# Implementations — AI Codebase Doctor

Engineering reference for how each subsystem is actually built. Update this file as decisions are
made. Source of truth is the code; when this file conflicts with code, the code wins — fix the file.

## Global conventions

- **Everything runs in Docker Compose.** No dev path requires a paid service.
- **Providers are interfaces.** New provider = new class implementing the interface + registration
  in the registry. Fallback chain: OpenRouter → user-configured alternatives → optional local.
- **OpenRouter is the primary LLM**, one API key routes to many models (free + paid). Models are
  role-routed: **Patch Agent ← coding model, Debug Agent ← reasoning model, Summary Agent ← fast
  model** (env `OPENROUTER_MODEL_CODING` / `_REASONING` / `_FAST`).
- **Secrets:** user-configured API keys are encrypted at rest, decrypted only in-process in the
  API/worker, never logged, never sent to OpenReplay, never shipped to the browser, never passed
  to an external LLM until secrets are redacted.
- **Async workers** do all long work (clone, parse, analyze, ML, agent runs). API enqueues and
  returns job ids.

## Compose topology (dev vs prod)

| File | Purpose |
|---|---|
| `compose.yaml` | Base stack (LITE): postgres, valkey, qdrant, minio, api, worker, web |
| `compose.override.yaml` | **Development** — auto-loaded by `docker compose up`: source mounts, hot reload, dev ports. Do NOT use in prod |
| `compose.prod.yml` | **Production** — built images, no source mounts, healthcheck `depends_on`, restart policies, no dev ports |
| `compose.full.yml` | STANDARD/FULL overlay — heavy/optional services behind `--profile standard` / `--profile full` (ollama, mlflow, glitchtip, openreplay, prometheus, grafana, loki, otel-collector, searxng) |

```bash
docker compose -f compose.yaml -f compose.prod.yml up -d --build     # prod
docker compose --profile full -f compose.yaml -f compose.prod.yml up -d
```

Heavy/optional services ALWAYS behind a profile. Public demo runs LITE only. Internal analyzer
containers are ephemeral sandboxes, not part of the default stack.

## Backend (api/)

- FastAPI app factory (`app.main:create_app`); settings from pydantic-settings reading `.env`
  (see `.env.example`).
- DB: SQLAlchemy 2.x async + asyncpg; Alembic for migrations; models in `app/models/`, imported
  into `app/db/base.py` so `autogenerate` sees them.
- Models (initial): `users`, `repositories`, `analyses`, `findings`, `vulnerabilities`, `agents`,
  `model_results`, `patches`, `api_usage`, `config`, `audit_logs`. JSONB for flexible fields.
- Logging: `structlog` JSON; request-id middleware; never log key material — sanitize at source.
- Secret redaction in `app/core/redaction.py` is a REQUIRED step on repo content before an
  external LLM call. Unit-tested (OpenAI-style keys, GitHub tokens, PEM blocks).
- Static analyzers run as internal endpoints `POST /internal/analyze/{tool}` (sandboxed CLI exec);
  agents call these as tools (no tool shelling directly).

### LLM role routing

`app/providers/llm.py` exposes `build_llm_providers(settings)` and `resolve_role_model(settings, role)`:

| Role | Env var | Default suggestion |
|---|---|---|
| `coding` (Patch Agent) | `OPENROUTER_MODEL_CODING` | `anthropic/claude-sonnet-4` |
| `reasoning` (Debug Agent) | `OPENROUTER_MODEL_REASONING` | `deepseek/deepseek-r1` |
| `fast` (Summary Agent) | `OPENROUTER_MODEL_FAST` | `openai/gpt-4o-mini` |

Fallback order in `build_llm_providers`: **openrouter** → gemini → groq → anthropic → openai.
Ollama is appended ONLY when `OLLAMA_ENABLED=true` (FULL profile, local mode). `Registry.active_llm`
prefers the configured `LLM_PROVIDER`; `llm_complete_with_fallback` tries each until one succeeds.

### Provider registry (app/providers/)

