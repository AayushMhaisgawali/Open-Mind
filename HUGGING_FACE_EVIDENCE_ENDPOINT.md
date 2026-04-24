# Hugging Face Evidence Endpoint

The backend can now call a dedicated Hugging Face Inference Endpoint for the
evidence stage instead of loading the local `evidence_classifier_model/` folder
on Render.

## Render environment variables

Set these on Render:

```env
EVIDENCE_ENDPOINT_URL=https://your-endpoint-id.region.vendor.endpoints.huggingface.cloud
EVIDENCE_ENDPOINT_TOKEN=hf_xxx
EVIDENCE_ENDPOINT_TIMEOUT=20
```

When `EVIDENCE_ENDPOINT_URL` is configured, the backend posts requests like:

```json
{
  "inputs": {
    "claim": "Structured normalized claim text",
    "document_text": "The parsed source text, truncated to about 1000 characters"
  }
}
```

The backend expects the endpoint to return either:

1. A custom response:

```json
{
  "label": "support",
  "confidence_score": 0.91,
  "probabilities": {
    "support": 0.91,
    "contradict": 0.04,
    "neutral": 0.05
  },
  "reasoning": "The document explicitly confirms the claim.",
  "evidence_excerpt": "..."
}
```

2. Or a standard text-classification style list:

```json
[
  {"label": "support", "score": 0.91},
  {"label": "neutral", "score": 0.05},
  {"label": "contradict", "score": 0.04}
]
```

## Hugging Face custom handler template

Hugging Face Inference Endpoints support custom handlers via `handler.py`.
Their docs note that the handler receives the request body as a dictionary and
always includes the `inputs` key:

- [Send Requests to Endpoints](https://huggingface.co/docs/inference-endpoints/main/guides/test_endpoint)
- [Create custom Inference Handler](https://huggingface.co/docs/inference-endpoints/main/en/guides/custom_handler)

Use this as the `handler.py` inside your Hugging Face model repo:

```python
from typing import Any

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


class EndpointHandler:
    def __init__(self, path: str = ""):
        self.tokenizer = AutoTokenizer.from_pretrained(path)
        self.model = AutoModelForSequenceClassification.from_pretrained(path)
        self.model.eval()

    def __call__(self, data: dict[str, Any]) -> dict[str, Any]:
        payload = data.get("inputs", data)
        claim = str(payload["claim"])
        document_text = str(payload["document_text"])[:1000]

        inputs = self.tokenizer(
            claim,
            document_text,
            max_length=320,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )
        with torch.no_grad():
            logits = self.model(**inputs).logits

        probs = torch.softmax(logits, dim=1)[0].detach().cpu().tolist()
        id2label = {0: "support", 1: "contradict", 2: "neutral"}
        pred_id = max(range(len(probs)), key=lambda idx: probs[idx])

        return {
            "label": id2label[pred_id],
            "confidence_score": float(probs[pred_id]),
            "probabilities": {
                id2label[idx]: float(score)
                for idx, score in enumerate(probs)
            },
            "reasoning": f"Endpoint evidence classifier predicted {id2label[pred_id]}.",
            "evidence_excerpt": document_text[:220],
        }
```
