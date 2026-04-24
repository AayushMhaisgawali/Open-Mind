# Deploying The Backend On Render

This project can serve the API from `api.py` on Render.

## What changed

- Added `requirements-render.txt` for a lighter production install
- Added `render.yaml` with a Render web service definition
- Made the confidence model fall back to a heuristic if `torch` is unavailable

This means the backend can run without CUDA-specific PyTorch packages.

## Important limitation

Your backend is not currently inside the same Git repo as the Vercel frontend repo.
Render normally deploys from a Git repository, so you need one of these:

1. Put the backend files into a GitHub repo
2. Create a new repo for the backend
3. Deploy to a VPS instead of Render

## Files that must be in the backend repo

- `api.py`
- `src/`
- `confidence_model/`
- `requirements-render.txt`
- `pyproject.toml`
- `render.yaml`

You do not need `evidence_classifier_model/` on Render if you host the evidence model remotely through a Hugging Face inference endpoint.

## Render setup

If you push the backend to GitHub, you can deploy it on Render with:

- Service type: Web Service
- Runtime: Python
- Build command: `pip install -r requirements-render.txt && pip install -e .`
- Start command: `uvicorn api:app --host 0.0.0.0 --port $PORT`

Or let Render read `render.yaml`.

## Required environment variables

Set these in Render:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5-mini
RETRIEVAL_PROVIDER=duckduckgo
EVIDENCE_ENDPOINT_URL=your_hugging_face_endpoint_url
EVIDENCE_ENDPOINT_TOKEN=your_hugging_face_endpoint_token
EVIDENCE_ENDPOINT_TIMEOUT=20
SERPAPI_API_KEY=optional_if_using_serpapi
SERPAPI_GOOGLE_DOMAIN=google.com
SERPAPI_GL=us
SERPAPI_HL=en
```

If `EVIDENCE_ENDPOINT_URL` is set, the backend will use that remote evidence model instead of trying to load the heavy local `evidence_classifier_model/` folder on Render.

## After Render gives you a URL

Take the Render API URL, for example:

```text
https://open-mind-api.onrender.com
```

Then set this in Vercel for the frontend project:

```env
VITE_API_BASE_URL=https://open-mind-api.onrender.com
```

Then redeploy the Vercel frontend.
