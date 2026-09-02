# Tasks — AI Codebase Doctor

Working roadmap. Each task is checkable — flip `[ ]` → `[x]` as you complete it. This is the
canonical backlog; new work gets added here before `implementations.md` is updated.

**Current status:** the runnable product is the **LITE** demo
(`docker compose up -d --build`). The UI has been overhauled (dashboard, findings explorer,
driver.js onboarding tour, exports, responsive layout); the API/worker/web containers have
healthchecks; startup env validation and Docker hardening shipped. **Phases 4–9 and several items
below under Phase 3/7/8 are NOT yet implemented.** See `implementations.md` for the
actual-vs-aspirational breakdown.

Legend: **LITE** = core product · **STD** = STANDARD mode · **FULL** = FULL mode.

## Phase 0 — Repo foundation

- [x] git init (`main`), `.gitignore`, `.gitattributes`, initial commit, remote `origin`
- [x] GitHub repo `Tanmay-Somani/codedoc` (public) created + pushed
- [x] `.env.example` with the full configuration surface documented
- [x] MIT LICENSE
- [x] README.md (comprehensive), tasks.md, implementations.md
- [x] GitHub Actions CI: backend (ruff, mypy, pytest) + frontend (lint, typecheck, build) +
      docker image smoke build (`.github/workflows/ci.yml`)
- [ ] Repo topics/description finalization; release tags when milestone ships
- [ ] `robot.md` does NOT exist yet — keeping it as a Phase 0 deliverable

## Phase 1 — Infrastructure & Compose

- [x] `compose.yaml` base stack: web, api, worker, postgres, valkey, qdrant, minio (LITE)
- [x] `compose.full.yml` + profiles (`--profile standard` / `--profile full`)
- [x] Dev/prod split: `compose.override.yaml` (hot reload, mounted sources, dev ports) and
      `compose.prod.yml` (built images, no mounts, restart policies)
- [x] Reverse proxy (Caddy) config in `infra/caddy/Caddyfile` with TLS example
- [ ] Prometheus scrape config + Grafana dashboards (infra scaffolding exists in
      `infra/prometheus`, `infra/grafana`; dashboards/metrics targets not finalized)
- [ ] Loki + OTel collector config (`infra/otel/config.yaml` exists; not wired into app)
- [x] Healthcheck wiring across services: infra services (postgres/valkey/qdrant/minio) + app
      services (api → `/health`, web → HTTP 200, worker → process liveness) with
      `depends_on: condition: service_healthy` (api requires postgres/valkey/qdrant, web requires api)
- [ ] Resource limits per service (maps to LITE/STANDARD/FULL RAM budgets)
- [x] `sample-repo/` with intentional vulnerabilities (SQLi, hardcoded secret, weak auth) — exists, may grow
- [x] Demo safety limits enforced (LITE: repo ≤ 256 MB, files ≤ 5,000, 1 concurrent/user, 10 min timeout)

## Phase 2 — Backend core

- [x] FastAPI app factory + pydantic-settings (`.env`)
- [x] Structured JSON logging (structlog), request-id ready
- [x] SQLAlchemy async engine/session + Alembic (`0001_initial`)
- [x] ORM model surface: users, repositories, analyses, findings, vulnerabilities, agents,
      model_results, patches, api_usage, config, audit_logs
- [x] `/health` (with `version`), `/api/integrations/status`, skeleton `/metrics`
- [x] Demo analysis flow via `BackgroundTasks` + 2 s placeholder (NOT Dramatiq for LITE)
- [ ] Demo safety limits **unit-tested** (enforced in code; no dedicated tests)
- [ ] Authn: local accounts + GitHub OAuth; password hashing; replace dev bootstrap user

## Phase 3 — Provider abstractions

- [x] Interfaces: `LLMProvider`, `EmbeddingProvider`, `SearchProvider`, `VulnerabilityProvider`,
      `PackageProvider`, `VectorStore`, `ObjectStore`, `Cache`, `RateLimitState` (Protocols in base.py)
- [x] OpenRouter primary with 3 role models (`OPENROUTER_MODEL_CODING/REASONING/FAST`)
- [x] Fallback chain: OpenRouter → (user-configured) Gemini / Groq / Anthropic / OpenAI; Ollama
      optional (FULL only, `OLLAMA_ENABLED=true`)
- [ ] `EmbeddingProvider` impl (interface only; no local sentence-transformers implementation wired)
- [x] `SearchProvider`: SearXNG default; Tavily/Brave/Serper optional
- [x] `VulnerabilityProvider`: OSV (cached, in-memory) + NVD + GitHub Advisory → merged/deduped/CVSS-sorted
- [ ] `PackageProvider` wired into Registry (implementations exist in `package.py`; not registered)
- [x] `VectorStore`: Qdrant store; pgvector store (pending)
- [ ] `ObjectStore`: MinIO/S3 implementation
- [ ] `QueueProvider`: Dramatiq/Celery over Valkey (scaffold in `worker.py`; not wired to API)
- [ ] API result cache in Valkey + `api_usage` rate-limit persistence (rate tracking is in-memory)
- [ ] Encrypted API-key storage via `KeyVault` exposed over HTTP (`/api/config` GET/POST not yet wired)

