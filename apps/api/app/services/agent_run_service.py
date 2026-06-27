from datetime import UTC, datetime

from app.schemas import (
    AgentRunGenerationMode,
    AgentRunResult,
    InboxItem,
)
from app.services.action_card_store import list_action_cards
from app.services.agent_trace_store import list_agent_steps_for_card
from app.services.evidence_store import list_evidence_by_ids
from app.settings import get_settings


def run_agent_for_inbox_item(inbox_item: InboxItem) -> AgentRunResult | None:
    action_card = next(
        (
            card
            for card in list_action_cards()
            if card.source_item_id == inbox_item.id
        ),
        None,
    )
    if action_card is None:
        return None

    settings = get_settings()
    created_at = datetime.now(UTC)

    return AgentRunResult(
        run_id=f"run_{inbox_item.id}_{created_at.strftime('%Y%m%d%H%M%S%f')}",
        inbox_item_id=inbox_item.id,
        action_card=action_card,
        agent_steps=list(list_agent_steps_for_card(action_card.id)),
        evidence_items=list(list_evidence_by_ids(action_card.evidence_ids)),
        llm_model=settings.gemini_model,
        llm_configured=bool(settings.gemini_api_key),
        generation_mode=AgentRunGenerationMode.DETERMINISTIC_TEMPLATE,
        created_at=created_at,
    )
