from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.action_card import ActionCardStatus, ActionKind, Priority, RiskLevel


class ActionPlanEffort(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ActionPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rank: int = Field(ge=1)
    action_card_id: str = Field(min_length=1)
    source_item_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    actions: list[ActionKind] = Field(min_length=1)
    priority: Priority
    risk_level: RiskLevel
    status: ActionCardStatus
    score: int
    estimated_minutes: int = Field(ge=1)
    effort: ActionPlanEffort
    next_action: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    blockers: list[str] = Field(default_factory=list)


class ActionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generated_at: datetime
    summary: str = Field(min_length=1)
    processed_inbox_count: int = Field(ge=0)
    action_card_count: int = Field(ge=0)
    agent_run_ids: list[str] = Field(default_factory=list)
    llm_configured: bool | None = None
    generation_modes: dict[str, int] = Field(default_factory=dict)
    items: list[ActionPlanItem] = Field(default_factory=list)
    quick_wins: list[ActionPlanItem] = Field(default_factory=list)