## Phase 4 — Analysis engine

- [ ] Repository ingestion: clone/archive → housekeeping → demo-limit enforcement (clone exists for URL repos; no archive upload)
- [ ] Tree-sitter / AST / Universal Ctags parsing → code graph + embeddings → Qdrant collections (not implemented; scanner is regex-based)
- [ ] Static analyzer wrappers: `POST /internal/analyze/{semgrep,bandit,ruff,mypy,eslint,gitleaks,trivy}`
- [ ] Gitleaks integration + redaction gate (redaction core exists + tested; no Gitleaks scan yet)
- [ ] Dependency parser per ecosystem → package metadata → OSV + NVD + Advisory merge pipeline (offline bundled `_VULN_DB` only)
- [ ] Vulnerability/classification + bug-risk ML models; MLflow tracking (not implemented)
- [ ] RAG: hybrid BM25 + vector + rerank (not implemented)

## Phase 5 — Agents (LangGraph, role-routed)

- [ ] Patch Agent (coding), Debug Agent (reasoning), Summary Agent (fast) — not implemented; only
      role-routed provider selection exists today
- [ ] Shared agent tools: `search_web`, static-analyzer wrappers, vector search
- [ ] Agent tool-failure observability (Prometheus + OTel)

## Phase 6 — Webhook & incremental

- [ ] GitHub webhook receiver: push / PR / issues / release / workflow_run → queued incremental analysis

## Phase 7 — Frontend (LITE)

- [x] Next.js scaffold: TS strict + Tailwind + custom ui/ + TanStack Query (no Zustand, no shadcn install, no Monaco, no React Flow)
- [x] Dashboard page (`/dashboard`): risk score hero, severity bar, stat cards, recent-analyses
      timeline, integrations panel (root `/` still redirects to `/repositories` by design)
- [x] Analysis flow: connect repo **or** "TRY SAMPLE REPOSITORY" (no GitHub needed)
- [ ] Findings explorer: Monaco viewer + Summary-Agent chat (findings list fully shipped — severity
      filtering, `?severity=`/`?analysis=` URL state, stepped AI-investigation panel, copy-to-clipboard,
      CSV/JSON/PDF export; **no Monaco, no live chat** yet)
- [ ] Dependency security report view — **API-wired** (currently static mock; add `GET /api/dependencies`)
- [ ] Settings: provider toggles + encrypted API keys — **API-wired** (currently form-only; add `GET/POST /api/config`)
- [ ] Delete-repository end-to-end (backend DELETE + frontend mutation)
- [ ] React Flow dependency/impact graph; Recharts metrics (Recharts present & used; React Flow not added)
- [x] No Vercel-specific APIs; self-host / standalone-output compatible
- [x] **driver.js** guided tour shipped: first-run onboarding for the repositories flow
      (connect form → try sample) plus a findings deep-dive tour; opt-out via Settings → "Restart
      guided tour" (replays); `useOnboardingTour` + `lib/tour.ts` localStorage gates

## Phase 8 — Observability

- [ ] OTel instrumentation (FastAPI, Postgres, Qdrant, external APIs, LLM calls, agent tools)
- [ ] Sentry SDKs (DSN → GlitchTip); GlitchTip configured, not instrumented in code
- [ ] OpenReplay integration with secret/source masking
- [ ] `/metrics`: LLM latency/tokens per role, RAG time, queue size, external usage

## Phase 9 — Voice (FULL, optional)

- [ ] `POST /api/voice/synthesize` → Kokoro 82M TTS (CPU); STT via faster-whisper (feature-flagged)

## Phase 10 — Demo hardening

- [x] `sample-repo/` with intentional vulnerabilities
- [x] LITE-only public demo; safety limits enforced everywhere
- [x] `compose.full.yml` as the full-local-stack option

## Phase 11 — Tests & polish

- [x] Backend startup env validation (`Settings.check_environment()`) — warns/criticals logged by
      `create_app`; never blocks the LITE demo
- [x] Docker hardening: `api/Dockerfile` multi-stage + non-root user + HEALTHCHECK, `web/Dockerfile`
      HEALTHCHECK, `api/.dockerignore`, `web/.dockerignore`, compose app healthchecks
- [x] Root `Makefile`: `make dev/prod/full/down/logs` + per-package `test/lint/typecheck/build`
- [x] UI polish shipped: Space Grotesk + clinical palette, footer (guided tour, platform health, GitHub),
      Sonner toasts, responsive sidebar drawer, `animate-breathe` status dots
- [x] Backend pytest: redaction, rate-limit tracking (pure-logic, no DB)
- [ ] Backend pytest: providers (mocked HTTP via respx), dependency pipeline shape, cache TTL
- [ ] Backend pytest: route-level tests (`ASGITransport` + in-memory DB override) for dependencies/config/analyze redaction
- [ ] Frontend component smoke tests + CI typecheck
- [ ] E2E: sample repo → analysis → findings rendered in UI
- [ ] Final README wiring diagram + screenshots
- [ ] Delete `prompt.md` once `README.md`, `tasks.md`, `implementations.md` and `robot.md` exist (robot.md pending)
