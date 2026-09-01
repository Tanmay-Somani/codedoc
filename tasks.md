# Tasks — AI Codebase Doctor

Working roadmap. Each task is checkable; check them off as completed ([x]). Treat this as the canonical backlog — new work gets added here before `implementations.md` is updated.

Legend: LITE = required for core product; STD = STANDARD mode; FULL = FULL mode.

## Phase 0 — Repo foundation

- [x] Create README.md, tasks.md, implementations.md, robot.md
- [ ] git init + initial commit + `.gitignore`
- [ ] `.env.example` with all config surface documented
- [ ] GitHub Actions: lint + typecheck + test (backend, frontend)
- [ ] LICENSE (prefer MIT/Apache-2.0)

## Phase 1 — Infrastructure & Compose

- [ ] `docker-compose.yml` (LITE default): web, api, worker, postgres, valkey, qdrant, minio
- [ ] `docker-compose.full.yml` or profiles: ollama, mlflow, glitchtip, openreplay, prometheus, grafana, loki, otel-collector, searxng
- [ ] Resource-aware `LITE`/`STANDARD`/`FULL` modes (RAM limits, profiles)
- [ ] Reverse proxy (nginx/caddy) config in `infra/`
- [ ] Prometheus scrape config + Grafana dashboards (API Health, Agent Health, LLM Usage, Vector Search, Worker Queue, Repository Analysis, External API Usage)
- [ ] Loki + OpenTelemetry collector config in `infra/`
- [ ] Healthcheck wiring across services (depends_on condition: service_healthy)

## Phase 2 — Backend core

- [ ] FastAPI app factory + settings via pydantic-settings (`.env`)
- [ ] Structured JSON logging (structlog), request ID middleware
- [ ] SQLAlchemy async engine/session + Alembic migrations wired
- [ ] Data model: users, repositories, analyses, findings, vulnerabilities, agents, model_results, patches, tests, api_usage, config, audit_logs
- [ ] `/api/health`, `/api/integrations/status`, `/metrics` (prometheus client)
- [ ] Demo safety limits middleware (repo size/files/concurrency/timeout)
- [ ] Authn: local accounts + optional GitHub OAuth; password hashing

## Phase 3 — Provider abstractions

- [ ] `LLMProvider` with fallback chain: Ollama/OpenAI/Gemini/Groq/OpenRouter/Anthropic
- [ ] `EmbeddingProvider` (local sentence-transformers + HF inference as fallback)
- [ ] `SearchProvider`: SearXNG first, Tavily/Brave/Serper optional
- [ ] `VulnerabilityProvider`: OSV (24h TTL cache), NVD, GitHubAdvisory — merged + deduped + CVSS
- [ ] `PackageProvider`: PyPI, npm, crates.io, Maven, Go
- [ ] `VectorStore`: Qdrant store + PgVector store behind one interface
- [ ] `ObjectStore`: S3 protocol (MinIO/R2/B2/S3)
- [ ] `QueueProvider`: Dramatiq/Celery over Valkey
- [ ] API result cache (Valkey) + rate-limit manager (track remaining/reset/rate per provider)
- [ ] Encrypted API-key storage; keys never logged, never in replay, never in frontend bundles

## Phase 4 — Analysis engine

- [ ] Repository ingestion: clone/archive → housekeeping (size/file limits) → parse
- [ ] Tree-sitter/AST/universal-ctags parsing → code graph + embeddings → Qdrant collections (`repository_code`, `documentation`, `github_issues`, `commit_history`, `security_knowledge`, `external_knowledge`)
- [ ] Static analyzer wrappers as internal APIs: `POST /internal/analyze/{semgrep,bandit,ruff,mypy,eslint,gitleaks,trivy}`
- [ ] Gitleaks integration + secret redaction BEFORE any external LLM call
- [ ] Dependency parser per ecosystem → PyPI/npm/etc → OSV+NVD+Advisory merge pipeline
- [ ] Vulnerability classifier + bug-risk ML models (small, CPU-runnable); MLflow tracking
- [ ] RAG: hybrid BM25 + vector + rerank

## Phase 5 — Agents (LangGraph)

- [ ] Investigation agent: finding → code graph → RAG → git history → docs/search → root cause
- [ ] Patch agent: root cause → patch → sandbox tests → GitHub PR (opt-in)
- [ ] Research agent: `search_web(query)` via SearXNG (never blindly copy SO answers)
- [ ] Security agent: raw finding + code graph + RAG → explanation for humans
- [ ] Agent tool wrappers over static analyzers; tool failure observability

## Phase 6 — Webhook & incremental

- [ ] GitHub webhook receiver: push/PR/issues/release/workflow_run → queued incremental analysis
- [ ] Rate-limit awareness on all webhook-triggered jobs

## Phase 7 — Frontend (LITE)

- [ ] Next.js scaffold: TS + Tailwind + shadcn/ui + TanStack Query + Zustand
- [ ] Dashboard: repo list, analyses, findings, health/integrations panel
- [ ] Analysis flow: connect repo OR "TRY SAMPLE REPOSITORY" (no GitHub needed)
- [ ] Findings explorer: Monaco viewer, severity/CVSS, AI explanation panel
- [ ] Dependency security report view
- [ ] Settings: provider toggles + encrypted API keys (never to client bundle)
- [ ] React Flow: dependency/impact graph; Recharts: metrics
- [ ] No Vercel-specific APIs; static export-or-self-host compatible

## Phase 8 — Observability

- [ ] OTel instrumentation: FastAPI, workers, Postgres, Qdrant, external APIs, LLM calls, agent tools
- [ ] Sentry SDKs in Next.js/FastAPI/workers with DSN → GlitchTip
- [ ] OpenReplay integration with masking of secrets/source sections
- [ ] `/metrics` for LLM latency/tokens, RAG retrieval time, queue size, active workers

## Phase 9 — Voice (FULL, optional)

- [ ] `POST /api/voice/synthesize` → Kokoro 82M TTS (CPU)
- [ ] STT via faster-whisper/whisper.cpp; agent → code RAG → LLM → TTS pipeline
- [ ] Voice never blocks main app (feature-flagged)

## Phase 10 — Demo hardening

- [ ] Sample repository with intentional vulnerabilities (SQLi, bad JWT, hardcoded creds, path traversal, command injection, weak crypto, missing validation, poor tests)
- [ ] Public demo deploy = LITE only; safety limits enforced
- [ ] `docker-compose.full.yml` documented as the recruiter/dev local-stack option

## Phase 11 — Tests & polish

- [ ] Backend pytest: providers (with mocked HTTP), redaction, rate limiter, dependency pipeline
- [ ] Frontend: component smoke tests + CI typecheck
- [ ] End-to-end: sample repo → full analysis → findings rendered
- [ ] Docs refresh; final README wiring diagram
- [ ] Delete `prompt.md` (allowed only once README.md, tasks.md, implementations.md, robot.md exist)