from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.action_card import ActionCardReviewStatus, ActionCardStatus


class ReviewActor(StrEnum):
    USER = "user"


class ReviewEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    action_card_id: str = Field(min_length=1)
    from_status: ActionCardStatus
    to_status: ActionCardReviewStatus
    actor: ReviewActor = ReviewActor.USER
    created_at: datetime
    note: str | None = None
    schema_version: Literal["1.0"] = "1.0"
