"""Core ORM entities.

Domains from the spec: users, repositories, analyses, findings, vulnerabilities,
agents, model_results, patches, tests, api_usage, config, audit_logs.
"""

import enum
from typing import Any

from sqlalchemy import (
    JSON,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class AnalysisStatus(enum.StrEnum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class FindingSeverity(enum.StrEnum):
    info = "info"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    github_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_admin: Mapped[bool] = mapped_column(default=False)

    repositories: Mapped[list["Repository"]] = relationship(back_populates="owner")


class Repository(Base, TimestampMixin):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    default_branch: Mapped[str] = mapped_column(String(128), default="main")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    is_sample: Mapped[bool] = mapped_column(default=False)

    owner: Mapped[User] = relationship(back_populates="repositories")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="repository")

    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_repo_owner_name"),)


class Analysis(Base, TimestampMixin):
    __tablename__ = "analyses"
    __table_args__ = (Index("ix_analysis_repo_status", "repository_id", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus), default=AnalysisStatus.queued
    )
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    repository: Mapped[Repository] = relationship(back_populates="analyses")
    findings: Mapped[list["Finding"]] = relationship(back_populates="analysis")


class Finding(Base, TimestampMixin):
    __tablename__ = "findings"
    __table_args__ = (Index("ix_finding_analysis_severity", "analysis_id", "severity"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"), index=True)
    tool: Mapped[str] = mapped_column(
        String(64)
    )  # semgrep|bandit|ruff|mypy|eslint|gitleaks|trivy|dependency
    rule_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    severity: Mapped[FindingSeverity] = mapped_column(
        Enum(FindingSeverity), default=FindingSeverity.info
    )
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    line_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    line_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text)
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    ai_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)

    analysis: Mapped[Analysis] = relationship(back_populates="findings")
    vulnerability: Mapped["Vulnerability | None"] = relationship(
        back_populates="finding", uselist=False
    )


class Vulnerability(Base, TimestampMixin):
    __tablename__ = "vulnerabilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey("findings.id"), unique=True)
    source: Mapped[str] = mapped_column(String(64))  # osv|nvd|github_advisory
    identifier: Mapped[str] = mapped_column(String(128), index=True)  # CVE-..., GHSA-..., OSV-...
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_range: Mapped[str | None] = mapped_column(Text, nullable=True)
    cvss_score: Mapped[float | None] = mapped_column(nullable=True)
    cvss_vector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    patched_versions: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    references: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    finding: Mapped[Finding] = relationship(back_populates="vulnerability")


class ApiUsage(Base, TimestampMixin):
    __tablename__ = "api_usage"
    __table_args__ = (UniqueConstraint("provider", "period", name="uq_api_usage_provider_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), index=True)
    period: Mapped[str] = mapped_column(String(32))  # e.g. "2026-09-01T13"
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    total_latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    cache_hits: Mapped[int] = mapped_column(Integer, default=0)
    cache_misses: Mapped[int] = mapped_column(Integer, default=0)
    rate_remaining: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_reset_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class EncryptedConfig(Base, TimestampMixin):
    """Provider keys and configuration, encrypted at rest (never logged)."""

    __tablename__ = "config"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    key: Mapped[str] = mapped_column(String(128), unique=True)
    value_encrypted: Mapped[str] = mapped_column(Text)

    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_config_user_key"),)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(128))  # e.g. analysis.created, config.updated
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class AgentRun(Base, TimestampMixin):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"), index=True)
    agent_type: Mapped[str] = mapped_column(String(64))  # investigation|patch|research|security
    status: Mapped[str] = mapped_column(String(32), default="queued")
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    input_summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class ModelResult(Base, TimestampMixin):
    __tablename__ = "model_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("analyses.id"), nullable=True)
    model_name: Mapped[str] = mapped_column(String(128))
    task: Mapped[str] = mapped_column(String(64))  # vulnerability_classification|bug_risk|custom
    input_hash: Mapped[str] = mapped_column(String(64), index=True)
    prediction: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    confidence: Mapped[float | None] = mapped_column(nullable=True)
    mlflow_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Patch(Base, TimestampMixin):
    __tablename__ = "patches"

    id: Mapped[int] = mapped_column(primary_key=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey("findings.id"), index=True)
    diff: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tests_passed: Mapped[bool | None] = mapped_column(nullable=True)
    pr_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
