> **STATUS — this file is the ORIGINAL master spec (1770 lines), retained as history.**
> It has been superseded by [`README.md`](README.md), [`tasks.md`](tasks.md), and
> [`implementations.md`](implementations.md), which are kept in sync with the code ("the code
> wins"). Do **not** delete this file yet — per its final line and `AGENTS.md`, deletion is gated on
> `README.md`, `tasks.md`, `implementations.md` and `robot.md` all existing; `robot.md` has not been
> created yet, so this spec is preserved.
>
> Quick current-state map (see `tasks.md` for the live checklist):
> - **Current runnable product = LITE demo** (`docker compose up -d --build`). Backend: FastAPI +
>   async SQLAlchemy + Alembic `0001_initial` + structlog JSON + a dependency-light heuristic
>   scanner (`app/scanner.py`) + OpenRouter role-routed LLM fallback chain. Frontend: Next.js 14 +
>   TS strict + Tailwind + TanStack Query; pages: `/repositories`, `/findings`, `/dependencies`,
>   `/integrations`, `/settings`.
> - **NOT yet implemented** (aspirational, full stack): LangGraph agents (Patch/Debug/Summary),
>   tree-sitter code graph + embeddings-to-Qdrant, Semgrep/Bandit/Ruff/mypy/ESLint/Trivy scanner
>   wrappers, live OSV/NVD package-vuln merge pipeline, ML bug-risk models + MLflow tracking,
>   hybrid BM25+vector RAG reranker, voice (Kokoro/faster-whisper), OpenReplay session replay,
>   full Prometheus/Grafana/Loki dashboards, GitHub webhook incremental analysis, full authn
>   (OAuth), and wiring the remaining frontend pages (Dependencies/Settings) to the API.
> - This session's change: documented an optional `driver.js` guided tour in `README.md` (opt-in,
>   client-only; not bundled until enabled).
>
> The narrative below remains the design intent; where it conflicts with shipped code, the code in
> `api/` and `web/` wins — fix this file (or `implementations.md`) to match.

Yes. Then the architecture should be designed around **free/open-source/self-hostable components**, with external APIs used where they materially improve capability.

For your specific constraints, I would make these changes:

* **Error tracking:** GlitchTip
* **Session replay:** OpenReplay
* **Voice/TTS:** Kokoro 82M
* **Database:** PostgreSQL, self-hostable
* **Vector DB:** Qdrant, self-hostable
* **Cache/queue:** Redis or Valkey
* **Storage:** MinIO, self-hostable
* **Monitoring:** Prometheus + Grafana
* **Tracing:** OpenTelemetry
* **ML tracking:** MLflow
* **LLM gateway:** OpenRouter (primary — one key, role-routed coding/reasoning/fast models), optional local Ollama (FULL)
* **Deployment:** everything Dockerized so it can run on one VPS / free compute host / local server
* **APIs:** GitHub, OSV, NVD/CVE, Stack Exchange, package registries, OpenRouter, documentation/search APIs

I would also **avoid making AWS/GCP/Azure mandatory**.

Use this addition/replacement for your master specification:

# AI CODEBASE DOCTOR — FREE DEPLOYMENT + OPEN-SOURCE + API-FIRST ARCHITECTURE

The entire AI Codebase Doctor must be designed around one fundamental constraint:

> **The complete application must be deployable without requiring paid infrastructure.**

Every core component must therefore have one of the following:

1. A completely free hosted tier.
2. An open-source self-hosted alternative.
3. The ability to run through Docker on the user's own Linux server.
4. A local CPU-compatible mode where practical.

Avoid architecture that requires AWS, GCP, Azure, Datadog, proprietary vector databases, proprietary observability platforms, or permanently paid LLM APIs.

All infrastructure components must communicate through documented APIs so that one provider can be replaced without redesigning the application.

---

# 1. DEPLOYMENT PRINCIPLE

Design the system as a portable containerized application.

