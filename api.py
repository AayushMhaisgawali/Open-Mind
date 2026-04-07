from __future__ import annotations

import json
import os
import queue
import sys
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.autonomous_pipeline import AutonomousVerificationRunner, AutonomousVerificationResult
from claim_engine.confidence_model import MonteCarloConfidenceModel, TORCH_AVAILABLE
from claim_engine.evidence import EvidenceAnalysisError, OpenAIEvidenceAnalyzer
from claim_engine.evidence_classifier import EvidenceClassifier, TRANSFORMERS_AVAILABLE
from claim_engine.final_summarizer import FinalSummarizationError, OpenAIFinalSummarizer
from claim_engine.parser import ContentExtractionAgent, ParsingError
from claim_engine.query_refiner import QueryRefinementError
from claim_engine.retrieval import RetrievalError, WebRetrievalAgent, build_search_provider
from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer

DEFAULT_MODEL_DIR = "confidence_model"
SUPPORTED_PROVIDERS = {"duckduckgo", "serpapi"}
GraphGroup = Literal["person", "organization", "media", "government", "event"]
SourceStance = Literal["support", "contradict", "neutral"]
DEMO_DAILY_QUERY_LIMIT = 5
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
REQUIRE_REAL_CONFIDENCE_MODEL = os.getenv("REQUIRE_REAL_CONFIDENCE_MODEL", "true").strip().lower() not in {"0", "false", "no"}
REQUIRE_REAL_EVIDENCE_MODEL = os.getenv("REQUIRE_REAL_EVIDENCE_MODEL", "true").strip().lower() not in {"0", "false", "no"}


class VerifyRequest(BaseModel):
    query: str = Field(min_length=1)
    provider: str = Field(default="duckduckgo", min_length=1)


class DashboardGraphNode(BaseModel):
    id: str
    group: GraphGroup
    label: str
    val: float = 12.0
    confidence: int = 80
    summary: str = ""
    stance: str = ""
    url: str | None = None
    domain: str | None = None


class DashboardGraphLink(BaseModel):
    source: str
    target: str
    label: str


class DashboardSource(BaseModel):
    id: str
    domain: str
    title: str
    url: str
    stance: SourceStance
    confidence: float
    relevance: float
    excerpt: str
    fetch_status: str


class DashboardCounts(BaseModel):
    support: int
    neutral: int
    contradict: int
    total: int
    support_pct: int
    neutral_pct: int
    contradict_pct: int


class DashboardVerdict(BaseModel):
    label: str
    confidence: float
    uncertainty: float
    stopped_reason: str
    retries_used: int


class DashboardClaim(BaseModel):
    original_query: str
    normalized_claim: str
    question_type: str
    claim_type: str
    entities: list[str] = Field(default_factory=list)


class DashboardGraph(BaseModel):
    nodes: list[DashboardGraphNode] = Field(default_factory=list)
    links: list[DashboardGraphLink] = Field(default_factory=list)


class DashboardResponse(BaseModel):
    query: str
    provider: str
    assistant_message: str
    final_answer: dict[str, object]
    verdict: DashboardVerdict
    counts: DashboardCounts
    claim: DashboardClaim
    sources: list[DashboardSource] = Field(default_factory=list)
    graph: DashboardGraph
    processing_stream: list[str] = Field(default_factory=list)


_CONFIDENCE_MODEL: MonteCarloConfidenceModel | None = None
_EVIDENCE_CLASSIFIER: EvidenceClassifier | None = None


def get_confidence_engine() -> str:
    return "torch_model" if TORCH_AVAILABLE else "heuristic_fallback"


def get_evidence_classifier() -> EvidenceClassifier:
    global _EVIDENCE_CLASSIFIER
    if _EVIDENCE_CLASSIFIER is None:
        _EVIDENCE_CLASSIFIER = EvidenceClassifier()
    return _EVIDENCE_CLASSIFIER


