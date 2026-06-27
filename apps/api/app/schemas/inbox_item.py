from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class InboxChannel(StrEnum):
    EMAIL = "email"
    LINE = "line"
    SLACK = "slack"


class InboxItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    channel: InboxChannel
    sender_name: str = Field(min_length=1)
    sender_address: str | None = None
    subject: str = Field(min_length=1)
    received_at: datetime
    body: str = Field(min_length=1)