```text
                    INTERNET
                       │
                       ▼
                 Reverse Proxy
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Frontend        FastAPI       WebSockets
        │              │
        └──────────────┼──────────────┐
                       │              │
                  AI Gateway      Job Queue
                       │              │
          ┌────────────┼──────────┐   │
          ▼            ▼          ▼   ▼
        RAG          ML/DL      Agents Workers
          │            │          │
          └────────────┼──────────┘
                       │
     ┌─────────────────┼─────────────────────┐
     ▼                 ▼                     ▼
 PostgreSQL          Qdrant                 MinIO
     │                                       │
     └─────────────────┬─────────────────────┘
                       ▼
                Observability
```

Everything should run through Docker Compose.

The application should be runnable with approximately:

```bash
git clone <repository>
cd ai-codebase-doctor
docker compose up -d
```

---

# 2. FREE DEPLOYMENT OPTIONS

Support multiple deployment configurations.

## Option A — Completely self-hosted

Run everything on:

* Linux server
* old desktop
* mini PC
* Oracle Cloud free VM where available
* university/server infrastructure
* personal VPS
* home server

Required software:

* Docker
* Docker Compose
* Git
* reverse proxy

No proprietary cloud dependency.

---

# 3. FRONTEND

Use:

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* TanStack Query
* Zustand
* Monaco Editor
* React Flow
* Recharts

Deployment options:

* Cloudflare Pages
* Vercel free tier
* Netlify free tier
* self-hosted Next.js container

The frontend must not depend on Vercel-specific APIs.

---

# 4. BACKEND

Use:

* Python
* FastAPI
* Pydantic
* SQLAlchemy
* Alembic
* Uvicorn
* Gunicorn where appropriate

Run as a Docker container.

Do not depend on proprietary serverless functions.

---

# 5. DATABASE

Use:

# PostgreSQL

PostgreSQL should be the primary database.

Reasons:

* open source
* self-hostable
* mature
* relational
* JSONB
* full-text search
* extensions
* pgvector support
* easy Docker deployment

Store:

* users
* repositories
* commits
* analyses
* findings
* vulnerabilities
* agents
* model results
* patches
* tests
* API usage
* configuration
* audit logs

Example Docker service:

```text
postgres
    ↓
persistent volume
    ↓
all application state
```

The database must be portable so a user can export it and move it to another server.

Support:

```bash
pg_dump
pg_restore
```

Never make the database dependent on a proprietary managed service.

---

# 6. VECTOR DATABASE

Use:

# Qdrant

Run Qdrant locally or remotely.

Use it for:

* source-code embeddings
* documentation
* issues
* commits
* PRs
* vulnerability descriptions
* Stack Overflow results
* package documentation

Collections:

```text
repository_code
documentation
github_issues
commit_history
security_knowledge
external_knowledge
```

Alternative:

PostgreSQL + pgvector.

The application should implement a VectorStore abstraction:

```text
VectorStore
├── QdrantStore
└── PgVectorStore
```

---

# 7. OBJECT STORAGE

Use:

# MinIO

Use MinIO as a self-hosted S3-compatible object store.

Store:

* repository archives
* ML models
* datasets
* logs
* generated reports
* patches
* experiment artifacts

Implement using the S3 protocol.

This makes the system compatible with:

* MinIO
* AWS S3
* Cloudflare R2
* Backblaze B2
* other S3-compatible providers

without rewriting the application.

---

# 8. REDIS REPLACEMENT / CACHE

Use:

# Valkey

Prefer Valkey because it is open source.

Redis-compatible APIs may also be supported.

Use for:

* caching
* task queues
* rate limiting
* temporary agent state
* distributed locks
* job progress
* pub/sub

---

# 9. ASYNC WORKERS

Use:

* Celery
* Dramatiq

with Valkey/Redis.

Long-running repository analysis must happen asynchronously.

Example:

```text
API request
   ↓
Create analysis job
   ↓
Queue
   ↓
Worker
   ↓
Clone repo
   ↓
Parse
   ↓
Analyze
   ↓
ML inference
   ↓
Agent investigation
   ↓
Persist
```

