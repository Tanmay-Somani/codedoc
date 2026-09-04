"""Tests for the 'necessary files only' scanner selection logic."""

from app.scanner import MAX_SCAN_FILES, _select_scan_files


def _tree() -> list[tuple[str, str]]:
    # (relative path, absolute path) pairs as produced by the repo walk.
    return [
        ("src/app.py", "/repo/src/app.py"),
        ("src/utils.go", "/repo/src/utils.go"),
        ("node_modules/pkg/index.js", "/repo/node_modules/pkg/index.js"),
        ("vendor/lib/core.rs", "/repo/vendor/lib/core.rs"),
        ("dist/bundle.min.js", "/repo/dist/bundle.min.js"),
        ("assets/logo.png", "/repo/assets/logo.png"),
        ("package.json", "/repo/package.json"),
        ("requirements.txt", "/repo/requirements.txt"),
        ("config/settings.yaml", "/repo/config/settings.yaml"),
        (".env", "/repo/.env"),
        ("README.md", "/repo/README.md"),
        (".github/workflows/ci.yml", "/repo/.github/workflows/ci.yml"),
    ]


def test_select_scan_files_skips_vendored_and_binaries():
    selected = {rel for rel, _ in _select_scan_files(_tree())}
    assert "src/app.py" in selected
    assert "src/utils.go" in selected
    assert "config/settings.yaml" in selected
    assert ".env" in selected
    assert "README.md" in selected
    assert ".github/workflows/ci.yml" in selected

    assert "node_modules/pkg/index.js" not in selected
    assert "vendor/lib/core.rs" not in selected
    assert "dist/bundle.min.js" not in selected
    assert "assets/logo.png" not in selected


def test_select_scan_files_prioritizes_manifests():
    order = _select_scan_files(_tree())
    rels = [rel for rel, _ in order]
    # Manifests must come before regular source when under the cap.
    assert rels.index("package.json") < rels.index("src/app.py")
    assert rels.index("requirements.txt") < rels.index("src/utils.go")


def test_select_scan_files_respects_cap():
    many = [(f"src/file{i}.py", f"/repo/src/file{i}.py") for i in range(500)]
    selected = _select_scan_files(many)
    assert len(selected) == min(MAX_SCAN_FILES, len(many))
    assert len(selected) == MAX_SCAN_FILES
