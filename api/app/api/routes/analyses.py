import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import Deps, db_unavailable, get_deps
from app.core.logging import get_logger
from app.core.redaction import redact_text
from app.models import (
    Analysis,
    AnalysisStatus,
    Finding,
    FindingSeverity,
    Repository,
    User,
    Vulnerability,
)
from app.providers.registry import Registry
from app.scanner import ScanError, run_scan
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

# Demo placeholder for the Phase 4 scan pipeline: seeded representative
# findings so the sample flow shows real, persisted results.
_SAMPLE_FINDINGS: list[dict[str, object]] = [
    {
        "tool": "bandit",
        "rule_id": "B608",
        "severity": FindingSeverity.high,
        "file_path": "app/auth.py",
        "line_start": 14,
        "line_end": 14,
        "message": "Potential hardcoded password: hardcoded_password_string",
        "ai_explanation": (
            "This code embeds a plaintext password directly in source. Anyone "
            "with read access to the repository can extract it. Replace with a "
            "secret-vault reference or environment variable."
        ),
        "root_cause": "Developer convenience made the secret a literal in a constants module.",
    },
    {
        "tool": "semgrep",
        "rule_id": "python.lang.security.sql-injection",
        "severity": FindingSeverity.critical,
        "file_path": "app/db.py",
        "line_start": 42,
        "line_end": 45,
        "message": "SQL statement built from unsanitized user input",
        "ai_explanation": (
            "User-supplied input is interpolated directly into a SQL string. "
            "An attacker can inject arbitrary SQL. Use parameterized queries "
            "or an ORM to bind values safely."
        ),
        "root_cause": "Query built via f-string instead of a parameterized cursor.execute.",
        "vulnerability": {
            "identifier": "CVE-2019-16239",
            "source": "nvd",
            "cvss_score": 9.8,
            "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "summary": "SQL injection allowing full database compromise.",
            "references": ["https://nvd.nist.gov/vuln/detail/CVE-2019-16239"],
        },
    },
    {
        "tool": "gitleaks",
        "rule_id": "generic-api-key",
        "severity": FindingSeverity.medium,
        "file_path": ".env.example",
        "line_start": 3,
        "line_end": 3,
        "message": "Detected a possible API key in source",
        "ai_explanation": (
            "A token-shaped string was found. It has been redacted before "
            "reaching any external LLM. Rotate the key and store it in the "
            "encrypted vault."
        ),
        "root_cause": (
            "Example environment file committed with a placeholder that looks like a key."
        ),
    },
    {
        "tool": "ruff",
        "rule_id": "S105",
        "severity": FindingSeverity.low,
        "file_path": "worker.py",
        "line_start": 20,
        "line_end": 20,
        "message": "Hardcoded temporary admin password",
        "ai_explanation": (
            "A default password is set in code. While usable for local dev, "
            "it must not ship to production."
        ),
        "root_cause": "Bootstrap script uses a static default credential.",
    },
    {
        "tool": "eslint",
        "rule_id": "no-unused-vars",
        "severity": FindingSeverity.info,
        "file_path": "src/index.ts",
        "line_start": 7,
        "line_end": 7,
        "message": "'foo' is defined but never used",
        "ai_explanation": (
            "Dead code increases maintenance cost. Removing unused bindings "
            "keeps the codebase clean."
        ),
        "root_cause": "Leftover variable from an earlier refactor.",
    },
]


async def _persist_findings(
    db: AsyncSession, analysis_id: int, items: list[dict[str, object]]
) -> None:
    """Persist Finding rows (and linked Vulnerability rows) for an analysis."""
    for item in items:
        finding = Finding(
            analysis_id=analysis_id,
            tool=item["tool"],
            rule_id=item["rule_id"],
            severity=item["severity"],
            file_path=item.get("file_path"),
            line_start=item.get("line_start"),
            line_end=item.get("line_end"),
            message=item["message"],
            ai_explanation=item.get("ai_explanation"),
            root_cause=item.get("root_cause"),
            raw_data=item.get("raw_data"),
        )
        db.add(finding)
        await db.flush()
        vuln = item.get("vulnerability")
        if isinstance(vuln, dict):
            db.add(
                Vulnerability(
                    finding_id=finding.id,
                    source=vuln["source"],
                    identifier=vuln["identifier"],
                    summary=vuln.get("summary"),
                    cvss_score=vuln.get("cvss_score"),
                    cvss_vector=vuln.get("cvss_vector"),
                    patched_versions=vuln.get("patched_versions"),
                    references=vuln.get("references"),
                )
            )


async def _complete_demo_analysis(analysis_id: int, max_repo_mb: int, max_files: int) -> None:
    """Demo stand-in for the scan worker: run the real (LITE) heuristics
    scanner against the repository and persist findings. Sample repositories
    get a seeded, representative result set."""
    await asyncio.sleep(2)
    from app.db.session import async_session

    async with async_session() as db:
        analysis = await db.get(Analysis, analysis_id, populate_existing=True)
        if analysis is None or analysis.status in (
            AnalysisStatus.completed,
            AnalysisStatus.failed,
        ):
            return
        repo = await db.get(Repository, analysis.repository_id)
        if repo is not None and repo.is_sample:
            analysis.status = AnalysisStatus.completed
            await _persist_findings(db, analysis.id, _SAMPLE_FINDINGS)
            await db.commit()
            logger.info("analysis_completed", analysis_id=analysis.id)
            return

        if repo is None or not repo.url:
            analysis.status = AnalysisStatus.completed
            await db.commit()
            return

        try:
            scan_results, file_count, total_bytes = await run_scan(
                repo.url, repo.default_branch, max_repo_mb, max_files
            )
        except ScanError as exc:
            analysis.status = AnalysisStatus.failed
            analysis.error = str(exc)
            await db.commit()
            logger.warning("analysis_failed", analysis_id=analysis.id, error=str(exc))
            return
        repo.size_bytes = total_bytes
        repo.file_count = file_count
        analysis.status = AnalysisStatus.completed
        await _persist_findings(db, analysis.id, scan_results)
        await db.commit()
        logger.info("analysis_completed", analysis_id=analysis.id)


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
        result = await db.execute(select(Repository).order_by(Repository.created_at.desc()))
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
        owner_id=user.id,
        name=payload.name,
        url=payload.url,
        default_branch=payload.default_branch,
        is_sample=payload.is_sample,
    )
    db.add(repo)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="repository with that name already exists"
        ) from exc
    await db.refresh(repo)
    return {"id": repo.id, "name": repo.name}


@router.post("/analyses", response_model=AnalysisOut)
async def create_analysis(
    payload: AnalysisCreate,
    background_tasks: BackgroundTasks,
    deps: Deps = Depends(get_deps),
) -> AnalysisOut:
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
    background_tasks.add_task(
        _complete_demo_analysis,
        analysis.id,
        settings.demo_max_repo_mb,
        settings.demo_max_files,
    )
    logger.info("analysis_created", analysis_id=analysis.id, repository=repo.name)
    return AnalysisOut.model_validate(analysis)


@router.get("/analyses", response_model=list[AnalysisOut])
async def list_analyses(deps: Deps = Depends(get_deps)) -> list[AnalysisOut]:
    db: AsyncSession = deps["db"]
    try:
        result = await db.execute(select(Analysis).order_by(Analysis.created_at.desc()).limit(50))
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
            .options(selectinload(Finding.vulnerability))
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
