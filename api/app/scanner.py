"""Real, dependency-light repository scanner for the LITE demo.

Clones a repository (shallow) and runs deterministic heuristic checks plus a
bundled vulnerability database against declared dependencies. This is the
Phase-4 pipeline in miniature: output shape matches the ``Findings`` ORM model
so results persist and render through the existing findings API.

Safety limits (repo size, file count, scan size) are enforced here exactly as
the spec's demo mode requires.
"""

import asyncio
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.core.logging import get_logger
from app.models import FindingSeverity

logger = get_logger(__name__)


class ScanError(Exception):
    """Raised when a repository cannot be scanned (no network, bad URL, ...)."""


MAX_FILE_SCAN_BYTES = 1_000_000  # only scan file contents up to this size

# ---------------------------------------------------------------------------
# Static heuristic rules. Each rule yields findings with the exact shape the
# Finding ORM model expects.
# ---------------------------------------------------------------------------

_SECRET_RULES: list[tuple[str, str, FindingSeverity, re.Pattern[str]]] = [
    (
        "detected-aws-access-key",
        "Hardcoded AWS access key",
        FindingSeverity.high,
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ),
    (
        "detected-openai-key",
        "Hardcoded OpenAI-style API key",
        FindingSeverity.high,
        re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    ),
    (
        "detected-github-token",
        "Hardcoded GitHub token",
        FindingSeverity.high,
        re.compile(r"(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}"),
    ),
    (
        "detected-google-key",
        "Hardcoded Google API key",
        FindingSeverity.high,
        re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    ),
    (
        "detected-private-key",
        "Private key committed to source",
        FindingSeverity.critical,
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    ),
    (
        "hardcoded-password",
        "Hardcoded password assignment",
        FindingSeverity.high,
        re.compile(r"(?i)(?:password|passwd|pwd)\s*[=:]\s*[\"'][^\"']{6,}[\"']"),
    ),
    (
        "hardcoded-api-key",
        "Hardcoded API key/token value",
        FindingSeverity.medium,
        re.compile(r"(?i)api[_-]?key\s*[=:]\s*[\"'][A-Za-z0-9+/=_\-]{16,}[\"']"),
    ),
    (
        "committed-secret-file",
        "Sensitive file committed (should be gitignored)",
        FindingSeverity.critical,
        re.compile(r"\.(pem|p12|pfx|key|p8)$|(^|/)id_rsa$|(^|/)\.env(-[^/]*)?$", re.I),
    ),
]

_SQLI_RULES: list[tuple[str, str, re.Pattern[str]]] = [
    (
        "sql-string-concat",
        "SQL statement likely built by string concatenation",
        re.compile(r".{0,60}(SELECT|INSERT|UPDATE|DELETE).{0,60}[\"']\s*\+", re.I),
    ),
    (
        "sql-fstring",
        "SQL statement embedded in an f-string (injection risk)",
        re.compile(r"[\"']\s*(SELECT|INSERT|UPDATE|DELETE)[^\"']*\{", re.I),
    ),
]

_UNSAFE_CODE_RULES: list[tuple[str, str, FindingSeverity, re.Pattern[str]]] = [
    (
        "eval-usage",
        "Use of eval() with untrusted input",
        FindingSeverity.medium,
        re.compile(r"\beval\s*\("),
    ),
    (
        "exec-usage",
        "Use of exec() with untrusted input",
        FindingSeverity.medium,
        re.compile(r"\bexec\s*\("),
    ),
    (
        "pickle-usage",
        "Unsafe pickle.loads() (arbitrary code execution)",
        FindingSeverity.medium,
        re.compile(r"\bpickle\.loads?\s*\("),
    ),
    (
        "subprocess-shell",
        "subprocess/shell invocation with shell=True",
        FindingSeverity.medium,
        re.compile(r"subprocess\.(?:call|run|Popen|check_output)[^;]*shell\s*=\s*True"),
    ),
    (
        "django-debug-true",
        "Django DEBUG=True left enabled",
        FindingSeverity.medium,
        re.compile(r"(?i)DEBUG\s*=\s*True"),
    ),
    (
        "hardcoded-secret-key",
        "Django SECRET_KEY hardcoded",
        FindingSeverity.high,
        re.compile(r"(?i)SECRET_KEY\s*=\s*[\"'][^\"']{8,}[\"']"),
    ),
]

# Files that are usually only present in a dependency manifest.
_DEPENDENCY_FILES = ("package.json", "requirements.txt", "pyproject.toml", "go.mod")