---

# 10. ERROR TRACKING

Use:

# GlitchTip

GlitchTip should replace proprietary Sentry hosting.

It is Sentry SDK compatible.

Use Sentry-compatible SDKs in:

* Next.js
* FastAPI
* background workers

Configure through:

```env
SENTRY_DSN=
```

The DSN should point to GlitchTip.

Track:

* frontend crashes
* backend exceptions
* worker failures
* failed agent executions
* model inference errors
* API failures

---

# 11. SESSION REPLAY

Use:

# OpenReplay

Self-host OpenReplay.

Capture:

* frontend sessions
* UI errors
* failed repository interactions
* navigation flows
* frontend performance

Integrate OpenReplay with the Next.js frontend.

Do NOT send sensitive source-code contents or credentials into replay recordings.

Mask:

* repository tokens
* API keys
* secrets
* source-code sections where required
* user credentials

---

# 12. VOICE

Integrate:

# Kokoro

Use Kokoro 82M for text-to-speech.

Properties:

* approximately 82M parameters
* CPU-capable
* local inference
* open-source-friendly deployment

Use it to create an optional:

# Voice AI Code Reviewer

The user can ask:

"Explain why this vulnerability is dangerous."

The AI Code Doctor produces the explanation and Kokoro speaks the response.

Pipeline:

```text
User question
     ↓
Agent
     ↓
Code RAG
     ↓
LLM response
     ↓
Kokoro
     ↓
Audio response
```

Expose:

```text
POST /api/voice/synthesize
```

Voice is optional and should not prevent the main application from functioning.

---

# 13. SPEECH-TO-TEXT

Add optional speech input.

Use:

* faster-whisper
* Whisper
* whisper.cpp

Allow:

```text
microphone
   ↓
speech recognition
   ↓
"Find the authentication vulnerability"
   ↓
Agent
```

This creates a complete:

```text
Voice
 ↓
STT
 ↓
Agent
 ↓
Code analysis
 ↓
TTS
```

developer interface.

---

# 14. OBSERVABILITY

Do not use Datadog/New Relic as core dependencies.

Use:

# OpenTelemetry

Instrument:

* FastAPI
* workers
* PostgreSQL
* Qdrant
* external API calls
* LLM calls
* ML inference
* agent tools

Track traces across:

```text
Frontend
 ↓
API
 ↓
Agent
 ↓
RAG
 ↓
LLM
 ↓
Database
```

---

# 15. METRICS

Use:

# Prometheus

Expose:

```text
/metrics
```

Track:

* HTTP requests
* errors
* latency
* LLM latency
* LLM calls
* tokens
* RAG retrieval time
* vector queries
* database latency
* agent runs
* tool failures
* ML inference
* queue size
* active workers

---

# 16. DASHBOARDS

Use:

# Grafana

Build dashboards for:

```text
API Health

Agent Health

LLM Usage

ML Model Performance

Vector Search

Worker Queue

Repository Analysis

External API Usage
```

---

# 17. LOGGING

Use structured JSON logs.

Recommended:

* structlog
* Python logging
* OpenTelemetry

Optionally aggregate with:

* Grafana Loki

Architecture:

```text
containers
 ↓
logs
 ↓
Loki
 ↓
Grafana
```

---

# 18. ML TRACKING

Use:

# MLflow

Self-host MLflow.

Track:

```text
training run
dataset version
parameters
metrics
model
artifact
commit hash
```

Register:

* vulnerability classifier
* bug-risk model
* code embedding models

---

# 19. DEEP LEARNING

Use Hugging Face + PyTorch.

Models may include:

* CodeBERT
* GraphCodeBERT
* UniXcoder
* CodeT5

Tasks:

* vulnerability classification
* code similarity
* bug detection
* semantic code embedding

Models should be downloadable and runnable locally.

Prefer small models capable of CPU inference.

---

