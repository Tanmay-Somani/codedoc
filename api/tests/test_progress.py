"""Tests for the in-memory scan progress store."""


def test_progress_store_set_get_clear():
    from app.providers.base import ScanProgressStore

    store = ScanProgressStore()
    assert store.get(42) is None

    store.set(42, {"phase": "scanning", "current": 3, "total": 10, "message": "Scanning x"})
    snap = store.get(42)
    assert snap is not None
    assert snap["phase"] == "scanning"
    assert snap["current"] == 3
    assert snap["total"] == 10

    store.clear(42)
    assert store.get(42) is None


def test_progress_store_get_isolated_copy():
    from app.providers.base import ScanProgressStore

    store = ScanProgressStore()
    store.set(1, {"phase": "cloning", "current": 0, "total": 0, "message": "Cloning…"})
    snap = store.get(1)
    assert snap is not None
    snap["phase"] = "scanned"
    assert store.get(1)["phase"] == "cloning"  # mutation does not affect stored entry
