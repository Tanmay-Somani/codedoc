# AI Codebase Doctor

An open-source, self-hostable AI platform that analyzes any codebase for vulnerabilities, bugs, dependency risks, and code quality — then explains findings, proposes patches, and can open pull requests.

Built around one hard constraint:

> **The complete application must be deployable without requiring paid infrastructure.**

Every component has a free hosted tier, an open-source self-hosted alternative, a Docker container, or a local CPU-compatible mode. No hard AWS/GCP/Azure/Datadog/Sentry dependencies.

## Quick start

```bash
git clone https://github.com/<you>/ai-codebase-doctor
cd ai-codebase-doctor
cp .env.example .env
docker compose up -d
```

This runs the **LITE** deployment: frontend + FastAPI + PostgreSQL + Qdrant + Valkey + free/API LLM inference.

For the complete self-hosted stack (observability, MLflow, Ollama, GlitchTip, OpenReplay, voice):

```bash
docker compose --profile full up -d
```

## Product capabilities

- **Bug & vulnerability investigation** — raw findings from Semgrep/Bandit/ESLint/Ruff/mypy/Gitleaks/Trivy are enriched via OSV/NVD/GitHub Advisory, code graph, RAG, git history, and docs/search, then investigated by an agent into root cause → patch → sandbox tests → PR.
- **Dependency security** — `requirements.txt` / `package.json` / etc. → PyPI/npm/crates.io/Maven → OSV + GitHub Advisory + NVD → deduplicated CVSS-scored results with AI explanations.
- **Code RAG + agents** — LangGraph agents over a code knowledge graph with Qdrant/pgvector hybrid retrieval (BM25 + rerank).
- **Voice interface (optional)** — Kokoro 82M TTS + faster-whisper STT for an optional voice chat, never blocking the main app.
- **Full observability** — OpenTelemetry + Prometheus + Grafana + Loki, structured JSON logs, GlitchTip error tracking, OpenReplay session replay.

## Architecture at a glance

```
Frontend (Next.js) → FastAPI → AI Gateway ─┬─ RAG (Qdrant/pgvector)
                                           ├─ ML/DL (Transformers)
                                           └─ Agent Workers (Celery/Dramatiq)
                                                    │
                    PostgreSQL ←──── Qdrant ←──── MinIO (S3)
                                            └── Observability (OTel/Prometheus/Grafana)
```

Every external integration is behind an interface — `LLMProvider`, `EmbeddingProvider`, `SearchProvider`, `VulnerabilityProvider`, `PackageProvider`, `VectorStore`, `ObjectStore`, `QueueProvider` — so any provider can be replaced without redesigning the application.

## Deployment modes

| Mode | Services | Typical RAM |
|---|---|---|
| `LITE` (default) | frontend, FastAPI, PostgreSQL, Qdrant, Valkey, free LLM API | 1–2 GB |
| `STANDARD` | + workers, MLflow, SearXNG, GlitchTip, Prometheus, Grafana | moderate server |
| `FULL` | + Ollama, local DL, OpenReplay, Loki, all observability, voice | capable hardware |

The public demo runs **LITE** only. The FULL stack is a documented local/self-hosted option — do not host it on a tiny free instance.

## Repo layout

```
api/            FastAPI backend (Python, SQLAlchemy, Alembic)
web/            Next.js frontend (TypeScript, Tailwind, shadcn/ui, Monaco, React Flow)
workers/        Background analysis workers (Celery/Dramatiq)
infra/          Nginx, Prometheus, Grafana, Loki, Otel configs
sample-repo/    Intentional vulnerable demo repo for the "TRY SAMPLE" button
prompt.md       Original master spec (deleted once README/planning docs exist)
```

## Development

See `tasks.md` (roadmap), `implementations.md` (how each subsystem is built), and `robot.md` (agent-facing build notes).

```bash
# backend (in api/)
python -m venv .venv && .venv\Scripts\activate   # or . .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload

# frontend (in web/)
npm install
npm run dev
```

## Demo mode safety limits

The public deployment enforces: repo size ≤ 30 MB, files ≤ 1,500, 1 concurrent analysis per user, 10-minute analysis timeout, request rate limits. The **TRY SAMPLE REPOSITORY** button needs no GitHub connection.

## Security

- Secrets detected by Gitleaks are redacted (`sk-...` → `[REDACTED_SECRET]`) **before** any data reaches an external LLM API.
- API keys are user-configured, encrypted, never logged, never sent to session replay, never bundled into the frontend.
- Repo tokens/creds are masked in OpenReplay recordings.

## License

TBD.