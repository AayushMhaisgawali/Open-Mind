from __future__ import annotations

import inspect
import json
import os
import re
from pathlib import Path

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:  # pragma: no cover - depends on local environment
    torch = None
    AutoModelForSequenceClassification = None
    AutoTokenizer = None
    TRANSFORMERS_AVAILABLE = False

WORD_NUMBER_MAP = {
    'zero': '0',
    'one': '1',
    'two': '2',
    'three': '3',
    'four': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8',
    'nine': '9',
    'ten': '10',
    'eleven': '11',
    'twelve': '12',
    'thirteen': '13',
    'fourteen': '14',
    'fifteen': '15',
    'sixteen': '16',
    'seventeen': '17',
    'eighteen': '18',
    'nineteen': '19',
    'twenty': '20',
}
NUMBER_PATTERN = re.compile(r'\b\d{1,4}\b')
WORD_NUMBER_PATTERN = re.compile(r'\b(' + '|'.join(sorted(WORD_NUMBER_MAP, key=len, reverse=True)) + r')\b', re.IGNORECASE)
NUMBER_TOKEN_REGEX = r'(?:\d{1,4}|' + '|'.join(sorted(WORD_NUMBER_MAP, key=len, reverse=True)) + r')'
STOPWORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'of', 'to', 'that', 'it', 'this', 'did', 'does', 'do',
    'had', 'has', 'have', 'and', 'or', 'for', 'with', 'at', 'by', 'from', 'into', 'whether',
}
FACT_TERMS = ('age', 'aged', 'year', 'years', 'heart', 'hearts', 'born', 'died', 'became', 'king', 'founded', 'released', 'launched')


