<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/github/actions/workflow/status/Tanmay-Somani/codedoc/ci.yml" alt="CI"/>
  <img src="https://img.shields.io/badge/Python-3.12-3776AB.svg" alt="Python 3.12"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688.svg" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Next.js-15-black.svg" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6.svg" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1.svg" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Qdrant-v1.12-5067F5.svg" alt="Qdrant"/>
  <img src="https://img.shields.io/badge/Valkey-8-8DC966.svg" alt="Valkey"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED.svg" alt="Docker Compose"/>
  <img src="https://img.shields.io/badge/LLM-OpenRouter-7C4DFF.svg" alt="OpenRouter"/>
</p>

<h1 align="center">AI Codebase Doctor</h1>

<p align="center">
  An open-source, self-hostable AI platform that analyzes any codebase for vulnerabilities, bugs,
  and dependency risk — then explains each finding, proposes patches, and can open pull requests.
</p>

<p align="center"><b>Deployable without paid infrastructure.</b> No hard AWS/GCP/Azure/Datadog/Sentry dependencies.</p>

---

## Why

Most code analysis tools dump a raw finding list on you. This project turns findings into
**investigations**: every issue is enriched with OSV/NVD/GitHub Advisory intelligence, code-graph
context, git history, and web research — then reasoned over by role-specific agents that produce a
root cause, a patch, and a human explanation.

## Architecture

```
      AI CODEBASE DOCTOR
              │
              ▼
     ┌─────────────────┐
     │   AI GATEWAY     │   FastAPI — ingestion, analysis orchestration,
     │    (FastAPI)     │   provider abstraction, RAG, task queue
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │    OPENROUTER   │   One API key → many models (free + paid), role-routed
     └────────┬────────┘
          ┌───┴───┬───────┐
          ▼       ▼       ▼
   Coding     Reasoning  Fast
   Model      Model      Model
          │       │       │
          ▼       ▼       ▼
   Patch    Debug    Summary
   Agent    Agent    Agent
```

| Role | Model (OpenRouter) | Agent | Delivers |
|---|---|---|---|
| Coding | `OPENROUTER_MODEL_CODING` | **Patch Agent** | Production-ready diff + sandbox tests + PR |
| Reasoning | `OPENROUTER_MODEL_REASONING` | **Debug Agent** | Root-cause analysis of bugs and failed tests |
| Fast | `OPENROUTER_MODEL_FAST` | **Summary Agent** | Quick summaries, triage, chat over findings |

Each layer talks to the next through interfaces (`LLMProvider`, `VulnerabilityProvider`,
`VectorStore`, …), so any provider can be swapped without redesigning the system.

Sub-systems that feed the agents:

```
Static analyzers (Semgrep, Bandit, Ruff, mypy, ESLint, Gitleaks, Trivy)
        → Findings → Investigation → Root cause → Patch → PR
Dependency manifests → PyPI/npm/crates/Maven → OSV + NVD + GitHub Advisory → CVSS findings
Repository code → Tree-sitter + code graph + RAG (Qdrant/pgvector) → context for every agent
```

## Deployment modes

| Mode | Services | Use case |
|---|---|---|
| **LITE** | web, api, worker, PostgreSQL, Qdrant, Valkey, MinIO, OpenRouter API | Public demo, 1–2 GB RAM |
| **STANDARD** | + MLflow, SearXNG, GlitchTip, Prometheus, Grafana | Moderate self-hosted server |
| **FULL** | + optional local Ollama, OpenReplay, Loki, voice (Kokoro/faster-whisper) | Capable hardware, full observability |

The public demo runs **LITE** only. Heavy services live behind Compose profiles.

## Getting started

### Development

```bash
https://codedoc-ruddy.vercel.app/
cd codedoc
cp .env.example .env        # set OPENROUTER_API_KEY (see note below)
docker compose up -d --build # pulls everything, runs migrations, starts web + api
```

- Web: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>

Run services without Docker:

```bash
# backend
cd api && python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload                            # then set DATABASE_URL to local PG

# frontend
cd web && npm install && npm run dev                     # then set NEXT_PUBLIC_API_URL
```

Verify:

