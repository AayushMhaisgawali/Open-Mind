from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


EvidenceLabel = Literal["support", "contradict", "neutral"]
AnalysisMethod = Literal["model", "heuristic"]


class EvidenceJudgment(BaseModel):
    label: EvidenceLabel
    reasoning: str = Field(min_length=1)
    evidence_excerpt: str = Field(min_length=1)
    relevance_score: float = Field(ge=0.0, le=1.0)
    confidence_score: float = Field(ge=0.0, le=1.0)


class EvidenceAssessment(BaseModel):
    title: str = Field(min_length=1)
    url: HttpUrl
    source: str = Field(min_length=1)
    label: EvidenceLabel
    reasoning: str = Field(min_length=1)
    evidence_excerpt: str = Field(min_length=1)
    relevance_score: float = Field(ge=0.0, le=1.0)
    confidence_score: float = Field(ge=0.0, le=1.0)
    quality_score: float = Field(ge=0.0, le=1.0)
    extraction_method: str = Field(min_length=1)
    fetch_status: str = Field(min_length=1)
    analysis_method: AnalysisMethod


class EvidenceAnalysisResult(BaseModel):
    claim: str = Field(min_length=1)
    assessments: list[EvidenceAssessment] = Field(default_factory=list)
    support_count: int = Field(ge=0, default=0)
    contradict_count: int = Field(ge=0, default=0)
    neutral_count: int = Field(ge=0, default=0)
    model_assessment_count: int = Field(ge=0, default=0)
    heuristic_assessment_count: int = Field(ge=0, default=0)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def populate_counts(self) -> "EvidenceAnalysisResult":
        self.support_count = sum(1 for item in self.assessments if item.label == "support")
        self.contradict_count = sum(1 for item in self.assessments if item.label == "contradict")
        self.neutral_count = sum(1 for item in self.assessments if item.label == "neutral")
        self.model_assessment_count = sum(1 for item in self.assessments if item.analysis_method == "model")
        self.heuristic_assessment_count = sum(1 for item in self.assessments if item.analysis_method == "heuristic")
        deduped_warnings: list[str] = []
        for warning in self.warnings:
            compact = " ".join(warning.split()).strip()
            if compact and compact not in deduped_warnings:
                deduped_warnings.append(compact)
        self.warnings = deduped_warnings
        return self
