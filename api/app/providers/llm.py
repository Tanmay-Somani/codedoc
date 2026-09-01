"""LLM provider implementations + fallback chain.

Fallback order: the user-configured default provider first; if it fails or is
unconfigured, the registry tries the remaining providers in order so local
(Ollama) → free → alternative all work without a paid key.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings
from app.providers.base import LLMProvider


class OllamaProvider:
    name = "ollama"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self.base_url = settings.ollama_base_url

    async def complete(self, prompt: str, *, model: str | None = None, **kwargs: Any) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/api/generate",
                json={"model": model or self._settings.ollama_model, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            data = resp.json()
        return str(data.get("response", ""))


class OpenAICompatProvider:
    """OpenAI-compatible chat completions (OpenAI, Groq, OpenRouter)."""

    def __init__(self, name: str, base_url: str, api_key: str, default_model: str) -> None:
        self.name = name
        self._base_url = base_url
        self._api_key = api_key
        self._default_model = default_model

    async def complete(self, prompt: str, *, model: str | None = None, **kwargs: Any) -> str:
        if not self._api_key:
            raise RuntimeError(f"{self.name}: no API key configured")
        headers = {"Authorization": f"Bearer {self._api_key}"}
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers=headers,
                json={
                    "model": model or self._default_model,
                    "messages": [{"role": "user", "content": prompt}],
                    **kwargs,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return str(data["choices"][0]["message"]["content"])


class GeminiProvider:
    name = "gemini"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def complete(self, prompt: str, *, model: str | None = None, **kwargs: Any) -> str:
        key = self._settings.gemini_api_key
        if not key:
            raise RuntimeError("gemini: no API key configured")
        model_name = model or self._settings.gemini_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                params={"key": key},
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            resp.raise_for_status()
            data = resp.json()
        return str(data["candidates"][0]["content"]["parts"][0]["text"])


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def complete(self, prompt: str, *, model: str | None = None, **kwargs: Any) -> str:
        key = self._settings.anthropic_api_key
        if not key:
            raise RuntimeError("anthropic: no API key configured")
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model or self._settings.anthropic_model,
                    "max_tokens": 2000,
                    "messages": [{"role": "user", "content": prompt}],
                    **kwargs,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return str(data["content"][0]["text"])


def build_llm_providers(settings: Settings) -> list[LLMProvider]:
    """Ordered list in fallback order. Local first, then free, then paid."""
    providers: list[LLMProvider] = [OllamaProvider(settings)]
    if settings.gemini_api_key:
        providers.append(GeminiProvider(settings))
    if settings.groq_api_key:
        providers.append(OpenAICompatProvider("groq", "https://api.groq.com/openai/v1", settings.groq_api_key, settings.groq_model))
    if settings.openrouter_api_key:
        providers.append(OpenAICompatProvider("openrouter", "https://openrouter.ai/api/v1", settings.openrouter_api_key, settings.openrouter_model))
    if settings.anthropic_api_key:
        providers.append(AnthropicProvider(settings))
    if settings.openai_api_key:
        providers.append(OpenAICompatProvider("openai", "https://api.openai.com/v1", settings.openai_api_key, settings.openai_model))
    return providers