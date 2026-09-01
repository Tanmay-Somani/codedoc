# Implementations — AI Codebase Doctor

Engineering reference for how each subsystem is actually built. Update this file as decisions are made. Source of truth is the code; when this file conflicts with code, the code wins — fix the file.

## Global conventions

- **Everything runs in Docker Compose.** No dev path requires a paid service.
- **Providers are interfaces.** New provider = new class implementing the interface + registration in a factory. Fallback chain: local → free → alternative.
- **Secrets:** user-configured API keys are encrypted at rest, decrypted only in-process in the API/worker, never logged, never sent to OpenReplay, never shipped to the browser, never passed to an external LLM until secrets are redacted.
- **Async workers** do all long work (clone, parse, analyze, ML, agent runs). API enqueues and returns job ids.

## Backend (api/)

- FastAPI app factory (`app.main:create_app`); settings from pydantic-settings reading `.env` (see `.env.example`).
- DB: SQLAlchemy 2.x async + asyncpg; Alembic for migrations; all models in `app/models/`, imported into `app/db/base.py` so `autogenerate` sees them.
- Models (initial): `users`, `repositories`, `analyses`, `findings`, `vulnerabilities`, `agents`, `model_results`, `patches`, `tests`, `api_usage`, `config`, `audit_logs`. JSONB for flexible fields (embeddings metadata, tool outputs).
- Logging: `structlog` JSON; request-id middleware; never log key material — sanitize at the source.
- Secret redaction is implemented in `app/core/redaction.py` and applied as a REQUIRED step on any repo content before an external LLM call. Unit-tested.
- Static analyzers run as internal endpoints `POST /internal/analyze/{tool}` that exec the CLI in a sandboxed container/home with limits; agents call these as tools (no tool shelling directly).

### Provider registry (app/providers/)

| Interface | Implementations | Notes |
|---|---|---|
| `LLMProvider` | OllamaProvider, OpenAIProvider, GeminiProvider, GroqProvider, OpenRouterProvider, AnthropicProvider | auto-fallback; user picks via settings |
| `EmbeddingProvider` | LocalSentenceTransformersProvider, HFInferenceProvider | CPU-friendly small models |
| `SearchProvider` | SearXNGProvider, TavilyProvider, BraveProvider, SerperProvider | SearXNG is the free default |
| `VulnerabilityProvider` | OSVProvider, NVDProvider, GitHubAdvisoryProvider | merged, deduped, CVSS-sorted; OSV cached 24h in Valkey |
| `PackageProvider` | PyPIProvider, NpmProvider, CrateIoProvider, MavenProvider, GoProvider | |
| `VectorStore` | QdrantStore, PgVectorStore | collections: repository_code, documentation, github_issues, commit_history, security_knowledge, external_knowledge |
| `ObjectStore` | MinIOStore (S3 protocol) | works with R2/B2/S3 unchanged |
| `QueueProvider` | DramatiqProvider, CeleryProvider | over Valkey |

- Rate-limit manager stores `{provider, remaining, reset_time, current_rate}` (model `api_usage` + Valkey) and surfaces in the Integrations dashboard.

## Frontend (web/)

- Next.js (App Router) + TS + Tailwind + shadcn/ui. State: TanStack Query (server state) + Zustand (UI state).
- No Vercel-specific APIs (`headers()`, `cookies()` server usage must not be Vercel-exclusive; prefer plain fetch to `/api`).
- Key surfaces: Dashboard, Repositories, Analysis results (Monaco viewer + explanation panel), Dependency report, Integrations/Health, Settings (providers + keys).
- "TRY SAMPLE REPOSITORY" button posts a special request that uses the bundled sample repo — no GitHub token needed.
- OpenReplay records sessions but masking is mandatory for code areas and any credential inputs.

## Analysis engine

1. **Ingest:** clone (github URL) or upload archive or bundled sample → enforce demo limits → housekeeping.
2. **Parse:** Tree-sitter per language + universal-ctags symbol index → build code graph; emit chunks for embedding → store vectors in Qdrant (or pgvector).
3. **Static findings:** run wrappers (Semgrep/Bandit/Ruff/mypy/ESLint/Gitleaks/Trivy) → normalized `Finding`.
4. **Dependency pipeline:** lock/manifest per ecosystem → package metadata (PyPI/npm/…) → OSV + GitHub Advisory + NVD → merge/dedupe → CVSS → finding.
5. **Enrich + investigate (LangGraph):** finding → code graph slice + relevant RAG chunks + git history + docs/web search (SearXNG) → root cause → optional patch → sandbox tests → optional PR.
6. **Redaction:** Gitleaks output drives `[REDACTED_SECRET]` replacement in anything leaving the sandbox.

## Voice (FULL)

- `POST /api/voice/synthesize` returns audio from Kokoro 82M (CPU). STT via faster-whisper. Feature-flagged; absence never degrades the app.

## Compose topology

- `docker-compose.yml` (default = LITE): `web`, `api`, `worker`, `postgres`, `valkey`, `qdrant`, `minio`.
- Full stack added via Compose `--profile full`: `ollama`, `mlflow`, `glitchtip`, `openreplay`, `prometheus`, `grafana`, `loki`, `otel-collector`, `searxng`.
- Heavy/optional services ALWAYS behind a profile. Public demo runs LITE only.
- Internal analyzer containers are ephemeral sandboxes, not part of the default up.

## Gotchas / decisions

- GlitchTip uses Sentry-compatible SDKs; DSN env `SENTRY_DSN` points at GlitchTip, never Sentry cloud.
- Valkey, not Redis (licensing).
- pg_dump/pg_restore must work — DB is portable by design.
- Demo limits: repo ≤ 30 MB, files ≤ 1,500, 1 concurrent analysis/user, timeout 10 min.
- Never advertise unlimited processing on the public demo.