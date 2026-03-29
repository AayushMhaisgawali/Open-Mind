from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Iterable

try:
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, TensorDataset, WeightedRandomSampler
    TORCH_AVAILABLE = True
except ImportError:  # pragma: no cover - depends on deployment environment
    torch = None
    nn = None
    DataLoader = None
    TensorDataset = None
    WeightedRandomSampler = None
    TORCH_AVAILABLE = False

from claim_engine.confidence_schema import ConfidencePrediction
from claim_engine.feature_schema import ClaimFeatureVector

LABEL_TO_ID = {'supported': 0, 'contradicted': 1, 'uncertain': 2}
ID_TO_LABEL = {value: key for key, value in LABEL_TO_ID.items()}


if TORCH_AVAILABLE:
    class ConfidenceMLP(nn.Module):
        def __init__(self, input_dim: int, hidden_1: int = 64, hidden_2: int = 32, dropout: float = 0.3) -> None:
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(input_dim, hidden_1),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_1, hidden_2),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_2, 3),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.net(x)
else:
    class ConfidenceMLP:  # pragma: no cover - shape holder for torch-less environments
        def __init__(self, input_dim: int, hidden_1: int = 64, hidden_2: int = 32, dropout: float = 0.3) -> None:
            self.input_dim = input_dim
            self.hidden_1 = hidden_1
            self.hidden_2 = hidden_2
            self.dropout = dropout