# 20. AI GATEWAY — OPENROUTER-FIRST LLM SUPPORT

OpenRouter is the **primary** LLM provider: one API key routes to many models (free and paid).
Models are role-routed to agents:

```text
AI Gateway (FastAPI)
      ↓
  OpenRouter
      ↓
Coding Model ──► Patch Agent       (OPENROUTER_MODEL_CODING)
Reasoning Model ──► Debug Agent    (OPENROUTER_MODEL_REASONING)
Fast Model ──► Summary Agent       (OPENROUTER_MODEL_FAST)
```

Local mode stays available as an OPTIONAL fallback via Ollama (FULL profile, `OLLAMA_ENABLED=true`):

```text
Ollama (optional)
 ↓
local model
 ↓
no LLM API bill
```

Potential local models:

* Qwen coder models
* DeepSeek coder models
* Code Llama
* StarCoder variants
* Gemma variants

Create:

```text
LLMProvider
├── OpenRouterProvider    (default, role-routed models)
├── GeminiProvider
├── GroqProvider
├── OpenAIProvider
├── AnthropicProvider
└── OllamaProvider        (optional local mode)
```

The user should choose the provider from settings.

---

# 21. API-FIRST DESIGN

Use as many useful public APIs as possible where they provide real functionality.

However:

> Do not call APIs purely to increase the API count.

Every API must improve a defined product capability.

Create a centralized:

# External API Gateway

```text
AI Code Doctor
      ↓
API Gateway
      │
 ┌────┼─────┬───────┬─────────┐
 ▼    ▼     ▼       ▼         ▼
GitHub OSV   NVD   Packages   Docs
```

Track:

* provider
* request count
* latency
* errors
* rate limits
* cache status

---

# 22. GITHUB API

Use extensively.

Integrate:

## GitHub REST API

For:

* repositories
* branches
* commits
* files
* contributors
* issues
* pull requests
* comments
* releases
* workflows

## GitHub GraphQL API

Use for complex relationship queries.

## GitHub Webhooks

Events:

```text
push
pull_request
issues
release
workflow_run
```

Use:

```text
push
 ↓
Webhook
 ↓
Incremental code analysis
```

---

# 23. OSV API

Integrate:

# OSV.dev API

Use it for open-source vulnerability lookup.

Input:

```text
package
version
ecosystem
```

Output:

```text
known vulnerabilities
affected versions
patched versions
references
```

Use for:

* Python packages
* npm
* Go
* Maven
* Rust
* other supported ecosystems

---

# 24. NVD / CVE API

Integrate NIST NVD vulnerability information.

Use for:

* CVE information
* CVSS
* vulnerability descriptions
* references

Correlate:

```text
dependency
   ↓
OSV
   +
NVD
   ↓
security finding
```

Cache results locally.

---

# 25. GITHUB SECURITY ADVISORIES

Use GitHub's security advisory APIs.

Retrieve:

* GHSA identifiers
* affected packages
* patched versions
* severity
* CVEs

Combine:

```text
OSV
+
GitHub Advisory
+
NVD
```

to create richer dependency intelligence.

---

# 26. PACKAGE REGISTRY APIs

Use ecosystem APIs.

## PyPI API

Retrieve:

* package metadata
* versions
* releases
* dependencies

## npm Registry API

Retrieve:

* versions
* package metadata
* dependencies

## crates.io API

For Rust.

## Maven Central API

For Java.

## Go package information

Use Go ecosystem sources where appropriate.

Create:

```text
PackageRegistryProvider
├── PyPI
├── npm
├── Maven
├── crates.io
└── Go
```

---

# 27. STACK EXCHANGE API

Integrate Stack Exchange / Stack Overflow.

Use when the agent encounters:

* compiler errors
* unusual framework errors
* dependency issues
* language-specific problems

Example:

```text
Error detected
     ↓
Search Stack Overflow
     ↓
Retrieve relevant discussions
     ↓
Rerank
     ↓
Agent receives references
```

