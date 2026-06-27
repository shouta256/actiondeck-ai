from dataclasses import dataclass, field

from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    EvidenceItem,
    InboxItem,
)
from app.settings import Settings


@dataclass
class AgentState:
    inbox_item: InboxItem
    template_action_card: ActionCard
    all_evidence_items: tuple[EvidenceItem, ...]
    settings: Settings
    triage_signals: dict[str, bool] = field(default_factory=dict)
    retrieved_evidence_items: tuple[EvidenceItem, ...] = ()
    action_card: ActionCard | None = None
    generation_mode: AgentRunGenerationMode = (
        AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    )
    fallback_reason: str | None = None
