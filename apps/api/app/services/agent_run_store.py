import json

import asyncpg

from app.schemas import AgentRunResult
from app.settings import get_settings


_agent_runs_by_id: dict[str, AgentRunResult] = {}


CREATE_AGENT_RUNS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS agent_runs (
  run_id text PRIMARY KEY,
  inbox_item_id text NOT NULL,
  generation_mode text NOT NULL,
  llm_provider text NOT NULL,
  llm_model text NOT NULL,
  llm_configured boolean NOT NULL,
  fallback_reason text,
  action_card jsonb NOT NULL,
  agent_steps jsonb NOT NULL,
  evidence_items jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_inbox_item_created_at
  ON agent_runs (inbox_item_id, created_at DESC);
"""


async def save_agent_run(agent_run: AgentRunResult) -> AgentRunResult:
    try:
        connection = await _connect()
        try:
            await _ensure_agent_runs_table(connection)
            await connection.execute(
                """
                INSERT INTO agent_runs (
                  run_id,
                  inbox_item_id,
                  generation_mode,
                  llm_provider,
                  llm_model,
                  llm_configured,
                  fallback_reason,
                  action_card,
                  agent_steps,
                  evidence_items,
                  created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
                ON CONFLICT (run_id) DO UPDATE SET
                  inbox_item_id = EXCLUDED.inbox_item_id,
                  generation_mode = EXCLUDED.generation_mode,
                  llm_provider = EXCLUDED.llm_provider,
                  llm_model = EXCLUDED.llm_model,
                  llm_configured = EXCLUDED.llm_configured,
                  fallback_reason = EXCLUDED.fallback_reason,
                  action_card = EXCLUDED.action_card,
                  agent_steps = EXCLUDED.agent_steps,
                  evidence_items = EXCLUDED.evidence_items,
                  created_at = EXCLUDED.created_at
                """,
                agent_run.run_id,
                agent_run.inbox_item_id,
                agent_run.generation_mode.value,
                agent_run.llm_provider,
                agent_run.llm_model,
                agent_run.llm_configured,
                agent_run.fallback_reason,
                json.dumps(agent_run.action_card.model_dump(mode="json")),
                json.dumps(
                    [step.model_dump(mode="json") for step in agent_run.agent_steps]
                ),
                json.dumps(
                    [item.model_dump(mode="json") for item in agent_run.evidence_items]
                ),
                agent_run.created_at,
            )
        finally:
            await connection.close()
    except (OSError, asyncpg.PostgresError):
        _agent_runs_by_id[agent_run.run_id] = agent_run
        return agent_run

    _agent_runs_by_id[agent_run.run_id] = agent_run
    return agent_run


async def get_agent_run(run_id: str) -> AgentRunResult | None:
    try:
        connection = await _connect()
        try:
            await _ensure_agent_runs_table(connection)
            row = await connection.fetchrow(
                "SELECT * FROM agent_runs WHERE run_id = $1",
                run_id,
            )
        finally:
            await connection.close()
        if row is not None:
            return _agent_run_from_row(row)
    except (OSError, asyncpg.PostgresError):
        pass

    return _agent_runs_by_id.get(run_id)


async def list_agent_runs(
    inbox_item_id: str | None = None,
) -> tuple[AgentRunResult, ...]:
    try:
        connection = await _connect()
        try:
            await _ensure_agent_runs_table(connection)
            if inbox_item_id is None:
                rows = await connection.fetch(
                    "SELECT * FROM agent_runs ORDER BY created_at DESC"
                )
            else:
                rows = await connection.fetch(
                    """
                    SELECT * FROM agent_runs
                    WHERE inbox_item_id = $1
                    ORDER BY created_at DESC
                    """,
                    inbox_item_id,
                )
        finally:
            await connection.close()
        return tuple(_agent_run_from_row(row) for row in rows)
    except (OSError, asyncpg.PostgresError):
        agent_runs = _agent_runs_by_id.values()
        if inbox_item_id is not None:
            agent_runs = (
                agent_run
                for agent_run in agent_runs
                if agent_run.inbox_item_id == inbox_item_id
            )
        return tuple(sorted(agent_runs, key=lambda run: run.created_at, reverse=True))


async def _connect() -> asyncpg.Connection:
    settings = get_settings()
    return await asyncpg.connect(settings.asyncpg_database_url)


async def _ensure_agent_runs_table(connection: asyncpg.Connection) -> None:
    await connection.execute(CREATE_AGENT_RUNS_TABLE_SQL)


def _agent_run_from_row(row: asyncpg.Record) -> AgentRunResult:
    return AgentRunResult.model_validate(
        {
            "run_id": row["run_id"],
            "inbox_item_id": row["inbox_item_id"],
            "generation_mode": row["generation_mode"],
            "llm_provider": row["llm_provider"],
            "llm_model": row["llm_model"],
            "llm_configured": row["llm_configured"],
            "fallback_reason": row["fallback_reason"],
            "action_card": _json_value(row["action_card"]),
            "agent_steps": _json_value(row["agent_steps"]),
            "evidence_items": _json_value(row["evidence_items"]),
            "created_at": row["created_at"],
        }
    )


def _json_value(value: object) -> object:
    if isinstance(value, str):
        return json.loads(value)
    return value