class MonteCarloConfidenceModel:
    def __init__(self, model: ConfidenceMLP | None = None, device: object | None = None) -> None:
        self.model = model
        self.device = device or (torch.device('cuda' if torch.cuda.is_available() else 'cpu') if TORCH_AVAILABLE else 'cpu')
        if TORCH_AVAILABLE and self.model is not None:
            self.model = self.model.to(self.device)

    @classmethod
    def create(cls, input_dim: int, hidden_1: int = 64, hidden_2: int = 32, dropout: float = 0.3) -> 'MonteCarloConfidenceModel':
        return cls(ConfidenceMLP(input_dim=input_dim, hidden_1=hidden_1, hidden_2=hidden_2, dropout=dropout))

    def fit(
        self,
        features: torch.Tensor,
        labels: torch.Tensor,
        *,
        epochs: int = 80,
        batch_size: int = 16,
        learning_rate: float = 1e-3,
        seed: int = 42,
    ) -> dict[str, float]:
        if not TORCH_AVAILABLE:
            raise RuntimeError('Torch is required to train the confidence model.')
        torch.manual_seed(seed)
        dataset = TensorDataset(features, labels)

        counts = Counter(int(label.item()) for label in labels)
        class_weights = []
        for class_id in range(len(ID_TO_LABEL)):
            count = counts.get(class_id, 0)
            class_weights.append(0.0 if count == 0 else len(labels) / (len(ID_TO_LABEL) * count))
        class_weight_tensor = torch.tensor(class_weights, dtype=torch.float32, device=self.device)

        sample_weights = torch.tensor([class_weights[int(label.item())] for label in labels], dtype=torch.double)
        sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
        loader = DataLoader(dataset, batch_size=batch_size, sampler=sampler)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        loss_fn = nn.CrossEntropyLoss(weight=class_weight_tensor)

        self.model.train()
        final_loss = 0.0
        for _ in range(epochs):
            epoch_loss = 0.0
            for batch_features, batch_labels in loader:
                batch_features = batch_features.to(self.device)
                batch_labels = batch_labels.to(self.device)
                optimizer.zero_grad()
                logits = self.model(batch_features)
                loss = loss_fn(logits, batch_labels)
                loss.backward()
                optimizer.step()
                epoch_loss += float(loss.item())
            final_loss = epoch_loss / max(len(loader), 1)
        return {
            'train_loss': round(final_loss, 6),
            'class_weight_supported': round(float(class_weights[0]), 4),
            'class_weight_contradicted': round(float(class_weights[1]), 4),
            'class_weight_uncertain': round(float(class_weights[2]), 4),
        }

    def predict(self, features: ClaimFeatureVector | list[float], mc_passes: int = 30) -> ConfidencePrediction:
        vector = features.as_ordered_vector() if isinstance(features, ClaimFeatureVector) else list(features)
        if not TORCH_AVAILABLE or self.model is None:
            return self._heuristic_predict(features if isinstance(features, ClaimFeatureVector) else vector, mc_passes=mc_passes)

        x = torch.tensor([vector], dtype=torch.float32, device=self.device)

        self.model.train()
        probs = []
        with torch.no_grad():
            for _ in range(mc_passes):
                logits = self.model(x)
                probs.append(torch.softmax(logits, dim=1)[0].detach().cpu())

        stacked = torch.stack(probs)
        mean_probs = stacked.mean(dim=0)
        std_probs = stacked.std(dim=0)
        pred_id = int(mean_probs.argmax().item())
        pred_label = ID_TO_LABEL[pred_id]
        class_probabilities = {
            ID_TO_LABEL[idx]: round(float(mean_probs[idx].item()), 4)
            for idx in range(mean_probs.shape[0])
        }
        mean_confidence = float(mean_probs[pred_id].item())
        uncertainty = float(std_probs.mean().item())

        return ConfidencePrediction(
            predicted_label=pred_label,
            class_probabilities=class_probabilities,
            mean_confidence=round(mean_confidence, 4),
            uncertainty=round(uncertainty, 4),
            mc_passes=mc_passes,
            feature_vector=vector,
        )

    def save(self, model_dir: str | Path) -> None:
        if not TORCH_AVAILABLE or self.model is None:
            raise RuntimeError('Torch is required to save the confidence model.')
        model_dir = Path(model_dir)
        model_dir.mkdir(parents=True, exist_ok=True)
        torch.save(self.model.state_dict(), model_dir / 'confidence_model.pt')
        metadata = {
            'input_dim': self.model.net[0].in_features,
            'hidden_1': self.model.net[0].out_features,
            'hidden_2': self.model.net[3].out_features,
            'dropout': self.model.net[2].p,
            'labels': LABEL_TO_ID,
        }
        (model_dir / 'confidence_meta.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    @classmethod
    def load(cls, model_dir: str | Path) -> 'MonteCarloConfidenceModel':
        model_dir = Path(model_dir)
        metadata = json.loads((model_dir / 'confidence_meta.json').read_text(encoding='utf-8'))
        if not TORCH_AVAILABLE:
            return cls(
                ConfidenceMLP(
                    input_dim=int(metadata['input_dim']),
                    hidden_1=int(metadata['hidden_1']),
                    hidden_2=int(metadata['hidden_2']),
                    dropout=float(metadata['dropout']),
                )
            )
        model = ConfidenceMLP(
            input_dim=int(metadata['input_dim']),
            hidden_1=int(metadata['hidden_1']),
            hidden_2=int(metadata['hidden_2']),
            dropout=float(metadata['dropout']),
        )
        state_dict = torch.load(model_dir / 'confidence_model.pt', map_location='cpu')
        model.load_state_dict(state_dict)
        model.eval()
        return cls(model)

    @staticmethod
    def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
        return max(low, min(high, value))

    def _heuristic_predict(
        self,
        features: ClaimFeatureVector | list[float],
        mc_passes: int = 30,
    ) -> ConfidencePrediction:
        vector = features.as_ordered_vector() if isinstance(features, ClaimFeatureVector) else list(features)
        if isinstance(features, ClaimFeatureVector):
            data = features
        else:
            data = ClaimFeatureVector(
                support_count=int(round(vector[0] if len(vector) > 0 else 0)),
                contradict_count=int(round(vector[1] if len(vector) > 1 else 0)),
                neutral_count=int(round(vector[2] if len(vector) > 2 else 0)),
                total_assessments=int(round(vector[3] if len(vector) > 3 else 0)),
                support_ratio=float(vector[4] if len(vector) > 4 else 0.0),
                contradict_ratio=float(vector[5] if len(vector) > 5 else 0.0),
                neutral_ratio=float(vector[6] if len(vector) > 6 else 0.0),
                avg_quality_score=float(vector[7] if len(vector) > 7 else 0.0),
                max_quality_score=float(vector[8] if len(vector) > 8 else 0.0),
                avg_relevance_score=float(vector[9] if len(vector) > 9 else 0.0),
                avg_confidence_score=float(vector[10] if len(vector) > 10 else 0.0),
                weighted_support_score=float(vector[11] if len(vector) > 11 else 0.0),
                weighted_contradict_score=float(vector[12] if len(vector) > 12 else 0.0),
                weighted_neutral_score=float(vector[13] if len(vector) > 13 else 0.0),
                support_minus_contradict=float(vector[14] if len(vector) > 14 else 0.0),
                unique_source_count=int(round(vector[15] if len(vector) > 15 else 0)),
                official_source_count=int(round(vector[16] if len(vector) > 16 else 0)),
                low_signal_source_count=int(round(vector[17] if len(vector) > 17 else 0)),
                full_page_count=int(round(vector[18] if len(vector) > 18 else 0)),
                fallback_count=int(round(vector[19] if len(vector) > 19 else 0)),
                failed_fetch_count=int(round(vector[20] if len(vector) > 20 else 0)),
                partial_fetch_count=int(round(vector[21] if len(vector) > 21 else 0)),
                retrieval_document_count=int(round(vector[22] if len(vector) > 22 else 0)),
                parsed_document_count=int(round(vector[23] if len(vector) > 23 else 0)),
                succeeded_query_count=int(round(vector[24] if len(vector) > 24 else 0)),
                failed_query_count=int(round(vector[25] if len(vector) > 25 else 0)),
                warning_count=int(round(vector[26] if len(vector) > 26 else 0)),
                ambiguity_count=int(round(vector[27] if len(vector) > 27 else 0)),
                needs_clarification=int(round(vector[28] if len(vector) > 28 else 0)),
            )

        decisive_gap = data.weighted_support_score - data.weighted_contradict_score
        evidence_strength = self._clamp((data.avg_quality_score + data.avg_relevance_score + data.avg_confidence_score) / 3.0)
        source_bonus = self._clamp(data.official_source_count / max(data.unique_source_count, 1) if data.unique_source_count else 0.0)
        ambiguity_penalty = self._clamp((data.ambiguity_count * 0.08) + (0.12 if data.needs_clarification else 0.0))
        warning_penalty = self._clamp((data.warning_count * 0.04) + (data.failed_fetch_count * 0.05))

        support_score = self._clamp(
            data.support_ratio * 0.55
            + self._clamp(decisive_gap, 0.0, 1.0) * 0.25
            + evidence_strength * 0.12
            + source_bonus * 0.08
            - ambiguity_penalty * 0.25
            - warning_penalty * 0.15
        )
        contradict_score = self._clamp(
            data.contradict_ratio * 0.55
            + self._clamp(-decisive_gap, 0.0, 1.0) * 0.25
            + evidence_strength * 0.12
            + source_bonus * 0.08
            - ambiguity_penalty * 0.25
            - warning_penalty * 0.15
        )
        uncertain_score = self._clamp(
            data.neutral_ratio * 0.45
            + ambiguity_penalty * 0.30
            + warning_penalty * 0.20
            + (1.0 - evidence_strength) * 0.15
        )

        raw_scores = {
            'supported': max(support_score, 0.01),
            'contradicted': max(contradict_score, 0.01),
            'uncertain': max(uncertain_score, 0.01),
        }
        total = sum(raw_scores.values())
        probabilities = {label: round(score / total, 4) for label, score in raw_scores.items()}
        pred_label = max(probabilities, key=probabilities.get)
        sorted_probs = sorted(probabilities.values(), reverse=True)
        margin = sorted_probs[0] - sorted_probs[1] if len(sorted_probs) > 1 else sorted_probs[0]
        uncertainty = round(self._clamp(0.28 - margin * 0.35 + ambiguity_penalty * 0.4 + warning_penalty * 0.3, 0.03, 0.45), 4)

        return ConfidencePrediction(
            predicted_label=pred_label,
            class_probabilities=probabilities,
            mean_confidence=round(probabilities[pred_label], 4),
            uncertainty=uncertainty,
            mc_passes=mc_passes,
            feature_vector=vector,
        )


def rows_to_tensors(rows: Iterable[dict]) -> tuple[object, object]:
    if not TORCH_AVAILABLE:
        raise RuntimeError('Torch is required to convert rows into tensors.')
    feature_rows = []
    label_rows = []
    for row in rows:
        feature_rows.append([float(value) for value in row['feature_vector']])
        label_rows.append(LABEL_TO_ID[row['label']])
    features = torch.tensor(feature_rows, dtype=torch.float32)
    labels = torch.tensor(label_rows, dtype=torch.long)
    return features, labels
