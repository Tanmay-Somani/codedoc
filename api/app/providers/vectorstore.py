"""Vector stores: Qdrant (default) and PgVector (fallback), same interface."""

from __future__ import annotations

from typing import Any

from qdrant_client import AsyncQdrantClient

from app.config import Settings

COLLECTIONS = [
    "repository_code",
    "documentation",
    "github_issues",
    "commit_history",
    "security_knowledge",
    "external_knowledge",
]


class QdrantStore:
    name = "qdrant"

    def __init__(self, settings: Settings) -> None:
        self._client = AsyncQdrantClient(
            url=f"http://{settings.qdrant_host}:{settings.qdrant_port}"
        )
        self._dim = 384  # all-MiniLM-L6-v2 default

    async def upsert(
        self, collection: str, points: list[tuple[str, list[float], dict[str, Any]]]
    ) -> None:
        from qdrant_client.models import PointStruct

        if not await self._collection_exists(collection):
            await self._create(collection)
        await self._client.upsert(
            collection_name=collection,
            points=[
                PointStruct(id=pid, vector=vector, payload=payload)
                for pid, vector, payload in points
            ],
        )

    async def search(
        self, collection: str, vector: list[float], *, limit: int = 10
    ) -> list[dict[str, Any]]:
        if not await self._collection_exists(collection):
            return []
        hits = await self._client.search(  # type: ignore[attr-defined]
            collection_name=collection, query_vector=vector, limit=limit
        )
        return [{"id": h.id, "score": h.score, "payload": h.payload} for h in hits]

    async def _collection_exists(self, collection: str) -> bool:
        try:
            await self._client.get_collection(collection)
            return True
        except Exception:
            return False

    async def _create(self, collection: str) -> None:
        from qdrant_client.models import Distance, VectorParams

        await self._client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
        )


class PgVectorStore:
    """pgvector alternative behind the same interface (still to implement)."""

    name = "pgvector"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def upsert(
        self, collection: str, points: list[tuple[str, list[float], dict[str, Any]]]
    ) -> None:
        raise NotImplementedError("PgVectorStore lands with the pgvector migration")

    async def search(
        self, collection: str, vector: list[float], *, limit: int = 10
    ) -> list[dict[str, Any]]:
        raise NotImplementedError("PgVectorStore lands with the pgvector migration")


def build_vector_store(settings: Settings) -> QdrantStore | PgVectorStore:
    return QdrantStore(settings)
