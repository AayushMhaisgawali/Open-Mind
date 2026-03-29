from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class ParsedDocument(BaseModel):
    title: str = Field(min_length=1)
    url: HttpUrl
    source: str = Field(min_length=1)
    snippet: str = ""
    query_used: str = Field(min_length=1)
    rank: int = Field(ge=1)
    clean_text: str = Field(min_length=1)
    text_length: int = Field(ge=1)
    extraction_method: str = Field(min_length=1)
    fetch_status: str = Field(min_length=1)
    quality_score: float = Field(ge=0.0, le=1.0, default=0.5)
    error: str | None = None


class ParsingResult(BaseModel):
    parsed_documents: list[ParsedDocument] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
