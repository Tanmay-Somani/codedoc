# Implementations — AI Codebase Doctor

Engineering reference for how each subsystem is **actually built today**. Principle: "Source of truth
is the code; when this file conflicts with code, the code wins — fix the file." See `tasks.md` for the
live backlog.

## Current product status

- **Runnable product = LITE.** `docker compose up -d --build` brings up the full demo: a FastAPI
  backend, a Next.js frontend, and Postgres/Qdrant/Valkey/MinIO containers. With only an
  `OPENROUTER_API_KEY` the flow works end to end: clone (or use the bundled `sample-repo/`) → LITE
  heuristic scan (2 s placeholder) → persisted findings → Summary-Agent explanations via OpenRouter.
- **UI = shipped.** Dashboard, findings explorer (exports, URL state, onboarding tours, toasts),
  responsive layout, footer — see the frontend section.
- **Ops = hardened.** App healthchecks + `service_healthy` ordering, non-root API image, `.dockerignore`
  files, startup env validation, and a root `Makefile`.
- **Phases 4–9 features (LangGraph agents, tree-sitter code graph, ML models, MLflow, voice,
  OpenReplay, full Grafana/Loki dashboards, GitHub webhooks, OAuth auth, RAG reranker) are
  aspirational and NOT yet implemented.** They are listed under "Not yet implemented" below.

## Session change log

- **This session (scan efficiency + token safety + progress):**
  - **Scanner scans only "necessary files"** (`api/app/scanner.py`): added a very-aggressive
    source/config whitelist (`_SCAN_EXTENSIONS`, `_SCAN_EXACT_NAMES`), skips vendored/generated dirs
    (`_SKIP_DIRS`), and a hard per-repo cap `MAX_SCAN_FILES=200` with manifest/config-first priority
    ordering. The regex scan loop now runs over `_select_scan_files(...)` instead of every file in
    the tree; the whole-tree `file_count`/`total_bytes` are still returned for repo metadata.
  - **Token-safety rate limiting on `POST /api/analyze`** (`api/app/api/routes/analyses.py`,
    `api/app/providers/base.py`): new in-memory `SlidingWindowLimiter` (per-user, in-process) plus a
    hard input-size cap (`DEMO_ANALYZE_MAX_CHARS`) and a bounded output `max_tokens`
    (`DEMO_ANALYZE_MAX_TOKENS`). Both excess-size and over-rate requests return `429`.
  - **Real scan progress bar** (`ScanProgressStore` in `api/app/providers/base.py`, wired in
    `Registry`; scanner emits phase/current/total via a callback; `AnalysisOut` now carries
    `progress`/`progress_message`; `web/src/app/findings/page.tsx` renders a determinate bar while
    scanning). In-memory, migration-free — resets on process restart.
  - New env vars in `.env.example`: `DEMO_MAX_SCAN_FILES=200`,
    `DEMO_ANALYZE_LIMIT_PER_MIN=20`, `DEMO_ANALYZE_MAX_CHARS=100000`, `DEMO_ANALYZE_MAX_TOKENS=512`.
  - Tests: `tests/test_scanner_filter.py`, `tests/test_progress.py`, plus
    `SlidingWindowLimiter` cases in `tests/test_rate_limit.py`.

- **This session:** UI overhaul — Space Grotesk display font + clinical cyan palette (`globals.css`,
  `tailwind.config.ts`, `layout.tsx`), dashboard page (`/dashboard`), findings-explorer rework
  (severity borders, stepped AI-investigation panel, CSV/JSON/PDF export via `lib/export.ts`,
  copy-to-clipboard via `components/copy-button.tsx`, `?severity`/`?analysis` URL state), Sonner
  toasts (`components/toaster.tsx`), driver.js first-run tours (`hooks/use-onboarding-tour.ts`,
  `lib/tour.ts`) for repositories + findings with a Settings "Restart guided tour" replay, footer
  with tour/platform-health links, responsive sidebar drawer, `.env.example` demo limits synced to
  256 MB / 5,000 files. Ops: startup env validation (`Settings.check_environment()`), docker
  hardening (`api/Dockerfile` multi-stage + non-root, `.dockerignore` ×2, HEALTHCHECKs), compose
  app healthchecks + `service_healthy` ordering, root `Makefile`.

