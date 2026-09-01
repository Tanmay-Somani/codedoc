from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"
    services: dict[str, str]


class IntegrationStatus(BaseModel):
    providers: dict[str, str]
    active_llm: str
    usage: dict[str, object]


class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    url: str | None = None
    default_branch: str = "main"


class RepositoryOut(BaseModel):
    id: int
    name: str
    url: str | None = None
    default_branch: str
    size_bytes: int
    file_count: int
    is_sample: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalysisCreate(BaseModel):
    repository_id: int
    commit_sha: str | None = None


class AnalysisOut(BaseModel):
    id: int
    repository_id: int
    status: str
    commit_sha: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalysisVulnerabilityOut(BaseModel):
    id: int
    tool: str
    rule_id: str | None
    severity: str
    file_path: str | None
    line_start: int | None
    line_end: int | None
    message: str
    ai_explanation: str | None
    root_cause: str | None

    model_config = {"from_attributes": True}


class AnalyzeRequest(BaseModel):
    """Direct LLM analysis of provided text (post-redaction)."""

    content: str = Field(min_length=1)
    task: str = "explain"
