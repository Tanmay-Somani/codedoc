import pytest


@pytest.fixture
def settings():
    from app.config import Settings

    return Settings(_env_file=None)


@pytest.fixture
def rate_state():
    from app.providers.base import InMemoryRateLimitState

    return InMemoryRateLimitState()