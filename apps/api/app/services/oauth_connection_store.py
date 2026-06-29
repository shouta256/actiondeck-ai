import json
from dataclasses import dataclass
from datetime import datetime

import asyncpg

from app.settings import get_settings


@dataclass(frozen=True)
class OAuthConnection:
    provider: str
    token_json: dict
    scopes: list[str]
    expires_at: datetime | None
    connected_at: datetime
    updated_at: datetime


async def create_oauth_state(
    *,
    provider: str,
    state: str,
    code_verifier: str | None,
) -> None:
    connection = await _connect()
    try:
        await ensure_oauth_tables(connection)
        await connection.execute(
            """
            INSERT INTO oauth_states (
              state,
              provider,
              code_verifier,
              created_at,
              consumed_at
            )
            VALUES ($1, $2, $3, now(), NULL)
            ON CONFLICT (state) DO NOTHING
            """,
            state,
            provider,
            code_verifier,
        )
    finally:
        await connection.close()


async def consume_oauth_state(*, provider: str, state: str) -> str | None:
    connection = await _connect()
    try:
        await ensure_oauth_tables(connection)
        code_verifier = await connection.fetchval(
            """
            UPDATE oauth_states
            SET consumed_at = now()
            WHERE provider = $1
              AND state = $2
              AND consumed_at IS NULL
              AND created_at > now() - interval '30 minutes'
            RETURNING code_verifier
            """,
            provider,
            state,
        )
        return code_verifier
    finally:
        await connection.close()


async def save_oauth_connection(
    *,
    provider: str,
    token_json: dict,
    scopes: list[str],
    expires_at: datetime | None,
) -> OAuthConnection:
    connection = await _connect()
    try:
        await ensure_oauth_tables(connection)
        row = await connection.fetchrow(
            """
            INSERT INTO oauth_connections (
              provider,
              token_json,
              scopes,
              expires_at,
              connected_at,
              updated_at
            )
            VALUES ($1, $2::jsonb, $3::jsonb, $4, now(), now())
            ON CONFLICT (provider) DO UPDATE SET
              token_json = EXCLUDED.token_json,
              scopes = EXCLUDED.scopes,
              expires_at = EXCLUDED.expires_at,
              updated_at = now()
            RETURNING
              provider,
              token_json,
              scopes,
              expires_at,
              connected_at,
              updated_at
            """,
            provider,
            json.dumps(token_json),
            json.dumps(scopes),
            expires_at,
        )
        return _oauth_connection_from_row(row)
    finally:
        await connection.close()


async def get_oauth_connection(provider: str) -> OAuthConnection | None:
    connection = await _connect()
    try:
        await ensure_oauth_tables(connection)
        row = await connection.fetchrow(
            """
            SELECT
              provider,
              token_json,
              scopes,
              expires_at,
              connected_at,
              updated_at
            FROM oauth_connections
            WHERE provider = $1
            """,
            provider,
        )
        return _oauth_connection_from_row(row) if row else None
    finally:
        await connection.close()


async def _connect() -> asyncpg.Connection:
    return await asyncpg.connect(get_settings().asyncpg_database_url)


async def ensure_oauth_tables(connection: asyncpg.Connection) -> None:
    await connection.execute(
        """
        CREATE TABLE IF NOT EXISTS oauth_states (
          state text PRIMARY KEY,
          provider text NOT NULL,
          code_verifier text,
          created_at timestamptz NOT NULL,
          consumed_at timestamptz
        );

        ALTER TABLE oauth_states
          ADD COLUMN IF NOT EXISTS code_verifier text;

        CREATE INDEX IF NOT EXISTS idx_oauth_states_provider_created_at
          ON oauth_states (provider, created_at DESC);

        CREATE TABLE IF NOT EXISTS oauth_connections (
          provider text PRIMARY KEY,
          token_json jsonb NOT NULL,
          scopes jsonb NOT NULL,
          expires_at timestamptz,
          connected_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        );
        """
    )


def _oauth_connection_from_row(row: asyncpg.Record) -> OAuthConnection:
    token_json = row["token_json"]
    scopes = row["scopes"]
    return OAuthConnection(
        provider=row["provider"],
        token_json=(
            json.loads(token_json)
            if isinstance(token_json, str)
            else dict(token_json)
        ),
        scopes=(
            json.loads(scopes)
            if isinstance(scopes, str)
            else list(scopes)
        ),
        expires_at=row["expires_at"],
        connected_at=row["connected_at"],
        updated_at=row["updated_at"],
    )