```bash
# backend
cd api && pytest && ruff check . && mypy app
# frontend
cd web && npm run lint && npm run typecheck && npm run build
```

### Production

Run the production stack (built images, no source mounts, healthchecks, restart policies):

```bash
docker compose -f compose.yaml -f compose.prod.yml up -d --build
```

Enable optional services (STANDARD/FULL sets):

```bash
docker compose --profile standard -f compose.yaml -f compose.prod.yml up -d
docker compose --profile full     -f compose.yaml -f compose.prod.yml up -d
```

Production checklist:

- Set a strong `SECRET_KEY` and unique DB/MinIO passwords in `.env`.
- Put the app behind Caddy or Nginx with TLS (example config in `infra/caddy`).
- Point `SENTRY_DSN` at your self-hosted **GlitchTip** (never Sentry cloud).
- Enforce the demo safety limits (`DEMO_MAX_REPO_MB`, `DEMO_MAX_FILES`, …) on public instances.
- Back up PostgreSQL (`pg_dump`) — the database is portable by design.

### API keys you'll need

| Service | Needed for | Cost |
|---|---|---|
| **OpenRouter** | All LLM features (Patch/Debug/Summary agents) | Free tier models available |
| GitHub OAuth token | Connecting real repositories (optional in demo) | Free |
| GitLab/Bitbucket | Optional extra repo sources | Free |
| SearXNG | Self-hosted web search | Free (self-hosted) |
| OSV / NVD / PyPI / npm / crates.io / Maven | Security & package data | Free, no key |

> Your keys live in `.env` / server environment only. They are encrypted at rest, never logged,
> never embedded in the frontend, and never sent to session replay.

## Guided tutorial (driver.js)

A first-run, client-only tour (powered by `driver.js`) walks through the core flow — no backend
involved:

1. **Repositories** — on first visit, three steps highlight the repo list, the connect form, and the
   "TRY SAMPLE REPOSITORY" button.
2. **Findings** — after visiting a repository, `/findings` highlights the findings list, the severity
   filter, and the AI-investigation panel.

Replay it anytime from **Settings → Help → Restart guided tour** or the **"Guided tour" link in the
footer**. Progress lives in `localStorage` (`codedoc_tour_done`, `codedoc_visited_repos`).

## Repository layout

```
compose.yaml          Base Compose stack (PostgreSQL, Qdrant, Valkey, MinIO, api, worker, web)
compose.override.yaml Development overlay (hot reload, mounted sources) — auto-loaded by `docker compose up`
compose.prod.yml      Production overlay (built images, no mounts, healthchecks, restart policies)
compose.full.yml      FULL-profile services (Ollama, MLflow, GlitchTip, OpenReplay, observability, SearXNG)
api/                  FastAPI backend — providers, analysis engine, scanner, models, Alembic
web/                  Next.js frontend — dashboard, findings explorer, dependency report, settings
infra/                Prometheus, Grafana, Loki, OpenTelemetry, reverse-proxy configs
sample-repo/          Intentionally vulnerable demo repo (used by the "TRY SAMPLE" button)
Makefile              Dev shortcut targets (docker compose + per-package test/lint/build)
prompt.md             Original master spec (superseded by README/planning docs)
```

## Security

- Gitleaks findings drive secret redaction: any content leaving the sandbox to an external LLM
  passes through `[REDACTED_SECRET]` redaction first.
- API keys are encrypted at rest, never logged, never in session replay, never in the frontend.
- OpenReplay recordings mask source-code sections and credential inputs.

## Roadmap

See [`tasks.md`](tasks.md) for the full, checkable backlog; [`implementations.md`](implementations.md)
documents how each subsystem is built.

Shipped: LITE demo (`docker compose up -d --build`), the UI overhaul (dashboard, findings explorer,
driver.js onboarding tour, exports), healthchecks + Docker hardening, startup env validation, and a
root `Makefile`. Remaining backlog: LangGraph agents, deeper analysis engine (parsers, analyzer
wrappers, live OSV/NVD), Observability (OTel/GlitchTip/`/metrics`), voice, auth, and webhooks.

## License

MIT — see [LICENSE](LICENSE). 

# Contributions welcome: open an issue or PR.
