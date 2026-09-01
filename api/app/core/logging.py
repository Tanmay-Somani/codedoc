import logging
import sys
from typing import Any

import structlog

from app.config import Settings


def setup_logging(settings: Settings) -> None:
    """Configure structlog JSON logging. Never log secret material."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(stream=sys.stdout, level=level, format="%(message)s")

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(ensure_ascii=False),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "codedoc") -> structlog.typing.FilteringBoundLogger:
    return structlog.get_logger(name)


def log_redacted(logger: Any, **ctx: Any) -> None:
    """Log a context dict after stamping out anything that looks like a secret."""
    from app.core.redaction import redact_text

    logger.info(**{k: (redact_text(str(v)) if isinstance(v, str) else v) for k, v in ctx.items()})