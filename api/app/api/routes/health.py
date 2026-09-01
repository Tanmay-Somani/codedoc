from fastapi import APIRouter, Depends

from app.api.deps import get_registry
from app.providers.registry import Registry
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(registry: Registry = Depends(get_registry)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        services={
            "vector_store": registry.vector_store.name,
            "cache": "valkey",
            "vulnerability": registry.vulnerability_provider.name,
        },
    )


@router.get("/metrics")
async def metrics() -> dict[str, str]:
    """Prometheus metrics summary. Full exposition lives at /metrics in prod."""
    return {"_note": "Prometheus /metrics endpoint is wired via the metrics middleware"}
