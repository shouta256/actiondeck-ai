from dataclasses import dataclass, field

from app.schemas import (
    ActionCard,
    AgentCriticReport,
    AgentRunGenerationMode,
    EvidenceItem,
    InboxItem,
)
from app.schemas.agent_route import AgentRoute
from app.services.calendar_availability import CalendarAvailabilityResult
from app.settings import Settings


@dataclass
class AgentState:
    inbox_item: InboxItem
    template_action_card: ActionCard
    all_evidence_items: tuple[EvidenceItem, ...]
    settings: Settings
    triage_signals: dict[str, bool] = field(default_factory=dict)
    route: AgentRoute | None = None
    retrieved_evidence_items: tuple[EvidenceItem, ...] = ()
    calendar_availability: CalendarAvailabilityResult | None = None
    critic_report: AgentCriticReport | None = None
    action_card: ActionCard | None = None
    generation_mode: AgentRunGenerationMode = (
        AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    )
    fallback_reason: str | None = None