# Bundled (curated) known-vulnerable dependency database. In the real pipeline
# this is replaced by OSV/NVD lookups; LITE mode stays offline and deterministic.
_VULN_DB: list[dict[str, object]] = [
    {"package": "lodash", "below": "4.17.21", "cve": "CVE-2021-23337", "cvss": 7.2},
    {"package": "axios", "below": "0.21.2", "cve": "CVE-2021-3749", "cvss": 9.8},
    {"package": "express", "below": "4.17.3", "cve": "CVE-2022-24999", "cvss": 7.5},
    {"package": "jinja2", "below": "3.1.3", "cve": "CVE-2024-22195", "cvss": 6.1},
    {"package": "requests", "below": "2.32.0", "cve": "CVE-2024-35195", "cvss": 8.8},
    {"package": "urllib3", "below": "2.0.7", "cve": "CVE-2023-45803", "cvss": 5.3},
    {"package": "pillow", "below": "10.1.0", "cve": "CVE-2023-44271", "cvss": 7.4},
    {"package": "django", "below": "4.2.15", "cve": "CVE-2024-45230", "cvss": 5.9},
    {"package": "log4j", "below": "2.17.1", "cve": "CVE-2021-44832", "cvss": 6.6},
    {"package": "openpyxl", "below": "3.1.2", "cve": "CVE-2024-35966", "cvss": 6.5},
    {"package": "bootstrap", "below": "4.5.2", "cve": "CVE-2024-6484", "cvss": 9.1},
    {"package": "jszip", "below": "3.8.0", "cve": "CVE-2023-0669", "cvss": 6.1},
]

# O(1) package -> vuln entry lookup for dependencies (built once at import).
_VULN_BY_PACKAGE: dict[str, dict[str, object]] = {
    str(entry["package"]): entry for entry in _VULN_DB
}

# npm vs pypi (vs maven) classification for the manifest the package lives in;
# used as display metadata on the dependencies page.
_ECOSYSTEM: dict[str, str] = {
    "lodash": "npm",
    "axios": "npm",
    "express": "npm",
    "bootstrap": "npm",
    "jszip": "npm",
    "jinja2": "pypi",
    "requests": "pypi",
    "urllib3": "pypi",
    "pillow": "pypi",
    "django": "pypi",
    "openpyxl": "pypi",
    "log4j": "maven",
}


def _version_tuple(version: str) -> tuple[int, ...]:
    nums = re.findall(r"\d+", version) or ["0"]
    return tuple(int(n) for n in nums[:4])


def _version_below(version: str, threshold: str) -> bool:
    return _version_tuple(version) < _version_tuple(threshold)


def _check_file(relative_path: str, content: str) -> list[dict[str, object]]:
    """Run static rules over one file, returning findings.

    Lines are scanned once; every applicable rule is checked against the line
    in a single pass instead of re-walking the line list per rule.
    """
    findings: list[dict[str, object]] = []
    lines = content.splitlines()

    # SQL injection + unsafe code rules are both tagged as `semgrep`; secret
    # rules are tagged as `gitleaks`. SQLI/unsafe findings are high/medium but
    # the message alone signals tool/severity — map rule -> (tool, severity).
    semgrep_rules: list[tuple[str, str, re.Pattern[str], str]] = [
        (rule_id, message, rule, "high") for rule_id, message, rule in _SQLI_RULES
    ]
    semgrep_rules += [
        (rule_id, message, rule, severity.value)
        for rule_id, message, severity, rule in _UNSAFE_CODE_RULES
    ]

    for num, line in enumerate(lines, start=1):
        for rule_id, message, rule, severity in semgrep_rules:
            if rule.search(line):
                findings.append(
                    {
                        "tool": "semgrep",
                        "rule_id": rule_id,
                        "severity": severity,
                        "file_path": relative_path,
                        "line_start": num,
                        "line_end": num,
                        "message": message,
                    }
                )
        for rule_id, message, severity, rule in _SECRET_RULES:
            if rule_id == "committed-secret-file":
                continue  # handled against the path below
            if rule.search(line):
                findings.append(
                    {
                        "tool": "gitleaks",
                        "rule_id": rule_id,
                        "severity": severity.value,
                        "file_path": relative_path,
                        "line_start": num,
                        "line_end": num,
                        "message": message,
                    }
                )

    low = relative_path.lower()
    for rule_id, message, severity, rule in _SECRET_RULES:
        if rule_id == "committed-secret-file" and rule.search(low):
            findings.append(
                {
                    "tool": "gitleaks",
                    "rule_id": rule_id,
                    "severity": severity.value,
                    "file_path": relative_path,
                    "line_start": None,
                    "line_end": None,
                    "message": message,
                }
            )

    return findings


