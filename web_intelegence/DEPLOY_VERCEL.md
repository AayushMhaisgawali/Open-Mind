# Deploying The Web App On Vercel

This frontend is a Vite app and can be deployed directly to Vercel.

## Recommended architecture

- Deploy `web_intelegence` to Vercel
- Deploy the Python API separately on a platform better suited to FastAPI + model dependencies
- Point the frontend to that backend with `VITE_API_BASE_URL`

## Why not deploy the current backend to Vercel?

The backend in the workspace root depends on:

- `torch`
- local model folders such as `confidence_model`
- heavier Python runtime behavior that is not a great fit for Vercel serverless functions

That means the smooth path is:

- frontend on Vercel
- backend on Railway, Render, an Ubuntu VM, or another Python-friendly host

## Vercel project settings

Create a new Vercel project and use:

- Root Directory: `web_intelegence`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

## Environment variables in Vercel

Add this environment variable in the Vercel dashboard:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

Example:

```env
VITE_API_BASE_URL=https://one-mind-api.onrender.com
```

The frontend will call:

```text
https://your-backend-domain.com/api/verify/stream
```

## Local preview with production-style API URL

Create a local `.env` inside `web_intelegence` if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

If `VITE_API_BASE_URL` is not set, the frontend falls back to same-origin requests.

## Important security note

Do not place backend secrets such as `OPENAI_API_KEY` in the Vercel frontend project.
Those must stay only on the backend host.
