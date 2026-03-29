from __future__ import annotations

from pathlib import Path

from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError

from claim_engine.confidence_schema import ConfidencePrediction
from claim_engine.evidence_schema import EvidenceAnalysisResult
from claim_engine.refinement_schema import QueryRefinementPlan
from claim_engine.schema import StructuredClaim
from claim_engine.settings import settings


SYSTEM_PROMPT = """You improve web retrieval queries for a downstream verification system.

Return JSON that exactly matches the provided schema.

Rules:
- Do not answer whether the claim is true.
- Your job is only to propose stronger follow-up web search queries.
- Use the current confidence, uncertainty, and evidence weaknesses to improve retrieval quality.
- Generate queries that are concise, web-searchable, and evidence-seeking.
- Prefer authoritative sources for business and engineering research.
- Add contradiction-seeking queries when evidence may be one-sided or ambiguous.
- Preserve the original claim intent exactly; do not change the user's question into a different claim.
- `authoritative_queries` should target official sources, documentation, investor relations, press releases, standards bodies, or top-tier reporting.
- `contradiction_queries` should target the opposite or disputed side of the claim when helpful.
- `domain_specific_queries` should use business or engineering terminology that can surface higher-quality evidence.
- Avoid duplicate or near-duplicate queries.
- Every query must be a plain web search string, not an instruction block.
- Every query must be 4 to 14 words when possible.
- Do not include notes, explanations, parentheses, URLs, or placeholder text inside queries.
- Do not invent special operators, internal flags, JSON fragments, or unsupported filters.
- Use only common search syntax such as simple quoted phrases and `site:domain.com` when truly helpful.

Good query examples:
- Microsoft Activision Blizzard acquisition closed October 13 2023
- site:news.microsoft.com Microsoft completes Activision Blizzard acquisition
- FTC Microsoft Activision Blizzard injunction July 2023

Bad query examples:
- site:sec.gov ... replace with standard search syntax supported by your engine
- query with 0.0.0.0 or internal flags
- a full sentence explaining why the query is useful
"""

BOOTSTRAP_PROMPT = """You repair weak web retrieval plans for a downstream verification system.

Return JSON that exactly matches the provided schema.

Rules:
- Do not answer whether the claim is true.
- The previous search queries failed to return useful web results.
- Generate broader but still relevant recovery queries.
- Preserve the original claim intent exactly.
- Prefer searches that can surface official sources, top-tier reporting, technical docs, investor relations, or standards bodies.
- Include contradiction-oriented queries only if they are likely to help find the other side of the claim.
- Avoid duplicates and avoid overly long queries.
- Every query must be a plain web search string, not an instruction block.
- Every query must be 4 to 14 words when possible.
- Do not include notes, explanations, parentheses, URLs, or placeholder text inside queries.
- Do not invent special operators, internal flags, or unsupported filters.
"""


class QueryRefinementError(RuntimeError):
    """Raised when query refinement could not be completed safely."""


