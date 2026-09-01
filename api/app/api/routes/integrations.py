from fastapi import APIRouter, Depends

from app.api.deps import get_registry
from app.providers.registry import Registry
from app.schemas import IntegrationStatus

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/status", response_model=IntegrationStatus)
async def integration_status(registry: Registry = Depends(get_registry)) -> IntegrationStatus:
    status = registry.integration_status()
    llm: dict[str, str] = {k: str(v) for k, v in status["llm"].items()}
    return IntegrationStatus(
        providers=llm,
        active_llm=llm["active"],
        usage=status["usage"],
    )
