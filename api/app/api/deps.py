from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.session import get_db_session
from app.providers.registry import Registry


def get_registry(request: Request) -> Registry:
    return request.app.state.registry


def get_settings_dep() -> Settings:
    return get_settings()


def get_deps(
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
    registry: Registry = Depends(get_registry),
) -> dict:
    return {"db": db, "settings": settings, "registry": registry}