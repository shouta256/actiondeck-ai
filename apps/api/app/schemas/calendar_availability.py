from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.calendar_event import CalendarEvent


class CalendarAvailabilityCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: datetime
    end: datetime
    is_available: bool
    conflicting_events: list[CalendarEvent] = Field(default_factory=list)


class CalendarAvailabilityReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidates: list[CalendarAvailabilityCandidate] = Field(default_factory=list)
    inspected_event_count: int = Field(ge=0)
    fallback_reason: str | None = None
