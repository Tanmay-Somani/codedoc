import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_ROOT = Path(__file__).resolve().parent.parent  # .../codedoc/api
_REPO_ROOT = _API_ROOT.parent  # .../codedoc
_ENV_FILE = os.getenv(
    "CODEDOC_ENV_FILE",
    str(_REPO_ROOT / ".env"),
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
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
    ]

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
    demo_max_repo_mb: int = 256
    demo_max_files: int = 5000
    demo_max_scan_files: int = 200
    demo_max_concurrent_per_user: int = 1
    demo_analysis_timeout_min: int = 10

    # Token-safety guards for the LLM /analyze endpoint
    demo_analyze_limit_per_min: int = 20
    demo_analyze_max_chars: int = 100_000
    demo_analyze_max_tokens: int = 512

    # Cryptography key for encrypting user-provided API keys at rest
    fernet_key: str = Field(default="", alias="SECRET_KEY")

    def check_environment(self) -> list[tuple[str, str]]:
        """Return ``(level, message)`` startup issues.

        ``critical`` entries mean an insecure/unsafe production setup;
        ``warning`` entries mean a degraded-but-functional configuration.
        This never raises - it only surfaces problems so the demo can still boot.
        """
        issues: list[tuple[str, str]] = []
        prod = self.environment == "production"

        if self.secret_key in ("", DEFAULT_SECRET_KEY):
            level = "critical" if prod else "warning"
            issues.append(
                (
                    level,
                    "SECRET_KEY is unset or the default value; key vault encryption is insecure",
                )
            )
        if self.minio_root_password == DEFAULT_MINIO_PASSWORD:
            level = "critical" if prod else "warning"
            issues.append((level, "MinIO root password is the default 'codedoc-minio'"))

        if prod and not self.sentry_dsn:
            issues.append(("warning", "SENTRY_DSN is empty; error tracking is disabled"))

        for provider, key in (
            ("openrouter", self.openrouter_api_key),
            ("openai", self.openai_api_key),
            ("gemini", self.gemini_api_key),
            ("groq", self.groq_api_key),
            ("anthropic", self.anthropic_api_key),
        ):
            if self.llm_provider == provider and not key:
                issues.append(("warning", f"LLM provider '{provider}' has no API key configured"))

        if self.search_provider == "searxng" and not self.searxng_url:
            issues.append(
                ("warning", "SearXNG URL is empty; search-based reasoning is unavailable")
            )
        for provider, key in (
            ("tavily", self.tavily_api_key),
            ("brave", self.brave_api_key),
            ("serper", self.serper_api_key),
        ):
            if self.search_provider == provider and not key:
                issues.append(
                    ("warning", f"Search provider '{provider}' has no API key configured")
                )

        return issues


DEFAULT_SECRET_KEY = "change-me-generate-a-random-string"
DEFAULT_MINIO_PASSWORD = "codedoc-minio"


@lru_cache
def get_settings() -> Settings:
    return Settings()
