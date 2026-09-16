from fastapi import APIRouter, Depends

from app.api.deps import get_registry
from app.providers.registry import Registry
from app.schemas import IntegrationStatus

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# Registered provider names mapped to the display keys the web Integrations
# dashboard looks up (frontend lowercases the catalog names).
_DISPLAY_KEY = {"github_advisory": "github advisory"}


@router.get("/status", response_model=IntegrationStatus)
async def integration_status(registry: Registry = Depends(get_registry)) -> IntegrationStatus:
    status = registry.integration_status()
    providers: dict[str, str] = {}
    for name in (*status["llm"]["providers"], *status["vulnerability"]["providers"],
                 *status["search"]["providers"]):
        providers[_DISPLAY_KEY.get(name, name)] = "configured"
    providers[_DISPLAY_KEY.get(
        status["vector_store"]["provider"], status["vector_store"]["provider"]
    )] = "configured"
    providers[_DISPLAY_KEY.get(
        status["cache"]["provider"], status["cache"]["provider"]
    )] = "configured"
    return IntegrationStatus(
        providers=providers,
        active_llm=status["llm"]["active"],
        usage=status["usage"],
    )
