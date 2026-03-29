from __future__ import annotations

import re
import time
from collections.abc import Callable
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from claim_engine.parser_schema import ParsedDocument, ParsingResult
from claim_engine.retrieval_schema import RetrievedDocument, RetrievalResult


class ParsingError(RuntimeError):
    """Raised when page parsing could not be completed safely."""


class ContentExtractionAgent:
    NOISE_PATTERNS = (
        "share this",
        "sign in",
        "privacy policy",
        "terms of service",
        "all rights reserved",
        "follow us",
        "cookie",
        "subscribe",
        "advertisement",
        "related articles",
        "read more",
        "view all",
    )
    LOW_SIGNAL_DOMAINS = {"linkedin.com", "medium.com", "youtube.com", "researchgate.net"}
    PDF_BINARY_MARKERS = (
        "startxref",
        "%%eof",
        "endstream",
        "endobj",
        "/type/catalog",
        "/pages",
        "/metadata",
        "obj <",
    )

    def __init__(
        self,
        timeout_seconds: float = 20.0,
        min_text_length: int = 200,
        max_retries: int = 2,
        max_text_length: int = 12000,
        event_callback: Callable[[dict[str, object]], None] | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.min_text_length = min_text_length
        self.max_retries = max_retries
        self.max_text_length = max_text_length
        self.event_callback = event_callback
        self.current_pass_index = 1
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        }

    def parse(self, retrieval_result: RetrievalResult) -> ParsingResult:
        parsed_documents: list[ParsedDocument] = []
        warnings: list[str] = list(retrieval_result.warnings)
        for document in retrieval_result.documents:
            self._emit(
                "parse_document_started",
                title=document.title,
                url=str(document.url),
                source=document.source,
            )
            parsed_document = self._parse_document(document)
            if parsed_document.extraction_method == "snippet_fallback":
                warnings.append(f"Used snippet fallback for {document.source}")
            if parsed_document.error and "PDF/binary-like" in parsed_document.error:
                warnings.append(f"Filtered PDF/binary parse noise for {document.source}")
            parsed_documents.append(parsed_document)
            self._emit(
                "parse_document_completed",
                title=document.title,
                url=str(document.url),
                source=document.source,
                extraction_method=parsed_document.extraction_method,
                fetch_status=parsed_document.fetch_status,
                preview=self._preview_text(parsed_document.clean_text),
                quality_score=parsed_document.quality_score,
            )
        return ParsingResult(parsed_documents=parsed_documents, warnings=self._dedupe_strings(warnings))

    def _parse_document(self, document: RetrievedDocument) -> ParsedDocument:
        try:
            html = self._fetch_html(str(document.url))
            if self._looks_like_binary_pdf_dump(html):
                raise ParsingError("PDF/binary-like response detected; using safe snippet fallback.")

            soup = BeautifulSoup(html, "html.parser")

            for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside", "form"]):
                tag.decompose()

            text = self._extract_clean_text(soup, document)
            if self._looks_like_binary_pdf_dump(text):
                raise ParsingError("PDF/binary-like extraction detected; using safe snippet fallback.")

            if len(text) < self.min_text_length:
                text = self._fallback_text(soup, document)
                method = "fallback_from_html"
            else:
                method = "full_page"

            if len(text) < max(80, len(document.snippet)):
                text = self._snippet_fallback(document)
                method = "snippet_fallback"
                fetch_status = "partial"
            else:
                fetch_status = "success"

            quality_score = self._quality_score(document, text, method)

            return ParsedDocument(
                title=document.title,
                url=document.url,
                source=document.source,
                snippet=document.snippet,
                query_used=document.query_used,
                rank=document.rank,
                clean_text=text,
                text_length=len(text),
                extraction_method=method,
                fetch_status=fetch_status,
                quality_score=quality_score,
                error=None,
            )
        except ParsingError as exc:
            text = self._snippet_fallback(document)
            return ParsedDocument(
                title=document.title,
                url=document.url,
                source=document.source,
                snippet=document.snippet,
                query_used=document.query_used,
                rank=document.rank,
                clean_text=text,
                text_length=len(text),
                extraction_method="snippet_fallback",
                fetch_status="failed",
                quality_score=self._quality_score(document, text, "snippet_fallback"),
                error=str(exc),
            )

    def _fetch_html(self, url: str) -> str:
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 2):
            try:
                with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True, headers=self.headers) as client:
                    response = client.get(url)
                    response.raise_for_status()
                    content_type = (response.headers.get("content-type") or "").lower()
                    if "application/pdf" in content_type:
                        raise ParsingError("PDF content detected; using safe snippet fallback.")
                    return response.text
            except ParsingError:
                raise
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt <= self.max_retries:
                    time.sleep(0.6 * attempt)
                continue

        raise ParsingError(
            "Could not fetch page content. Check network access, firewall rules, site blocking, or sandbox restrictions."
        ) from last_error

    def _extract_clean_text(self, soup: BeautifulSoup, document: RetrievedDocument) -> str:
        candidates = []

        article = soup.find("article")
        if article is not None:
            candidates.append(article.get_text(" ", strip=True))

        main = soup.find("main")
        if main is not None:
            candidates.append(main.get_text(" ", strip=True))

        paragraphs = " ".join(node.get_text(" ", strip=True) for node in soup.find_all("p"))
        if paragraphs:
            candidates.append(paragraphs)

        if not candidates:
            candidates.append(soup.get_text(" ", strip=True))

        best = max(candidates, key=self._candidate_score)
        if self._domain_from_url(str(document.url)) in self.LOW_SIGNAL_DOMAINS and len(best) > 3000:
            best = best[:3000]
        return self._normalize_text(best)

    def _fallback_text(self, soup: BeautifulSoup, document: RetrievedDocument) -> str:
        title = soup.title.get_text(" ", strip=True) if soup.title else document.title
        combined = f"{title}. {document.snippet}".strip()
        return self._normalize_text(combined)

    def _snippet_fallback(self, document: RetrievedDocument) -> str:
        combined = f"{document.title}. {document.snippet}".strip()
        text = self._normalize_text(combined)
        return text if text else document.title

    def _normalize_text(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        parts = re.split(r"(?<=[.!?])\s+", text)
        cleaned_parts: list[str] = []
        seen: set[str] = set()
        for part in parts:
            compact = part.strip()
            lowered = compact.lower()
            if len(compact) < 25:
                continue
            if any(pattern in lowered for pattern in self.NOISE_PATTERNS):
                continue
            if lowered in seen:
                continue
            seen.add(lowered)
            cleaned_parts.append(compact)
        normalized = " ".join(cleaned_parts) if cleaned_parts else text
        normalized = re.sub(r"\s+", " ", normalized).strip()
        if len(normalized) > self.max_text_length:
            normalized = normalized[: self.max_text_length].rsplit(" ", 1)[0].rstrip(".,;: ") + "..."
        return normalized

    def _candidate_score(self, text: str) -> tuple[int, int]:
        lowered = text.lower()
        penalty = sum(1 for pattern in self.NOISE_PATTERNS if pattern in lowered)
        paragraph_like = text.count(". ") + text.count("! ") + text.count("? ")
        return (paragraph_like - penalty, len(text))

    def _quality_score(self, document: RetrievedDocument, text: str, method: str) -> float:
        score = document.retrieval_score
        if method == "full_page":
            score += 0.15
        elif method == "fallback_from_html":
            score -= 0.05
        else:
            score -= 0.2
        if len(text) >= 1000:
            score += 0.08
        elif len(text) < 250:
            score -= 0.12
        if self._domain_from_url(str(document.url)) in self.LOW_SIGNAL_DOMAINS:
            score -= 0.12
        return max(0.0, min(1.0, round(score, 3)))

    def _looks_like_binary_pdf_dump(self, text: str) -> bool:
        lowered = (text or "").lower()
        if not lowered:
            return False
        marker_hits = sum(1 for marker in self.PDF_BINARY_MARKERS if marker in lowered)
        high_ascii = sum(1 for ch in text if ord(ch) > 127)
        replacement_chars = text.count("\ufffd")
        if marker_hits >= 2:
            return True
        if replacement_chars >= 8:
            return True
        if len(text) > 400 and high_ascii / max(len(text), 1) > 0.18:
            return True
        return False

    @staticmethod
    def _domain_from_url(url: str) -> str:
        try:
            return (urlparse(url).netloc or "").lower()
        except ValueError:
            return ""

    @staticmethod
    def _dedupe_strings(items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in items:
            compact = " ".join(item.split()).strip()
            if compact and compact not in cleaned:
                cleaned.append(compact)
        return cleaned

    @staticmethod
    def _preview_text(text: str, limit: int = 220) -> str:
        compact = " ".join((text or "").split()).strip()
        if len(compact) <= limit:
            return compact
        return compact[:limit].rsplit(" ", 1)[0].rstrip(".,;: ") + "..."

    def _emit(self, event_type: str, **payload: object) -> None:
        if self.event_callback is None:
            return
        event = {"type": event_type, "pass_index": self.current_pass_index}
        event.update(payload)
        self.event_callback(event)
