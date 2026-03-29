from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.autonomous_pipeline import AutonomousVerificationRunner
from claim_engine.confidence_model import MonteCarloConfidenceModel
from claim_engine.evidence import EvidenceAnalysisError
from claim_engine.final_summarizer import FinalSummarizationError, OpenAIFinalSummarizer
from claim_engine.parser import ParsingError
from claim_engine.query_refiner import QueryRefinementError
from claim_engine.retrieval import RetrievalError, WebRetrievalAgent, build_search_provider
from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer

DEFAULT_MODEL_DIR = "confidence_model"
DEFAULT_OUTPUT_PATH = ROOT / "last_run_output.json"


def prompt_query() -> str:
    query = input("Enter your query: ").strip()
    if not query:
        raise ValueError("Please enter a non-empty query.")
    return query


def prompt_provider() -> str:
    return input(
        "Choose retrieval provider [duckduckgo/serpapi] (default: duckduckgo): "
    ).strip().lower() or "duckduckgo"


def print_json(payload: object) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def print_stage(message: str) -> None:
    print(f"[OneMind] {message}")


def print_section(title: str, payload: object) -> None:
    print()
    print(f"{'=' * 18} {title} {'=' * 18}")
    print_json(payload)


def run_autonomous_verification() -> None:
    query = prompt_query()
    provider = prompt_provider()

    print_stage("Loading confidence model...")
    confidence_model = MonteCarloConfidenceModel.load(DEFAULT_MODEL_DIR)
    print_stage("Structuring claim...")
    claim = OpenAIClaimStructurer().structure(query)
    print_stage("Running autonomous retrieval, parsing, verification, and refinement...")
    runner = AutonomousVerificationRunner(
        retrieval_agent=WebRetrievalAgent(provider=build_search_provider(provider)),
        progress_callback=print_stage,
    )
    result = runner.run(claim, confidence_model)

    print_stage("Generating final grounded LLM summary...")
    final_answer = OpenAIFinalSummarizer().summarize(
        claim=result.claim,
        evidence=result.evidence,
        features=result.features,
        prediction=result.prediction,
        stopped_reason=result.stopped_reason,
        retries_used=result.retries_used,
        refinement_history=result.refinement_history,
    )

    payload = {
        "claim": result.claim.model_dump(),
        "retrieval": result.retrieval.model_dump(mode="json"),
        "parsing": result.parsing.model_dump(mode="json"),
        "evidence": result.evidence.model_dump(mode="json"),
        "features": result.features.model_dump(mode="json"),
        "prediction": result.prediction.model_dump(mode="json"),
        "retries_used": result.retries_used,
        "stopped_reason": result.stopped_reason,
        "refinement_history": [item.model_dump() for item in result.refinement_history],
        "pass_history": [item.model_dump(mode="json") for item in result.pass_history],
        "final_answer": final_answer.model_dump(mode="json"),
        "final_answer_markdown": final_answer.as_markdown(),
    }
    DEFAULT_OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print_stage("Run complete. Printing full transparent pipeline output...")
    print_section("INPUT", {"query": query, "provider": provider, "model_dir": DEFAULT_MODEL_DIR})
    print_section("CLAIM", payload["claim"])
    print_section("RETRIEVAL", payload["retrieval"])
    print_section("PARSING", payload["parsing"])
    print_section("EVIDENCE", payload["evidence"])
    print_section("FEATURES", payload["features"])
    print_section("PREDICTION", payload["prediction"])
    print_section("REFINEMENT HISTORY", payload["refinement_history"])
    print_section("PASS HISTORY", payload["pass_history"])
    print_section("FINAL LLM ANSWER", payload["final_answer"])
    print()
    print("=" * 18 + " FINAL LLM ANSWER (READABLE) " + "=" * 18)
    print(payload["final_answer_markdown"])
    print_section(
        "FINAL SUMMARY",
        {
            "query": query,
            "normalized_claim": result.claim.normalized_claim,
            "predicted_label": result.prediction.predicted_label,
            "mean_confidence": result.prediction.mean_confidence,
            "uncertainty": result.prediction.uncertainty,
            "support_count": result.evidence.support_count,
            "contradict_count": result.evidence.contradict_count,
            "neutral_count": result.evidence.neutral_count,
            "retrieved_documents": len(result.retrieval.documents),
            "retries_used": result.retries_used,
            "stopped_reason": result.stopped_reason,
            "saved_full_output_to": str(DEFAULT_OUTPUT_PATH),
        },
    )


def main() -> None:
    try:
        run_autonomous_verification()
    except ValueError as exc:
        print(f"Error: {exc}")
    except (FileNotFoundError, ClaimStructuringError, RetrievalError, ParsingError, EvidenceAnalysisError, QueryRefinementError, FinalSummarizationError) as exc:
        message = str(exc)
        if "OpenAI API" in message or "OPENAI_API_KEY" in message:
            print("Error: the autonomous app needs OpenAI/network access for claim structuring, low-confidence refinement, and final summarization.")
            print(f"Details: {message}")
        else:
            print(f"Error: {message}")


if __name__ == "__main__":
    main()
