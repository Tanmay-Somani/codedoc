"""Provider registry: composition root for all swappable integrations."""

from __future__ import annotations

from typing import Any, cast

import redis.asyncio as aioredis

from app.config import Settings
from app.core.logging import get_logger
from app.providers.base import Cache, InMemoryRateLimitState, LLMProvider, RateLimitState
from app.providers.llm import build_llm_providers
from app.providers.search import build_search_providers
from app.providers.vectorstore import build_vector_store
from app.providers.vulnerability import (
    GitHubAdvisoryProvider,
    MergedVulnerabilityProvider,
    NVDProvider,
    OSVProvider,
)

logger = get_logger(__name__)


class ValkeyCache(Cache):
    """Redis-protocol cache over Valkey."""

    def __init__(self, url: str) -> None:
        self._client = aioredis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> str | None:
        return cast(str | None, await self._client.get(key))

    async def set(self, key: str, value: str, ttl_seconds: int) -> None:
        await self._client.set(key, value, ex=ttl_seconds)


class Registry:
    """Holds all providers. Built once at app startup."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.cache: Cache = ValkeyCache(settings.valkey_url)
        self.rates: RateLimitState = InMemoryRateLimitState()

        self.llm_providers = build_llm_providers(settings)
        self.search_providers = build_search_providers(settings)
        self.vector_store = build_vector_store(settings)

        osv = OSVProvider(self.cache, self.rates)
        self.vulnerability_provider = MergedVulnerabilityProvider(
            osv,
            NVDProvider(),
            GitHubAdvisoryProvider(),
        )

    @property
    def active_llm(self) -> LLMProvider:
        """Preferred configured LLM provider (default or first available)."""
        by_name = {getattr(p, "name", "?"): p for p in self.llm_providers}
        if self.settings.llm_provider in by_name:
            return by_name[self.settings.llm_provider]
        if "openrouter" in by_name:
            return by_name["openrouter"]
        return self.llm_providers[0]

    async def llm_complete_with_fallback(self, prompt: str, **kwargs: Any) -> str:
        """Try providers in order until one succeeds (local → free → paid)."""
        last_error: Exception | None = None
        s = self.settings
        for provider in self.llm_providers:
            name = getattr(provider, "name", "?")
            if name == "gemini" and not s.gemini_api_key:
                continue
            if name == "anthropic" and not s.anthropic_api_key:
                continue
            try:
                self.rates.record(name, ok=True, latency_ms=10.0)
                return await provider.complete(prompt, **kwargs)
            except Exception as exc:  # noqa: BLE001 - fallback is the point
                logger.warning("llm_provider_failed_trying_next", provider=name)
                self.rates.record(name, ok=False, latency_ms=10.0)
                last_error = exc
        raise RuntimeError("all LLM providers failed") from last_error

    def integration_status(self) -> dict[str, dict[str, Any]]:
        """Health info for the Integrations dashboard."""
        llm_names = [p.name for p in self.llm_providers]
        return {
            "llm": {"providers": llm_names, "active": self.active_llm.name},
            "vector_store": {"provider": self.vector_store.name},
            "search": {"providers": [p.name for p in self.search_providers]},
            "vulnerability": {"provider": self.vulnerability_provider.name},
            "cache": {"provider": "valkey"},
            "usage": self.rates.snapshot(),
        }

    async def aclose(self) -> None:
        """Release any persistent HTTP clients held by providers."""
        for provider in [*self.llm_providers, *self.search_providers]:
            aclose = getattr(provider, "aclose", None)
            if aclose is not None:
                try:
                    await aclose()
                except Exception:  # noqa: BLE001 - shutdown must not raise
                    logger.exception(
                        "provider_shutdown_failed", provider=getattr(provider, "name", "?")
                    )
        try:
            await self.vulnerability_provider.aclose()
        except Exception:  # noqa: BLE001 - shutdown must not raise
            logger.exception("vulnerability_shutdown_failed")
