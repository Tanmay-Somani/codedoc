"""Provider contracts + shared rate-limit/tracking.

Every external integration implements one of these interfaces so providers
can be swapped without touching callers. Automatic fallback is layered on top
by :mod:`app.providers.registry`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol


class LLMProvider(Protocol):
    name: str

    async def complete(self, prompt: str, *, model: str | None = None, **kwargs: Any) -> str: ...


class EmbeddingProvider(Protocol):
    name: str

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class SearchResult(Protocol):
    title: str
    url: str
    snippet: str


class SearchProvider(Protocol):
    name: str

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]: ...


@dataclass
class VulnerabilityInfo:
    source: str
    identifier: str
    summary: str | None = None
    affected_range: str | None = None
    cvss_score: float | None = None
    cvss_vector: str | None = None
    patched_versions: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)


class VulnerabilityProvider(Protocol):
    name: str

    async def query(
        self, package: str, version: str, ecosystem: str
    ) -> list[VulnerabilityInfo]: ...


class PackageProvider(Protocol):
    name: str

    async def get_metadata(self, package: str) -> dict[str, Any]: ...


class VectorStore(Protocol):
    async def upsert(
        self, collection: str, points: list[tuple[str, list[float], dict[str, Any]]]
    ) -> None: ...

    async def search(
        self, collection: str, vector: list[float], *, limit: int = 10
    ) -> list[dict[str, Any]]: ...


class ObjectStore(Protocol):
    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None: ...

    async def get(self, key: str) -> bytes: ...


class Cache(Protocol):
    async def get(self, key: str) -> str | None: ...

    async def set(self, key: str, value: str, ttl_seconds: int) -> None: ...


class RateLimitState(ABC):
    """Records per-provider usage; surfaced in the Integrations dashboard."""

    @abstractmethod
    def record(
        self,
        provider: str,
        *,
        ok: bool,
        latency_ms: float,
        cache_hit: bool = False,
        rate_remaining: int | None = None,
        rate_reset_at: str | None = None,
    ) -> None: ...

    @abstractmethod
    def snapshot(self) -> dict[str, dict[str, Any]]: ...


class InMemoryRateLimitState(RateLimitState):
    """Process-local tracking; swap for a Valkey-backed implementation later."""

    def __init__(self) -> None:
        self._state: dict[str, dict[str, Any]] = {}

    def record(
        self,
        provider: str,
        *,
        ok: bool,
        latency_ms: float,
        cache_hit: bool = False,
        rate_remaining: int | None = None,
        rate_reset_at: str | None = None,
    ) -> None:
        entry = self._state.setdefault(
            provider,
            {
                "requests": 0,
                "errors": 0,
                "latency_sum_ms": 0.0,
                "cache_hits": 0,
                "cache_misses": 0,
                "rate_remaining": None,
                "rate_reset_at": None,
                "last_request": None,
            },
        )
        entry["requests"] += 1
        if not ok:
            entry["errors"] += 1
        entry["latency_sum_ms"] += latency_ms
        entry["cache_hits" if cache_hit else "cache_misses"] += 1
        entry["last_request"] = datetime.now(UTC).isoformat()
        if rate_remaining is not None:
            entry["rate_remaining"] = rate_remaining
        if rate_reset_at is not None:
            entry["rate_reset_at"] = rate_reset_at

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return {k: dict(v) for k, v in self._state.items()}


class CachedProvider:
    """Mixin for providers that cache external results in Valkey."""

    cache_prefix = "codedoc:api"
    name = "base"

    def __init__(self, cache: Cache, rate_state: RateLimitState) -> None:
        self._cache = cache
        self._rates = rate_state

    async def _cached_get(
        self, key: str, ttl_seconds: int, fetcher: Callable[[], Awaitable[Any]]
    ) -> Any:
        import json

        hit = await self._cache.get(key)
        if hit is not None:
            self._rates.record(self.name, ok=True, latency_ms=0.5, cache_hit=True)
            return json.loads(hit)
        value = await fetcher()
        await self._cache.set(key, json.dumps(value), ttl_seconds)
        self._rates.record(self.name, ok=True, latency_ms=1.0, cache_hit=False)
        return value
