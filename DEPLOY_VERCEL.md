# Deploying One Mind With Vercel

This repository is split into two different deployment shapes:

- `web_intelegence/` is a Vite frontend and is a good fit for Vercel
- the workspace root is a FastAPI backend with OpenAI calls, local model files, and `torch` dependencies

Because of that, the reliable production setup is:

- deploy the frontend on Vercel
- deploy the backend on a Python-friendly host like Render, Railway, or a VM
- connect them with `VITE_API_BASE_URL`

## Why the full system should not be deployed entirely on Vercel

The backend currently depends on:

- `torch`
- local model artifacts in `confidence_model/`
- FastAPI request handling that is better suited to a long-running Python service than a serverless function

You may be able to force parts of it onto Vercel, but it is not the low-risk deployment path for this codebase.

## Frontend deployment on Vercel

Create a new Vercel project with these settings:

- Root Directory: `web_intelegence`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Add this environment variable in the Vercel dashboard:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

Example:

```env
VITE_API_BASE_URL=https://one-mind-api.onrender.com
```

## Backend deployment

Deploy the FastAPI app from the repository root on a Python host.

The API entrypoint is:

- `api.py`

Useful endpoints:

- `GET /api/health`
- `POST /api/verify`
- `POST /api/verify/stream`

Required backend environment variables include:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RETRIEVAL_PROVIDER`
- `SERPAPI_API_KEY` if you use SerpAPI

## End-to-end result

After both are deployed:

- users visit the Vercel frontend
- the frontend sends requests to `${VITE_API_BASE_URL}/api/verify/stream`
- backend secrets remain off Vercel and stay on the API host
