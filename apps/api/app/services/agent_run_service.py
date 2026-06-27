from datetime import UTC, datetime

from app.schemas import (
    ActionCard,
    AgentRunResult,
    InboxItem,
)
from app.agents import run_agent_workflow
from app.services.action_card_store import list_action_cards
from app.services.evidence_store import list_evidence_items
from app.settings import get_settings


def run_agent_for_inbox_item(inbox_item: InboxItem) -> AgentRunResult | None:
    template_action_card = _find_template_action_card(inbox_item.id)
    if template_action_card is None:
        return None

    settings = get_settings()
    created_at = datetime.now(UTC)
    workflow_result = run_agent_workflow(
        inbox_item=inbox_item,
        template_action_card=template_action_card,
        evidence_items=list_evidence_items(),
        settings=settings,
    )

    return AgentRunResult(
        run_id=f"run_{inbox_item.id}_{created_at.strftime('%Y%m%d%H%M%S%f')}",
        inbox_item_id=inbox_item.id,
        action_card=workflow_result.action_card,
        agent_steps=workflow_result.agent_steps,
        evidence_items=workflow_result.evidence_items,
        llm_model=settings.gemini_model,
        llm_configured=bool(settings.gemini_api_key),
        generation_mode=workflow_result.generation_mode,
        fallback_reason=workflow_result.fallback_reason,
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
