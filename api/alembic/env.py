import os
import sys
from logging.config import fileConfig

from alembic import context

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import models so autogenerate sees their tables.
import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

sync_url = os.getenv("DATABASE_URL_SYNC", "postgresql://codedoc:codedoc@postgres:5432/codedoc")


def run_migrations_offline() -> None:
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy.ext.asyncio import create_async_engine

    async def do_run() -> None:
        connectable = create_async_engine(sync_url.replace("postgresql://", "postgresql+asyncpg://"))
        async with connectable.connect() as connection:
            await connection.run_sync(_run_sync_migrations)
        await connectable.dispose()

    def _run_sync_migrations(connection) -> None:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

    import asyncio

    asyncio.run(do_run())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()