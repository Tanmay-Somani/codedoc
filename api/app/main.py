from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analyses, health, integrations
from app.config import Settings, get_settings
from app.core.logging import setup_logging
from app.providers.registry import Registry

log = structlog.get_logger(__name__)


def log_settings_warnings(settings: Settings) -> None:
    for level, message in settings.check_environment():
        logger = getattr(log, "critical" if level == "critical" else "warning")
        logger("env_check", issue=message, environment=settings.environment, level=level)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    setup_logging(settings)
    log_settings_warnings(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        registry = Registry(settings)
        app.state.registry = registry
        if settings.sentry_dsn:
            # DSN points at GlitchTip, never Sentry cloud.
            try:
                import sentry_sdk

                sentry_sdk.init(
                    dsn=settings.sentry_dsn,
                    traces_sample_rate=settings.sentry_traces_sample_rate,
                )
            except Exception:  # noqa: BLE001 - observability must never crash the app
                pass
        yield
        try:
            await registry.aclose()
        except Exception:  # noqa: BLE001 - shutdown must never crash uvicorn
            log.warning("registry_shutdown_issue")

    app = FastAPI(
        title="AI Codebase Doctor API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(integrations.router)
    app.include_router(analyses.router)
    return app


app = create_app()
