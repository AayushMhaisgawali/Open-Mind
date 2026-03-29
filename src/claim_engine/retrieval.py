from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from claim_engine.retrieval_schema import RetrievedDocument, RetrievalResult
from claim_engine.schema import StructuredClaim
from claim_engine.settings import settings

BUSINESS_TECH_HIGH_TRUST = (
    '.gov', '.edu', 'sec.gov', 'investor.', 'ir.', 'newsroom.', 'blog.',
    'reuters.com', 'apnews.com', 'bbc.', 'bloomberg.com', 'wsj.com', 'ft.com',
    'techcrunch.com', 'theverge.com', 'arstechnica.com', 'crunchbase.com',
    'github.com', 'docs.', 'developer.', 'openai.com', 'nvidia.com', 'microsoft.com',
    'google.com', 'alphabet.com', 'apple.com', 'amazon.com', 'meta.com', 'tesla.com',
    'netflix.com', 'intel.com', 'amd.com', 'qualcomm.com', 'oracle.com', 'ibm.com',
    'salesforce.com', 'ces.tech', 'e3expo.com', 'wwdc', 'gtc', 'ietf.org', 'w3.org',
    'python.org', 'rust-lang.org', 'kubernetes.io', 'docker.com',
)
BUSINESS_TECH_MEDIUM_TRUST = (
    'wikipedia.org', 'britannica.com', 'nationalgeographic.com', 'smithsonian',
    'worldhistory.org', 'nature.com', 'science.org', 'ieee.org', 'acm.org',
)
LOW_SIGNAL_DOMAINS = (
    'youtube.com', 'linkedin.com', 'medium.com', 'researchgate.net', '10times.com',
    'quora.com', 'reddit.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'msn.com',
)


class RetrievalError(RuntimeError):
    """Raised when web retrieval could not be completed safely."""


class SearchProvider(ABC):
    name: str

    @abstractmethod
    def search(self, query: str, limit: int = 5) -> list[RetrievedDocument]:
        raise NotImplementedError


