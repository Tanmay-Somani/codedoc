import asyncio
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import case, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import Deps, db_unavailable, get_deps
from app.core.logging import get_logger
from app.core.redaction import redact_text
from app.models import (
    AgentRun,
    Analysis,
    AnalysisStatus,
    Finding,
    FindingSeverity,
    ModelResult,
    Patch,
    Repository,
    User,
    Vulnerability,
)
from app.providers.base import ScanProgressStore
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


async def _repo_meta(url: str) -> tuple[int, int]:
    """Shallow-clone a repo and return (file_count, total_bytes).

    This both verifies the URL points at an existing, reachable repository and
    lets us populate the repository's metadata (file count / size) immediately
    on add, instead of showing 0 B / 0 files until an analysis runs.

    Raises ``HTTPException(422)`` if the URL is not a valid, existing repo,
    telling the user to enter a proper repository.
    """
    git = shutil.which("git")
    if git is None:
        raise HTTPException(
            status_code=422,
            detail="git is not available on the server; cannot verify the repository URL.",
        )

    tmp = Path(tempfile.mkdtemp(prefix="codedoc-repo-meta-"))
    try:
        root = tmp / "repo"
        cmd = [
            git,
            "clone",
            "--depth",
            "1",
            "--quiet",
            url,
            str(root),
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except (TimeoutError, OSError):
            raise HTTPException(
                status_code=422,
                detail="Could not reach that repository URL. Please enter a valid, "
                "existing Git repository (e.g. https://github.com/org/repo.git).",
            ) from None
        if proc.returncode != 0:
            detail = (stderr or b"").decode(errors="ignore").strip().splitlines()
            raise HTTPException(
                status_code=422,
                detail="That repository does not exist or is not reachable. Please "
                f"enter a proper, existing repo. ({detail[-1] if detail else 'not found'})",
            )

        file_count = 0
        total_bytes = 0
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel.startswith(".git/"):
                continue
            total_bytes += path.stat().st_size
            file_count += 1
        return file_count, total_bytes
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


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
    """Persist Finding rows (and linked Vulnerability rows) for an analysis.

    Findings are added in bulk and flushed once to backfill generated IDs,
    then vulnerabilities are added in bulk — a single flush instead of one
    round-trip per finding.
    """
    findings: list[Finding] = []
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
        findings.append(finding)
        db.add(finding)
    if findings:
        await db.flush()

    for finding, item in zip(findings, items, strict=True):
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


async def _complete_demo_analysis(
    analysis_id: int,
    max_repo_mb: int,
    max_files: int,
    max_scan_files: int,
    timeout_min: int,
    progress_store: ScanProgressStore,
) -> None:
    """Demo stand-in for the scan worker: run the real (LITE) heuristics
    scanner against the repository and persist findings. Sample repositories
    get a seeded, representative result set."""
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

        progress_store.set(
            analysis_id,
            {"phase": "cloning", "current": 0, "total": 0, "message": "Cloning repository…"},
        )
        try:
            scan_results, file_count, total_bytes = await asyncio.wait_for(
                run_scan(
                    repo.url,
                    repo.default_branch,
                    max_repo_mb,
                    max_files,
                    max_scan_files,
                    lambda snap: progress_store.set(analysis_id, snap),
                ),
                timeout=timeout_min * 60,
            )
        except TimeoutError:
            analysis.status = AnalysisStatus.failed
            analysis.error = f"analysis timed out after {timeout_min} minutes"
            await db.commit()
            logger.warning("analysis_timed_out", analysis_id=analysis.id)
            progress_store.clear(analysis_id)
            return
        except ScanError as exc:
            analysis.status = AnalysisStatus.failed
            analysis.error = str(exc)
            await db.commit()
            logger.warning("analysis_failed", analysis_id=analysis.id, error=str(exc))
            progress_store.clear(analysis_id)
            return
        repo.size_bytes = total_bytes
        repo.file_count = file_count
        analysis.status = AnalysisStatus.completed
        await _persist_findings(db, analysis.id, scan_results)
        await db.commit()
        progress_store.clear(analysis_id)
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


def _snap_int(snap: dict[str, object], key: str) -> int:
    """Read an int from a progress snapshot dict (values are typed object)."""
    value = snap.get(key)
    return value if isinstance(value, int) else 0


def _analysis_out_with_progress(analysis: Analysis, store: ScanProgressStore | None) -> AnalysisOut:
    """Build an AnalysisOut, merging any live scan progress into it.

    Progress is stored in-memory keyed by analysis id while the scan runs; once
    it completes the entry is cleared, so only in-flight analyses carry a value.
    The overall bar fraction is derived from the scanning phase's current/total.
    """
    out = AnalysisOut.model_validate(analysis)
    if store is None or analysis.status != AnalysisStatus.running:
        return out
    snap = store.get(analysis.id)
    if not snap:
        return out
    phase = str(snap.get("phase", ""))
    if phase == "finalizing":
        out.progress = 1.0
        out.progress_message = "Finalizing…"
    elif phase == "scanning":
        total = _snap_int(snap, "total")
        current = _snap_int(snap, "current")
        if total > 0:
            out.progress = min(1.0, current / total)
        # Reserve a little headroom before finalizing by scaling to 0.95.
        out.progress = round((out.progress or 0.0) * 0.95, 3)
        out.progress_message = str(snap.get("message") or "Scanning…")
    else:  # cloning or unknown
        out.progress_message = str(snap.get("message") or "Working…")
    return out


@router.get("/repositories", response_model=list[RepositoryOut])
async def list_repositories(
    offset: int = 0,
    limit: int = 100,
    deps: Deps = Depends(get_deps),
) -> list[RepositoryOut]:
    db: AsyncSession = deps["db"]
    try:
        result = await db.execute(
            select(Repository).order_by(Repository.created_at.desc()).offset(offset).limit(limit)
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
    size_bytes = 0
    file_count = 0
    if payload.url and not payload.is_sample:
        file_count, size_bytes = await _repo_meta(payload.url)
    repo = Repository(
        owner_id=user.id,
        name=payload.name,
        url=payload.url,
        default_branch=payload.default_branch,
        is_sample=payload.is_sample,
        size_bytes=size_bytes,
        file_count=file_count,
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


@router.delete("/repositories/{repository_id}")
async def delete_repository(
    repository_id: int, deps: Deps = Depends(get_deps)
) -> dict[str, object]:
    db: AsyncSession = deps["db"]
    user = await _current_user(db)
    repo = await db.get(Repository, repository_id)
    if repo is None or repo.owner_id != user.id:
        raise HTTPException(status_code=404, detail="repository not found")

    # No DB-level ON DELETE CASCADE, so remove dependents explicitly in order.
    analyses = await db.execute(select(Analysis.id).where(Analysis.repository_id == repo.id))
    analysis_ids = [row[0] for row in analyses.all()]
    if analysis_ids:
        finding_ids_res = await db.execute(
            select(Finding.id).where(Finding.analysis_id.in_(analysis_ids))
        )
        finding_ids = [row[0] for row in finding_ids_res.all()]
        if finding_ids:
            await db.execute(delete(Patch).where(Patch.finding_id.in_(finding_ids)))
            await db.execute(delete(Vulnerability).where(Vulnerability.finding_id.in_(finding_ids)))
            await db.execute(delete(Finding).where(Finding.id.in_(finding_ids)))
        await db.execute(delete(AgentRun).where(AgentRun.analysis_id.in_(analysis_ids)))
        await db.execute(delete(ModelResult).where(ModelResult.analysis_id.in_(analysis_ids)))
        await db.execute(delete(Analysis).where(Analysis.id.in_(analysis_ids)))

    await db.delete(repo)
    await db.commit()
    logger.info("repository_deleted", repository_id=repo.id, name=repo.name)
    return {"id": repo.id, "deleted": True}


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
    registry: Registry = deps["registry"]
    background_tasks.add_task(
        _complete_demo_analysis,
        analysis.id,
        settings.demo_max_repo_mb,
        settings.demo_max_files,
        settings.demo_max_scan_files,
        settings.demo_analysis_timeout_min,
        registry.scan_progress,
    )
    logger.info("analysis_created", analysis_id=analysis.id, repository=repo.name)
    return AnalysisOut.model_validate(analysis)


@router.get("/analyses", response_model=list[AnalysisOut])
async def list_analyses(
    offset: int = 0,
    limit: int = 50,
    deps: Deps = Depends(get_deps),
) -> list[AnalysisOut]:
    db: AsyncSession = deps["db"]
    store: ScanProgressStore = deps["registry"].scan_progress
    try:
        result = await db.execute(
            select(Analysis).order_by(Analysis.created_at.desc()).offset(offset).limit(limit)
        )
        return [_analysis_out_with_progress(a, store) for a in result.scalars().all()]
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
        severity_rank = case(
            (Finding.severity == FindingSeverity.critical, 0),
            (Finding.severity == FindingSeverity.high, 1),
            (Finding.severity == FindingSeverity.medium, 2),
            (Finding.severity == FindingSeverity.low, 3),
            else_=4,
        )
        result = await db.execute(
            select(Finding)
            .where(Finding.analysis_id == analysis_id)
            .order_by(severity_rank)
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
    """Agent-callable LLM analysis. Content is REDACTED before it leaves the server.

    Token-safety guards: a per-user sliding-window rate limit and a hard cap on
    input size, plus a bounded output ``max_tokens``, so a runaway caller can't
    blow through the LLM budget.
    """
    registry: Registry = deps["registry"]
    settings = deps["settings"]
    db: AsyncSession = deps["db"]

    if len(payload.content) > settings.demo_analyze_max_chars:
        raise HTTPException(
            status_code=429,
            detail=f"analyze content exceeds the token-safety limit "
            f"({settings.demo_analyze_max_chars} chars)",
        )

    user = await _current_user(db)
    if not registry.analyze_limiter.allow(str(user.id)):
        raise HTTPException(
            status_code=429,
            detail=f"analyze rate limit reached ({settings.demo_analyze_limit_per_min}/min)",
        )

    safe_content = redact_text(payload.content)
    if safe_content != payload.content:
        logger.info("secrets_redacted_before_llm")
    prompt = f"Task: {payload.task}\n\n{safe_content}"
    try:
        explanation = await registry.llm_complete_with_fallback(
            prompt, max_tokens=settings.demo_analyze_max_tokens
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "task": payload.task,
        "redacted": safe_content != payload.content,
        "explanation": explanation,
    }