class OpenAIQueryRefiner:
    def __init__(self, client: OpenAI | None = None, model: str | None = None) -> None:
        self.client = client
        self.model = model or settings.openai_model

    def refine(
        self,
        *,
        original_query: str,
        claim: StructuredClaim,
        prediction: ConfidencePrediction,
        evidence: EvidenceAnalysisResult,
        prior_queries: list[str],
        retry_index: int,
    ) -> QueryRefinementPlan:
        top_sources = []
        for assessment in evidence.assessments[:5]:
            source_summary = (
                f"{assessment.source} [{assessment.label}] "
                f"rel={assessment.relevance_score:.2f} conf={assessment.confidence_score:.2f}"
            )
            top_sources.append(source_summary)

        evidence_summary = {
            "support_count": evidence.support_count,
            "contradict_count": evidence.contradict_count,
            "neutral_count": evidence.neutral_count,
            "warnings": evidence.warnings[:5],
            "top_sources": top_sources,
        }
        prediction_summary = {
            "predicted_label": prediction.predicted_label,
            "mean_confidence": prediction.mean_confidence,
            "uncertainty": prediction.uncertainty,
            "class_probabilities": prediction.class_probabilities,
            "retry_index": retry_index,
        }

        plan = self._parse_plan(
            system_prompt=SYSTEM_PROMPT,
            user_content=(
                "Original user query:\n"
                f"{original_query}\n\n"
                "Structured claim:\n"
                f"{claim.model_dump_json(indent=2)}\n\n"
                "Previous search queries:\n"
                f"{prior_queries}\n\n"
                "Current prediction summary:\n"
                f"{prediction_summary}\n\n"
                "Current evidence summary:\n"
                f"{evidence_summary}\n\n"
                "Generate stronger follow-up search queries for the next retrieval pass."
            ),
        )
        return self._ensure_useful_queries(plan, claim, prior_queries)

    def bootstrap_refine(
        self,
        *,
        original_query: str,
        claim: StructuredClaim,
        prior_queries: list[str],
        failure_reason: str,
        retry_index: int,
    ) -> QueryRefinementPlan:
        plan = self._parse_plan(
            system_prompt=BOOTSTRAP_PROMPT,
            user_content=(
                "Original user query:\n"
                f"{original_query}\n\n"
                "Structured claim:\n"
                f"{claim.model_dump_json(indent=2)}\n\n"
                "Previous search queries:\n"
                f"{prior_queries}\n\n"
                "Failure reason:\n"
                f"{failure_reason}\n\n"
                f"This is bootstrap retrieval retry #{retry_index}. Generate broader recovery queries."
            ),
        )
        return self._ensure_useful_queries(plan, claim, prior_queries)

    def _parse_plan(self, *, system_prompt: str, user_content: str) -> QueryRefinementPlan:
        if not settings.openai_api_key:
            env_path = Path(__file__).resolve().parents[2] / ".env"
            raise QueryRefinementError(
                f"OPENAI_API_KEY is missing. Add it to {env_path} or your environment."
            )
        if self.client is None:
            self.client = OpenAI(api_key=settings.openai_api_key)

        try:
            response = self.client.responses.parse(
                model=self.model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                text_format=QueryRefinementPlan,
            )
        except APIConnectionError as exc:
            raise QueryRefinementError(
                "Could not reach the OpenAI API from this environment. Check network access, firewall rules, or sandbox restrictions."
            ) from exc
        except APIStatusError as exc:
            raise QueryRefinementError(f"OpenAI API returned an error: {exc.status_code}.") from exc
        except OpenAIError as exc:
            raise QueryRefinementError(f"OpenAI request failed: {exc}") from exc

        if getattr(response, "output_parsed", None) is None:
            raise QueryRefinementError("The model did not return a parsed query refinement plan.")

        return QueryRefinementPlan.model_validate(response.output_parsed.model_dump())

    def _ensure_useful_queries(
        self,
        plan: QueryRefinementPlan,
        claim: StructuredClaim,
        prior_queries: list[str],
    ) -> QueryRefinementPlan:
        if plan.combined_queries(limit=6):
            return plan

        fallback_queries = self._build_fallback_queries(claim, prior_queries)
        return QueryRefinementPlan(
            rationale=(
                plan.rationale
                or "Fallback refinement plan generated locally because the model returned unusable queries."
            ),
            weaknesses=plan.weaknesses or [
                "The model returned unusable or over-constrained search queries."
            ],
            authoritative_queries=fallback_queries[:2],
            contradiction_queries=fallback_queries[2:4],
            domain_specific_queries=fallback_queries[4:6],
        )

    def _build_fallback_queries(
        self,
        claim: StructuredClaim,
        prior_queries: list[str],
    ) -> list[str]:
        subject = (claim.subject or "").strip()
        obj = (claim.object or "").strip()
        predicate = (claim.predicate or "").strip()
        claim_type = (claim.claim_type or "").strip().lower()

        candidates = [
            claim.original_query,
            f"{subject} {obj} {predicate}".strip(),
            f"{subject} {obj} official announcement".strip(),
            f"{subject} {obj} press release".strip(),
            f"{subject} {obj} Reuters".strip(),
        ]

        if claim_type in {"acquisition_event", "funding_event", "partnership_event"}:
            candidates.extend(
                [
                    f"{subject} {obj} closing date",
                    f"{subject} {obj} investor relations",
                    f"{subject} {obj} regulatory approval",
                ]
            )
        elif claim_type in {"technical_definition", "classification", "standards_fact"}:
            candidates.extend(
                [
                    f"{obj or subject} official documentation",
                    f"{obj or subject} standard definition",
                    f"{obj or subject} specification",
                ]
            )
        else:
            candidates.extend(
                [
                    f"{subject} {obj} official",
                    f"{subject} {obj} documentation",
                    f"{subject} {obj} evidence",
                ]
            )

        normalized_prior = {" ".join(query.lower().split()) for query in prior_queries}
        cleaned: list[str] = []
        for candidate in candidates:
            compact = " ".join(candidate.split()).strip()
            if not compact:
                continue
            if compact.lower() in normalized_prior:
                continue
            if compact not in cleaned:
                cleaned.append(compact)

        return cleaned[:6]
