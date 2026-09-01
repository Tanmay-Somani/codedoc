# Tasks — AI Codebase Doctor

Working roadmap. Each task is checkable — flip `[ ]` → `[x]` as you complete it. This is the
canonical backlog; new work gets added here before `implementations.md` is updated.

Legend: **LITE** = core product · **STD** = STANDARD mode · **FULL** = FULL mode.

## Phase 0 — Repo foundation

- [x] Create README.md, tasks.md, implementations.md, robot.md, prompt.md
- [x] git init (`main`), `.gitignore`, `.gitattributes`, initial commit, remote `origin`
- [x] GitHub repo `Tanmay-Somani/codedoc` (public) created + pushed
- [x] `.env.example` with the full configuration surface documented
- [x] MIT LICENSE
- [ ] GitHub Actions CI: backend (ruff, mypy, pytest) + frontend (lint, typecheck, build)
- [ ] Repo topics/description finalization; release tags when milestone ships

## Phase 1 — Infrastructure & Compose

- [x] `compose.yaml` base stack: web, api, worker, postgres, valkey, qdrant, minio (LITE)
- [x] `docker-compose.full.yml` → renamed/merged into `compose.full.yml` + profiles
- [ ] **Dev/Prod split:** `compose.override.yaml` (dev: hot reload, mounted sources) and `compose.prod.yml` (prod: built images, no mounts, healthchecks, restart policies)
- [ ] Reverse proxy (Caddy or Nginx) config in `infra/` with TLS example
- [ ] Prometheus scrape config + Grafana dashboards (API Health, Agent Health, LLM Usage, Vector Search, Worker Queue, Repository Analysis, External API Usage)
- [ ] Loki + OpenTelemetry collector config in `infra/`
- [ ] Healthcheck wiring across services (`depends_on: condition: service_healthy`)
- [ ] Resource limits per service (maps to LITE/STANDARD/FULL RAM budgets)

## Phase 2 — Backend core

- [x] FastAPI app factory + pydantic-settings (`.env`)
- [x] Structured JSON logging (structlog), request-id middleware
- [x] SQLAlchemy async engine/session + Alembic (hand-written `0001_initial`)
- [x] Data model: users, repositories, analyses, findings, vulnerabilities, agents, model_results, patches, api_usage, config, audit_logs
- [x] `/api/health`, `/api/integrations/status`, skeleton `/metrics`
- [ ] Demo safety limits middleware (repo size / files / concurrency / timeout) enforced + tested
- [ ] Authn: local accounts + optional GitHub OAuth; password hashing; replace dev bootstrap user

## Phase 3 — Provider abstractions

- [x] Interfaces: `LLMProvider`, `SearchProvider`, `VulnerabilityProvider`, `PackageProvider`, `VectorStore`, `ObjectStore`, `QueueProvider`, `Cache`, rate-limit tracking
- [x] **OpenRouter first** (`OpenRouterProvider`, chat-completions compatible) with **3 role models** driven by agent: `OPENROUTER_MODEL_CODING` / `_REASONING` / `_FAST`
- [x] Fallback chain: OpenRouter → (user-configured) Gemini / Groq / OpenAI / Anthropic; **Ollama optional** (FULL profile only, `OLLAMA_ENABLED=true`)
- [x] `EmbeddingProvider`: local sentence-transformers (CPU); HF inference optional
- [x] `SearchProvider`: SearXNG default; Tavily/Brave/Serper optional
- [x] `VulnerabilityProvider`: OSV (24h TTL cache) + NVD + GitHubAdvisory → merged, deduped, CVSS-sorted
- [x] `PackageProvider`: PyPI, npm, crates.io, Maven
- [x] `VectorStore`: Qdrant store; pgvector store behind same interface (implementation pending)
- [ ] `ObjectStore`: MinIO S3-store implementation
- [ ] `QueueProvider`: Dramatiq/Celery over Valkey (actor scaffold exists; wire into API)
- [ ] API result cache (Valkey) verified end-to-end + rate-limit manager persisted in `api_usage`
- [ ] Encrypted API-key storage via `KeyVault`; keys never logged / replayed / bundled

