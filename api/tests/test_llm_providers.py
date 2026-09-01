import pytest


def test_resolve_role_model_defaults(settings):
    from app.providers.llm import resolve_role_model

    assert resolve_role_model(settings, "coding") == settings.openrouter_model_coding
    assert resolve_role_model(settings, "reasoning") == settings.openrouter_model_reasoning
    assert resolve_role_model(settings, "fast") == settings.openrouter_model_fast
    assert resolve_role_model(settings, "unknown") == settings.openrouter_model_fast


def test_build_llm_providers_openrouter_first():
    from app.config import Settings

    s = Settings(_env_file=None, openrouter_api_key="")
    from app.providers.llm import build_llm_providers

    providers = build_llm_providers(s)
    assert providers[0].name == "openrouter"
    assert "ollama" not in [p.name for p in providers]


def test_build_llm_providers_ollama_optional_when_enabled():
    from app.config import Settings

    s = Settings(_env_file=None, ollama_enabled=True)
    from app.providers.llm import build_llm_providers

    names = [p.name for p in build_llm_providers(s)]
    assert "openrouter" in names
    assert "ollama" in names
    assert names.index("openrouter") < names.index("ollama")


def test_openrouter_provider_requires_key(settings):
    import asyncio

    from app.providers.llm import OpenRouterProvider

    provider = OpenRouterProvider(settings)
    with pytest.raises(RuntimeError, match="no API key"):
        asyncio.run(provider.complete("hello"))
