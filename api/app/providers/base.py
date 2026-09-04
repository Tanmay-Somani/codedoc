"""Provider contracts + shared rate-limit/tracking.

Every external integration implements one of these interfaces so providers
can be swapped without touching callers. Automatic fallback is layered on top
by :mod:`app.providers.registry`.
"""

from __future__ import annotations

import threading
import time
from abc import ABC, abstractmethod
from collections import deque
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


class SlidingWindowLimiter:
    """Thread-safe in-memory sliding-window rate limiter.

    Tracks event timestamps per key and allows at most ``max_events`` in the
    last ``window_seconds``. Good enough for the single-process demo; swap for a
    Valkey-backed implementation if the API is ever scaled horizontally.
    """

    def __init__(self, max_events: int, window_seconds: float) -> None:
        self._max_events = max_events
        self._window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Return True if the key is still under the limit, else False.

        Consumes one allowance on a True return.
        """
        now = time.monotonic()
        cutoff = now - self._window_seconds
        with self._lock:
            window = self._events.get(key)
            if window is None:
                window = self._events[key] = deque()
            while window and window[0] < cutoff:
                window.popleft()
            if len(window) >= self._max_events:
                return False
            window.append(now)
            return True

    def remaining(self, key: str) -> int:
        """Number of allowances left for ``key`` (does not consume one)."""
        now = time.monotonic()
        cutoff = now - self._window_seconds
        with self._lock:
            window = self._events.get(key)
            if window is None:
                return self._max_events
            while window and window[0] < cutoff:
                window.popleft()
            return max(self._max_events - len(window), 0)


class ScanProgressStore:
    """Thread-safe, in-memory store of in-flight scan progress.

    The scanner runs in a worker thread (via asyncio.to_thread), so reads from
    the request handlers and writes from the scan must be lock-guarded. Entries
    are cleared once the analysis completes or fails.
    """

    def __init__(self) -> None:
        self._state: dict[int, dict[str, object]] = {}
        self._lock = threading.Lock()

    def set(self, analysis_id: int, snapshot: dict[str, object]) -> None:
        with self._lock:
            self._state[analysis_id] = dict(snapshot)

    def get(self, analysis_id: int) -> dict[str, object] | None:
        with self._lock:
            entry = self._state.get(analysis_id)
            return dict(entry) if entry is not None else None

    def clear(self, analysis_id: int) -> None:
        with self._lock:
            self._state.pop(analysis_id, None)


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
