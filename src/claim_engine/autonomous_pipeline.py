from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field

from claim_engine.confidence_model import MonteCarloConfidenceModel
from claim_engine.confidence_schema import ConfidencePrediction
from claim_engine.evidence import OpenAIEvidenceAnalyzer
from claim_engine.evidence_schema import EvidenceAnalysisResult
from claim_engine.feature_schema import ClaimFeatureVector
from claim_engine.features import ClaimFeatureAggregator
from claim_engine.parser import ContentExtractionAgent
from claim_engine.parser_schema import ParsingResult
from claim_engine.query_refiner import OpenAIQueryRefiner
from claim_engine.refinement_schema import QueryRefinementPlan
from claim_engine.retrieval import RetrievalError, WebRetrievalAgent
from claim_engine.retrieval_schema import RetrievalResult
from claim_engine.schema import StructuredClaim


class VerificationPassRecord(BaseModel):
    pass_index: int = Field(ge=1)
    query_bundle: list[str] = Field(default_factory=list)
    prediction: ConfidencePrediction
    rationale: str = ""
    newly_added_sources: list[str] = Field(default_factory=list)
    newly_added_urls: list[str] = Field(default_factory=list)


class AutonomousVerificationResult(BaseModel):
    claim: StructuredClaim
    retrieval: RetrievalResult
    parsing: ParsingResult
    evidence: EvidenceAnalysisResult
    features: ClaimFeatureVector
    prediction: ConfidencePrediction
    retries_used: int = Field(ge=0, default=0)
    stopped_reason: str = Field(min_length=1)
    refinement_history: list[QueryRefinementPlan] = Field(default_factory=list)
    pass_history: list[VerificationPassRecord] = Field(default_factory=list)


