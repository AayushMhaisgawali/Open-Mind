from __future__ import annotations

from claim_engine.evidence_schema import EvidenceAnalysisResult
from claim_engine.feature_schema import ClaimFeatureVector
from claim_engine.parser_schema import ParsingResult
from claim_engine.retrieval_schema import RetrievalResult
from claim_engine.schema import StructuredClaim

OFFICIAL_DOMAINS = (
    'nvidia.com',
    'blogs.nvidia.com',
    'www.nvidia.com',
    'ces.tech',
    'exhibitors.ces.tech',
    '.gov',
    '.edu',
    'reuters.com',
    'apnews.com',
)
LOW_SIGNAL_DOMAINS = (
    'linkedin.com',
    'youtube.com',
    'medium.com',
    'researchgate.net',
    '10times.com',
)
FALLBACK_METHODS = {'snippet_fallback', 'fallback_from_html'}


class ClaimFeatureAggregator:
    def build(
        self,
        claim: StructuredClaim,
        retrieval: RetrievalResult,
        parsing: ParsingResult,
        evidence: EvidenceAnalysisResult,
    ) -> ClaimFeatureVector:
        assessments = evidence.assessments
        total = len(assessments)

        quality_scores = [item.quality_score for item in assessments]
        relevance_scores = [item.relevance_score for item in assessments]
        confidence_scores = [item.confidence_score for item in assessments]

        support_items = [item for item in assessments if item.label == 'support']
        contradict_items = [item for item in assessments if item.label == 'contradict']
        neutral_items = [item for item in assessments if item.label == 'neutral']

        unique_sources = {item.source.lower() for item in assessments}
        official_source_count = sum(1 for source in unique_sources if self._is_official_source(source))
        low_signal_source_count = sum(1 for source in unique_sources if self._is_low_signal_source(source))

        parsed_documents = parsing.parsed_documents
        full_page_count = sum(1 for doc in parsed_documents if doc.extraction_method == 'full_page')
        fallback_count = sum(1 for doc in parsed_documents if doc.extraction_method in FALLBACK_METHODS)
        failed_fetch_count = sum(1 for doc in parsed_documents if doc.fetch_status == 'failed')
        partial_fetch_count = sum(1 for doc in parsed_documents if doc.fetch_status == 'partial')

        all_warnings = list(retrieval.warnings) + list(parsing.warnings) + list(evidence.warnings)

        vector = ClaimFeatureVector(
            support_count=len(support_items),
            contradict_count=len(contradict_items),
            neutral_count=len(neutral_items),
            total_assessments=total,
            support_ratio=self._ratio(len(support_items), total),
            contradict_ratio=self._ratio(len(contradict_items), total),
            neutral_ratio=self._ratio(len(neutral_items), total),
            avg_quality_score=self._average(quality_scores),
            max_quality_score=max(quality_scores, default=0.0),
            avg_relevance_score=self._average(relevance_scores),
            avg_confidence_score=self._average(confidence_scores),
            weighted_support_score=self._weighted_score(support_items),
            weighted_contradict_score=self._weighted_score(contradict_items),
            weighted_neutral_score=self._weighted_score(neutral_items),
            support_minus_contradict=round(self._weighted_score(support_items) - self._weighted_score(contradict_items), 4),
            unique_source_count=len(unique_sources),
            official_source_count=official_source_count,
            low_signal_source_count=low_signal_source_count,
            full_page_count=full_page_count,
            fallback_count=fallback_count,
            failed_fetch_count=failed_fetch_count,
            partial_fetch_count=partial_fetch_count,
            retrieval_document_count=len(retrieval.documents),
            parsed_document_count=len(parsed_documents),
            succeeded_query_count=len(retrieval.succeeded_queries),
            failed_query_count=len(retrieval.failed_queries),
            warning_count=len(all_warnings),
            ambiguity_count=len(claim.ambiguities),
            needs_clarification=1 if claim.needs_clarification else 0,
        )
        return vector

    @staticmethod
    def _ratio(value: int, total: int) -> float:
        if total <= 0:
            return 0.0
        return round(value / total, 4)

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return round(sum(values) / len(values), 4)

    @staticmethod
    def _weighted_score(items: list) -> float:
        if not items:
            return 0.0
        total = sum(item.quality_score * item.relevance_score * item.confidence_score for item in items)
        return round(total, 4)

    @staticmethod
    def _is_official_source(source: str) -> bool:
        lowered = source.lower()
        return any(marker in lowered for marker in OFFICIAL_DOMAINS)

    @staticmethod
    def _is_low_signal_source(source: str) -> bool:
        lowered = source.lower()
        return any(marker in lowered for marker in LOW_SIGNAL_DOMAINS)
