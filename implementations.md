# Implementations — AI Codebase Doctor

Engineering reference for how each subsystem is **actually built today**. Principle: "Source of truth
is the code; when this file conflicts with code, the code wins — fix the file." See `tasks.md` for the
live backlog.

## Current product status

- **Runnable product = LITE.** `docker compose up -d --build` brings up the full demo: a FastAPI
  backend, a Next.js frontend, and Postgres/Qdrant/Valkey/MinIO containers. With only an
  `OPENROUTER_API_KEY` the flow works end to end: clone (or use the bundled `sample-repo/`) → LITE
  heuristic scan (2 s placeholder) → persisted findings → Summary-Agent explanations via OpenRouter.
- **Phases 4–9 features (LangGraph agents, tree-sitter code graph, ML models, MLflow, voice,
  OpenReplay, full Grafana/Loki dashboards, GitHub webhooks, OAuth auth, RAG reranker) are
  aspirational and NOT yet implemented.** They are listed under "Not yet implemented" below.

## Session change log

- **This session:** documented an opt-in `driver.js` guided tour in `README.md` (client-only; not
  bundled until `npm i driver.js` + `<GuidedTour />`). No runtime code added.

## Compose topology

| File | Purpose |
|---|---|
| `compose.yaml` | Base stack (LITE): `postgres`, `valkey`, `qdrant`, `minio`, `api`, `worker`, `web`. Runs `alembic upgrade head` on API start. |
| `compose.override.yaml` | **Dev only** — auto-loaded by `docker compose up`: source mounts, `uvicorn --reload`, `next dev`, ports `8000`/`3000`. Do NOT combine with `compose.prod.yml`. |
| `compose.prod.yml` | Prod: built images, no mounts, healthchecks, restart policy. |
| `compose.full.yml` | STANDARD/FULL overlay, behind `--profile standard`/`--profile full` (ollama, mlflow, glitchtip, openreplay, prometheus, grafana, loki, otel-collector, searxng). |

## Backend (`api/`)

- App factory: `app.main:create_app()`; settings via pydantic-settings from `.env` (`app/config.py`).
  DB: SQLAlchemy 2.0 async + `asyncpg`; the default `database_url` points at the `postgres` **Docker**
  host — override to `localhost` when running outside Docker.
- **Alembic**: one migration `alembic/versions/0001_initial.py` creates all current tables
  (`users`, `repositories`, `analyses`, `findings`, `vulnerabilities`, `agents`, `model_results`,
  `patches`, `api_usage`, `config`, `audit_logs`). Auto-applied on container start.
- Models: `app/models/entities.py` (`TimestampMixin`, `Enum`/`StrEnum` statuses/severities).
- Logging: `structlog` JSON via `app/core/logging.py`; never logs key material.
- Secret redaction: `app/core/redaction.py:redact_text()` replaces `sk-…`, GitHub tokens, Google keys,
  private keys, etc. with `[REDACTED_SECRET]`. This is the REQUIRED gate before any content leaves the
  sandbox (`POST /api/analyze` calls it before LLM fallback). Unit-tested.
- Key encryption at rest: `app/core/security.py:KeyVault` (Fernet over `secret_key`). No route
  currently stores/retrieves keys over HTTP; keys come only from Settings.

### Routes wired today (`app/api/routes/`)

| Route | Method | Implementation state |
|---|---|---|
| `/health` | GET | Returns `status`, `version` (Pydantic default `0.1.0`), `services`. |
| `/api/integrations/status` | GET | Returns LLM provider list + active + usage (flattens only `llm`; nested provider dicts not consumed by UI yet). |
| `/api/repositories` | GET | Lists repos; degrades to `[]` if DB unavailable. |
| `/api/repositories` | POST | Creates a repo (dev bootstrap user via `_current_user`). |
| `/api/analyses` | GET | Latest 50 analyses. |
| `/api/analyses` | POST | Creates an analysis, enforces `DEMO_MAX_CONCURRENT_PER_USER` (429 if exceeded), enqueues `_complete_demo_analysis` as a `BackgroundTask` (NOT Dramatiq). |
| `/api/analyses/{id}` | GET | Returns all findings for an analysis (incl. `tool="dependency"`); no server-side tool filter yet. |
| `/api/analyze` | POST | Redacts the prompt, calls `Registry.llm_complete_with_fallback`, returns the explanation. |

### Demo analysis flow (LITE)
`_complete_demo_analysis` (in `routes/analyses.py`) is a `BackgroundTask` that:
1. `await asyncio.sleep(2)` (demo placeholder for the scan worker);
2. for `is_sample` repos → seeds `_SAMPLE_FINDINGS` (bandit/semgrep/gitleaks/ruff/eslint) + a linked
   `Vulnerability` where applicable, no git clone;
3. for URL repos → runs `app/scanner.py:run_scan` (shallow git clone + deterministic regex rules +
   bundled known-vulnerable-dependency table), persisting `Finding` rows.

Demo safety limits (`DEMO_MAX_REPO_MB=30`, `DEMO_MAX_FILES=1500`, `DEMO_MAX_CONCURRENT_PER_USER=1`)
are enforced in the scanner and in `POST /api/analyses`. `db_unavailable()` (in `app/api/deps.py`)
inspects exception names to degrade list/read views to empty when the DB is unreachable.

