from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from claim_engine.confidence_model import MonteCarloConfidenceModel, rows_to_tensors


def load_rows(dataset_path: Path) -> list[dict]:
    if dataset_path.suffix.lower() == '.jsonl':
        return [json.loads(line) for line in dataset_path.read_text(encoding='utf-8').splitlines() if line.strip()]
    if dataset_path.suffix.lower() == '.json':
        data = json.loads(dataset_path.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else data['rows']
    if dataset_path.suffix.lower() == '.csv':
        rows = []
        with dataset_path.open('r', encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                feature_vector = json.loads(row['feature_vector'])
                rows.append({'feature_vector': feature_vector, 'label': row['label']})
        return rows
    raise ValueError(f'Unsupported dataset format: {dataset_path.suffix}')


def main() -> None:
    dataset_arg = input('Dataset path [confidence_dataset.jsonl]: ').strip() or 'confidence_dataset.jsonl'
    model_dir_arg = input('Output model dir [confidence_model]: ').strip() or 'confidence_model'
    dataset_path = Path(dataset_arg)
    if not dataset_path.exists():
        print(f'Dataset not found: {dataset_path}')
        return

    rows = load_rows(dataset_path)
    if not rows:
        print('Dataset is empty.')
        return

    features, labels = rows_to_tensors(rows)
    model = MonteCarloConfidenceModel.create(input_dim=features.shape[1])
    metrics = model.fit(features, labels)
    model.save(model_dir_arg)
    print(json.dumps({'trained_rows': len(rows), 'metrics': metrics, 'model_dir': model_dir_arg}, indent=2))


if __name__ == '__main__':
    main()