def get_evidence_engine() -> str:
    classifier = get_evidence_classifier()
    return "evidence_model" if classifier.loaded else "heuristic_fallback"


def get_confidence_model() -> MonteCarloConfidenceModel:
    global _CONFIDENCE_MODEL
    if REQUIRE_REAL_CONFIDENCE_MODEL and not TORCH_AVAILABLE:
        raise RuntimeError(
            "Real confidence model inference is required, but torch is not installed in this environment."
        )
    if _CONFIDENCE_MODEL is None:
        _CONFIDENCE_MODEL = MonteCarloConfidenceModel.load(DEFAULT_MODEL_DIR)
    return _CONFIDENCE_MODEL


def require_evidence_model() -> None:
    classifier = get_evidence_classifier()
    if REQUIRE_REAL_EVIDENCE_MODEL and (not TRANSFORMERS_AVAILABLE or not classifier.loaded):
        detail = classifier.load_error or "Evidence classifier did not load."
        raise RuntimeError(
            f"Real evidence model inference is required, but the evidence classifier is not loaded in this environment. {detail}"
        )


def determine_source_group(domain: str) -> GraphGroup:
    lowered = domain.lower()
    if lowered.endswith(".gov") or ".gov." in lowered:
        return "government"
    media_hints = (
        "news", "times", "reuters", "bloomberg", "wsj", "ft", "bbc", "cnn", "forbes", "zdnet", "blog", "medium"
    )
    if any(hint in lowered for hint in media_hints):
        return "media"
    return "organization"


def determine_entity_group(entity: str) -> GraphGroup:
    words = entity.split()
    if len(words) == 2 and all(part[:1].isupper() for part in words):
        return "person"
    return "organization"


def to_pct(count: int, total: int) -> int:
    if total <= 0:
        return 0
    return round((count / total) * 100)


def _trim(text: str, limit: int = 220) -> str:
    compact = " ".join((text or "").split()).strip()
    if len(compact) <= limit:
        return compact
    return compact[:limit].rsplit(" ", 1)[0].rstrip(".,;: ") + "..."


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Authorization header must be a Bearer token.")
    return token.strip()


def _supabase_headers(api_key: str, bearer: str | None = None) -> dict[str, str]:
    headers = {"apikey": api_key}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    return headers


def _require_supabase_env() -> None:
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY or not SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase quota enforcement is not configured. Add SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.",
        )


def _get_authenticated_user(access_token: str) -> dict[str, Any]:
    _require_supabase_env()
    response = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers=_supabase_headers(SUPABASE_PUBLISHABLE_KEY, access_token),
        timeout=10.0,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=401, detail="Invalid or expired user session.")
    return response.json()


def _get_admin_meta(user_id: str) -> dict[str, Any] | None:
    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/admin_user_meta",
        headers={
            **_supabase_headers(SUPABASE_SECRET_KEY, SUPABASE_SECRET_KEY),
            "Accept": "application/json",
        },
        params={
            "select": "user_id,is_blocked,role,plan",
            "user_id": f"eq.{user_id}",
            "limit": "1",
        },
        timeout=10.0,
    )
    response.raise_for_status()
    payload = response.json()
    return payload[0] if payload else None


def _get_daily_investigation_count(user_id: str) -> int:
    day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/investigations",
        headers={
            **_supabase_headers(SUPABASE_SECRET_KEY, SUPABASE_SECRET_KEY),
            "Range-Unit": "items",
            "Range": "0-0",
            "Prefer": "count=exact",
        },
        params={
            "select": "id",
            "user_id": f"eq.{user_id}",
            "status": "neq.started",
            "and": f"(created_at.gte.{day_start.isoformat()},created_at.lt.{day_end.isoformat()})",
        },
        timeout=10.0,
    )
    response.raise_for_status()
    content_range = response.headers.get("content-range", "0-0/0")
    total = content_range.split("/")[-1]
    try:
        return int(total)
    except ValueError:
        return 0


