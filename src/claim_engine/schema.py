from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


QuestionType = Literal["what", "when", "where", "who", "which", "how", "why", "whether", "unknown"]
ClaimType = Literal[
    "general_fact",
    "biographical_fact",
    "funding_event",
    "acquisition_event",
    "product_launch",
    "legal_regulatory",
    "financial_performance",
    "scientific_claim",
    "medical_claim",
    "policy_claim",
    "causal_claim",
    "market_claim",
]


class StructuredClaim(BaseModel):
    original_query: str = Field(min_length=1)
    question_type: QuestionType
    normalized_claim: str = Field(min_length=1)
    claim_type: ClaimType
    subject: str = Field(min_length=1)
    predicate: str = Field(min_length=1)
    object: str = ""
    time: str | None = None
    location: str | None = None
    entities: list[str] = Field(default_factory=list)
    search_queries: list[str] = Field(default_factory=list, min_length=2, max_length=6)
    decision_context: str = ""
    ambiguities: list[str] = Field(default_factory=list)
    needs_clarification: bool = False

    @model_validator(mode="after")
    def normalize_fields(self) -> "StructuredClaim":
        self.original_query = " ".join(self.original_query.split())
        self.normalized_claim = self.normalized_claim.strip().rstrip("?")
        self.subject = self.subject.strip()
        self.predicate = self.predicate.strip()
        self.object = self.object.strip()
        self.time = self.time.strip() if self.time else None
        self.location = self.location.strip() if self.location else None

        self.entities = self._dedupe_strings(self.entities)
        self.search_queries = self._dedupe_strings(self.search_queries)[:6]
        self.ambiguities = self._dedupe_strings(self.ambiguities)

        if self.ambiguities and not self.needs_clarification:
            self.needs_clarification = True

        return self

    @staticmethod
    def _dedupe_strings(items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in items:
            compact = " ".join(item.split()).strip()
            if compact and compact not in cleaned:
                cleaned.append(compact)
        return cleaned
