from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.retrieval import RetrievalError, WebRetrievalAgent, build_search_provider
from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer


def main() -> None:
    query = input("Enter your query: ").strip()
    if not query:
        print("Please enter a non-empty query.")
        return

    provider_choice = input("Choose retrieval provider [duckduckgo/serpapi] (default: duckduckgo): ").strip().lower() or "duckduckgo"

    structurer = OpenAIClaimStructurer()
    try:
        provider = build_search_provider(provider_choice)
        retriever = WebRetrievalAgent(provider=provider)
        claim = structurer.structure(query)
        result = retriever.retrieve(claim)
    except (ClaimStructuringError, RetrievalError) as exc:
        print(f"Error: {exc}")
        return

    print(json.dumps({"claim": claim.model_dump(), "retrieval": result.model_dump(mode="json")}, indent=2))


if __name__ == "__main__":
    main()
