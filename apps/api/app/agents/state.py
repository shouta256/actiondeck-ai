from dataclasses import dataclass, field
from enum import StrEnum

from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    EvidenceItem,
    InboxItem,
)
from app.settings import Settings


class AgentRoute(StrEnum):
    CONFLICTING_EVIDENCE = "conflicting_evidence"
    IGNORE = "ignore"
    LOW_RISK_TODO = "low_risk_todo"
    MISSING_INFO = "missing_info"
    REVIEW_REQUIRED = "review_required"


@dataclass
class AgentState:
    inbox_item: InboxItem
    template_action_card: ActionCard
    all_evidence_items: tuple[EvidenceItem, ...]
    settings: Settings
    triage_signals: dict[str, bool] = field(default_factory=dict)
    route: AgentRoute | None = None
    retrieved_evidence_items: tuple[EvidenceItem, ...] = ()
    action_card: ActionCard | None = None
    generation_mode: AgentRunGenerationMode = (
        AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    )
    fallback_reason: str | None = None
