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
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str = (
        "http://127.0.0.1:8000/integrations/google-calendar/oauth/callback"
    )
    google_calendar_scopes: str = (
        "https://www.googleapis.com/auth/calendar.readonly"
    )
    google_calendar_sync_days: int = 90
    google_calendar_sync_max_results: int = 100

    @property
    def asyncpg_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def google_calendar_scope_list(self) -> list[str]:
        return [
            scope.strip()
            for scope in self.google_calendar_scopes.split(",")
            if scope.strip()
        ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
