from fastapi import APIRouter, Depends

from app.api.deps import get_registry
from app.providers.registry import Registry
from app.schemas import IntegrationStatus

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/status", response_model=IntegrationStatus)
async def integration_status(registry: Registry = Depends(get_registry)) -> IntegrationStatus:
    status = registry.integration_status()
    return IntegrationStatus(
        providers=status["llm"],
        active_llm=status["llm"]["active"],
        usage=status["usage"],
    )