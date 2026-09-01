from typing import Any

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.logging import get_logger
from app.db.session import get_db_session
from app.providers.registry import Registry

Deps = dict[str, Any]

logger = get_logger(__name__)


def get_registry(request: Request) -> Registry:
    return request.app.state.registry  # type: ignore[no-any-return]


def get_settings_dep() -> Settings:
    return get_settings()


def get_deps(
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
    registry: Registry = Depends(get_registry),
) -> Deps:
    return {"db": db, "settings": settings, "registry": registry}


async def db_unavailable(exc: Exception) -> bool:
    """Detect a database connectivity failure (as opposed to a query/validation
    error) by inspecting the full exception cause chain.

    An app should degrade its list/read views to empty results when the
    database is unreachable, rather than crash the whole dashboard.
    """
    markers = (
        "operationalerror",
        "interfaceerror",
        "gaierror",
        "connectionrefused",
        "cannotconnect",
        "timeouterror",
    )
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        name = type(current).__name__.lower()
        if any(m in name for m in markers):
            return True
        current = current.__cause__ or current.__context__
    return False
