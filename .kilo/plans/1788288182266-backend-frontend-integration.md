# Backend-Frontend Integration Plan

## Current State Audit

### Backend API Endpoints (all implemented in `api/app/api/routes/`)
| Endpoint | Method | Frontend Status |
|----------|--------|-----------------|
| `/health` | GET | ✓ Connected |
| `/api/integrations/status` | GET | ✓ Connected |
| `/api/repositories` | GET | ✓ Connected |
| `/api/repositories` | POST | ✓ Connected |
| `/api/analyses` | GET | ✓ Connected |
| `/api/analyses` | POST | ✓ Connected |
| `/api/analyses/{id}` | GET | ✓ Connected |
| `/api/analyze` | POST | ✓ Connected (unused in UI) |

### Frontend Pages vs API Reality
| Page | API Connection | Issue |
|------|---------------|-------|
| Repositories | Fully wired | Works |
| Findings | Fully wired | Works (sample data shown when no live findings) |
| Dependencies | **Static mock data** | No API call — shows hardcoded packages |
| Integrations | Partially wired | Shows provider names but usage is empty |
| Settings | **No API calls** | Form state only, no persistence |

### Schema Mismatch
- `HealthResponse.version` is in schema but not returned by `/health` endpoint
- Dependencies page has no backend model/API — needs creation

## Tasks

### 1. Add Dependencies API (Backend)
**Files:** `api/app/api/routes/dependencies.py` (new), `api/app/api/routes/__init__.py`, `api/app/main.py`

- `GET /api/dependencies` — return dependency findings from latest analysis
- Query latest completed analysis → extract dependency-type findings
- Return enriched data with CVSS from linked Vulnerability records
- Wire into `main.py` router includes

### 2. Update Frontend Types
**File:** `web/src/lib/types.ts`

- Add `Dependency` interface matching backend response
- Ensure `Finding` type covers dependency findings (already does)

### 3. Update Frontend API Client
**File:** `web/src/lib/api.ts`

- Add `dependencies()` function calling `GET /api/dependencies`
- Add `deleteRepository(id)` function

### 4. Wire Dependencies Page
**File:** `web/src/app/dependencies/page.tsx`

- Replace static mock data with `useQuery({ queryFn: api.dependencies })`
- Add loading/error/empty states
- Link to source analysis

### 5. Wire Settings Page
**File:** `web/src/app/settings/page.tsx`

- On mount: fetch current config from `GET /api/config`
- On save: POST to `API_PUT` `/api/config` with encrypted values
- Show save confirmation/error

### 6. Fix Health Endpoint
**File:** `api/app/api/routes/health.py`

- Add `version` field to response

### 7. Backend Tests
**Files:** `api/tests/test_analyses.py` (new), `api/tests/test_dependencies.py` (new)

- Test repository CRUD flow
- Test analysis creation → findings retrieval
- Test dependencies endpoint returns correct shape
- Test redaction in `/api/analyze`

### 8. Frontend Type Check & Build
**Command:** `npm run typecheck && npm run build`

- Ensure no type errors
- Ensure build succeeds

## Execution Order

1. Fix health endpoint version field
2. Add dependencies API route + wire to main.py
3. Update frontend types
4. Update frontend API client
5. Wire dependencies page
6. Wire settings page
7. Write backend tests
8. Verify typecheck + build

## Validation

- `cd api && pytest tests/ -v` passes
- `cd web && npm run typecheck` passes
- `cd web && npm run build` succeeds
- Manual: start with `docker compose up`, navigate all pages, confirm live data
