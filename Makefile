.PHONY: help dev up down logs ps restart \
        test lint typecheck format \
        test-api lint-api mypy format-api test-web lint-web typecheck-web build-web \
        prod up-prod down-prod full

COMPOSE_DEV := docker compose up -d --build
COMPOSE_PROD := docker compose -f compose.yaml -f compose.prod.yml up -d --build
COMPOSE_FULL := docker compose -f compose.yaml -f compose.prod.yml -f compose.full.yml --profile full up -d

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Compose overrides: dev auto-loads compose.override.yaml. Never mix it with prod."

# ---- Docker Compose ----

dev: ## Build & start dev stack (hot reload, ports 3000/8000)
	$(COMPOSE_DEV)

up: dev

prod: ## Build & start prod stack (built images, no dev ports)
	$(COMPOSE_PROD)

up-prod: prod

down: ## Stop the stack
	docker compose down

down-prod: ## Stop prod stack (keeps volumes)
	docker compose -f compose.yaml -f compose.prod.yml down

logs: ## Tail logs for all services
	docker compose logs -f --tail 200

ps: ## Show service status
	docker compose ps

restart: ## Rebuild and restart all services
	$(COMPOSE_DEV)
	docker compose restart

full: ## Build & start FULL profile (all services, standalone profiles enabled)
	$(COMPOSE_FULL)

# ---- Backend ----

test-api: ## Run API tests
	cd api && pytest

lint-api: ## Ruff lint on API
	cd api && ruff check app tests

format-api: ## Ruff format + check on API
	cd api && ruff format app tests

mypy: ## Type check API (strict)
	cd api && mypy app

typecheck-api: mypy

# ---- Frontend ----

test-web: ## Run web linter + typecheck + build
	cd web && npm run lint && npm run typecheck && npm run build

lint-web: ## ESLint on web
	cd web && npm run lint

typecheck-web: ## tsc --noEmit on web
	cd web && npm run typecheck

build-web: ## Production build of web
	cd web && npm run build

# ---- Aggregate ----

test: test-api test-web ## Run backend tests + frontend checks

lint: lint-api lint-web ## Lint backend + frontend

typecheck: mypy typecheck-web ## Type check backend + frontend

format: format-api ## Auto-format backend code