Never blindly copy Stack Overflow solutions.

Use them as supporting external context.

---

# 28. DOCUMENTATION SOURCES

Create an external documentation retrieval layer.

Search official documentation for:

* Python
* FastAPI
* React
* Next.js
* Node.js
* PostgreSQL
* Docker
* Kubernetes
* frameworks detected in repository

Use official sources whenever possible.

Index retrieved documentation into temporary RAG collections.

---

# 29. SEARCH API

Allow optional web search APIs.

Provider abstraction:

```text
SearchProvider
├── Tavily
├── Brave Search
├── Serper
└── SelfHostedSearch
```

Self-hosted option:

# SearXNG

Use SearXNG as the free/self-hosted web search backend.

This preserves the ability to perform external research without requiring paid APIs.

---

# 30. SELF-HOSTED SEARCH

Deploy:

# SearXNG

The Research Agent can call:

```text
search_web(query)
```

which talks to SearXNG.

This can search:

* developer documentation
* GitHub discussions
* technical articles
* CVEs
* package information

without making the core architecture dependent on a commercial search provider.

---

# 31. CODE QUALITY APIs / TOOLS

Use CLI tools wrapped behind internal APIs:

```text
POST /internal/analyze/semgrep
POST /internal/analyze/bandit
POST /internal/analyze/ruff
POST /internal/analyze/eslint
POST /internal/analyze/mypy
POST /internal/analyze/gitleaks
POST /internal/analyze/trivy
```

This transforms external static analyzers into agent-callable tools.

---

# 32. GITLEAKS

Use Gitleaks to identify:

* API keys
* passwords
* tokens
* private keys
* credentials

Never send detected secrets to external LLM APIs.

Redact them first:

```text
sk-abcdef....
 ↓
[REDACTED_SECRET]
```

---

# 33. TRIVY

Use Trivy for:

* dependency vulnerabilities
* Docker images
* filesystem vulnerabilities
* misconfiguration

Agent tool:

```text
scan_dependencies()
scan_container()
scan_config()
```

---

# 34. SEMGREP

Use Semgrep for static analysis.

Integrate findings with AI explanations.

Pipeline:

```text
Semgrep
 ↓
Finding
 ↓
Code graph
 ↓
RAG
 ↓
Security Agent
 ↓
Explanation
```

---

# 35. MODEL APIs

OpenRouter is the primary entry point; optional external inference providers remain available.

Primary:

* OpenRouter (one key, role-routed coding/reasoning/fast models, free tiers available)

Optional providers with free/developer tiers may include:

* Gemini API
* Groq
* Hugging Face inference
* OpenAI
* Anthropic
* Ollama (local, optional)

The system must NOT require any particular paid provider.

Implement automatic fallback:

```text
OpenRouter
     ↓ fails / unavailable

Free provider
     ↓

Alternative provider
     ↓

Optional local model (Ollama)
```

API keys are configured by the user.

---

# 36. API KEY MANAGEMENT

Frontend settings should include:

```text
AI Providers

[ ] OpenRouter      (primary — one key, role-routed models)
[ ] Gemini
[ ] Groq
[ ] OpenAI
[ ] Anthropic
[ ] Ollama         (optional, local)

External Services

[ ] GitHub
[ ] NVD
[ ] Stack Exchange
[ ] Search
```

Keys should:

* be encrypted
* never be logged
* never appear in session replay
* never be embedded into frontend bundles

---

# 37. PROVIDER ABSTRACTION

Every external integration should use an interface.

Example:

```python
class VulnerabilityProvider:
    async def query(self, package, version):
        ...
```

Implement:

```text
OSVProvider
NVDProvider
GitHubAdvisoryProvider
```

Likewise:

```text
LLMProvider
EmbeddingProvider
SearchProvider
PackageProvider
VectorStore
ObjectStore
QueueProvider
```

This is important because it demonstrates proper software architecture.

---

# 38. API RESULT CACHE

Never unnecessarily hit external APIs repeatedly.

