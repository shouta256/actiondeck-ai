from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GoogleCalendarOAuthStartResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    authorization_url: str = Field(min_length=1)
    state: str = Field(min_length=1)
    scopes: list[str] = Field(min_length=1)


class GoogleCalendarOAuthCallbackResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connected: bool
    provider: str = Field(default="google_calendar", min_length=1)
    scopes: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None


class GoogleCalendarConnectionStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connected: bool
    provider: str = Field(default="google_calendar", min_length=1)
    scopes: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None
    updated_at: datetime | None = None


class GoogleCalendarSyncResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calendar_id: str = Field(min_length=1)
    synced_count: int = Field(ge=0)
    event_ids: list[str] = Field(default_factory=list)
