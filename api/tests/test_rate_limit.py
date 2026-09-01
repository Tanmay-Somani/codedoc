def test_rate_state_tracks_counts(rate_state):
    rate_state.record("osv", ok=True, latency_ms=12.0, cache_hit=True)
    rate_state.record("osv", ok=True, latency_ms=5.0, cache_hit=True)
    rate_state.record("osv", ok=False, latency_ms=50.0, cache_hit=False)

    snap = rate_state.snapshot()["osv"]
    assert snap["requests"] == 3
    assert snap["errors"] == 1
    assert snap["cache_hits"] == 2
    assert snap["cache_misses"] == 1
    assert snap["latency_sum_ms"] == 67.0
    assert snap["last_request"] is not None


def test_rate_state_tracks_rate_headers(rate_state):
    rate_state.record("github", ok=True, latency_ms=1.0, rate_remaining=4813, rate_reset_at="2026-09-01T00:00:00Z")
    snap = rate_state.snapshot()["github"]
    assert snap["rate_remaining"] == 4813
    assert snap["rate_reset_at"] == "2026-09-01T00:00:00Z"


def test_rate_state_snapshot_isolated(rate_state):
    rate_state.record("osv", ok=True, latency_ms=1.0)
    snap = rate_state.snapshot()
    snap["osv"]["requests"] = 999
    assert rate_state.snapshot()["osv"]["requests"] == 1