Use Valkey.

Example:

```text
OSV request
 ↓
check cache
 ↓
MISS
 ↓
OSV API
 ↓
store result
 ↓
24-hour TTL
```

Use appropriate TTLs depending on data volatility.

---

# 39. API RATE LIMIT MANAGEMENT

Build a rate-limit manager.

Store:

```text
provider
remaining_requests
reset_time
current_rate
```

Display:

```text
GitHub              4,813 / 5,000
Stack Exchange          287 / 300
NVD                      Available
OSV                      Available
```

This would be a strong engineering feature.

---

# 40. API HEALTH DASHBOARD

Create:

# Integrations

```text
GitHub                  ● Connected
OSV                     ● Healthy
NVD                     ● Healthy
Stack Exchange          ● Healthy
SearXNG                 ● Healthy
Ollama                  ● Running
Qdrant                  ● Running
PostgreSQL              ● Running
MLflow                  ● Running
GlitchTip               ● Running
OpenReplay              ● Running
```

Include:

* latency
* last request
* errors
* request count

---

# 41. COMPLETE SELF-HOSTED STACK

Docker Compose should support:

```text
code-doctor-web
code-doctor-api
code-doctor-worker

postgres
valkey
qdrant
minio

ollama               # optional — local LLM mode, FULL profile only

mlflow

glitchtip

openreplay

prometheus
grafana
loki
otel-collector

searxng
```

Optional services should use Docker Compose profiles.

Example:

```bash
docker compose --profile observability up -d
```

or:

```bash
docker compose --profile full up -d
```

---

# 42. RESOURCE-AWARE DEPLOYMENT

Because the project needs to run for free, create three operating modes.

## LITE

Runs:

```text
Frontend
FastAPI
PostgreSQL
Qdrant
Valkey
external/free LLM API
```

Designed for approximately:

```text
1–2 GB RAM
```

---

## STANDARD

Adds:

```text
workers
MLflow
SearXNG
GlitchTip
Prometheus
Grafana
```

Designed for a moderate self-hosted server.

---

## FULL

Adds:

```text
Ollama
local DL inference
OpenReplay
Loki
all observability
voice
speech recognition
```

Designed for more capable hardware.

---

# 43. FREE PUBLIC DEMO STRATEGY

The deployed resume demo does NOT need every self-hosted service running on the public server simultaneously.

Use:

```text
Public Demo
├── Frontend
├── FastAPI
├── PostgreSQL
├── Qdrant
└── OpenRouter (free-tier inference)
```

Then provide:

```text
docker-compose.full.yml
```

for recruiters/developers who want the entire local stack.

This prevents free hosting RAM limits from destroying the deployment.

---

# 44. DEMO SAFETY LIMITS

For the public deployment:

* repository size limit
* files limit
* token limit
* analysis timeout
* request rate limit
* maximum concurrent jobs

Example:

```text
Repository size        <= 30 MB
Files                  <= 1,500
Concurrent analyses    1 per user
Analysis timeout       10 min
```

Do not advertise unlimited processing.

---

# 45. DEMO REPOSITORY

Provide an instant demo button:

# TRY SAMPLE REPOSITORY

The user should not have to connect GitHub.

The sample should contain intentionally created examples of:

* SQL injection
* insecure JWT validation
* hardcoded credentials
* path traversal
* command injection
* weak cryptography
* missing validation
* poor test coverage

This guarantees that recruiters can immediately see the system working.

---

# 46. API-FIRST SECURITY KNOWLEDGE PIPELINE

Example complete dependency analysis:

```text
requirements.txt
      ↓
Dependency Parser
      ↓
PyPI API
      │
      ├── OSV API
      ├── GitHub Advisory API
      └── NVD API
              ↓
        Vulnerability merger
              ↓
        Deduplication
              ↓
           CVSS
              ↓
        AI explanation
```

---

# 47. BUG INVESTIGATION PIPELINE

