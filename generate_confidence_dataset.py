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


def auto_label(features: dict[str, float]) -> str:
    support_count = features['support_count']
    contradict_count = features['contradict_count']
    support_ratio = features['support_ratio']
    contradict_ratio = features['contradict_ratio']
    support_score = features['weighted_support_score']
    contradict_score = features['weighted_contradict_score']
    confidence = features['avg_confidence_score']

    if (
        support_count >= max(2, contradict_count + 1)
        and support_ratio >= 0.5
        and support_score > max(0.8, contradict_score * 1.25)
        and confidence >= 0.55
    ):
        return 'supported'

    if (
        contradict_count >= max(2, support_count + 1)
        and contradict_ratio >= 0.4
        and contradict_score > max(0.8, support_score * 1.25)
        and confidence >= 0.55
    ):
        return 'contradicted'

    return 'uncertain'


def main() -> None:
    query_file_arg = input('Query file [queries.txt]: ').strip() or 'queries.txt'
    output_arg = input('Output dataset [confidence_dataset.jsonl]: ').strip() or 'confidence_dataset.jsonl'
    provider_choice = input('Choose retrieval provider [duckduckgo/serpapi] (default: duckduckgo): ').strip().lower() or 'duckduckgo'

    query_file = Path(query_file_arg)
    if not query_file.exists():
        print(f'Query file not found: {query_file}')
        return

    queries = [line.strip() for line in query_file.read_text(encoding='utf-8').splitlines() if line.strip()]
    if not queries:
        print('Query file is empty.')
        return

    structurer = OpenAIClaimStructurer()
    retriever = WebRetrievalAgent(provider=build_search_provider(provider_choice))
    parser = ContentExtractionAgent()
    analyzer = OpenAIEvidenceAnalyzer()
    aggregator = ClaimFeatureAggregator()

    rows = []
    for idx, query in enumerate(queries, start=1):
        print(f'[{idx}/{len(queries)}] Processing: {query}')
        try:
            claim = structurer.structure(query)
            retrieval = retriever.retrieve(claim)
            parsed = parser.parse(retrieval)
            evidence = analyzer.analyze(claim, parsed)
            features = aggregator.build(claim, retrieval, parsed, evidence)
            feature_dict = features.model_dump(mode='json')
            label = auto_label(feature_dict)
            rows.append({
                'query': query,
                'claim': claim.normalized_claim,
                'feature_vector': features.as_ordered_vector(),
                'features': feature_dict,
                'label': label,
            })
        except (ClaimStructuringError, RetrievalError, ParsingError, EvidenceAnalysisError) as exc:
            print(f'  skipped: {exc}')

    output_path = Path(output_arg)
    with output_path.open('w', encoding='utf-8', newline='') as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')

    print(json.dumps({'written_rows': len(rows), 'output': str(output_path)}, indent=2))


if __name__ == '__main__':
    main()