## Phase 4 — Analysis engine

- [ ] Repository ingestion: clone/archive → housekeeping → parse; enforcement of demo limits
- [ ] Tree-sitter / AST / universal-ctags parsing → code graph + embeddings → Qdrant collections (`repository_code`, `documentation`, `github_issues`, `commit_history`, `security_knowledge`, `external_knowledge`)
- [ ] Static analyzer wrappers: `POST /internal/analyze/{semgrep,bandit,ruff,mypy,eslint,gitleaks,trivy}` (sandboxed CLI exec)
- [ ] Gitleaks integration + redaction gate before any external LLM call (redaction core exists + tested)
- [ ] Dependency parser per ecosystem → package metadata → OSV + NVD + Advisory merge pipeline
- [ ] Vulnerability classifier + bug-risk ML models (small, CPU-runnable); MLflow tracking
- [ ] RAG: hybrid BM25 + vector + rerank

## Phase 5 — Agents (LangGraph, OpenRouter role-routed)

- [ ] **Patch Agent** (coding model): root cause → diff → sandbox tests → optional GitHub PR
- [ ] **Debug Agent** (reasoning model): bug/failed-test investigation → root cause report
- [ ] **Summary Agent** (fast model): finding triage, human explanations, chat over RAG context
- [ ] Shared tools: `search_web` (SearXNG) — never blindly copy SO answers
- [ ] Agent tool wrappers over static analyzers; tool-failure observability (Prometheus + OTel)

## Phase 6 — Webhook & incremental

- [ ] GitHub webhook receiver: push / PR / issues / release / workflow_run → queued incremental analysis
- [ ] Rate-limit awareness on webhook-triggered jobs

## Phase 7 — Frontend (LITE)

- [ ] Next.js scaffold: TS strict + Tailwind + shadcn/ui + TanStack Query + Zustand
- [ ] Dashboard: repo list, analyses, findings, Integrations/health panel
- [ ] Analysis flow: connect repo **or** "TRY SAMPLE REPOSITORY" (no GitHub needed)
- [ ] Findings explorer: Monaco viewer, severity/CVSS, AI explanation panel (Summary Agent chat)
- [ ] Dependency security report view
- [ ] Settings: provider toggles + encrypted API keys (never shipped to the client)
- [ ] React Flow dependency/impact graph; Recharts metrics
- [ ] No Vercel-specific APIs; export-or-self-host compatible

## Phase 8 — Observability

- [ ] OTel instrumentation: FastAPI, workers, Postgres, Qdrant, external APIs, LLM calls, agent tools
- [ ] Sentry SDKs (web/worker/api) with DSN → **GlitchTip**
- [ ] OpenReplay integration with masking of secrets/source sections
- [ ] `/metrics`: LLM latency/tokens per role, RAG retrieval time, queue size, active workers

## Phase 9 — Voice (FULL, optional)

- [ ] `POST /api/voice/synthesize` → Kokoro 82M TTS (CPU)
- [ ] STT via faster-whisper / whisper.cpp; voice never blocks the main app (feature-flagged)

## Phase 10 — Demo hardening

- [ ] `sample-repo/` with intentional vulnerabilities (SQLi, bad JWT, hardcoded creds, path traversal, command injection, weak crypto, missing validation)
- [ ] Public demo deploy = LITE only; safety limits enforced everywhere
- [ ] `compose.full.yml` documented as the recruiter/dev full-local-stack option

## Phase 11 — Tests & polish

- [x] Backend pytest: redaction, rate-limit tracking
- [ ] Backend pytest: providers (mocked HTTP via respx), dependency pipeline, cache TTL
- [ ] Frontend component smoke tests + CI typecheck
- [ ] E2E: sample repo → analysis → findings rendered
- [ ] Final README wiring diagram + screenshots
- [ ] Archive `prompt.md` → git history (superseded by README/planning docs)