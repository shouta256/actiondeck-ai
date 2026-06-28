from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CalendarEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    calendar_id: str = Field(default="primary", min_length=1)
    title: str = Field(min_length=1)
    start: datetime
    end: datetime
    location: str | None = None
    source: str = Field(default="local_seed", min_length=1)

    @model_validator(mode="after")
    def validate_time_range(self) -> "CalendarEvent":
        if self.end <= self.start:
            raise ValueError("calendar_event.end must be later than start")
        return self