```text
STATIC ANALYZERS
Semgrep / Bandit / ESLint
          │
          ▼
     Raw Finding
          │
          ├─────────────► OSV/NVD APIs
          │
          ├─────────────► Code Graph
          │
          ├─────────────► Code RAG
          │
          ├─────────────► Git History
          │
          └─────────────► Documentation/Search
                              │
                              ▼
                        Investigation Agent
                              │
                              ▼
                         Root Cause
                              │
                              ▼
                           Patch
                              │
                              ▼
                       Sandbox Tests
                              │
                              ▼
                           GitHub PR
```

---

# 48. REVISED FINAL TECHNOLOGY STACK

## Core application

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Monaco Editor
* React Flow
* FastAPI
* Python
* Pydantic
* SQLAlchemy
* Alembic

## Database

* PostgreSQL

## Vector search

* Qdrant
* optional pgvector

## Queue/cache

* Valkey
* Celery/Dramatiq

## Object storage

* MinIO

## Code parsing

* Tree-sitter
* AST
* Universal Ctags

## Static/security analysis

* Semgrep
* Bandit
* Ruff
* mypy
* ESLint
* Trivy
* Gitleaks

## AI

* LangGraph
* Hugging Face Transformers
* PyTorch
* Sentence Transformers
* OpenRouter (primary LLM gateway, role-routed models)
* Ollama (optional local mode)
* CodeBERT
* GraphCodeBERT
* CodeT5

## Machine Learning

* XGBoost
* LightGBM
* scikit-learn
* Optuna
* SHAP

## RAG

* Qdrant
* BM25
* hybrid retrieval
* reranking

## Voice

* Kokoro 82M
* faster-whisper / whisper.cpp

## MLOps

* MLflow

## Errors

* GlitchTip

## Session replay

* OpenReplay

## Search

* SearXNG

## Observability

* OpenTelemetry
* Prometheus
* Grafana
* Loki

## Infrastructure

* Docker
* Docker Compose
* GitHub Actions
* Nginx or Caddy

---

# 49. EXTERNAL APIS

Integrate where available:

* GitHub REST API
* GitHub GraphQL API
* GitHub Webhooks
* GitHub Security Advisory API
* OSV API
* NVD CVE API
* PyPI API
* npm Registry API
* Maven Central API
* crates.io API
* Stack Exchange API
* Hugging Face API
* optional Gemini API
* optional Groq API
* optional OpenRouter API
* optional OpenAI API
* optional Anthropic API
* SearXNG API

Every provider must have a fallback or self-hosted option whenever reasonably possible.

---

# 50. FINAL DESIGN PRINCIPLE

The system should demonstrate:

> **The ability to integrate many heterogeneous APIs and AI systems into one reliable product while remaining deployable on free or self-hosted infrastructure.**

The architecture should optimize for:

* replaceability
* modularity
* low operational cost
* graceful fallbacks
* caching
* rate-limit awareness
* CPU-compatible inference
* open standards
* open-source components
* Docker portability

A reviewer should be able to see that the project is not simply a collection of API calls but a carefully engineered AI platform where:

```text
GitHub
+
Static Analysis
+
ML
+
DL
+
Code RAG
+
Knowledge Graph
+
Agentic AI
+
Security APIs
+
Package APIs
+
Search
+
Voice
+
Observability
+
MLOps
+
Automated Patching
+
Testing
+
Pull Requests
```

work together as one deployable product.

One correction to the earlier design: **do not try to publicly host the entire "full" stack for free**. OpenReplay + GlitchTip + Grafana + Loki + MLflow + Qdrant + PostgreSQL + Ollama + workers on one tiny free instance will almost certainly become the bottleneck.

For the resume URL, run the **LITE deployment** and use free/API-based inference. Keep the repository capable of running the **FULL self-hosted deployment** through Docker Compose. That actually gives you a stronger architecture story: *production demo optimized for constrained infrastructure + fully self-hostable stack*.
 
delete this file once README.md tasks.md and implementations.md and  have been made