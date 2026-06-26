from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ActionKind(StrEnum):
    DRAFT_REPLY = "draft_reply"
    PROPOSE_SCHEDULE = "propose_schedule"
    CREATE_TODO = "create_todo"
    SAVE_FOR_LATER = "save_for_later"
    IGNORE = "ignore"
    REQUEST_MISSING_INFO = "request_missing_info"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ActionCardStatus(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"
    COMPLETED = "completed"


class TodoProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    due_date: date | None = None


class CalendarEventProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    start: datetime
    end: datetime
    location: str | None = None

    @model_validator(mode="after")
    def validate_time_range(self) -> "CalendarEventProposal":
        if self.end <= self.start:
            raise ValueError("calendar_event.end must be later than start")
        return self


class ActionProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply_draft: str | None = None
    calendar_event: CalendarEventProposal | None = None
    todos: list[TodoProposal] = Field(default_factory=list)


class ActionCard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"] = "1.0"
    id: str = Field(min_length=1)
    source_item_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    actions: list[ActionKind] = Field(min_length=1)
    priority: Priority
    risk_level: RiskLevel
    confidence: float = Field(ge=0, le=1)
    approval_required: bool
    status: ActionCardStatus
    summary: str = Field(min_length=1)
    proposal: ActionProposal = Field(default_factory=ActionProposal)
    evidence_ids: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    safety_notes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_action_card_consistency(self) -> "ActionCard":
        action_set = set(self.actions)
        if len(action_set) != len(self.actions):
            raise ValueError("actions must not contain duplicates")

        if ActionKind.IGNORE in action_set and len(action_set) > 1:
            raise ValueError("ignore must not be combined with other actions")

        if ActionKind.DRAFT_REPLY in action_set and not self.proposal.reply_draft:
            raise ValueError("draft_reply requires proposal.reply_draft")

        if (
            ActionKind.PROPOSE_SCHEDULE in action_set
            and self.proposal.calendar_event is None
        ):
            raise ValueError("propose_schedule requires proposal.calendar_event")

        if ActionKind.CREATE_TODO in action_set and not self.proposal.todos:
            raise ValueError("create_todo requires proposal.todos")

        if ActionKind.REQUEST_MISSING_INFO in action_set and not self.missing_info:
            raise ValueError("request_missing_info requires missing_info")

        if self._requires_approval(action_set) and not self.approval_required:
            raise ValueError("approval_required must be true for reviewable actions")

        return self

    def _requires_approval(self, action_set: set[ActionKind]) -> bool:
        approval_actions = {
            ActionKind.DRAFT_REPLY,
            ActionKind.PROPOSE_SCHEDULE,
        }
        return bool(action_set & approval_actions) or self.risk_level == RiskLevel.HIGH
