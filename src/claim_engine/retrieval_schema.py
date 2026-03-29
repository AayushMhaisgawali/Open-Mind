from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl, model_validator


class RetrievedDocument(BaseModel):
    title: str = Field(min_length=1)
    url: HttpUrl
    snippet: str = ""
    source: str = Field(min_length=1)
    query_used: str = Field(min_length=1)
    rank: int = Field(ge=1)
    provider_rank: int = Field(ge=1)
    retrieval_score: float = Field(ge=0.0, le=1.0, default=0.5)


class RetrievalResult(BaseModel):
    provider: str = Field(min_length=1)
    query_bundle: list[str] = Field(min_length=1)
    documents: list[RetrievedDocument] = Field(default_factory=list)
    succeeded_queries: list[str] = Field(default_factory=list)
    failed_queries: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def dedupe_documents(self) -> "RetrievalResult":
        deduped: list[RetrievedDocument] = []
        seen: set[str] = set()
        for document in self.documents:
            key = self._normalize_url(str(document.url))
            if key not in seen:
                seen.add(key)
                deduped.append(document)
        self.documents = deduped
        self.query_bundle = self._dedupe_strings(self.query_bundle)
        self.succeeded_queries = self._dedupe_strings(self.succeeded_queries)
        self.failed_queries = self._dedupe_strings(self.failed_queries)
        self.warnings = self._dedupe_strings(self.warnings)
        return self

    @staticmethod
    def _dedupe_strings(items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in items:
            compact = " ".join(item.split()).strip()
            if compact and compact not in cleaned:
                cleaned.append(compact)
        return cleaned

    @staticmethod
    def _normalize_url(url: str) -> str:
        lowered = url.rstrip("/").lower()
        for marker in ("?", "#"):
            if marker in lowered:
                lowered = lowered.split(marker, 1)[0]
        return lowered
