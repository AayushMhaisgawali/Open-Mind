from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.autonomous_pipeline import AutonomousVerificationRunner
from claim_engine.confidence_model import MonteCarloConfidenceModel
from claim_engine.evidence import EvidenceAnalysisError
from claim_engine.parser import ParsingError
from claim_engine.query_refiner import QueryRefinementError
from claim_engine.retrieval import RetrievalError, WebRetrievalAgent, build_search_provider
from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer


def main() -> None:
    model_dir = input('Confidence model dir [confidence_model]: ').strip() or 'confidence_model'
    query = input('Enter your query: ').strip()
    if not query:
        print('Please enter a non-empty query.')
        return
    provider_choice = input('Choose retrieval provider [duckduckgo/serpapi] (default: duckduckgo): ').strip().lower() or 'duckduckgo'

    try:
        confidence_model = MonteCarloConfidenceModel.load(model_dir)
        claim = OpenAIClaimStructurer().structure(query)
        runner = AutonomousVerificationRunner(
            retrieval_agent=WebRetrievalAgent(provider=build_search_provider(provider_choice))
        )
        result = runner.run(claim, confidence_model)
    except (FileNotFoundError, ClaimStructuringError, RetrievalError, ParsingError, EvidenceAnalysisError, QueryRefinementError, ValueError) as exc:
        print(f'Error: {exc}')
        return

    print(json.dumps({
        'claim': result.claim.model_dump(),
        'retrieval': result.retrieval.model_dump(mode='json'),
        'parsing': result.parsing.model_dump(mode='json'),
        'evidence': result.evidence.model_dump(mode='json'),
        'features': result.features.model_dump(mode='json'),
        'prediction': result.prediction.model_dump(mode='json'),
        'retries_used': result.retries_used,
        'stopped_reason': result.stopped_reason,
        'refinement_history': [item.model_dump() for item in result.refinement_history],
        'pass_history': [item.model_dump(mode='json') for item in result.pass_history],
    }, indent=2))


if __name__ == '__main__':
    main()