class DuckDuckGoSearchProvider(SearchProvider):
    name = "duckduckgo"
    SEARCH_URL = "https://html.duckduckgo.com/html/"
    BLOCKED_DOMAINS = {"duckduckgo.com"}

    def __init__(self, timeout_seconds: float = 15.0) -> None:
        self.timeout_seconds = timeout_seconds

    def search(self, query: str, limit: int = 5) -> list[RetrievedDocument]:
        try:
            with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
                response = client.post(
                    self.SEARCH_URL,
                    data={"q": query},
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RetrievalError(
                "Could not reach DuckDuckGo. Check network access, firewall rules, or sandbox restrictions."
            ) from exc

        soup = BeautifulSoup(response.text, "html.parser")
        documents: list[RetrievedDocument] = []
        for rank, result in enumerate(soup.select(".result"), start=1):
            link = result.select_one(".result__title a")
            snippet = result.select_one(".result__snippet")
            if link is None:
                continue

            href = (link.get("href") or "").strip()
            title = link.get_text(" ", strip=True)
            if not href or not title:
                continue

            source = self._source_from_url(href)
            if source in self.BLOCKED_DOMAINS:
                continue

            snippet_text = snippet.get_text(" ", strip=True) if snippet else ""
            documents.append(
                RetrievedDocument(
                    title=title,
                    url=href,
                    snippet=snippet_text,
                    source=source,
                    query_used=query,
                    rank=rank,
                    provider_rank=rank,
                    retrieval_score=self._score_result(title, snippet_text, source, rank),
                )
            )
            if len(documents) >= limit:
                break
        return documents

    @staticmethod
    def _source_from_url(url: str) -> str:
        try:
            parsed = urlparse(url)
            return (parsed.netloc or "unknown").lower()
        except ValueError:
            return "unknown"

    @staticmethod
    def _score_result(title: str, snippet: str, source: str, rank: int) -> float:
        score = 0.65
        if snippet:
            score += 0.10
        score += _domain_priority_bonus(source)
        if len(title.split()) < 3:
            score -= 0.08
        score -= min(rank - 1, 5) * 0.04
        return max(0.0, min(1.0, round(score, 3)))


class SerpApiGoogleSearchProvider(SearchProvider):
    name = "serpapi"
    SEARCH_URL = "https://serpapi.com/search"
    BLOCKED_DOMAINS = {"scholar.google.com"}

    def __init__(
        self,
        api_key: str | None = None,
        google_domain: str | None = None,
        gl: str | None = None,
        hl: str | None = None,
        timeout_seconds: float = 20.0,
    ) -> None:
        self.api_key = api_key or settings.serpapi_api_key
        self.google_domain = google_domain or settings.serpapi_google_domain
        self.gl = gl or settings.serpapi_gl
        self.hl = hl or settings.serpapi_hl
        self.timeout_seconds = timeout_seconds

    def search(self, query: str, limit: int = 5) -> list[RetrievedDocument]:
        if not self.api_key:
            raise RetrievalError("SERPAPI_API_KEY is missing. Add it to your .env file or environment.")

        params = {
            "engine": "google",
            "q": query,
            "num": min(max(limit, 1), 10),
            "api_key": self.api_key,
            "google_domain": self.google_domain,
            "gl": self.gl,
            "hl": self.hl,
        }

        try:
            with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
                response = client.get(self.SEARCH_URL, params=params)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RetrievalError(
                "Could not reach SerpAPI. Check network access, firewall rules, API key validity, or sandbox restrictions."
            ) from exc

        payload = response.json()
        if payload.get("error"):
            raise RetrievalError(f"SerpAPI returned an error: {payload['error']}")

        organic_results = payload.get("organic_results", [])
        documents: list[RetrievedDocument] = []
        for result in organic_results:
            link = (result.get("link") or "").strip()
            title = (result.get("title") or "").strip()
            if not link or not title:
                continue

            source = (result.get("source") or self._source_from_url(link) or "unknown").strip().lower()
            if source in self.BLOCKED_DOMAINS:
                continue

            rank = int(result.get("position") or len(documents) + 1)
            snippet_text = (result.get("snippet") or "").strip()
            documents.append(
                RetrievedDocument(
                    title=title,
                    url=link,
                    snippet=snippet_text,
                    source=source,
                    query_used=query,
                    rank=rank,
                    provider_rank=rank,
                    retrieval_score=self._score_result(title, snippet_text, source, rank),
                )
            )
            if len(documents) >= limit:
                break
        return documents

    @staticmethod
    def _source_from_url(url: str) -> str:
        try:
            parsed = urlparse(url)
            return (parsed.netloc or "unknown").lower()
        except ValueError:
            return "unknown"

    @staticmethod
    def _score_result(title: str, snippet: str, source: str, rank: int) -> float:
        score = 0.70
        if snippet:
            score += 0.08
        score += _domain_priority_bonus(source)
        if len(title.split()) < 3:
            score -= 0.08
        score -= min(rank - 1, 5) * 0.04
        return max(0.0, min(1.0, round(score, 3)))


def _domain_priority_bonus(source: str) -> float:
    lowered = source.lower()
    if any(token in lowered for token in LOW_SIGNAL_DOMAINS):
        return -0.18
    if any(token in lowered for token in BUSINESS_TECH_HIGH_TRUST):
        return 0.14
    if any(token in lowered for token in BUSINESS_TECH_MEDIUM_TRUST):
        return 0.06
    return 0.0


def build_search_provider(provider_name: str | None = None) -> SearchProvider:
    selected = (provider_name or settings.retrieval_provider or "duckduckgo").strip().lower()
    if selected == "duckduckgo":
        return DuckDuckGoSearchProvider()
    if selected == "serpapi":
        return SerpApiGoogleSearchProvider()
    raise RetrievalError("Unknown retrieval provider. Use 'duckduckgo' or 'serpapi'.")


class WebRetrievalAgent:
    def __init__(
        self,
        provider: SearchProvider | None = None,
        per_query_limit: int = 4,
        event_callback: Callable[[dict[str, object]], None] | None = None,
    ) -> None:
        self.provider = provider or build_search_provider()
        self.per_query_limit = per_query_limit
        self.event_callback = event_callback
        self.current_pass_index = 1

    def retrieve(self, claim: StructuredClaim) -> RetrievalResult:
        documents: list[RetrievedDocument] = []
        succeeded_queries: list[str] = []
        failed_queries: list[str] = []
        warnings: list[str] = []

        self._emit("retrieval_bundle_started", queries=list(claim.search_queries), provider=self.provider.name)
        for query in claim.search_queries:
            self._emit("retrieval_query_started", query=query, provider=self.provider.name)
            try:
                found = self.provider.search(query=query, limit=self.per_query_limit)
            except RetrievalError as exc:
                failed_queries.append(query)
                self._emit("retrieval_query_failed", query=query, error=str(exc))
                continue

            if found:
                documents.extend(found)
                succeeded_queries.append(query)
                for document in found:
                    self._emit(
                        "retrieval_document_found",
                        query=query,
                        title=document.title,
                        url=str(document.url),
                        source=document.source,
                        rank=document.rank,
                        retrieval_score=document.retrieval_score,
                        snippet=document.snippet,
                    )
                self._emit("retrieval_query_completed", query=query, count=len(found))
            else:
                warnings.append(f"No results returned for query: {query}")
                self._emit("retrieval_query_completed", query=query, count=0)

        if not documents:
            fallback_queries = self._build_fallback_queries(claim)
            if fallback_queries:
                self._emit("retrieval_fallback_started", queries=fallback_queries)
            for query in fallback_queries:
                self._emit("retrieval_query_started", query=query, provider=self.provider.name, is_fallback=True)
                try:
                    found = self.provider.search(query=query, limit=self.per_query_limit)
                except RetrievalError as exc:
                    failed_queries.append(query)
                    self._emit("retrieval_query_failed", query=query, error=str(exc), is_fallback=True)
                    continue

                if found:
                    documents.extend(found)
                    succeeded_queries.append(query)
                    for document in found:
                        self._emit(
                            "retrieval_document_found",
                            query=query,
                            title=document.title,
                            url=str(document.url),
                            source=document.source,
                            rank=document.rank,
                            retrieval_score=document.retrieval_score,
                            snippet=document.snippet,
                            is_fallback=True,
                        )
                    self._emit("retrieval_query_completed", query=query, count=len(found), is_fallback=True)
                else:
                    warnings.append(f"No results returned for fallback query: {query}")
                    self._emit("retrieval_query_completed", query=query, count=0, is_fallback=True)

            if documents:
                warnings.append("Primary query bundle returned no documents; fallback retrieval queries were used.")

        if not documents:
            if failed_queries:
                raise RetrievalError("All retrieval queries failed. Check provider access, network access, or API credentials.")
            raise RetrievalError("No retrieval results were returned for this claim, even after fallback query broadening.")

        if failed_queries:
            warnings.append(f"{len(failed_queries)} query variants failed but partial retrieval succeeded.")

        self._emit(
            "retrieval_bundle_completed",
            document_count=len(documents),
            succeeded_queries=succeeded_queries,
            failed_queries=failed_queries,
        )
        return RetrievalResult(
            provider=self.provider.name,
            query_bundle=[*claim.search_queries, *self._build_fallback_queries(claim)],
            documents=documents,
            succeeded_queries=succeeded_queries,
            failed_queries=failed_queries,
            warnings=warnings,
        )

    @staticmethod
    def _build_fallback_queries(claim: StructuredClaim) -> list[str]:
        candidates = [
            claim.original_query,
            claim.normalized_claim,
            f"{claim.subject} {claim.object}".strip(),
            f"{claim.subject} {claim.predicate}".strip(),
            f"{claim.subject} official".strip(),
            f"{claim.subject} documentation".strip(),
        ]
        if claim.claim_type in {"acquisition_event", "funding_event", "financial_performance", "market_claim"}:
            candidates.extend([
                f"{claim.subject} {claim.object} Reuters".strip(),
                f"{claim.subject} investor relations {claim.object}".strip(),
            ])
        if claim.claim_type in {"product_launch", "scientific_claim", "general_fact"}:
            candidates.extend([
                f"{claim.subject} official documentation".strip(),
                f"{claim.subject} specification".strip(),
            ])

        fallback_queries: list[str] = []
        for query in candidates:
            compact = " ".join(query.split()).strip()
            if compact and compact not in claim.search_queries and compact not in fallback_queries:
                fallback_queries.append(compact)
        return fallback_queries[:6]

    def _emit(self, event_type: str, **payload: object) -> None:
        if self.event_callback is None:
            return
        event = {"type": event_type, "pass_index": self.current_pass_index}
        event.update(payload)
        self.event_callback(event)
