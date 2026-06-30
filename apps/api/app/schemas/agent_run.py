from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.action_card import ActionCard
from app.schemas.agent_critic import AgentCriticReport
from app.schemas.agent_trace import AgentTraceStep
from app.schemas.calendar_availability import CalendarAvailabilityReport
from app.schemas.evidence import EvidenceItem


class AgentRunGenerationMode(StrEnum):
    DETERMINISTIC_TEMPLATE = "deterministic_template"
    GEMINI_ASSISTED = "gemini_assisted"


class AgentRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inbox_item_id: str = Field(min_length=1)


class AgentRunResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(min_length=1)
    inbox_item_id: str = Field(min_length=1)
    action_card: ActionCard
    agent_steps: list[AgentTraceStep]
    evidence_items: list[EvidenceItem]
    calendar_availability: CalendarAvailabilityReport | None = None
    critic_report: AgentCriticReport | None = None
    llm_provider: str = "gemini"
    llm_model: str = Field(min_length=1)
    llm_configured: bool
    generation_mode: AgentRunGenerationMode
    fallback_reason: str | None = None
    created_at: datetime
