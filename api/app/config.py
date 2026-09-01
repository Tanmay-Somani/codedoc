import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = os.getenv(
    "CODEDOC_ENV_FILE", str(Path(__file__).resolve().parent.parent / ".env")
)


class Settings(BaseSettings):
    """Application settings, loaded from environment (.env).

    Secrets are read only here and must NEVER be logged, exported to the
    frontend, or included in traces/session replay.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    log_level: str = "INFO"
    secret_key: str = "change-me-generate-a-random-string"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Core services
    database_url: str = "postgresql+asyncpg://codedoc:codedoc@postgres:5432/codedoc"
    database_url_sync: str = "postgresql://codedoc:codedoc@postgres:5432/codedoc"
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333
    valkey_url: str = "redis://valkey:6379/0"
    minio_host: str = "minio"
    minio_port: int = 9000
    minio_root_user: str = "codedoc"
    minio_root_password: str = "codedoc-minio"
    minio_bucket: str = "codedoc-artifacts"

    # Error tracking: Sentry SDKs, but the DSN points AT GLITCHTIP.
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1

    # LLM providers (user-configured). OpenRouter is primary; Ollama is
    # an OPTIONAL local mode behind the FULL profile (OLLAMA_ENABLED=true).
    llm_provider: str = "openrouter"
    openrouter_api_key: str = ""
    openrouter_model_coding: str = "anthropic/claude-sonnet-4"  # Patch Agent
    openrouter_model_reasoning: str = "deepseek/deepseek-r1"  # Debug Agent
    openrouter_model_fast: str = "openai/gpt-4o-mini"  # Summary Agent
    ollama_enabled: bool = False
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5-coder:7b"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-latest"

    # Embeddings
    embedding_provider: str = "local"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Search
    search_provider: str = "searxng"
    searxng_url: str = "http://searxng:8080"
    tavily_api_key: str = ""
    brave_api_key: str = ""
    serper_api_key: str = ""

    # Demo safety limits
    demo_max_repo_mb: int = 30
    demo_max_files: int = 1500
    demo_max_concurrent_per_user: int = 1
    demo_analysis_timeout_min: int = 10

    # Cryptography key for encrypting user-provided API keys at rest
    fernet_key: str = Field(default="", alias="SECRET_KEY")


@lru_cache
def get_settings() -> Settings:
    return Settings()