| Interface | Implementations | Notes |
|---|---|---|
| `LLMProvider` | OpenRouterProvider, OllamaProvider(optional), GeminiProvider, GroqProvider, OpenAIProvider, AnthropicProvider | role-routed models; auto-fallback |
| `EmbeddingProvider` | LocalSentenceTransformersProvider, HFInferenceProvider | CPU-friendly small models |
| `SearchProvider` | SearXNGProvider, TavilyProvider, BraveProvider, SerperProvider | SearXNG is the free default |
| `VulnerabilityProvider` | OSVProvider (24h TTL cache), NVDProvider, GitHubAdvisoryProvider | merged, deduped, CVSS-sorted |
| `PackageProvider` | PyPIProvider, NpmProvider, CrateIoProvider, MavenProvider | |
| `VectorStore` | QdrantStore, PgVectorStore (pending) | collections: repository_code, documentation, github_issues, commit_history, security_knowledge, external_knowledge |
| `ObjectStore` | MinIOStore (S3 protocol, pending) | works with R2/B2/S3 unchanged |
| `QueueProvider` | DramatiqProvider/CeleryProvider over Valkey | actor scaffold exists; wire API → queue → worker |

Rate-limit manager stores `{provider, remaining, reset_time, current_rate}` (model `api_usage`
+ Valkey) and surfaces in the Integrations dashboard.

## Agents (LangGraph, Phase 5)

| Agent | Model role | Input → Output |
|---|---|---|
| **Patch Agent** | coding | finding/root cause → diff → sandbox tests → optional PR |
| **Debug Agent** | reasoning | bug/failed test → root-cause report |
| **Summary Agent** | fast | finding → human explanation; chat over RAG context |

All agents share tools: static-analyzer wrapper API, `search_web` (SearXNG), vector search,
git history. Tool failures and token usage are metrics (`app/providers/...` rate tracking +
Prometheus).

## Frontend (web/)

- Next.js (App Router) + TS strict + Tailwind + shadcn/ui. State: TanStack Query (server) +
  Zustand (UI). No Vercel-specific APIs.
- Key surfaces: Dashboard, Repositories, Findings explorer (Monaco + Summary Agent chat),
  Dependency report, Integrations/Health, Settings (providers + keys).
- "TRY SAMPLE REPOSITORY" button posts a special request that uses the bundled `sample-repo/` —
  no GitHub token needed.
- OpenReplay records sessions but masking is mandatory for code areas and credential inputs.

## Analysis engine

1. **Ingest:** clone (URL) / upload archive / bundled sample → demo limits → housekeeping.
2. **Parse:** Tree-sitter per language + universal-ctags symbols → code graph; chunks embedded →
   vectors in Qdrant (or pgvector).
3. **Static findings:** Semgrep / Bandit / Ruff / mypy / ESLint / Gitleaks / Trivy → normalized
   `Finding`.
4. **Dependency pipeline:** manifest/lock per ecosystem → package metadata → OSV + GitHub Advisory
   + NVD → merge/dedupe → CVSS → finding.
5. **Enrich + investigate:** Debug Agent (reasoning) for root cause → Patch Agent (coding) for
   patch → Summary Agent (fast) writes the human explanation.
6. **Redaction:** Gitleaks output drives `[REDACTED_SECRET]` in anything leaving the sandbox.

## Voice (FULL)

- `POST /api/voice/synthesize` returns audio from Kokoro 82M (CPU). STT via faster-whisper.
  Feature-flagged; absence never degrades the app.

## Gotchas / decisions

- GlitchTip uses Sentry-compatible SDKs; `SENTRY_DSN` points at GlitchTip, never Sentry cloud.
- Valkey, not Redis (licensing).
- OpenRouter free/cheap models keep the demo viable with one key — but LLM calls still count into
  rate-limit + cost tracking.
- pg_dump/pg_restore must work — the DB is portable by design.
- Demo limits: repo ≤ 30 MB, files ≤ 1,500, 1 concurrent analysis/user, timeout 10 min.
- Never advertise unlimited processing on the public demo.