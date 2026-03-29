from __future__ import annotations

from pathlib import Path

from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError

from claim_engine.schema import StructuredClaim
from claim_engine.settings import settings


SYSTEM_PROMPT = """You convert professional user queries into a structured claim for downstream evidence retrieval.

Return JSON that exactly matches the provided schema.

Rules:
- Preserve the user's intent while normalizing the wording.
- Correct obvious spelling, grammar, or phrasing errors when the intended meaning is clear.
- If a correction is uncertain, keep the best normalized form but record the uncertainty in `ambiguities` and set `needs_clarification` to true.
- Produce a concise declarative `normalized_claim` and never start it with question words like what, when, where, why, how, or whether.
- Infer `question_type` from the query. Use `why` for motive/reason/causal explanation questions and `whether` only for yes-no verification questions.
- Choose the closest `claim_type` from the allowed enum.
- Extract `subject`, `predicate`, and `object` cleanly.
- Include `time` and `location` only if present or strongly implied.
- `entities` should list the most decision-relevant named items.
- Generate 2 to 6 high-quality web search queries suitable for evidence retrieval.
- Set `needs_clarification` to true when identity, spelling, event reference, time, or location ambiguity could materially affect retrieval quality.
- Put all important uncertainty into `ambiguities`.
- `decision_context` should summarize why this query matters for decision support in one short sentence.
- Do not answer whether the claim is true. Only structure the query.
"""

QUESTION_PREFIXES = {
    "what": "what",
    "when": "when",
    "where": "where",
    "who": "who",
    "which": "which",
    "how": "how",
    "why": "why",
}
AUXILIARY_PREFIXES = ("is", "are", "was", "were", "do", "does", "did", "can", "could", "has", "have", "had", "will", "would", "should")


class ClaimStructuringError(RuntimeError):
    """Raised when the claim could not be structured safely."""


class OpenAIClaimStructurer:
    def __init__(self, client: OpenAI | None = None, model: str | None = None) -> None:
        self.client = client
        self.model = model or settings.openai_model

    def structure(self, query: str) -> StructuredClaim:
        clean_query = " ".join(query.split())
        if not clean_query:
            raise ClaimStructuringError("Query must not be empty.")
        if not settings.openai_api_key:
            env_path = Path(__file__).resolve().parents[2] / ".env"
            raise ClaimStructuringError(
                f"OPENAI_API_KEY is missing. Add it to {env_path} or your environment."
            )
        if self.client is None:
            self.client = OpenAI(api_key=settings.openai_api_key)

        try:
            response = self.client.responses.parse(
                model=self.model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": clean_query},
                ],
                text_format=StructuredClaim,
            )
        except APIConnectionError as exc:
            raise ClaimStructuringError(
                "Could not reach the OpenAI API from this environment. Check network access, firewall rules, or sandbox restrictions."
            ) from exc
        except APIStatusError as exc:
            raise ClaimStructuringError(f"OpenAI API returned an error: {exc.status_code}.") from exc
        except OpenAIError as exc:
            raise ClaimStructuringError(f"OpenAI request failed: {exc}") from exc

        if getattr(response, "output_parsed", None) is None:
            raise ClaimStructuringError("The model did not return a parsed structured claim.")

        claim = self._post_process(response.output_parsed, clean_query)
        if len(claim.search_queries) < 2:
            raise ClaimStructuringError("Structured claim must contain at least two search queries.")
        return claim

    def _post_process(self, claim: StructuredClaim, query: str) -> StructuredClaim:
        inferred_question_type = self._infer_question_type(query)
        if inferred_question_type != "unknown":
            claim.question_type = inferred_question_type

        if claim.question_type == "why" and claim.claim_type != "causal_claim":
            claim.claim_type = "causal_claim"

        claim.original_query = query
        claim.normalized_claim = self._clean_normalized_claim(claim.normalized_claim, claim.question_type)

        if not claim.subject.strip() and claim.entities:
            claim.subject = claim.entities[0]
        if not claim.predicate.strip():
            claim.predicate = "relates to"
        if not claim.object.strip() and claim.question_type == "why":
            claim.object = "reason or motive"

        claim.entities = self._merge_entities(claim)
        claim.search_queries = self._normalize_search_queries(claim)

        if claim.ambiguities:
            claim.needs_clarification = True

        return StructuredClaim.model_validate(claim.model_dump())

    def _infer_question_type(self, query: str) -> str:
        lowered = query.strip().rstrip("?").lower()
        if not lowered:
            return "unknown"

        first_word = lowered.split()[0]
        if first_word in QUESTION_PREFIXES:
            return QUESTION_PREFIXES[first_word]
        if first_word in AUXILIARY_PREFIXES:
            return "whether"
        return "unknown"

    def _clean_normalized_claim(self, normalized_claim: str, question_type: str) -> str:
        text = normalized_claim.strip().rstrip("?")
        lowered = text.lower()
        for prefix in QUESTION_PREFIXES:
            if lowered.startswith(prefix + " "):
                text = text[len(prefix) + 1 :].strip()
                break
        if question_type == "why" and text.lower().startswith("reason "):
            text = text[7:].strip()
        return text

    def _merge_entities(self, claim: StructuredClaim) -> list[str]:
        candidates = [claim.subject, claim.object, claim.time or "", claim.location or "", *claim.entities]
        cleaned: list[str] = []
        for item in candidates:
            compact = " ".join(item.split()).strip()
            if compact and compact.lower() not in {"reason or motive", "motive/reason for the killing"} and compact not in cleaned:
                cleaned.append(compact)
        return cleaned

    def _normalize_search_queries(self, claim: StructuredClaim) -> list[str]:
        queries = [claim.normalized_claim, *claim.search_queries]

        if claim.question_type == "why":
            queries.append(f"{claim.subject} motive".strip())
            queries.append(f"{claim.subject} reason {claim.predicate} {claim.object}".strip())
        elif claim.question_type == "when":
            queries.append(f"{claim.subject} date {claim.predicate}".strip())
        elif claim.question_type == "where":
            queries.append(f"{claim.subject} location {claim.predicate}".strip())
        elif claim.question_type == "who":
            queries.append(f"who {claim.predicate} {claim.subject} {claim.object}".strip())

        cleaned: list[str] = []
        for query in queries:
            compact = " ".join(query.split()).strip()
            if compact and compact not in cleaned:
                cleaned.append(compact)
        return cleaned[:6]
