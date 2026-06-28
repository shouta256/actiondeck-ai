import asyncio

import asyncpg

from app.settings import get_settings


async def main() -> None:
    connection = await asyncpg.connect(get_settings().asyncpg_database_url)
    try:
        for table_name in ("agent_runs", "evidence_items", "calendar_events"):
            found_table = await connection.fetchval(
                f"select to_regclass('public.{table_name}')"
            )
            print(f"{table_name}: {found_table}")
            if found_table != table_name:
                raise RuntimeError(f"{table_name} table was not found")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
