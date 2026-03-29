from __future__ import annotations

from pydantic import BaseModel, Field


class ClaimFeatureVector(BaseModel):
    support_count: int = Field(ge=0, default=0)
    contradict_count: int = Field(ge=0, default=0)
    neutral_count: int = Field(ge=0, default=0)
    total_assessments: int = Field(ge=0, default=0)

    support_ratio: float = Field(ge=0.0, le=1.0, default=0.0)
    contradict_ratio: float = Field(ge=0.0, le=1.0, default=0.0)
    neutral_ratio: float = Field(ge=0.0, le=1.0, default=0.0)

    avg_quality_score: float = Field(ge=0.0, le=1.0, default=0.0)
    max_quality_score: float = Field(ge=0.0, le=1.0, default=0.0)
    avg_relevance_score: float = Field(ge=0.0, le=1.0, default=0.0)
    avg_confidence_score: float = Field(ge=0.0, le=1.0, default=0.0)

    weighted_support_score: float = Field(ge=0.0, default=0.0)
    weighted_contradict_score: float = Field(ge=0.0, default=0.0)
    weighted_neutral_score: float = Field(ge=0.0, default=0.0)
    support_minus_contradict: float = Field(default=0.0)

    unique_source_count: int = Field(ge=0, default=0)
    official_source_count: int = Field(ge=0, default=0)
    low_signal_source_count: int = Field(ge=0, default=0)

    full_page_count: int = Field(ge=0, default=0)
    fallback_count: int = Field(ge=0, default=0)
    failed_fetch_count: int = Field(ge=0, default=0)
    partial_fetch_count: int = Field(ge=0, default=0)

    retrieval_document_count: int = Field(ge=0, default=0)
    parsed_document_count: int = Field(ge=0, default=0)
    succeeded_query_count: int = Field(ge=0, default=0)
    failed_query_count: int = Field(ge=0, default=0)
    warning_count: int = Field(ge=0, default=0)

    ambiguity_count: int = Field(ge=0, default=0)
    needs_clarification: int = Field(ge=0, le=1, default=0)

    def as_ordered_vector(self) -> list[float]:
        return [
            float(self.support_count),
            float(self.contradict_count),
            float(self.neutral_count),
            float(self.total_assessments),
            self.support_ratio,
            self.contradict_ratio,
            self.neutral_ratio,
            self.avg_quality_score,
            self.max_quality_score,
            self.avg_relevance_score,
            self.avg_confidence_score,
            self.weighted_support_score,
            self.weighted_contradict_score,
            self.weighted_neutral_score,
            self.support_minus_contradict,
            float(self.unique_source_count),
            float(self.official_source_count),
            float(self.low_signal_source_count),
            float(self.full_page_count),
            float(self.fallback_count),
            float(self.failed_fetch_count),
            float(self.partial_fetch_count),
            float(self.retrieval_document_count),
            float(self.parsed_document_count),
            float(self.succeeded_query_count),
            float(self.failed_query_count),
            float(self.warning_count),
            float(self.ambiguity_count),
            float(self.needs_clarification),
        ]
