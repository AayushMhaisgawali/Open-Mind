from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer


def main() -> None:
    query = input("Enter your query: ").strip()
    if not query:
        print("Please enter a non-empty query.")
        return

    structurer = OpenAIClaimStructurer()
    try:
        claim = structurer.structure(query)
    except ClaimStructuringError as exc:
        print(f"Error: {exc}")
        return

    print(json.dumps(claim.model_dump(), indent=2))


if __name__ == "__main__":
    main()