class EvidenceClassifier:
    """Local evidence classifier backed by the saved Hugging Face model."""

    def __init__(self, model_path: str | None = None) -> None:
        project_root = Path(__file__).resolve().parents[2]
        default_model_path = project_root / 'evidence_classifier_model'
        self.model_path = Path(model_path or os.getenv('EVIDENCE_MODEL_PATH') or default_model_path)
        self.loaded = False
        self.tokenizer = None
        self.model = None
        self.config: dict[str, object] = {}
        self.device = torch.device('cuda' if torch and torch.cuda.is_available() else 'cpu') if torch else None
        self._try_load()

    def _try_load(self) -> None:
        if not TRANSFORMERS_AVAILABLE or not self.model_path.exists():
            return
        try:
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_path), fix_mistral_regex=True)
            except TypeError:
                self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_path))
            self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_path))
            self.model = self.model.to(self.device)
            self.model.eval()
            config_path = self.model_path / 'label_config.json'
            if config_path.exists():
                self.config = json.loads(config_path.read_text(encoding='utf-8'))
            self.loaded = True
        except Exception:
            self.loaded = False
            self.tokenizer = None
            self.model = None
            self.config = {}

    def classify(self, claim: str, document_text: str) -> dict[str, object]:
        if self.loaded:
            try:
                result = self._ml_classify(claim, document_text)
                return self._apply_fact_consistency_overrides(claim, document_text, result)
            except Exception:
                pass
        return self._apply_fact_consistency_overrides(claim, document_text, self._heuristic_classify(claim, document_text))

    def _ml_classify(self, claim: str, document_text: str) -> dict[str, object]:
        max_length = int(self.config.get('max_length', 320)) if self.config else 320
        inputs = self.tokenizer(
            claim,
            document_text[:1000],
            max_length=max_length,
            truncation=True,
            padding='max_length',
            return_tensors='pt',
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}
        with torch.no_grad():
            logits = self.model(**inputs).logits
        probs = torch.softmax(logits, dim=1)[0].detach().cpu()
        id2label = self.config.get('id2label') or {'0': 'support', '1': 'contradict', '2': 'neutral'}
        pred_id = int(probs.argmax().item())
        label = id2label[str(pred_id)]
        confidence = float(probs[pred_id].item())
        probabilities = {
            id2label[str(i)]: round(float(probs[i].item()), 4)
            for i in range(len(probs))
        }
        return {
            'label': label,
            'confidence_score': round(confidence, 4),
            'probabilities': probabilities,
            'analysis_method': 'model',
            'reasoning': self._template_reasoning(label, confidence),
            'evidence_excerpt': self._extract_excerpt(document_text),
        }

    def _heuristic_classify(self, claim: str, document_text: str) -> dict[str, object]:
        claim_words = set(claim.lower().split()) - STOPWORDS
        doc_lower = document_text.lower()
        overlap = sum(1 for word in claim_words if word in doc_lower) / max(len(claim_words), 1)
        contradiction_signals = ['not', 'never', 'false', 'incorrect', 'contrary', 'refutes', 'debunked']
        has_contradiction = any(signal in doc_lower for signal in contradiction_signals)

        if overlap > 0.4 and has_contradiction:
            label, confidence = 'contradict', 0.55
        elif overlap > 0.5:
            label, confidence = 'support', 0.55
        elif overlap > 0.2:
            label, confidence = 'neutral', 0.60
        else:
            label, confidence = 'neutral', 0.50

        return {
            'label': label,
            'confidence_score': confidence,
            'probabilities': {'support': 0.33, 'contradict': 0.33, 'neutral': 0.34},
            'analysis_method': 'heuristic',
            'reasoning': f'Heuristic classification based on keyword overlap ({overlap:.2f}).',
            'evidence_excerpt': self._extract_excerpt(document_text),
        }

    def _apply_fact_consistency_overrides(self, claim: str, document_text: str, result: dict[str, object]) -> dict[str, object]:
        claim_numbers = set(self._extract_numbers(claim))
        doc_numbers = set(self._extract_numbers(document_text))
        if not claim_numbers or not doc_numbers:
            return result

        shared_context = set(self._significant_tokens(claim)).intersection(self._significant_tokens(document_text))
        count_noun = self._extract_count_noun(claim)
        if not shared_context and not count_noun:
            return result

        if count_noun:
            claim_count = self._extract_count_values(claim, count_noun, direct_only=True)
            doc_direct_counts = self._extract_count_values(document_text, count_noun, direct_only=True)
            doc_any_counts = self._extract_count_values(document_text, count_noun, direct_only=False)
            if claim_count and doc_direct_counts:
                if set(claim_count).intersection(doc_direct_counts):
                    if result.get('label') == 'neutral':
                        updated = dict(result)
                        updated['label'] = 'support'
                        updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.72)
                        updated['reasoning'] = 'Rule-based fact check found a matching count for the main noun phrase.'
                        updated['probabilities'] = {'support': 0.72, 'contradict': 0.10, 'neutral': 0.18}
                        return updated
                    return result
                if result.get('label') != 'contradict':
                    updated = dict(result)
                    updated['label'] = 'contradict'
                    updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.9)
                    updated['reasoning'] = 'Rule-based fact check found a conflicting count for the main noun phrase.'
                    updated['evidence_excerpt'] = self._extract_best_fact_excerpt(document_text)
                    updated['probabilities'] = {'support': 0.03, 'contradict': 0.90, 'neutral': 0.07}
                    return updated
            elif claim_count and doc_any_counts and not set(claim_count).intersection(doc_any_counts) and result.get('label') != 'contradict':
                updated = dict(result)
                updated['label'] = 'contradict'
                updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.86)
                updated['reasoning'] = 'Rule-based fact check found conflicting count evidence in relevant context.'
                updated['evidence_excerpt'] = self._extract_best_fact_excerpt(document_text)
                updated['probabilities'] = {'support': 0.04, 'contradict': 0.86, 'neutral': 0.10}
                return updated

        if claim_numbers.intersection(doc_numbers):
            if result.get('label') == 'neutral':
                updated = dict(result)
                updated['label'] = 'support'
                updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.72)
                updated['reasoning'] = 'Rule-based fact check found matching numeric/count evidence in relevant context.'
                updated['probabilities'] = {'support': 0.72, 'contradict': 0.10, 'neutral': 0.18}
                return updated
            return result

        if self._has_fact_context(claim, document_text) and result.get('label') != 'contradict':
            updated = dict(result)
            updated['label'] = 'contradict'
            updated['confidence_score'] = max(float(result.get('confidence_score', 0.0)), 0.88)
            updated['reasoning'] = 'Rule-based fact check found conflicting numeric/count evidence in relevant context.'
            updated['evidence_excerpt'] = self._extract_best_fact_excerpt(document_text)
            updated['probabilities'] = {'support': 0.04, 'contradict': 0.88, 'neutral': 0.08}
            return updated

        return result

    @staticmethod
    def _template_reasoning(label: str, confidence: float) -> str:
        pct = int(confidence * 100)
        templates = {
            'support': f'ML classifier determined this document supports the claim ({pct}% confidence).',
            'contradict': f'ML classifier determined this document contradicts the claim ({pct}% confidence).',
            'neutral': f'ML classifier determined this document is neutral toward the claim ({pct}% confidence).',
        }
        return templates.get(label, 'Classification performed by ML model.')

    @staticmethod
    def _extract_excerpt(text: str, max_chars: int = 200) -> str:
        sentences = text.replace('\n', ' ').split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 30:
                return sentence[:max_chars] + ('...' if len(sentence) > max_chars else '')
        compact = ' '.join(text.split()).strip()
        return compact[:max_chars]

    def _extract_best_fact_excerpt(self, text: str, max_chars: int = 220) -> str:
        sentences = re.split(r'(?<=[.!?])\s+', text.replace('\n', ' '))
        scored: list[tuple[int, str]] = []
        for sentence in sentences:
            lowered = sentence.lower().strip()
            if len(lowered) < 20:
                continue
            score = len(self._extract_numbers(lowered))
            score += sum(1 for term in FACT_TERMS if term in lowered)
            if score:
                scored.append((score, sentence.strip()))
        if scored:
            best = max(scored, key=lambda item: (item[0], len(item[1])))[1]
            return best[:max_chars] + ('...' if len(best) > max_chars else '')
        return self._extract_excerpt(text, max_chars=max_chars)


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

    @staticmethod
    def _extract_numbers(text: str) -> list[str]:
        compact = text or ''
        numbers = NUMBER_PATTERN.findall(compact)
        for match in WORD_NUMBER_PATTERN.findall(compact.lower()):
            numbers.append(WORD_NUMBER_MAP[match.lower()])
        return numbers

    @staticmethod
    def _significant_tokens(text: str) -> list[str]:
        tokens = []
        for token in re.findall(r'[a-zA-Z0-9:+.-]{3,}', (text or '').lower()):
            if token not in STOPWORDS and token not in WORD_NUMBER_MAP and token not in tokens:
                tokens.append(token)
        return tokens[:20]

    @staticmethod
    def _has_fact_context(claim: str, document_text: str) -> bool:
        lowered = f'{claim} {document_text}'.lower()
        return any(term in lowered for term in FACT_TERMS)