class AutonomousVerificationRunner:
    def __init__(
        self,
        *,
        retrieval_agent: WebRetrievalAgent,
        parser_agent: ContentExtractionAgent | None = None,
        evidence_analyzer: OpenAIEvidenceAnalyzer | None = None,
        feature_aggregator: ClaimFeatureAggregator | None = None,
        query_refiner: OpenAIQueryRefiner | None = None,
        confidence_threshold: float = 0.75,
        uncertainty_threshold: float = 0.12,
        max_retries: int = 3,
        min_confidence_gain: float = 0.03,
        min_uncertainty_drop: float = 0.02,
        max_stalled_retries: int = 1,
        progress_callback: Callable[[str], None] | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.retrieval_agent = retrieval_agent
        self.parser_agent = parser_agent or ContentExtractionAgent()
        self.evidence_analyzer = evidence_analyzer or OpenAIEvidenceAnalyzer()
        self.feature_aggregator = feature_aggregator or ClaimFeatureAggregator()
        self.query_refiner = query_refiner or OpenAIQueryRefiner()
        self.confidence_threshold = confidence_threshold
        self.uncertainty_threshold = uncertainty_threshold
        self.max_retries = max_retries
        self.min_confidence_gain = min_confidence_gain
        self.min_uncertainty_drop = min_uncertainty_drop
        self.max_stalled_retries = max_stalled_retries
        self.progress_callback = progress_callback
        self.event_callback = event_callback

    def run(self, claim: StructuredClaim, confidence_model: MonteCarloConfidenceModel) -> AutonomousVerificationResult:
        working_claim = StructuredClaim.model_validate(claim.model_dump())
        refinement_history: list[QueryRefinementPlan] = []
        pass_history: list[VerificationPassRecord] = []

        self._report("Starting retrieval pass 1...")
        self._emit("pass_started", pass_index=1, queries=list(working_claim.search_queries))
        self.retrieval_agent.current_pass_index = 1
        self.parser_agent.current_pass_index = 1
        self.evidence_analyzer.current_pass_index = 1
        retrieval, working_claim, bootstrap_retries = self._bootstrap_retrieve(working_claim, refinement_history)
        self._report(f"Retrieved {len(retrieval.documents)} documents. Parsing content...")
        parsing = self.parser_agent.parse(retrieval)
        self._report("Scoring evidence against the claim...")
        evidence = self.evidence_analyzer.analyze(working_claim, parsing)
        features = self.feature_aggregator.build(working_claim, retrieval, parsing, evidence)
        prediction = confidence_model.predict(features)
        self._emit(
            "prediction_updated",
            pass_index=1,
            predicted_label=prediction.predicted_label,
            mean_confidence=prediction.mean_confidence,
            uncertainty=prediction.uncertainty,
        )
        pass_history.append(
            VerificationPassRecord(
                pass_index=1,
                query_bundle=list(working_claim.search_queries),
                prediction=prediction,
                rationale="Initial retrieval and verification pass." if bootstrap_retries == 0 else "Verification pass after bootstrap retrieval recovery.",
                newly_added_sources=sorted({doc.source for doc in retrieval.documents})[:10],
                newly_added_urls=[str(doc.url) for doc in retrieval.documents[:10]],
            )
        )

        retries_used = bootstrap_retries
        stalled_retries = 0
        stopped_reason = self._stop_reason(prediction)
        while not self._should_stop_after_prediction(prediction) and retries_used < self.max_retries:
            previous_prediction = prediction
            retries_used += 1
            self._emit("refinement_started", retry_index=retries_used, prior_label=prediction.predicted_label)
            self._report(
                f"Low confidence detected (confidence={prediction.mean_confidence:.2f}, uncertainty={prediction.uncertainty:.2f}). Refining queries for retry {retries_used}..."
            )
            refinement = self.query_refiner.refine(
                original_query=working_claim.original_query,
                claim=working_claim,
                prediction=prediction,
                evidence=evidence,
                prior_queries=working_claim.search_queries,
                retry_index=retries_used,
            )
            refinement_history.append(refinement)
            refined_queries = refinement.combined_queries(limit=6)
            if not refined_queries:
                stopped_reason = "query_refiner_returned_no_queries"
                break

            prior_urls = {str(doc.url) for doc in retrieval.documents}
            working_claim = StructuredClaim.model_validate(
                {
                    **working_claim.model_dump(),
                    "search_queries": refined_queries,
                }
            )
            self._report(f"Running retrieval retry {retries_used} with {len(refined_queries)} refined queries...")
            next_pass_index = len(pass_history) + 1
            self._emit("pass_started", pass_index=next_pass_index, queries=list(refined_queries), retry_index=retries_used)
            self.retrieval_agent.current_pass_index = next_pass_index
            self.parser_agent.current_pass_index = next_pass_index
            self.evidence_analyzer.current_pass_index = next_pass_index
            next_retrieval = self.retrieval_agent.retrieve(working_claim)
            new_documents = [doc for doc in next_retrieval.documents if str(doc.url) not in prior_urls]
            retrieval = self._merge_retrieval_results(retrieval, next_retrieval)
            self._report(f"Retry {retries_used} added {len(new_documents)} new documents. Re-parsing and re-scoring evidence...")
            parsing = self.parser_agent.parse(retrieval)
            evidence = self.evidence_analyzer.analyze(working_claim, parsing)
            features = self.feature_aggregator.build(working_claim, retrieval, parsing, evidence)
            prediction = confidence_model.predict(features)
            self._emit(
                "prediction_updated",
                pass_index=len(pass_history) + 1,
                predicted_label=prediction.predicted_label,
                mean_confidence=prediction.mean_confidence,
                uncertainty=prediction.uncertainty,
            )

            pass_history.append(
                VerificationPassRecord(
                    pass_index=len(pass_history) + 1,
                    query_bundle=list(refined_queries),
                    prediction=prediction,
                    rationale=refinement.rationale,
                    newly_added_sources=sorted({doc.source for doc in new_documents})[:10],
                    newly_added_urls=[str(doc.url) for doc in new_documents[:10]],
                )
            )

            if not new_documents:
                stopped_reason = "retry_added_no_new_documents"
                self._report("Stopping early because the retry did not add any new documents.")
                break

            if self._is_meaningful_retry_improvement(previous_prediction, prediction):
                stalled_retries = 0
            else:
                stalled_retries += 1
                self._report(
                    "Retry did not materially improve confidence or reduce uncertainty. "
                    f"Stalled retry count: {stalled_retries}/{self.max_stalled_retries}."
                )
                if stalled_retries >= self.max_stalled_retries:
                    stopped_reason = "retry_not_improving"
                    self._report("Stopping early because additional retries are unlikely to improve the result.")
                    break

            stopped_reason = self._stop_reason(prediction)

        if retries_used >= self.max_retries and not self._should_stop_after_prediction(prediction) and stopped_reason not in {
            "retry_added_no_new_documents",
            "retry_not_improving",
            "query_refiner_returned_no_queries",
        }:
            stopped_reason = "max_retries_reached_with_low_confidence"

        return AutonomousVerificationResult(
            claim=working_claim,
            retrieval=retrieval,
            parsing=parsing,
            evidence=evidence,
            features=features,
            prediction=prediction,
            retries_used=retries_used,
            stopped_reason=stopped_reason,
            refinement_history=refinement_history,
            pass_history=pass_history,
        )

    def _bootstrap_retrieve(
        self,
        claim: StructuredClaim,
        refinement_history: list[QueryRefinementPlan],
    ) -> tuple[RetrievalResult, StructuredClaim, int]:
        working_claim = claim
        attempts = 0
        last_error: RetrievalError | None = None

        while attempts <= self.max_retries:
            try:
                retrieval = self.retrieval_agent.retrieve(working_claim)
                return retrieval, working_claim, attempts
            except RetrievalError as exc:
                last_error = exc
                if attempts >= self.max_retries:
                    break
                attempts += 1
                self._report(
                    f"Initial retrieval returned no usable results. Generating broader bootstrap queries (attempt {attempts}/{self.max_retries})..."
                )
                refinement = self.query_refiner.bootstrap_refine(
                    original_query=working_claim.original_query,
                    claim=working_claim,
                    prior_queries=working_claim.search_queries,
                    failure_reason=str(exc),
                    retry_index=attempts,
                )
                refinement_history.append(refinement)
                refined_queries = refinement.combined_queries(limit=6)
                if not refined_queries:
                    break
                working_claim = StructuredClaim.model_validate(
                    {
                        **working_claim.model_dump(),
                        "search_queries": refined_queries,
                    }
                )
                self._report(f"Retrying retrieval with {len(refined_queries)} bootstrap recovery queries...")

        if last_error is not None:
            raise last_error
        raise RetrievalError("Bootstrap retrieval failed before any documents were found.")

    def _is_decisive_confident(self, prediction: ConfidencePrediction) -> bool:
        return (
            prediction.predicted_label in {"supported", "contradicted"}
            and prediction.mean_confidence >= self.confidence_threshold
            and prediction.uncertainty <= self.uncertainty_threshold
        )

    def _is_confident_abstention(self, prediction: ConfidencePrediction) -> bool:
        return (
            prediction.predicted_label == "uncertain"
            and prediction.mean_confidence >= self.confidence_threshold
            and prediction.uncertainty <= self.uncertainty_threshold
        )

    def _should_stop_after_prediction(self, prediction: ConfidencePrediction) -> bool:
        return self._is_decisive_confident(prediction) or self._is_confident_abstention(prediction)

    def _is_meaningful_retry_improvement(
        self,
        previous: ConfidencePrediction,
        current: ConfidencePrediction,
    ) -> bool:
        confidence_gain = current.mean_confidence - previous.mean_confidence
        uncertainty_drop = previous.uncertainty - current.uncertainty
        label_became_decisive = (
            previous.predicted_label == "uncertain"
            and current.predicted_label in {"supported", "contradicted"}
        )
        return (
            confidence_gain >= self.min_confidence_gain
            or uncertainty_drop >= self.min_uncertainty_drop
            or label_became_decisive
        )

    def _stop_reason(self, prediction: ConfidencePrediction) -> str:
        if self._is_decisive_confident(prediction):
            return "confidence_threshold_met"
        if self._is_confident_abstention(prediction):
            return "high_confidence_uncertain"
        if prediction.uncertainty > self.uncertainty_threshold:
            return "uncertainty_above_threshold"
        return "confidence_below_threshold"

    @staticmethod
    def _merge_retrieval_results(first: RetrievalResult, second: RetrievalResult) -> RetrievalResult:
        return RetrievalResult(
            provider=first.provider,
            query_bundle=[*first.query_bundle, *second.query_bundle],
            documents=[*first.documents, *second.documents],
            succeeded_queries=[*first.succeeded_queries, *second.succeeded_queries],
            failed_queries=[*first.failed_queries, *second.failed_queries],
            warnings=[*first.warnings, *second.warnings],
        )

    def _report(self, message: str) -> None:
        if self.progress_callback is not None:
            self.progress_callback(message)
        self._emit("log", message=message)

    def _emit(self, event_type: str, **payload: Any) -> None:
        if self.event_callback is None:
            return
        event = {"type": event_type}
        event.update(payload)
        self.event_callback(event)
