from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.evidence import EvidenceAnalysisError, OpenAIEvidenceAnalyzer
from claim_engine.features import ClaimFeatureAggregator
from claim_engine.parser import ContentExtractionAgent, ParsingError
from claim_engine.retrieval import RetrievalError, WebRetrievalAgent, build_search_provider
from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer


def main() -> None:
    query = input('Enter your query: ').strip()
    if not query:
        print('Please enter a non-empty query.')
        return

    provider_choice = input('Choose retrieval provider [duckduckgo/serpapi] (default: duckduckgo): ').strip().lower() or 'duckduckgo'

    structurer = OpenAIClaimStructurer()
    parser = ContentExtractionAgent()
    analyzer = OpenAIEvidenceAnalyzer()
    aggregator = ClaimFeatureAggregator()

    try:
        provider = build_search_provider(provider_choice)
        retriever = WebRetrievalAgent(provider=provider)
        claim = structurer.structure(query)
        retrieval = retriever.retrieve(claim)
        parsed = parser.parse(retrieval)
        evidence = analyzer.analyze(claim, parsed)
        features = aggregator.build(claim, retrieval, parsed, evidence)
    except (ClaimStructuringError, RetrievalError, ParsingError, EvidenceAnalysisError) as exc:
        print(f'Error: {exc}')
        return

    print(json.dumps({
        'claim': claim.model_dump(),
        'retrieval': retrieval.model_dump(mode='json'),
        'parsing': parsed.model_dump(mode='json'),
        'evidence': evidence.model_dump(mode='json'),
        'features': features.model_dump(mode='json'),
        'feature_vector': features.as_ordered_vector(),
    }, indent=2))


if __name__ == '__main__':
    main()
