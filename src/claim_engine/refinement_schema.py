from __future__ import annotations

import re

from pydantic import BaseModel, Field, model_validator


FORBIDDEN_QUERY_PATTERNS = (
    "0.0.0.0",
    "replace with",
    "note:",
    "---",
    "edgar_cik",
    "snippet-fallbacks-only",
    "ignore-snippet-only-results",
    "exact_only",
    "allow-html",
    "keep-docs",
    "pdf-only-results-fallbacks-only",
    "snippet-only-results-fallbacks-only",
)

FORBIDDEN_QUERY_CHARS = {"{", "}", "[", "]"}
MAX_QUERY_WORDS = 18
MAX_QUERY_LENGTH = 140


class QueryRefinementPlan(BaseModel):
    rationale: str = Field(min_length=1)
    weaknesses: list[str] = Field(default_factory=list)
    authoritative_queries: list[str] = Field(default_factory=list, max_length=4)
    contradiction_queries: list[str] = Field(default_factory=list, max_length=4)
    domain_specific_queries: list[str] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def normalize_fields(self) -> "QueryRefinementPlan":
        self.weaknesses = self._dedupe_strings(self.weaknesses)
        self.authoritative_queries = self._sanitize_queries(self.authoritative_queries)[:4]
        self.contradiction_queries = self._sanitize_queries(self.contradiction_queries)[:4]
        self.domain_specific_queries = self._sanitize_queries(self.domain_specific_queries)[:4]
        return self

    def combined_queries(self, limit: int = 6) -> list[str]:
        merged = self._dedupe_strings(
            [
                *self.authoritative_queries,
                *self.contradiction_queries,
                *self.domain_specific_queries,
            ]
        )
        return merged[:limit]

    @staticmethod
    def _dedupe_strings(items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in items:
            compact = " ".join(item.split()).strip()
            if compact and compact not in cleaned:
                cleaned.append(compact)
        return cleaned

    @classmethod
    def _sanitize_queries(cls, items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in cls._dedupe_strings(items):
            normalized = cls._sanitize_query(item)
            if normalized and normalized not in cleaned:
                cleaned.append(normalized)
        return cleaned

    @classmethod
    def _sanitize_query(cls, query: str) -> str:
        candidate = " ".join(query.split()).strip().strip("\"'")
        candidate = re.sub(r"\s+", " ", candidate)

        lower = candidate.lower()
        if any(token in lower for token in FORBIDDEN_QUERY_PATTERNS):
            return ""
        if any(char in candidate for char in FORBIDDEN_QUERY_CHARS):
            return ""
        if len(candidate) > MAX_QUERY_LENGTH:
            return ""
        if len(candidate.split()) > MAX_QUERY_WORDS:
            return ""
        if "http://" in lower or "https://" in lower:
            return ""
        if "site:*" in lower:
            return ""

        candidate = re.sub(r"\s+(OR|AND)\s+", " ", candidate, flags=re.IGNORECASE)
        candidate = re.sub(r"\([^)]*\)", "", candidate)
        candidate = re.sub(r"\bfiletype:\w+\b", "", candidate, flags=re.IGNORECASE)
        candidate = re.sub(r"\s+", " ", candidate).strip(" -,:;")

        if not candidate:
            return ""
        if len(candidate) > MAX_QUERY_LENGTH:
            return ""
        if len(candidate.split()) > MAX_QUERY_WORDS:
            return ""
        return candidate
