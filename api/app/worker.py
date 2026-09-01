"""Worker entrypoint (Dramatiq over Valkey).

Long-running analysis jobs run here, never in the API process. For LITE the
worker runs inside the `worker` compose profile.
"""

import dramatiq


@dramatiq.actor
def run_analysis(analysis_id: int) -> None:
    """Placeholder pipeline: clone → parse → analyze → persist.

    Full engine lands in Phase 4 (see tasks.md).
    """
    from app.core.logging import get_logger

    get_logger(__name__).info("analysis_job_received", analysis_id=analysis_id)


def main() -> None:
    dramatiq.set_broker(
        dramatiq.brokers.redis.RedisBroker(url="redis://valkey:6379/0")
    )
    dramatiq.cli.main()  # type: ignore[attr-defined]


if __name__ == "__main__":
    main()