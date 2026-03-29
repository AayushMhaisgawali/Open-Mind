from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.confidence_model import MonteCarloConfidenceModel
from claim_engine.evidence import EvidenceAnalysisError, OpenAIEvidenceAnalyzer
from claim_engine.features import ClaimFeatureAggregator
from claim_engine.parser import ContentExtractionAgent, ParsingError
from claim_engine.retrieval import RetrievalError, WebRetrievalAgent, build_search_provider
from claim_engine.structurer import ClaimStructuringError, OpenAIClaimStructurer


def load_queries(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def main() -> None:
    query_file_arg = input('Query file [professional_benchmark_queries.txt]: ').strip() or 'professional_benchmark_queries.txt'
    model_dir_arg = input('Confidence model dir [confidence_model]: ').strip() or 'confidence_model'
    output_arg = input('Output results [professional_benchmark_results.json]: ').strip() or 'professional_benchmark_results.json'
    provider_choice = input('Choose retrieval provider [duckduckgo/serpapi] (default: duckduckgo): ').strip().lower() or 'duckduckgo'

    query_file = Path(query_file_arg)
    if not query_file.exists():
        print(f'Query file not found: {query_file}')
        return

    queries = load_queries(query_file)
    if not queries:
        print('Query file is empty.')
        return

    try:
        model = MonteCarloConfidenceModel.load(model_dir_arg)
        structurer = OpenAIClaimStructurer()
        retriever = WebRetrievalAgent(provider=build_search_provider(provider_choice))
        parser = ContentExtractionAgent()
        analyzer = OpenAIEvidenceAnalyzer()
        aggregator = ClaimFeatureAggregator()
    except (FileNotFoundError, ValueError) as exc:
        print(f'Error: {exc}')
        return

    results = []
    for idx, query in enumerate(queries, start=1):
        print(f'[{idx}/{len(queries)}] Benchmarking: {query}')
        try:
            claim = structurer.structure(query)
            retrieval = retriever.retrieve(claim)
            parsed = parser.parse(retrieval)
            evidence = analyzer.analyze(claim, parsed)
            features = aggregator.build(claim, retrieval, parsed, evidence)
            prediction = model.predict(features)
            results.append({
                'query': query,
                'claim': claim.normalized_claim,
                'support_count': features.support_count,
                'contradict_count': features.contradict_count,
                'neutral_count': features.neutral_count,
                'predicted_label': prediction.predicted_label,
                'class_probabilities': prediction.class_probabilities,
                'uncertainty': prediction.uncertainty,
            })
        except (ClaimStructuringError, RetrievalError, ParsingError, EvidenceAnalysisError) as exc:
            results.append({'query': query, 'error': str(exc)})

    output_path = Path(output_arg)
    output_path.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps({'written_results': len(results), 'output': str(output_path)}, indent=2))


if __name__ == '__main__':
    main()
