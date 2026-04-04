# Professional Claim Structurer

This is the first four stages of the larger system:

`user query -> validated structured claim -> web source retrieval -> content parsing -> evidence analysis`

It is designed for broad, cross-domain professional queries, so it uses:

- OpenAI for generalized understanding
- Pydantic for schema validation
- a selectable retrieval agent with DuckDuckGo or SerpAPI
- a parser that extracts clean text from retrieved URLs
- an evidence analysis agent that labels documents as support, contradict, or neutral
- small CLI demos for step-by-step testing

## Setup

1. Add your OpenAI key and optional SerpAPI key to `.env`
2. Install dependencies

```powershell
venv\Scripts\python.exe -m pip install -e .
```

## Required .env values

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5-mini
RETRIEVAL_PROVIDER=duckduckgo
SERPAPI_API_KEY=your_serpapi_key
SERPAPI_GOOGLE_DOMAIN=google.com
SERPAPI_GL=us
SERPAPI_HL=en
```

Use `RETRIEVAL_PROVIDER=duckduckgo` for the free hackathon path or `RETRIEVAL_PROVIDER=serpapi` for Google-backed search.

## Run

```powershell
venv\Scripts\python.exe run_structured_claim.py
venv\Scripts\python.exe run_retrieval_demo.py
venv\Scripts\python.exe run_parsing_demo.py
venv\Scripts\python.exe run_evidence_demo.py
```


## Professional Focus

This project is now tuned primarily for:

- market / business analysts
- engineering researchers
- technical research users

Retrieval scoring now prefers:

- official company domains
- investor relations / newsroom pages
- official documentation
- standards bodies
- high-trust business and technical publications

A domain-specific benchmark set is available at:

- `professional_benchmark_queries.txt`

Use it to regenerate a confidence dataset aligned with the target audience.

## Deployment

For production deployment:

- deploy `web_intelegence` to Vercel
- deploy the FastAPI backend from the repository root to a Python-friendly host

Deployment notes are in `DEPLOY_VERCEL.md` and `DEPLOY_RENDER.md`.
