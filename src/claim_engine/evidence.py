from __future__ import annotations

import re
from collections.abc import Callable

from claim_engine.evidence_classifier import EvidenceClassifier
from claim_engine.evidence_schema import EvidenceAnalysisResult, EvidenceAssessment, EvidenceJudgment
from claim_engine.parser_schema import ParsedDocument, ParsingResult
from claim_engine.schema import StructuredClaim

STOPWORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'had', 'has', 'have', 'in', 'is', 'it', 'of',
    'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was', 'were', 'will', 'with', 'did', 'does', 'do', 'why',
    'when', 'where', 'who', 'which', 'how', 'whether', 'into', 'about', 'than', 'then', 'them', 'his', 'her', 'its',
}
NEGATION_PATTERNS = (
    ' did not ', " didn't ", ' does not ', " doesn't ", ' was not ', " wasn't ", ' were not ', " weren't ", ' has not ',
    " hasn't ", ' have not ', " haven't ", ' never ', ' no evidence ', ' false ', ' denied ', ' debunked ', ' not attend ',
    ' not at ces ', ' not acquire ', ' cancelled ', ' canceled ',
)
NUMBER_PATTERN = re.compile(r'\b\d{1,4}\b')
WORD_NUMBER_MAP = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11',
    'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15', 'sixteen': '16',
    'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
}
WORD_NUMBER_PATTERN = re.compile(r'\b(' + '|'.join(sorted(WORD_NUMBER_MAP, key=len, reverse=True)) + r')\b', re.IGNORECASE)
NUMBER_TOKEN_REGEX = r'(?:\d{1,4}|' + '|'.join(sorted(WORD_NUMBER_MAP, key=len, reverse=True)) + r')'
FACT_PATTERNS = (
    'age', 'aged', 'born', 'died', 'became', 'become', 'succeeded', 'succeed', 'ascended', 'ascension',
    'founded', 'founded in', 'released', 'launched', 'won', 'appointed', 'acquired', 'merged', 'announced',
)


class EvidenceAnalysisError(RuntimeError):
    """Raised when document-level evidence analysis could not be completed safely."""