def enforce_demo_quota(access_token: str) -> dict[str, Any]:
    user = _get_authenticated_user(access_token)
    user_id = str(user["id"])
    admin_meta = _get_admin_meta(user_id) or {}

    if admin_meta.get("is_blocked") is True:
        raise HTTPException(status_code=403, detail="Your account is blocked from running investigations.")

    if admin_meta.get("role") == "admin":
        return user

    daily_count = _get_daily_investigation_count(user_id)
    if daily_count >= DEMO_DAILY_QUERY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Demo limit reached. Free users can run {DEMO_DAILY_QUERY_LIMIT} investigations per day.",
        )

    return user


def build_flow_graph(result: AutonomousVerificationResult, top_sources: list[DashboardSource]) -> DashboardGraph:
    nodes: list[DashboardGraphNode] = [
        DashboardGraphNode(
            id="start",
            group="event",
            label="Start",
            val=11,
            confidence=100,
            summary=result.claim.original_query,
            stance="start",
        ),
    ]
    links: list[DashboardGraphLink] = []

    query_to_pass: dict[str, int] = {}
    for pass_record in result.pass_history:
        for query in pass_record.query_bundle:
            query_to_pass[query] = pass_record.pass_index

    parsed_by_url = {str(item.url): item for item in result.parsing.parsed_documents}
    assessment_by_url = {str(item.url): item for item in result.evidence.assessments}

    retrieval_documents = sorted(
        result.retrieval.documents,
        key=lambda doc: (
            query_to_pass.get(doc.query_used, 999),
            doc.provider_rank,
            -doc.retrieval_score,
        ),
    )

    previous_node_id = "start"

    for document in retrieval_documents[:14]:
        pass_index = query_to_pass.get(document.query_used, 1)
        source_id = f"source:{document.url}"
        parsed = parsed_by_url.get(str(document.url))
        assessment = assessment_by_url.get(str(document.url))
        source_summary_parts = [
            f"Visited from search: {_trim(document.query_used, 64)}.",
            _trim(document.title or document.snippet, 110),
        ]
        source_stance = "visited"
        source_confidence = max(45, round(document.retrieval_score * 100))
        if parsed is not None:
            source_summary_parts.append(f"Parsed via {parsed.extraction_method}.")
            source_confidence = max(source_confidence, max(45, round(parsed.quality_score * 100)))
        if assessment is not None:
            source_summary_parts.append(
                f"{assessment.label.title()}: {_trim(assessment.evidence_excerpt or assessment.reasoning, 140)}"
            )
            source_stance = assessment.label
            source_confidence = max(source_confidence, max(50, round(assessment.confidence_score * 100)))

        nodes.append(
            DashboardGraphNode(
                id=source_id,
                group=determine_source_group(document.source),
                label=document.source,
                val=12 + round(document.retrieval_score * 8),
                confidence=source_confidence,
                summary=" ".join(source_summary_parts),
                stance=source_stance,
                url=str(document.url),
                domain=document.source,
            )
        )
        links.append(DashboardGraphLink(source=previous_node_id, target=source_id, label="visited"))
        previous_node_id = source_id

    verdict_id = "final"
    nodes.append(
        DashboardGraphNode(
            id=verdict_id,
            group="event",
            label=result.prediction.predicted_label.title(),
            val=18,
            confidence=max(50, round(result.prediction.mean_confidence * 100)),
            summary=f"Confidence {result.prediction.mean_confidence:.2f}, uncertainty {result.prediction.uncertainty:.2f}.",
            stance=result.prediction.predicted_label,
        )
    )
    links.append(DashboardGraphLink(source=previous_node_id, target=verdict_id, label="final"))

    deduped_nodes: list[DashboardGraphNode] = []
    seen_nodes: set[str] = set()
    for node in nodes:
        if node.id not in seen_nodes:
            seen_nodes.add(node.id)
            deduped_nodes.append(node)

    deduped_links: list[DashboardGraphLink] = []
    seen_links: set[tuple[str, str, str]] = set()
    for link in links:
        key = (link.source, link.target, link.label)
        if key not in seen_links:
            seen_links.add(key)
            deduped_links.append(link)

    return DashboardGraph(nodes=deduped_nodes, links=deduped_links)