## Compose topology

| File | Purpose |
|---|---|
| `compose.yaml` | Base stack (LITE): `postgres`, `valkey`, `qdrant`, `minio`, `api`, `worker`, `web`. Runs `alembic upgrade head` on API start. |
| `compose.override.yaml` | **Dev only** — auto-loaded by `docker compose up`: source mounts, `uvicorn --reload`, `next dev`, ports `8000`/`3000`. Do NOT combine with `compose.prod.yml`. |
| `compose.prod.yml` | Prod: built images, no mounts, restart policy. |
| `compose.full.yml` | STANDARD/FULL overlay, behind `--profile standard`/`--profile full` (ollama, mlflow, glitchtip, openreplay, prometheus, grafana, loki, otel-collector, searxng). |

All app services have container healthchecks (`api` probes `/health`, `web` requires a 200 on `/`,
`worker` checks its own process liveness) and `depends_on: condition: service_healthy` — `api`
waits on postgres/valkey/qdrant, `web` waits on `api`. Dockerfiles carry `HEALTHCHECK`
instructions too, and each `api`/`web` root has a `.dockerignore`.

## Backend (`api/`)

- App factory: `app.main:create_app()`; settings via pydantic-settings from `.env` (`app/config.py`).
  DB: SQLAlchemy 2.0 async + `asyncpg`; the default `database_url` points at the `postgres` **Docker**
  host — override to `localhost` when running outside Docker.
- **Alembic**: one migration `alembic/versions/0001_initial.py` creates all current tables
  (`users`, `repositories`, `analyses`, `findings`, `vulnerabilities`, `agents`, `model_results`,
  `patches`, `api_usage`, `config`, `audit_logs`). Auto-applied on container start.
- Models: `app/models/entities.py` (`TimestampMixin`, `Enum`/`StrEnum` statuses/severities).
- Logging: `structlog` JSON via `app/core/logging.py`; never logs key material.
- Startup env validation: `Settings.check_environment()` (`app/config.py`) returns `(level, message)`
  issues — default `SECRET_KEY`, default MinIO password, missing API key for the selected LLM or
  search provider, empty `SENTRY_DSN` in production. `create_app()` logs each as an `env_check`
  warning/critical and **never raises**, so the LITE demo still boots.
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
| `/api/analyses` | GET | Latest 50 analyses; carries live `progress`/`progress_message` for in-flight scans (merged from the in-memory `ScanProgressStore`). |
| `/api/analyses` | POST | Creates an analysis, enforces `DEMO_MAX_CONCURRENT_PER_USER` (429 if exceeded), enqueues `_complete_demo_analysis` as a `BackgroundTask` (NOT Dramatiq). |
| `/api/analyses/{id}` | GET | Returns all findings for an analysis (incl. `tool="dependency"`); no server-side tool filter yet. |
| `/api/analyze` | POST | Redacts the prompt (required gate), enforces **token-safety guards** — per-user `SlidingWindowLimiter` (`DEMO_ANALYZE_LIMIT_PER_MIN`) and a hard input cap (`DEMO_ANALYZE_MAX_CHARS`), both → `429`; calls `Registry.llm_complete_with_fallback` with a bounded `max_tokens` (`DEMO_ANALYZE_MAX_TOKENS`), returns the explanation. |

### Demo analysis flow (LITE)
`_complete_demo_analysis` (in `routes/analyses.py`) is a `BackgroundTask` that:
1. for `is_sample` repos → seeds `_SAMPLE_FINDINGS` (bandit/semgrep/gitleaks/ruff/eslint) + a linked
   `Vulnerability` where applicable, no git clone;
2. for URL repos → runs `app/scanner.py:run_scan` (shallow git clone + deterministic regex rules +
   bundled known-vulnerable-dependency table), which streams progress into the process-local
   `ScanProgressStore` and returns `(findings, file_count, total_bytes)` for persistence.