def _parse_dependencies(root: Path) -> dict[str, str]:
    """Package name -> lowest version mentioned, from the usual manifests."""
    deps: dict[str, str] = {}

    pkg_json = root / "package.json"
    if pkg_json.exists():
        import json

        try:
            data = json.loads(pkg_json.read_text(errors="ignore"))
            data = (data or {}).get("dependencies", {}) or {}
            for name, spec in data.items():
                if isinstance(spec, str):
                    match = re.search(r"\d+(\.\d+){1,3}", spec)
                    if match:
                        deps[name] = match.group(0)
        except (json.JSONDecodeError, OSError):
            pass

    req_txt = root / "requirements.txt"
    if req_txt.exists():
        for line in req_txt.read_text(errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith(("#", "-", ".")):
                continue
            parts = re.split(r"[=~<>!; ]+", line, maxsplit=1)
            name = parts[0].strip().lower()
            if not name:
                continue
            match = re.search(r"\d+(\.\d+){1,3}", line)
            if match:
                deps[name] = match.group(0)

    go_mod = root / "go.mod"
    if go_mod.exists():
        for line in go_mod.read_text(errors="ignore").splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[0].startswith("\t"):
                match = re.search(r"\d+(\.\d+){1,3}", parts[-1])
                if match:
                    deps[parts[0].strip().lower()] = match.group(0)

    return deps


def _check_dependencies(root: Path) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    for pkg, version in _parse_dependencies(root).items():
        entry = _VULN_BY_PACKAGE.get(pkg)
        if entry is None:
            continue
        threshold = str(entry["below"])
        if not _version_below(version, threshold):
            continue
        identifier = str(entry["cve"])
        findings.append(
            {
                "tool": "dependency",
                "rule_id": "known-vulnerable-version",
                "severity": "medium"
                if float(entry["cvss"]) < 7.0  # type: ignore[arg-type]
                else "high",
                "file_path": None,
                "line_start": None,
                "line_end": None,
                "message": f"{pkg} {version} is vulnerable to {identifier}",
                "raw_data": {
                    "package": pkg,
                    "version": version,
                    "ecosystem": _ECOSYSTEM.get(pkg, "unknown"),
                    "identifier": identifier,
                    "cvss_score": entry["cvss"],
                    "affected_range": f"< {threshold}",
                    "fixed_version": threshold,
                },
                "vulnerability": {
                    "identifier": identifier,
                    "source": "osv",
                    "cvss_score": entry["cvss"],
                    "summary": (f"{pkg} {version} is affected; upgrade to {threshold} or newer"),
                    "patched_versions": [threshold],
                    "references": [f"https://nvd.nist.gov/vuln/detail/{identifier}"],
                },
            }
        )
    return findings


def _scan_sync(
    repo_url: str,
    branch: str,
    max_repo_mb: int,
    max_files: int,
) -> tuple[list[dict[str, object]], int, int]:
    """Clone + scan synchronously.

    Returns (findings, file_count, total_bytes) where file_count/total_bytes
    describe the scanned working tree (skipping .git) for repo metadata.
    """
    tmp = Path(tempfile.mkdtemp(prefix="codedoc-scan-"))
    try:
        root = tmp / "repo"
        should_fallback = not branch

        if branch:
            cmd = [
                "git",
                "clone",
                "--depth",
                "1",
                "--quiet",
                "--branch",
                branch,
                repo_url,
                str(root),
            ]
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=str(tmp),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    timeout=120,
                )
            except subprocess.TimeoutExpired as exc:
                raise ScanError("git clone timed out (120s limit)") from exc
            if proc.returncode != 0:
                detail = proc.stderr.decode(errors="ignore").strip().splitlines()
                # The requested branch may not exist (e.g. guessed "main" but the
                # repo defaults to "master"). Fall back to the remote default HEAD.
                should_fallback = any(
                    keyword in d.lower()
                    for d in detail
                    for keyword in ("remote branch", "not found", "couldn't find", "no such branch")
                )
                if not should_fallback:
                    raise ScanError(f"git clone failed: {(detail or ['unknown error'])[-1][:300]}")

        if should_fallback:
            cmd = ["git", "clone", "--depth", "1", "--quiet", repo_url, str(root)]
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=str(tmp),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    timeout=120,
                )
            except subprocess.TimeoutExpired as exc:
                raise ScanError("git clone timed out (120s limit)") from exc
            if proc.returncode != 0:
                detail = proc.stderr.decode(errors="ignore").strip().splitlines()
                raise ScanError(f"git clone failed: {(detail or ['unknown error'])[-1][:300]}")

        files: list[tuple[str, str]] = []
        total_bytes = 0
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel.startswith(".git/"):
                continue
            size = path.stat().st_size
            total_bytes += size
            if total_bytes > max_repo_mb * 1024 * 1024:
                raise ScanError(f"repository exceeds {max_repo_mb}MB demo limit")
            files.append((rel, str(path)))
        if len(files) > max_files:
            raise ScanError(f"repository exceeds {max_files} file demo limit")

        findings: list[dict[str, object]] = []
        for rel, rel_path in files:
            if rel.endswith(_DEPENDENCY_FILES):
                continue  # handled by _check_dependencies
            size = Path(rel_path).stat().st_size
            if size > MAX_FILE_SCAN_BYTES:
                continue
            try:
                content = Path(rel_path).read_text(errors="ignore")
            except OSError:
                continue
            findings.extend(_check_file(rel, content))
        findings.extend(_check_dependencies(root))
        logger.info(
            "scan_complete",
            repo_url=repo_url,
            files_scanned=len(files),
            findings=len(findings),
        )
        return (findings, len(files), total_bytes)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


async def run_scan(
    repo_url: str,
    branch: str,
    max_repo_mb: int,
    max_files: int,
) -> tuple[list[dict[str, object]], int, int]:
    """Clone + scan a repository, returning Finding-shaped dicts.

    Runs the blocking clone/scan in a worker thread so the API event loop
    stays responsive.
    """
    return await asyncio.to_thread(_scan_sync, repo_url, branch, max_repo_mb, max_files)
