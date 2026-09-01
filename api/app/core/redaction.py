"""Secret detection and redaction.

Gitleaks findings drive real-world detection in the analysis pipeline, but
this module is the code-level guarantee: anything leaving the sandbox to an
external LLM must pass through :func:`redact_text` first.
"""

import re

REDACTED = "[REDACTED_SECRET]"

# High-signal patterns (defense in depth on top of Gitleaks).
_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),  # OpenAI-style keys
    re.compile(r"(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}"),  # GitHub tokens
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),  # Google API keys
    re.compile(r"(?i)api[_-]?key\s*[=:]\s*[\"']?[A-Za-z0-9+/=_\-]{16,}"),
    re.compile(r"(?i)(secret|password|passwd|token)\s*[=:]\s*[\"']?[A-Za-z0-9+/=_\-]{12,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"[A-Za-z0-9_\-]{20,}\.atraz[0-9A-Za-z]{20,}"),  # Atlassian tokens (best-effort)
]


def redact_text(text: str) -> str:
    """Replace detected secrets with ``[REDACTED_SECRET]``."""
    for pattern in _PATTERNS:
        text = pattern.sub(REDACTED, text)
    return text


def redact_mapping(mapping: dict[str, str]) -> dict[str, str]:
    """Return a new mapping with every string value redacted."""
    return {k: (redact_text(v) if isinstance(v, str) else v) for k, v in mapping.items()}