### Provider registry (`app/providers/`)
`Registry` (built once at startup in `lifespan`) holds: `llm_providers`, `search_providers`,
`vector_store`, `vulnerability_provider` (merged OSV+NVD+GH Advisory), `cache` (Valkey),
`rates` (in-memory). `llm_complete_with_fallback` tries the chain
**openrouter → gemini → groq → anthropic → openai → ollama**; note `openai`/`anthropic` are skipped
in the loop only via the gemini/anthropic key checks — reaching `openai` with no key raises
`RuntimeError("openai: no API key configured")`.

### What is NOT yet implemented (backend)
- QueueProvider wiring (Dramatiq/Valkey scaffold in `worker.py` exists but is not used by the API —
  LITE uses `BackgroundTasks`).
- Result cache in Valkey; `api_usage` rate-limit persistence (rate tracking is in-memory only).
- `POST /internal/analyze/{tool}` scanner wrappers; Gitleaks-driven scanning; OSV/NVD live lookups in
  the scan pipeline (scanner uses a bundled offline `_VULN_DB` only).
- `/api/config` GET/POST for encrypted provider keys; `POST /repositories/{id}` DELETE.
- Full authn (currently a dev bootstrap `_current_user`); GitHub OAuth is not wired.
- OpenTelemetry / Prometheus metrics endpoints; GlitchTip is only DSN-configured, not instrumented.

## Frontend (`web/`)

- Next.js 14 (App Router) + React 18 + TypeScript **strict** + Tailwind 3 (custom CSS variables,
  dark mode `class`). Component primitives live in `src/components/ui/` (custom, `class-variance-
  authority`/`tailwind-merge`); not a literal shadcn install.
- Data: **TanStack Query** (`src/lib/api.ts`, `QueryClient` defaults staleTime 60s, gcTime 300s, retry
  1, no refetch on focus). **Zustand is NOT present.** `api.baseUrl` = `NEXT_PUBLIC_API_URL`
  (default `http://localhost:8000`).
- Pages: `/`, `/repositories`, `/findings`, `/dependencies`, `/integrations`, `/settings`.

### Page wiring reality
| Page | Backend | Notes |
|---|---|---|
| Repositories | Fully wired (`/api/repositories` GET/POST) | "TRY SAMPLE REPOSITORY" flow works. Delete is **not** wired (`handleDelete` is a stub string error). |
| Findings | Fully wired (`api.analyses` + `api.findings`) | Falls back to `sampleFindings` when the live analysis is a sample with no persisted findings. Shows `ai_explanation`/`root_cause` if persisted; **no Monaco viewer, no live Summary-Agent chat** yet. |
| Dependencies | **Not wired** — uses a static `dependencies: Dependency[]` mock. The API shape does not yet exist. |
| Integrations | Partially wired (`api.integrationStatus` + `api.health`) | "Service Status" uses a hardcoded `serviceCatalog` workaround; the backend response nests provider dicts that the page doesn't fully consume. |
| Settings | **Not wired** — form state only, no GET/POST to an API. Keys are not persisted. |
| Root `/` | Redirects to `/repositories`. No dashboard. |

### What is NOT yet implemented (frontend)
- Monaco code viewer; React Flow dependency/impact graph (neither is in `package.json`).
- Live Summary-Agent chat in the Findings panel.
- API wiring for Dependencies (`/api/dependencies`) and Settings (`GET`/`POST /api/config`).
- Delete-repository mutation end to end.

## Analysis engine (actual vs aspirational)
1. Ingest: `sample-repo/` bundled; URL repos are shallow-cloned in `run_scan`. No archive upload.
2. Parse: **none** — scanner is line-based regex, not tree-sitter.
3. Static findings: bundled heuristic rules in `scanner.py` (secrets, SQLi f-string, eval/exec/pickle/
   shell, hardcoded password/SECRET_KEY). No Semgrep/Bandit/Ruff/ESLint/Trivy wrappers.
4. Dependency pipeline: `_check_dependencies` checks declared packages against the offline `_VULN_DB`
   only (no live OSV/NVD lookup).
5. Enrich/investigate: findings carry a seeded `ai_explanation`/`root_cause` for samples; no agents.
6. Redaction: applied only at the `POST /api/analyze` LLM gate (redaction module is tested).

## Voice / Observability (FULL profile, not implemented)
Kokoro 82M TTS, faster-whisper STT, OpenReplay (with masking), Prometheus/Grafana/Loki dashboards,
OTel instrumentation — all declared in `prompt.md` but not present in `api/` or `web/` yet.

## Gotchas / decisions
- GlitchTip via Sentry SDKs; `SENTRY_DSN` points at GlitchTip, never Sentry cloud.
- Valkey (Redis protocol), not Redis.
- `compose.override.yaml` is auto-loaded by `docker compose up`; never combine with `compose.prod.yml`.
- `prompt.md` is the original 1770-line spec, retained as history and not deleted until `robot.md`
  exists (`robot.md` does not exist yet).