def _build_dashboard_response(query: str, provider: str, emit: callable | None = None) -> DashboardResponse:
    provider = provider.strip().lower() or "duckduckgo"
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported provider: {provider}")

    require_evidence_model()
    confidence_model = get_confidence_model()

    if emit:
        emit("investigation_started", query=query, provider=provider)
    claim = OpenAIClaimStructurer().structure(query)
    if emit:
        emit(
            "structured_claim",
            original_query=claim.original_query,
            normalized_claim=claim.normalized_claim,
            entities=claim.entities,
            question_type=claim.question_type,
            claim_type=claim.claim_type,
        )

    retrieval_agent = WebRetrievalAgent(provider=build_search_provider(provider), event_callback=emit)
    parser_agent = ContentExtractionAgent(event_callback=emit)
    evidence_analyzer = OpenAIEvidenceAnalyzer(event_callback=emit)
    runner = AutonomousVerificationRunner(
        retrieval_agent=retrieval_agent,
        parser_agent=parser_agent,
        evidence_analyzer=evidence_analyzer,
        progress_callback=None,
        event_callback=emit,
    )
    result = runner.run(claim, confidence_model)
    final_answer = OpenAIFinalSummarizer().summarize(
        claim=result.claim,
        evidence=result.evidence,
        features=result.features,
        prediction=result.prediction,
        stopped_reason=result.stopped_reason,
        retries_used=result.retries_used,
        refinement_history=result.refinement_history,
    )

    assessments = sorted(
        result.evidence.assessments,
        key=lambda item: (item.quality_score * 0.4) + (item.relevance_score * 0.35) + (item.confidence_score * 0.25),
        reverse=True,
    )
    top_sources = [
        DashboardSource(
            id=f"source-{index}",
            domain=item.source,
            title=item.title,
            url=str(item.url),
            stance=item.label,
            confidence=item.confidence_score,
            relevance=item.relevance_score,
            excerpt=_trim(item.evidence_excerpt, 260),
            fetch_status=item.fetch_status,
        )
        for index, item in enumerate(assessments[:6], start=1)
    ]

    total = max(result.evidence.support_count + result.evidence.neutral_count + result.evidence.contradict_count, 1)
    counts = DashboardCounts(
        support=result.evidence.support_count,
        neutral=result.evidence.neutral_count,
        contradict=result.evidence.contradict_count,
        total=total,
        support_pct=to_pct(result.evidence.support_count, total),
        neutral_pct=to_pct(result.evidence.neutral_count, total),
        contradict_pct=to_pct(result.evidence.contradict_count, total),
    )

    processing_stream = [
        f"Structured claim generated: {result.claim.normalized_claim}",
        f"Web retrieval explored {len(result.retrieval.documents)} documents across {result.features.unique_source_count} unique sources.",
        f"Evidence analysis found {result.evidence.support_count} supporting, {result.evidence.contradict_count} contradicting, and {result.evidence.neutral_count} neutral signals.",
        f"Confidence model returned {result.prediction.predicted_label} at {result.prediction.mean_confidence:.2f} confidence with {result.prediction.uncertainty:.2f} uncertainty.",
    ]
    if result.retries_used:
        processing_stream.append(f"Refinement loop retried {result.retries_used} time(s) before stopping with {result.stopped_reason}.")
    else:
        processing_stream.append(f"The investigation stopped after the first pass with {result.stopped_reason}.")

    assistant_message = "\n\n".join(
        [
            final_answer.direct_answer.strip(),
            final_answer.reasoning_summary.strip(),
            final_answer.confidence_note.strip(),
        ]
    ).strip()

    response = DashboardResponse(
        query=query,
        provider=provider,
        assistant_message=assistant_message,
        final_answer={
            "direct_answer": final_answer.direct_answer,
            "reasoning_summary": final_answer.reasoning_summary,
            "confidence_note": final_answer.confidence_note,
            "evidence_highlights": [item.model_dump() for item in final_answer.evidence_highlights],
            "markdown": final_answer.as_markdown(),
        },
        verdict=DashboardVerdict(
            label=result.prediction.predicted_label,
            confidence=result.prediction.mean_confidence,
            uncertainty=result.prediction.uncertainty,
            stopped_reason=result.stopped_reason,
            retries_used=result.retries_used,
        ),
        counts=counts,
        claim=DashboardClaim(
            original_query=result.claim.original_query,
            normalized_claim=result.claim.normalized_claim,
            question_type=result.claim.question_type,
            claim_type=result.claim.claim_type,
            entities=result.claim.entities,
        ),
        sources=top_sources,
        graph=build_flow_graph(result, top_sources),
        processing_stream=processing_stream,
    )
    return response


