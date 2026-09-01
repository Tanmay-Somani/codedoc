"""Search providers: SearXNG (free default), optional commercial, local."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import Settings


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


class SearXNGProvider:
    name = "searxng"

    def __init__(self, settings: Settings) -> None:
        self._url = settings.searxng_url

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(
                f"{self._url}/search",
                params={"q": query, "format": "json"},
            )
            resp.raise_for_status()
            raw = resp.json().get("results", [])
        results = [
            SearchResult(title=str(r.get("title", "")), url=str(r.get("url", "")), snippet=str(r.get("content", "")))
            for r in raw
        ]
        return results[:limit]


class BraveProvider:
    name = "brave"

    def __init__(self, settings: Settings) -> None:
        self._key = settings.brave_api_key

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        if not self._key:
            raise RuntimeError("brave: no API key configured")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": self._key},
                params={"q": query, "count": limit},
            )
            resp.raise_for_status()
            raw = resp.json().get("web", {}).get("results", [])
        return [
            SearchResult(title=str(r.get("title", "")), url=str(r.get("url", "")), snippet=str(r.get("description", "")))
            for r in raw
        ]


def build_search_providers(settings: Settings) -> list[SearXNGProvider | BraveProvider]:
    providers: list[SearXNGProvider | BraveProvider] = [SearXNGProvider(settings)]
    if settings.brave_api_key:
        providers.append(BraveProvider(settings))
    return providers