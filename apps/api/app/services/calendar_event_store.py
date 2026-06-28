import asyncio
import json
from collections.abc import Awaitable
from functools import lru_cache
from pathlib import Path
from threading import Thread

import asyncpg

from app.schemas import CalendarEvent
from app.settings import get_settings


SEED_CALENDAR_EVENTS_PATH = (
    Path(__file__).resolve().parents[4] / "data" / "seed" / "calendar_events.json"
)


@lru_cache(maxsize=1)
def list_seed_calendar_events() -> tuple[CalendarEvent, ...]:
    raw_events = json.loads(SEED_CALENDAR_EVENTS_PATH.read_text(encoding="utf-8"))
    return tuple(CalendarEvent.model_validate(raw_event) for raw_event in raw_events)


def list_calendar_events() -> tuple[CalendarEvent, ...]:
    try:
        events = _run_blocking(_list_calendar_events())
    except (OSError, asyncpg.PostgresError, RuntimeError):
        return list_seed_calendar_events()

    return events if events else list_seed_calendar_events()


def seed_calendar_events(calendar_events: tuple[CalendarEvent, ...]) -> int:
    return _run_blocking(_seed_calendar_events(calendar_events))


async def _list_calendar_events() -> tuple[CalendarEvent, ...]:
    connection = await _connect()
    try:
        await _ensure_calendar_events_table(connection)
        rows = await connection.fetch(
            """
            SELECT
              id,
              calendar_id,
              title,
              start_at AS start,
              end_at AS end,
              location,
              source
            FROM calendar_events
            ORDER BY start_at ASC
            """
        )
        return tuple(CalendarEvent.model_validate(dict(row)) for row in rows)
    finally:
        await connection.close()


async def _seed_calendar_events(calendar_events: tuple[CalendarEvent, ...]) -> int:
    connection = await _connect()
    try:
        await _ensure_calendar_events_table(connection)
        for event in calendar_events:
            await connection.execute(
                """
                INSERT INTO calendar_events (
                  id,
                  calendar_id,
                  title,
                  start_at,
                  end_at,
                  location,
                  source
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                  calendar_id = EXCLUDED.calendar_id,
                  title = EXCLUDED.title,
                  start_at = EXCLUDED.start_at,
                  end_at = EXCLUDED.end_at,
                  location = EXCLUDED.location,
                  source = EXCLUDED.source
                """,
                event.id,
                event.calendar_id,
                event.title,
                event.start,
                event.end,
                event.location,
                event.source,
            )
        return len(calendar_events)
    finally:
        await connection.close()


async def _connect() -> asyncpg.Connection:
    return await asyncpg.connect(get_settings().asyncpg_database_url)


async def _ensure_calendar_events_table(connection: asyncpg.Connection) -> None:
    await connection.execute(
        """
        CREATE TABLE IF NOT EXISTS calendar_events (
          id text PRIMARY KEY,
          calendar_id text NOT NULL,
          title text NOT NULL,
          start_at timestamp NOT NULL,
          end_at timestamp NOT NULL,
          location text,
          source text NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range
          ON calendar_events (start_at, end_at);
        """
    )


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
