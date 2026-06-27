from datetime import UTC, datetime

from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    AgentRunResult,
    InboxItem,
)
from app.services.action_card_store import list_action_cards
from app.services.agent_trace_store import list_agent_steps_for_card
from app.services.evidence_store import list_evidence_by_ids, list_evidence_items
from app.services.gemini_client import generate_action_card_with_gemini
from app.settings import get_settings


def run_agent_for_inbox_item(inbox_item: InboxItem) -> AgentRunResult | None:
    template_action_card = _find_template_action_card(inbox_item.id)
    if template_action_card is None:
        return None

    settings = get_settings()
    created_at = datetime.now(UTC)
    gemini_result = generate_action_card_with_gemini(
        inbox_item=inbox_item,
        evidence_items=list_evidence_items(),
        settings=settings,
    )
    if gemini_result.action_card:
        action_card = gemini_result.action_card
        generation_mode = AgentRunGenerationMode.GEMINI_ASSISTED
        fallback_reason = None
    else:
        action_card = template_action_card
        generation_mode = AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
        fallback_reason = gemini_result.fallback_reason

    return AgentRunResult(
        run_id=f"run_{inbox_item.id}_{created_at.strftime('%Y%m%d%H%M%S%f')}",
        inbox_item_id=inbox_item.id,
        action_card=action_card,
        agent_steps=list(_build_agent_steps(template_action_card, action_card)),
        evidence_items=list(list_evidence_by_ids(action_card.evidence_ids)),
        llm_model=settings.gemini_model,
        llm_configured=bool(settings.gemini_api_key),
        generation_mode=generation_mode,
        fallback_reason=fallback_reason,
        created_at=created_at,
    )


def _find_template_action_card(inbox_item_id: str) -> ActionCard | None:
    return next(
        (
            card
            for card in list_action_cards()
            if card.source_item_id == inbox_item_id
        ),
        None,
    )


def _build_agent_steps(
    template_action_card: ActionCard,
    action_card: ActionCard,
):
    return tuple(
        step.model_copy(update={"action_card_id": action_card.id})
        for step in list_agent_steps_for_card(template_action_card.id)
    )
