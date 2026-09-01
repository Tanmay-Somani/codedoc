from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Deps, db_unavailable, get_deps
from app.core.logging import get_logger
from app.core.redaction import redact_text
from app.models import Analysis, AnalysisStatus, Finding, Repository, User
from app.providers.registry import Registry
from app.schemas import (
    AnalysisCreate,
    AnalysisOut,
    AnalysisVulnerabilityOut,
    AnalyzeRequest,
    RepositoryCreate,
    RepositoryOut,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["analyses"])


async def _current_user(db: AsyncSession) -> User:
    """Dev bootstrap user. Replaced by real auth in Phase 2."""
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email="dev@codedoc.local")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.get("/repositories", response_model=list[RepositoryOut])
async def list_repositories(deps: Deps = Depends(get_deps)) -> list[RepositoryOut]:
    db: AsyncSession = deps["db"]
    try:
        result = await db.execute(
            select(Repository).order_by(Repository.created_at.desc())
        )
        return [RepositoryOut.model_validate(r) for r in result.scalars().all()]
    except Exception as exc:  # noqa: BLE001 - degrade when DB is unreachable
        if await db_unavailable(exc):
            logger.warning("db_unavailable_repositories", error=str(exc))
            return []
        raise


@router.post("/repositories")
async def create_repository(
    payload: RepositoryCreate, deps: Deps = Depends(get_deps)
) -> dict[str, object]:
    db: AsyncSession = deps["db"]
    user = await _current_user(db)
    repo = Repository(
        owner_id=user.id, name=payload.name, url=payload.url, default_branch=payload.default_branch
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return {"id": repo.id, "name": repo.name}


@router.post("/analyses", response_model=AnalysisOut)
async def create_analysis(payload: AnalysisCreate, deps: Deps = Depends(get_deps)) -> AnalysisOut:
    db: AsyncSession = deps["db"]
    user = await _current_user(db)
    repo = await db.get(Repository, payload.repository_id)
    if repo is None or repo.owner_id != user.id:
        raise HTTPException(status_code=404, detail="repository not found")

    # Demo safety: cap concurrent analyses per user.
    settings = deps["settings"]
    active = await db.execute(
        select(Analysis).where(
            Analysis.repository_id == repo.id,
            Analysis.status.in_([AnalysisStatus.queued, AnalysisStatus.running]),
        )
    )
    if len(active.scalars().all()) >= settings.demo_max_concurrent_per_user:
        raise HTTPException(status_code=429, detail="concurrent analysis limit reached for demo")

    analysis = Analysis(repository_id=repo.id, commit_sha=payload.commit_sha)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    logger.info("analysis_created", analysis_id=analysis.id, repository=repo.name)
    return AnalysisOut.model_validate(analysis)


@router.get("/analyses", response_model=list[AnalysisOut])
async def list_analyses(deps: Deps = Depends(get_deps)) -> list[AnalysisOut]:
    db: AsyncSession = deps["db"]
    try:
        result = await db.execute(
            select(Analysis).order_by(Analysis.created_at.desc()).limit(50)
        )
        return [AnalysisOut.model_validate(a) for a in result.scalars().all()]
    except Exception as exc:  # noqa: BLE001 - degrade when DB is unreachable
        if await db_unavailable(exc):
            logger.warning("db_unavailable_analyses", error=str(exc))
            return []
        raise


@router.get("/analyses/{analysis_id}", response_model=list[AnalysisVulnerabilityOut])
async def get_analysis_findings(
    analysis_id: int, deps: Deps = Depends(get_deps)
) -> list[AnalysisVulnerabilityOut]:
    db: AsyncSession = deps["db"]
    try:
        result = await db.execute(
            select(Finding)
            .where(Finding.analysis_id == analysis_id)
            .order_by(Finding.severity)
        )
        return [AnalysisVulnerabilityOut.model_validate(f) for f in result.scalars().all()]
    except Exception as exc:  # noqa: BLE001 - degrade when DB is unreachable
        if await db_unavailable(exc):
            logger.warning("db_unavailable_findings", error=str(exc))
            return []
        raise


@router.post("/analyze")
async def analyze(payload: AnalyzeRequest, deps: Deps = Depends(get_deps)) -> dict[str, object]:
    """Agent-callable LLM analysis. Content is REDACTED before it leaves the server."""
    registry: Registry = deps["registry"]
    safe_content = redact_text(payload.content)
    if safe_content != payload.content:
        logger.info("secrets_redacted_before_llm")
    prompt = f"Task: {payload.task}\n\n{safe_content}"
    try:
        explanation = await registry.llm_complete_with_fallback(prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "task": payload.task,
        "redacted": safe_content != payload.content,
        "explanation": explanation,
    }
