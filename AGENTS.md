# AGENTS.md

## Project status

This is a greenfield project: the repo currently contains only `prompt.md` (the master spec). No code, manifests, or tooling exist yet. Future sessions will build the "AI Codebase Doctor" from the spec. Do not delete `prompt.md` until `README.md`, `tasks.md`, `implementations.md`, and `robot.md` exist (per its final line).

## Non-negotiable architecture constraints (from spec)

- Must be deployable WITHOUT paid infrastructure. Every component needs: a free hosted tier, an OSS self-hosted alternative, a Docker container, or a local CPU-compatible mode. Avoid hard AWS/GCP/Azure/Datadog/proprietary-vector-DB/Sentry dependencies.
- Open-source-first stack choices: PostgreSQL, Qdrant (or pgvector), MinIO (S3 protocol), Valkey (not Redis), Celery/Dramatiq, GlitchTip (Sentry SDK-compatible for error tracking), OpenReplay (session replay), Kokoro 82M (TTS), faster-whisper (STT), OpenTelemetry + Prometheus + Grafana + Loki, MLflow, SearXNG (self-hosted search), Ollama.
- Operate via Docker Compose: `git clone && docker compose up -d`. Define `LITE` / `STANDARD` / `FULL` resource modes; heavy/optional services go behind Compose profiles (e.g. `docker compose --profile full up -d`). The public demo runs LITE (no OpenReplay/GlitchTip/Grafana/Loki/MLflow/Ollama on the shared instance).
- Every external integration sits behind an interface so it can be swapped: `LLMProvider` (Ollama/OpenAI/Gemini/Groq/OpenRouter/Anthropic), `EmbeddingProvider`, `SearchProvider`, `VulnerabilityProvider` (OSV/NVD/GitHubAdvisory), `PackageProvider`, `VectorStore` (Qdrant/PgVector), `ObjectStore`, `QueueProvider`. Implement automatic provider fallback.
- Provider-agnostic in practice: API keys are user-configured, encrypted, never logged, never sent to session replay, never bundled into the frontend.
- Redact detected secrets (Gitleaks) BEFORE any data reaches an external LLM API (`sk-...` → `[REDACTED_SECRET]`).
- External APIs (GitHub REST/GraphQL/Webhooks, OSV, NVD, PyPI, npm, Maven, crates.io, Stack Exchange) should be called only when they materially improve a defined product capability — not to inflate API count. Cache results (Valkey, e.g. OSV 24h TTL) and respect/track rate limits.
- Demo mode must have safety limits (repo size, file count, concurrency, timeout) and an instant "TRY SAMPLE REPOSITORY" button that needs no GitHub connection.

## Planned stack (build these)

- Frontend: Next.js + React + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand + Monaco Editor + React Flow + Recharts. No Vercel-specific APIs.
- Backend: Python + FastAPI + Pydantic + SQLAlchemy + Alembic + Uvicorn/Gunicorn.
- Static/security analysis wrapped as agent-callable internal APIs: Semgrep, Bandit, Ruff, mypy, ESLint, Trivy, Gitleaks.
- Parsing: Tree-sitter / AST / Universal Ctags. ML/DL: LangGraph, Hugging Face Transformers, PyTorch, Sentence Transformers, XGBoost/LightGBM/scikit-learn, Optuna, SHAP.

## Counter-intuitive points worth remembering

- Sentry SDKs are used but the DSN must point to GlitchTip, not Sentry's cloud.
- Prefer Valkey over Redis (OSS-licensing concern).
- The "full" stack must NOT be hosted on the public demo server — that's the documented deployment trap.
- Voice/STT are optional and must never block the main app.
