from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+asyncpg://actiondeck:actiondeck@localhost:5432/actiondeck_ai"
    )
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-flash-lite"
    embedding_provider: str = "local"
    gemini_embedding_model: str = "gemini-embedding-2"
    embedding_dimensions: int = 768

    @property
    def asyncpg_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
