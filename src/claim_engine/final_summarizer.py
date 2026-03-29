from __future__ import annotations

from pathlib import Path

from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError

from claim_engine.confidence_schema import ConfidencePrediction
from claim_engine.evidence_schema import EvidenceAnalysisResult, EvidenceAssessment
from claim_engine.feature_schema import ClaimFeatureVector
from claim_engine.final_answer_schema import FinalAnswerSummary
from claim_engine.refinement_schema import QueryRefinementPlan
from claim_engine.schema import StructuredClaim
from claim_engine.settings import settings


SYSTEM_PROMPT = """You write the final user-facing answer for a verified web research assistant.

Return JSON that exactly matches the provided schema.

Rules:
- Answer the user's question directly and naturally, like a strong ChatGPT-style research response.
- Do not mention the model, pipeline, classifier, retrieval loop, or internal system mechanics.
- Base the answer only on the supplied evidence and verdict.
- Never override the supplied verdict.
- If the verdict is uncertain, still give the best evidence-backed answer first, then briefly explain that the evidence is not fully decisive.
- The direct answer should be concise, clear, immediately useful, and should lead with the best available answer to the user's question.
- The reasoning summary should explain the conclusion using the strongest evidence, not system behavior.
- The confidence note should describe confidence in plain language without exposing internal jargon.
- Evidence highlights must come only from the supplied top evidence.
- Keep the tone professional, grounded, and helpful.
"""


class FinalSummarizationError(RuntimeError):
    """Raised when the final user-facing summary could not be created."""


class OpenAIFinalSummarizer:
    def __init__(self, client: OpenAI | None = None, model: str | None = None) -> None:
        self.client = client
        self.model = model or settings.openai_model

    def summarize(
        self,
        *,
        claim: StructuredClaim,
        evidence: EvidenceAnalysisResult,
        features: ClaimFeatureVector,
        prediction: ConfidencePrediction,
        stopped_reason: str,
        retries_used: int,
        refinement_history: list[QueryRefinementPlan],
    ) -> FinalAnswerSummary:
        top_evidence = [self._assessment_payload(item) for item in self._top_assessments(evidence)]
        prompt_payload = {
            "original_query": claim.original_query,
            "normalized_claim": claim.normalized_claim,
            "decision_context": claim.decision_context,
            "verdict": prediction.predicted_label,
            "mean_confidence": prediction.mean_confidence,
            "uncertainty": prediction.uncertainty,
            "support_count": evidence.support_count,
            "contradict_count": evidence.contradict_count,
            "neutral_count": evidence.neutral_count,
            "top_evidence": top_evidence,
            "source_context": {
                "official_source_count": features.official_source_count,
                "unique_source_count": features.unique_source_count,
                "warning_count": features.warning_count,
                "failed_fetch_count": features.failed_fetch_count,
            },
            "recent_refinement_rationales": [item.rationale for item in refinement_history[-2:]],
            "internal_only": {
                "stopped_reason": stopped_reason,
                "retries_used": retries_used,
            },
        }

        try:
            summary = self._parse_summary(prompt_payload)
        except FinalSummarizationError:
            return self._fallback_summary(
                claim=claim,
                evidence=evidence,
                prediction=prediction,
            )

        if not summary.evidence_highlights:
            return self._fallback_summary(
                claim=claim,
                evidence=evidence,
                prediction=prediction,
            )
        return summary

    def _parse_summary(self, prompt_payload: dict[str, object]) -> FinalAnswerSummary:
        if not settings.openai_api_key:
            env_path = Path(__file__).resolve().parents[2] / ".env"
            raise FinalSummarizationError(
                f"OPENAI_API_KEY is missing. Add it to {env_path} or your environment."
            )
        if self.client is None:
            self.client = OpenAI(api_key=settings.openai_api_key)

        try:
            response = self.client.responses.parse(
                model=self.model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": str(prompt_payload)},
                ],
                text_format=FinalAnswerSummary,
            )
        except APIConnectionError as exc:
            raise FinalSummarizationError(
                "Could not reach the OpenAI API for final summarization. Check network access, firewall rules, or sandbox restrictions."
            ) from exc
        except APIStatusError as exc:
            raise FinalSummarizationError(f"OpenAI API returned an error during final summarization: {exc.status_code}.") from exc
        except OpenAIError as exc:
            raise FinalSummarizationError(f"OpenAI final summarization failed: {exc}") from exc

        if getattr(response, "output_parsed", None) is None:
            raise FinalSummarizationError("The model did not return a parsed final summary.")

        return FinalAnswerSummary.model_validate(response.output_parsed.model_dump())

    def _fallback_summary(
        self,
        *,
        claim: StructuredClaim,
        evidence: EvidenceAnalysisResult,
        prediction: ConfidencePrediction,
    ) -> FinalAnswerSummary:
        top_items = [self._assessment_payload(item) for item in self._top_assessments(evidence)]
        verdict = prediction.predicted_label
        if verdict == "supported":
            direct_answer = claim.normalized_claim
            reasoning_summary = (
                f"The strongest sources reviewed point in the same direction, with {evidence.support_count} sources supporting the claim and no direct contradictions among the top evidence."
            )
            confidence_note = f"Confidence is moderate to strong based on the consistency of the evidence reviewed ({prediction.mean_confidence:.2f})."
        elif verdict == "contradicted":
            direct_answer = f"The available evidence does not support this claim: {claim.normalized_claim}"
            reasoning_summary = (
                f"The strongest sources reviewed contradict the claim, and the evidence set does not show a credible supporting case in the top results."
            )
            confidence_note = f"Confidence is moderate to strong because the strongest evidence points against the claim ({prediction.mean_confidence:.2f})."
        else:
            direct_answer = self._best_effort_uncertain_answer(claim, evidence)
            reasoning_summary = (
                f"The strongest retrieved sources lean in that direction, but the overall evidence set is still not decisive enough to treat the answer as fully settled. The review found {evidence.support_count} supporting, {evidence.contradict_count} contradicting, and {evidence.neutral_count} neutral signals among the assessed sources."
            )
            confidence_note = f"This answer is the best evidence-backed reading of the current sources, but confidence remains limited because the evidence is still mixed or indirect ({prediction.mean_confidence:.2f} confidence in an uncertain outcome)."
        return FinalAnswerSummary(
            direct_answer=direct_answer,
            reasoning_summary=reasoning_summary,
            confidence_note=confidence_note,
            evidence_highlights=top_items[:3],
        )

    def _best_effort_uncertain_answer(
        self,
        claim: StructuredClaim,
        evidence: EvidenceAnalysisResult,
    ) -> str:
        if evidence.support_count > evidence.contradict_count:
            return f"The available evidence leans toward this answer: {claim.normalized_claim}"
        if evidence.contradict_count > evidence.support_count:
            return f"The available evidence leans against this claim: {claim.normalized_claim}"
        return f"The available evidence is still mixed on this question: {claim.original_query}"

    def _top_assessments(self, evidence: EvidenceAnalysisResult) -> list[EvidenceAssessment]:
        ranked = sorted(
            evidence.assessments,
            key=lambda item: (item.quality_score * 0.4) + (item.relevance_score * 0.35) + (item.confidence_score * 0.25),
            reverse=True,
        )
        return ranked[:3]

    @staticmethod
    def _assessment_payload(item: EvidenceAssessment) -> dict[str, str]:
        excerpt = " ".join(item.evidence_excerpt.split())
        if len(excerpt) > 220:
            excerpt = excerpt[:217].rstrip() + "..."
        return {
            "source": item.source,
            "title": item.title,
            "stance": item.label,
            "excerpt": excerpt,
        }