app = FastAPI(title="One Mind API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    confidence_model_loaded = False
    confidence_model_error: str | None = None
    evidence_model_loaded = False
    evidence_model_error: str | None = None
    try:
        get_confidence_model()
        confidence_model_loaded = True
    except Exception as exc:
        confidence_model_error = str(exc)

    try:
        require_evidence_model()
        evidence_model_loaded = True
    except Exception as exc:
        evidence_model_error = str(exc)

    return {
        "status": (
            "ok"
            if (confidence_model_loaded or not REQUIRE_REAL_CONFIDENCE_MODEL)
            and (evidence_model_loaded or not REQUIRE_REAL_EVIDENCE_MODEL)
            else "degraded"
        ),
        "confidence_engine": get_confidence_engine(),
        "evidence_engine": get_evidence_engine(),
        "require_real_confidence_model": REQUIRE_REAL_CONFIDENCE_MODEL,
        "require_real_evidence_model": REQUIRE_REAL_EVIDENCE_MODEL,
        "confidence_model_loaded": confidence_model_loaded,
        "confidence_model_error": confidence_model_error,
        "evidence_model_loaded": evidence_model_loaded,
        "evidence_model_error": evidence_model_error,
    }


@app.head("/api/health")
def health_head() -> Response:
    return Response(status_code=200)


@app.post("/api/verify", response_model=DashboardResponse)
def verify(request: VerifyRequest, authorization: str | None = Header(default=None)) -> DashboardResponse:
    try:
        access_token = _extract_bearer_token(authorization)
        enforce_demo_quota(access_token)
        return _build_dashboard_response(request.query, request.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (
        FileNotFoundError,
        ClaimStructuringError,
        RetrievalError,
        ParsingError,
        EvidenceAnalysisError,
        QueryRefinementError,
        FinalSummarizationError,
    ) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/verify/stream")
def verify_stream(request: VerifyRequest, authorization: str | None = Header(default=None)) -> StreamingResponse:
    access_token = _extract_bearer_token(authorization)
    enforce_demo_quota(access_token)
    event_queue: queue.Queue[dict[str, Any] | None] = queue.Queue()

    def emit(event_or_type: Any, **payload: Any) -> None:
        if isinstance(event_or_type, dict):
            event_type = str(event_or_type.get("type") or "log")
            event_payload = {
                key: value
                for key, value in event_or_type.items()
                if key != "type"
            }
            event_queue.put({"type": event_type, "payload": event_payload})
            return

        event_queue.put({"type": str(event_or_type), "payload": payload})

    def worker() -> None:
        try:
            response = _build_dashboard_response(request.query, request.provider, emit=emit)
            event_queue.put({"type": "final_result", "payload": response.model_dump(mode="json")})
        except Exception as exc:
            event_queue.put({"type": "error", "payload": {"message": str(exc)}})
        finally:
            event_queue.put(None)

    def stream() -> Any:
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        while True:
            item = event_queue.get()
            if item is None:
                break
            yield json.dumps(item, ensure_ascii=False) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")
