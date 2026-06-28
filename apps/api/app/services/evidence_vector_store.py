import asyncio
from collections.abc import Awaitable
from dataclasses import dataclass
from threading import Thread

import asyncpg

from app.schemas import EvidenceItem
from app.services.evidence_embedding import (
    embed_evidence_text,
    evidence_text_for_embedding,
)
from app.settings import Settings, get_settings


@dataclass(frozen=True)
class EvidenceVectorSearchResult:
    evidence_items: tuple[EvidenceItem, ...]
    fallback_reason: str | None = None


def search_evidence_with_pgvector(
    *,
    query_text: str,
    limit: int,
) -> EvidenceVectorSearchResult:
    try:
        evidence_items = _run_blocking(_search_evidence_with_pgvector(query_text, limit))
    except (OSError, asyncpg.PostgresError, RuntimeError) as error:
        return EvidenceVectorSearchResult(
            evidence_items=(),
            fallback_reason=f"{type(error).__name__}: {error}",
        )

    if not evidence_items:
        return EvidenceVectorSearchResult(
            evidence_items=(),
            fallback_reason="pgvector returned no evidence items",
        )
    return EvidenceVectorSearchResult(evidence_items=evidence_items)


def seed_evidence_vectors(evidence_items: tuple[EvidenceItem, ...]) -> int:
    return _run_blocking(_seed_evidence_vectors(evidence_items))


async def _search_evidence_with_pgvector(
    query_text: str,
    limit: int,
) -> tuple[EvidenceItem, ...]:
    settings = get_settings()
    connection = await _connect()
    try:
        await _ensure_evidence_items_table(connection, settings=settings)
        query_embedding = embed_evidence_text(
            query_text,
            settings=settings,
            task_type="RETRIEVAL_QUERY",
        )
        rows = await connection.fetch(
            """
            SELECT
              id,
              source_type,
              source_id,
              title,
              snippet,
              relevance_score,
              used_for,
              chunk_id
            FROM evidence_items
            ORDER BY embedding <=> $1::vector
            LIMIT $2
            """,
            _format_vector(query_embedding),
            limit,
        )
        return tuple(_evidence_item_from_row(row) for row in rows)
    finally:
        await connection.close()


async def _seed_evidence_vectors(evidence_items: tuple[EvidenceItem, ...]) -> int:
    settings = get_settings()
    connection = await _connect()
    try:
        await _ensure_evidence_items_table(
            connection,
            settings=settings,
            recreate_on_dimension_mismatch=True,
        )
        for item in evidence_items:
            embedding = embed_evidence_text(
                evidence_text_for_embedding(
                    title=item.title,
                    snippet=item.snippet,
                    used_for=item.used_for,
                ),
                settings=settings,
                task_type="RETRIEVAL_DOCUMENT",
            )
            await connection.execute(
                """
                INSERT INTO evidence_items (
                  id,
                  source_type,
                  source_id,
                  title,
                  snippet,
                  relevance_score,
                  used_for,
                  chunk_id,
                  embedding
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
                ON CONFLICT (id) DO UPDATE SET
                  source_type = EXCLUDED.source_type,
                  source_id = EXCLUDED.source_id,
                  title = EXCLUDED.title,
                  snippet = EXCLUDED.snippet,
                  relevance_score = EXCLUDED.relevance_score,
                  used_for = EXCLUDED.used_for,
                  chunk_id = EXCLUDED.chunk_id,
                  embedding = EXCLUDED.embedding
                """,
                item.id,
                item.source_type.value,
                item.source_id,
                item.title,
                item.snippet,
                item.relevance_score,
                item.used_for,
                item.chunk_id,
                _format_vector(embedding),
            )
        return len(evidence_items)
    finally:
        await connection.close()


async def _connect() -> asyncpg.Connection:
    return await asyncpg.connect(get_settings().asyncpg_database_url)


async def _ensure_evidence_items_table(
    connection: asyncpg.Connection,
    *,
    settings: Settings,
    recreate_on_dimension_mismatch: bool = False,
) -> None:
    await connection.execute(_create_evidence_items_table_sql(settings))
    if not recreate_on_dimension_mismatch:
        return

    actual_dimensions = await _get_embedding_dimensions(connection)
    if actual_dimensions in {None, settings.embedding_dimensions}:
        return

    await connection.execute("DROP TABLE IF EXISTS evidence_items")
    await connection.execute(_create_evidence_items_table_sql(settings))


async def _get_embedding_dimensions(connection: asyncpg.Connection) -> int | None:
    return await connection.fetchval(
        """
        SELECT a.atttypmod
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'evidence_items' AND a.attname = 'embedding'
        """
    )


def _create_evidence_items_table_sql(settings: Settings) -> str:
    return f"""
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS evidence_items (
      id text PRIMARY KEY,
      source_type text NOT NULL,
      source_id text NOT NULL,
      title text NOT NULL,
      snippet text NOT NULL,
      relevance_score double precision NOT NULL,
      used_for text NOT NULL,
      chunk_id text NOT NULL,
      embedding vector({settings.embedding_dimensions}) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_items_embedding
      ON evidence_items USING hnsw (embedding vector_cosine_ops);
    """


def _evidence_item_from_row(row: asyncpg.Record) -> EvidenceItem:
    return EvidenceItem.model_validate(dict(row))


def _format_vector(vector: tuple[float, ...]) -> str:
    return f"[{','.join(str(value) for value in vector)}]"


def _run_blocking(awaitable: Awaitable[object]):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(awaitable)

    result: list[object] = []
    error: list[BaseException] = []

    def run_in_thread() -> None:
        try:
            result.append(asyncio.run(awaitable))
        except BaseException as raised_error:
            error.append(raised_error)

    thread = Thread(target=run_in_thread)
    thread.start()
    thread.join()

    if error:
        raise error[0]
    return result[0]
