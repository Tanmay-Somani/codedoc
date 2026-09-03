# AGENTS.md

## Project status

No longer greenfield. The repo has a working `api/` (Python/FastAPI) and `web/` (Next.js/React) with Docker Compose orchestration. `prompt.md` is the original spec, superseded by README/planning docs — do not delete it until `robot.md` exists per its final line.

## Architecture

Two packages, two runtimes, one Compose stack:

- **`api/`** — Python 3.12 + FastAPI + SQLAlchemy async + Alembic + structlog. Entry: `app/main.py:create_app()`. Worker: `app/worker.py` (Dramatiq over Valkey).
- **`web/`** — Next.js 14 + React 18 + TypeScript strict + Tailwind. App Router (`src/app/`). `@/*` path alias → `./src/*`.
- **Provider registry** (`app/providers/registry.py`) wires all swappable integrations (LLM, search, vector store, vulnerability, cache). LLM fallback chain: OpenRouter → Gemini → Groq → Anthropic → OpenAI → Ollama (FULL profile only).
- **Scanner** (`app/scanner.py`) is a dependency-light LITE-works demo scanner: deterministic heuristic rules + a bundled known-vulnerable-dependency table. No network needed beyond `git clone`. `run_scan()` returns `(findings, file_count, total_bytes)`.

## Developer commands

### Backend (`api/`)

```bash
cd api && pip install -e ".[dev]"   # install with dev deps
pytest                              # all tests (asyncio_mode=auto)
ruff format --check app tests       # format check
ruff check app tests                # lint
mypy app                            # type check (strict)
```

CI order (`api/app` in `.github/workflows/ci.yml`): `ruff format --check` → `ruff check` → `mypy` → `pytest`. All must pass.

### Frontend (`web/`)

```bash
cd web && npm ci
npm run dev                         # Next.js dev server (--turbo)
npm run lint                        # ESLint (next/core-web-vitals)
npm run typecheck                   # tsc --noEmit
npm run build                       # production build
```

CI order: `lint` → `typecheck` → `build`.

### Makefile (repo root)

Aggregate targets — run from repo root, no `cd` needed:

```bash
make test            # pytest (api) + lint+typecheck+build (web)
make lint            # ruff check (api) + eslint (web)
make typecheck       # mypy (api) + tsc (web)
make format          # ruff format (api)
make dev             # docker compose up -d --build
make prod            # docker compose prod stack
```

### Docker Compose

```bash
docker compose up -d --build        # dev (auto-merges compose.override.yaml: hot reload, mounted sources, ports 3000/8000)
docker compose -f compose.yaml -f compose.prod.yml up -d --build              # prod (built images, no mounts, no dev ports)
docker compose -f compose.yaml -f compose.prod.yml -f compose.full.yml --profile full up -d   # full
```

Public demo runs **LITE** only. STANDARD/FULL services live behind Compose profiles.

## Non-negotiable constraints

- **No paid infrastructure.** Every component needs a free tier, OSS self-hosted alternative, Docker container, or local CPU mode.
- **Valkey, not Redis** (OSS-licensing concern). Code uses the `redis` Python package but connects to Valkey (`redis://valkey:6379/0`).
- **GlitchTip, not Sentry cloud.** Sentry SDKs are used but `SENTRY_DSN` must point at self-hosted GlitchTip.
- **Redact before external LLM calls.** `app/core/redaction.py:redact_text()` must run on any content leaving the sandbox (`sk-...` → `[REDACTED_SECRET]`).
- **Demo safety limits** enforced in `app/scanner.py`; tuned via `DEMO_MAX_*` env vars (defaults 256 MB / 5000 files — note `.env.example` may lag behind `config.py` defaults).

## Style and conventions

### Backend

- Ruff: line-length 100, selects `E F I B UP ASYNC`. Per-file ignore `B008` (FastAPI `Depends()`) in `app/api/`.
- mypy strict mode, `ignore_missing_imports = true`.
- pytest `asyncio_mode = "auto"` (no explicit `@pytest.mark.asyncio`), testpaths `tests/`.
- structlog JSON logging only — `get_logger(__name__)`, never `print()` or stdlib `logging` directly.
- Settings via pydantic-settings from `.env` (`app/config.py`). Never log secret values; API keys are encrypted at rest via `KeyVault` (`app/core/security.py`, Fernet from `SECRET_KEY`).
- All ORM models in `app/models/entities.py`. Timestamps via `TimestampMixin` (defined in `app/db/base.py`); enums are `str` (`enum.StrEnum`).
- API deps injected via `app/api/deps.py:get_deps()` → `Deps = dict[str, Any]`.
- Alembic migrations in `api/alembic/versions/`, auto-run (`alembic upgrade head`) on API container start.

### Frontend

- TypeScript strict; no `any`.
- TanStack Query for data fetching (`src/lib/api.ts`); QueryClient defaults staleTime 60s, gcTime 300s, retry 1, no refetch on window focus.
- Tailwind theming via CSS variables (dark mode `class`-based); keep design tokens in `tailwind.config.ts`.
- Shared helpers: `cn()` in `src/lib/utils.ts`; `SeverityBadge`/`formatBytes`/`relativeTime` in `src/lib/severity.tsx`; backend-matching types in `src/lib/types.ts`.
- `api.baseUrl` is exported from `src/lib/api.ts` (`NEXT_PUBLIC_API_URL` or `http://localhost:8000`).

## Gotchas

- `compose.override.yaml` is **auto-loaded** by `docker compose up` in the repo root. Never combine it with `compose.prod.yml` — they conflict.
- The `worker` service runs the same Docker image as `api` but starts `python -m app.worker` (Dramatiq actors). Long-running jobs go here, never in the API process.
- `alembic.ini` uses the sync driver URL; the app engine is async (`postgresql+asyncpg://`). These are separate connection strings — update both when DB connection changes.
- Root `package.json` only holds `framer-motion` — it is **not** the frontend package. Frontend is `web/` (its own `package.json`/`package-lock.json`).
- The base `compose.yaml` publishes no app ports; dev ports come only from `compose.override.yaml`.