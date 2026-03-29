from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ConfidenceLabel = Literal['supported', 'contradicted', 'uncertain']


class ConfidencePrediction(BaseModel):
    predicted_label: ConfidenceLabel
    class_probabilities: dict[str, float] = Field(default_factory=dict)
    mean_confidence: float = Field(ge=0.0, le=1.0)
    uncertainty: float = Field(ge=0.0)
    mc_passes: int = Field(ge=1)
    feature_vector: list[float] = Field(default_factory=list)
