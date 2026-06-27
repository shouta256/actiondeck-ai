import asyncio

import asyncpg

from app.settings import get_settings


async def main() -> None:
    connection = await asyncpg.connect(get_settings().asyncpg_database_url)
    try:
        table_name = await connection.fetchval("select to_regclass('public.agent_runs')")
        print(f"agent_runs: {table_name}")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