The scanner only regex-scans a **prioritized whitelist** of files (`_select_scan_files`: source/config
extensions + exact names, skipping `node_modules`/`vendor`/`dist`/etc., capped at
`DEMO_MAX_SCAN_FILES=200`, manifests first) rather than every file in the checkout. `file_count` /
`total_bytes` still describe the whole tree (used by repo metadata).

Demo safety limits (`DEMO_MAX_REPO_MB=256`, `DEMO_MAX_FILES=5000`, `DEMO_MAX_SCAN_FILES=200`,
`DEMO_MAX_CONCURRENT_PER_USER=1`, `DEMO_ANALYZE_LIMIT_PER_MIN=20`, `DEMO_ANALYZE_MAX_CHARS=100000`,
`DEMO_ANALYZE_MAX_TOKENS=512`) are enforced in the scanner, in `POST /api/analyses`, and in
`POST /api/analyze`. `db_unavailable()` (in `app/api/deps.py`) inspects exception names to degrade
list/read views to empty when the DB is unreachable.

### Provider registry (`app/providers/`)
`Registry` (built once at startup in `lifespan`) holds: `llm_providers`, `search_providers`,
`vector_store`, `vulnerability_provider` (merged OSV+NVD+GH Advisory), `cache` (Valkey),
`rates` (in-memory), `analyze_limiter` (in-memory `SlidingWindowLimiter`), `scan_progress`
(in-memory `ScanProgressStore`). `llm_complete_with_fallback` tries the chain
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
- Page shells: `/`, `/dashboard`, `/repositories`, `/findings`, `/dependencies`, `/integrations`,
  `/settings`.
- **driver.js onboarding**: first-run tours via `hooks/use-onboarding-tour.ts` (dynamic import of
  `driver.js` + css, 700 ms delay, `onDestroyed` → `onComplete`). Repositories tour (3 steps)
  records a `codedoc_visited_repos` flag; findings tour (3 steps) marks `codedoc_tour_done`.
  Replayable from Settings → "Restart guided tour" and from the footer — both reset `lib/tour.ts`
  localStorage keys and navigate to `/repositories`.
- Notifications: Sonner `<Toaster>` (`components/toaster.tsx`, dark/bottom-right) wired into the
  repositories flow (`createRepo`, `runAnalysis` success/error).
- Exports: `lib/export.ts` — `exportCSV`, `exportJSON`, `exportPDF` (jsPDF + jspdf-autotable with
  severity-colored cells), `exportFindings` dispatcher; findings page exposes CSV/JSON/PDF buttons.

### Page wiring reality
| Page | Backend | Notes |
|---|---|---|
| Dashboard | Fully wired (`health` + `repositories` + `analyses` + `integrationStatus`) | Risk-score hero (`/5` late-stage model), severity stacked bar, stat cards, live analysis timeline with pulsing status dots, integrations panel, API-down banner. Root `/` still redirects to `/repositories`. |
| Repositories | Fully wired (`/api/repositories` GET/POST) | "TRY SAMPLE REPOSITORY" flow + driver.js onboarding tour. Delete is **not** wired (`handleDelete` is a stub string error). |
| Findings | Fully wired (`api.analyses` + `api.findings`, 5 s refetch; live progress bar while `analysis.progress` is present) | Severity filter + search, `?severity=`/`?analysis=` URL state, stepped AI-investigation panel (Detected → Summary → Debug → Patch), copy-to-clipboard, CSV/JSON/PDF export, findings tour. Falls back to `sampleFindings` when the live analysis is a sample with no persisted findings. **No Monaco viewer, no live Summary-Agent chat** yet. |
| Dependencies | **Not wired** — uses a static `dependencies: Dependency[]` mock. The API shape does not yet exist. |
| Integrations | Partially wired (`api.integrationStatus` + `api.health`) | "Service Status" uses a hardcoded `serviceCatalog` workaround; the backend response nests provider dicts that the page doesn't fully consume. |
| Settings | **Not wired** — form state only, no GET/POST to an API. Keys are not persisted. Has the "Restart guided tour" control. |
| Root `/` | — | `redirect("/repositories")`. No dashboard at root (intentional). |

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