class OpenAIEvidenceAnalyzer:
    """Backwards-compatible analyzer name, now using the local ML classifier."""

    def __init__(
        self,
        classifier: EvidenceClassifier | None = None,
        max_documents: int = 8,
        max_text_chars: int = 5000,
        min_quality_score: float = 0.25,
        event_callback: Callable[[dict[str, object]], None] | None = None,
    ) -> None:
        self.classifier = classifier or EvidenceClassifier()
        self.max_documents = max_documents
        self.max_text_chars = max_text_chars
        self.min_quality_score = min_quality_score
        self.event_callback = event_callback
        self.current_pass_index = 1

    def analyze(self, claim: StructuredClaim, parsing_result: ParsingResult) -> EvidenceAnalysisResult:
        warnings = list(parsing_result.warnings)
        prioritized_documents = self._prioritize_documents(parsing_result.parsed_documents)
        assessments: list[EvidenceAssessment] = []

        if not self.classifier.loaded:
            warnings.append('Evidence ML model unavailable; using heuristic fallback where needed.')

        for document in prioritized_documents:
            self._emit(
                "evidence_assessment_started",
                title=document.title,
                url=str(document.url),
                source=document.source,
            )
            assessment, warning = self._analyze_document(claim, document)
            if warning:
                warnings.append(warning)
            if assessment is not None:
                assessments.append(assessment)
                self._emit(
                    "evidence_assessment_completed",
                    title=assessment.title,
                    url=str(assessment.url),
                    source=assessment.source,
                    label=assessment.label,
                    reasoning=assessment.reasoning,
                    evidence_excerpt=assessment.evidence_excerpt,
                    confidence_score=assessment.confidence_score,
                    relevance_score=assessment.relevance_score,
                )

        if not assessments:
            raise EvidenceAnalysisError('No evidence assessments could be produced from the parsed documents.')

        if all(item.analysis_method == 'heuristic' for item in assessments):
            warnings.append('All document judgments used heuristic fallback; treat this pass as lower confidence.')

        return EvidenceAnalysisResult(
            claim=claim.normalized_claim,
            assessments=assessments,
            warnings=warnings,
        )

    def _prioritize_documents(self, documents: list[ParsedDocument]) -> list[ParsedDocument]:
        prioritized = sorted(documents, key=lambda doc: (doc.quality_score, doc.text_length), reverse=True)
        selected: list[ParsedDocument] = []
        per_source_counts: dict[str, int] = {}

        for document in prioritized:
            if document.quality_score < self.min_quality_score:
                continue
            count = per_source_counts.get(document.source, 0)
            if count >= 2:
                continue
            selected.append(document)
            per_source_counts[document.source] = count + 1
            if len(selected) >= self.max_documents:
                break

        if selected:
            return selected
        return prioritized[: self.max_documents]

    def _analyze_document(self, claim: StructuredClaim, document: ParsedDocument) -> tuple[EvidenceAssessment | None, str | None]:
        truncated_text = self._truncate_text(document.clean_text)
        result = self.classifier.classify(claim.normalized_claim, truncated_text)
        result = self._apply_fact_consistency_overrides(claim, truncated_text, result)
        analysis_method = str(result.get('analysis_method', 'heuristic'))
        warning = None
        if analysis_method == 'heuristic':
            warning = f'ML model unavailable or failed for {document.source}; used heuristic fallback.'

        judgment = EvidenceJudgment(
            label=result['label'],
            reasoning=result['reasoning'],
            evidence_excerpt=result.get('evidence_excerpt') or self._best_excerpt(document.clean_text, self._claim_terms(claim)),
            relevance_score=self._relevance_score(claim, document, result),
            confidence_score=float(result['confidence_score']),
        )
        assessment = self._compose_assessment(judgment, document, analysis_method)
        return assessment, warning

    def _apply_fact_consistency_overrides(
        self,
        claim: StructuredClaim,
        document_text: str,
        result: dict[str, object],
    ) -> dict[str, object]:
        claim_numbers = self._extract_numbers(claim.normalized_claim)
        if not claim_numbers:
            return result

        candidates = self._candidate_fact_sentences(claim, document_text)
        if not candidates:
            return result

        matching_sentences: list[str] = []
        conflicting_sentences: list[str] = []
        for sentence in candidates:
            numbers = self._extract_numbers(sentence)
            if not numbers:
                continue
            if any(number in claim_numbers for number in numbers):
                matching_sentences.append(sentence)
            elif self._has_fact_pattern(sentence):
                conflicting_sentences.append(sentence)

        count_noun = self._extract_count_noun(claim.normalized_claim)
        if count_noun:
            claim_count = self._extract_count_values(claim.normalized_claim, count_noun, direct_only=True)
            candidate_text = ' '.join(candidates)
            doc_direct_counts = self._extract_count_values(candidate_text, count_noun, direct_only=True)
            doc_any_counts = self._extract_count_values(candidate_text, count_noun, direct_only=False)
            if claim_count and doc_direct_counts:
                if set(claim_count).intersection(doc_direct_counts):
                    best = max(matching_sentences or candidates, key=len)
                    if result.get('label') == 'neutral':
                        updated = dict(result)
                        updated['label'] = 'support'
                        updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.72)
                        updated['reasoning'] = 'Rule-based fact check found a matching count for the main noun phrase.'
                        updated['evidence_excerpt'] = self._trim_sentence(best, 320)
                        updated['probabilities'] = {'support': 0.72, 'contradict': 0.10, 'neutral': 0.18}
                        return updated
                    return result
                if result.get('label') != 'contradict':
                    best = max(candidates, key=len)
                    updated = dict(result)
                    updated['label'] = 'contradict'
                    updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.9)
                    updated['reasoning'] = 'Rule-based fact check found a conflicting count for the main noun phrase.'
                    updated['evidence_excerpt'] = self._trim_sentence(best, 320)
                    updated['probabilities'] = {'support': 0.03, 'contradict': 0.90, 'neutral': 0.07}
                    return updated
            elif claim_count and doc_any_counts and not set(claim_count).intersection(doc_any_counts) and result.get('label') != 'contradict':
                best = max(candidates, key=len)
                updated = dict(result)
                updated['label'] = 'contradict'
                updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.86)
                updated['reasoning'] = 'Rule-based fact check found conflicting count evidence in relevant context.'
                updated['evidence_excerpt'] = self._trim_sentence(best, 320)
                updated['probabilities'] = {'support': 0.04, 'contradict': 0.86, 'neutral': 0.10}
                return updated

        if matching_sentences:
            best = max(matching_sentences, key=len)
            if result.get('label') == 'neutral':
                updated = dict(result)
                updated['label'] = 'support'
                updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.72)
                updated['reasoning'] = 'Rule-based fact check found a sentence with matching claim numbers in relevant context.'
                updated['evidence_excerpt'] = self._trim_sentence(best, 320)
                updated['probabilities'] = {'support': 0.72, 'contradict': 0.10, 'neutral': 0.18}
                return updated
            return result

        if conflicting_sentences and result.get('label') != 'contradict':
            best = max(conflicting_sentences, key=len)
            updated = dict(result)
            updated['label'] = 'contradict'
            updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.84)
            updated['reasoning'] = 'Rule-based fact check found conflicting numeric/date evidence in a highly relevant sentence.'
            updated['evidence_excerpt'] = self._trim_sentence(best, 320)
            updated['probabilities'] = {'support': 0.05, 'contradict': 0.84, 'neutral': 0.11}
            return updated

        return result

    def _candidate_fact_sentences(self, claim: StructuredClaim, document_text: str) -> list[str]:
        subject_tokens = self._significant_tokens(claim.subject)
        claim_tokens = self._significant_tokens(claim.normalized_claim)
        predicate_tokens = self._significant_tokens(claim.predicate)
        object_tokens = self._significant_tokens(claim.object)
        context_tokens = set(subject_tokens + predicate_tokens + object_tokens)
        sentences = re.split(r'(?<=[.!?])\s+', self._compact_text(document_text))
        candidates: list[tuple[int, str]] = []

        for sentence in sentences:
            lowered = sentence.lower().strip()
            if len(lowered) < 30:
                continue
            score = 0
            if any(token in lowered for token in subject_tokens):
                score += 2
            score += sum(1 for token in context_tokens if token in lowered)
            score += sum(1 for token in claim_tokens if token in lowered)
            if self._has_fact_pattern(lowered):
                score += 2
            if NUMBER_PATTERN.search(lowered) or WORD_NUMBER_PATTERN.search(lowered):
                score += 1
            if score >= 3:
                candidates.append((score, sentence.strip()))

        candidates.sort(key=lambda item: (item[0], len(item[1])), reverse=True)
        return [sentence for _, sentence in candidates[:5]]

    def _relevance_score(self, claim: StructuredClaim, document: ParsedDocument, result: dict[str, object]) -> float:
        text = self._compact_text(document.clean_text).lower()
        claim_terms = self._claim_terms(claim)
        overlap_count = sum(1 for term in claim_terms if term in text)
        base = min(0.90, 0.12 + 0.10 * overlap_count + 0.35 * document.quality_score)
        probabilities = result.get('probabilities') or {}
        if isinstance(probabilities, dict):
            non_neutral = max(float(probabilities.get('support', 0.0)), float(probabilities.get('contradict', 0.0)))
            if result.get('label') == 'neutral':
                base = max(base, min(0.72, 0.18 + non_neutral * 0.65))
            else:
                base = max(base, min(0.94, 0.25 + non_neutral * 0.55))
        excerpt = str(result.get('evidence_excerpt') or '').lower()
        excerpt_tokens = self._significant_tokens(excerpt)
        claim_token_set = set(self._significant_tokens(claim.normalized_claim))
        lexical_overlap = len(claim_token_set.intersection(excerpt_tokens))
        if lexical_overlap <= 1:
            base = min(base, 0.72)
        if result.get('label') != 'neutral' and self._extract_numbers(claim.normalized_claim):
            claim_numbers = set(self._extract_numbers(claim.normalized_claim))
            excerpt_numbers = set(self._extract_numbers(excerpt))
            if excerpt_numbers and not claim_numbers.intersection(excerpt_numbers):
                base = min(base, 0.78)
        return max(0.0, min(1.0, round(base, 3)))

    def _compose_assessment(self, judgment: EvidenceJudgment, document: ParsedDocument, analysis_method: str) -> EvidenceAssessment:
        confidence_score = judgment.confidence_score
        if document.extraction_method == 'snippet_fallback':
            confidence_score = min(confidence_score, 0.68)
        if document.fetch_status == 'failed':
            confidence_score = min(confidence_score, 0.60)
        if document.fetch_status == 'partial':
            confidence_score = min(confidence_score, 0.72)
        if document.quality_score < 0.45 and judgment.label != 'neutral':
            confidence_score = min(confidence_score, 0.62)
        if analysis_method == 'heuristic':
            confidence_score = min(confidence_score, 0.70)

        return EvidenceAssessment(
            title=document.title,
            url=document.url,
            source=document.source,
            label=judgment.label,
            reasoning=self._trim_sentence(judgment.reasoning, 220),
            evidence_excerpt=self._trim_sentence(judgment.evidence_excerpt, 320),
            relevance_score=max(0.0, min(1.0, round(judgment.relevance_score, 3))),
            confidence_score=max(0.0, min(1.0, round(confidence_score, 3))),
            quality_score=document.quality_score,
            extraction_method=document.extraction_method,
            fetch_status=document.fetch_status,
            analysis_method=analysis_method,
        )

    def _emit(self, event_type: str, **payload: object) -> None:
        if self.event_callback is None:
            return
        event = {"type": event_type, "pass_index": self.current_pass_index}
        event.update(payload)
        self.event_callback(event)

    def _claim_terms(self, claim: StructuredClaim) -> list[str]:
        raw_terms = [claim.subject, claim.object, claim.predicate, claim.normalized_claim, *(claim.entities or [])]
        normalized_terms: list[str] = []
        for term in raw_terms:
            compact = self._compact_text(term)
            if not compact:
                continue
            lowered = compact.lower()
            if len(lowered) >= 4 and lowered not in normalized_terms:
                normalized_terms.append(lowered)
            for token in re.findall(r'[a-zA-Z0-9:+.-]{3,}', lowered):
                if token not in STOPWORDS and token not in normalized_terms:
                    normalized_terms.append(token)
        return normalized_terms[:20]

    def _best_excerpt(self, text: str, claim_terms: list[str], limit: int = 320) -> str:
        compact = self._compact_text(text)
        if not compact:
            return 'No reliable excerpt available.'

        sentences = re.split(r'(?<=[.!?])\s+', compact)
        scored: list[tuple[int, str]] = []
        for sentence in sentences:
            stripped = sentence.strip()
            if len(stripped) < 40:
                continue
            score = sum(1 for term in claim_terms if term in stripped.lower())
            if any(pattern.strip() in stripped.lower() for pattern in NEGATION_PATTERNS):
                score += 1
            scored.append((score, stripped))

        if scored:
            best = max(scored, key=lambda item: (item[0], len(item[1])))[1]
            return self._trim_sentence(best, limit)
        return self._trim_sentence(compact, limit)

    def _truncate_text(self, text: str) -> str:
        compact = self._compact_text(text)
        if len(compact) <= self.max_text_chars:
            return compact
        return compact[: self.max_text_chars].rsplit(' ', 1)[0].rstrip('.,;: ') + '...'

    @staticmethod
    def _compact_text(text: str | None) -> str:
        return ' '.join((text or '').split()).strip()

    @staticmethod
    def _trim_sentence(text: str, limit: int) -> str:
        compact = ' '.join(text.split()).strip()
        if len(compact) <= limit:
            return compact
        return compact[:limit].rsplit(' ', 1)[0].rstrip('.,;: ') + '...'

    @staticmethod
    def _extract_numbers(text: str) -> list[str]:
        compact = text or ''
        numbers = NUMBER_PATTERN.findall(compact)
        for match in WORD_NUMBER_PATTERN.findall(compact.lower()):
            numbers.append(WORD_NUMBER_MAP[match.lower()])
        return numbers

    @staticmethod
    def _extract_count_noun(text: str) -> str | None:
        match = re.search(r'\b(?:' + NUMBER_TOKEN_REGEX + r')\s+([a-z]{3,})s?\b', (text or '').lower())
        return match.group(1) if match else None

    @staticmethod
    def _extract_count_values(text: str, noun: str, *, direct_only: bool) -> set[str]:
        if not noun:
            return set()
        gap = r'\s+' if direct_only else r'\s+(?:[a-z]+\s+){0,2}?'
        pattern = re.compile(r'\b(' + NUMBER_TOKEN_REGEX + r')' + gap + re.escape(noun) + r's?\b', re.IGNORECASE)
        values = set()
        for match in pattern.findall(text or ''):
            lowered = match.lower()
            values.add(WORD_NUMBER_MAP.get(lowered, lowered))
        return values

    def _significant_tokens(self, text: str | None) -> list[str]:
        tokens = []
        for token in re.findall(r'[a-zA-Z0-9:+.-]{3,}', (text or '').lower()):
            if token not in STOPWORDS and token not in tokens:
                tokens.append(token)
        return tokens[:20]

    @staticmethod
    def _has_fact_pattern(text: str) -> bool:
        lowered = text.lower()
        return any(pattern in lowered for pattern in FACT_PATTERNS)
