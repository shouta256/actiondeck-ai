from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class EvidenceSourceType(StrEnum):
    PERSONAL_NOTE = "personal_note"
    CALENDAR_MOCK = "calendar_mock"
    DOCUMENT = "document"
    PAST_EMAIL = "past_email"
    INBOX_ITEM = "inbox_item"


class EvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    source_type: EvidenceSourceType
    source_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    snippet: str = Field(min_length=1)
    relevance_score: float = Field(ge=0, le=1)
    used_for: str = Field(min_length=1)
    chunk_id: str = Field(min_length=1)
