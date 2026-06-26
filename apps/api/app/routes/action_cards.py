from fastapi import APIRouter, HTTPException

from app.schemas import (
    ActionCard,
    ActionCardStatus,
    ActionCardStatusUpdate,
    AgentTraceStep,
    EvidenceItem,
    ReviewEvent,
)
from app.services.action_card_store import (
    get_action_card,
    list_action_cards,
    update_action_card_status,
)
from app.services.agent_trace_store import list_agent_steps_for_card
from app.services.evidence_store import list_evidence_by_ids
from app.services.review_event_store import (
    append_review_event,
    list_review_events_for_card,
)

router = APIRouter(prefix="/action-cards", tags=["action-cards"])


@router.get("", response_model=list[ActionCard])
def read_action_cards() -> tuple[ActionCard, ...]:
    return list_action_cards()


@router.get("/{action_card_id}", response_model=ActionCard)
def read_action_card(action_card_id: str) -> ActionCard:
    action_card = get_action_card(action_card_id)
    if action_card is None:
        raise HTTPException(status_code=404, detail="Action card not found")
    return action_card


@router.patch("/{action_card_id}/status", response_model=ActionCard)
def update_action_card_review_status(
    action_card_id: str,
    payload: ActionCardStatusUpdate,
) -> ActionCard:
    current_action_card = get_action_card(action_card_id)
    if current_action_card is None:
        raise HTTPException(status_code=404, detail="Action card not found")

    action_card = update_action_card_status(
        action_card_id,
        ActionCardStatus(payload.status.value),
    )
    if action_card is None:
        raise HTTPException(status_code=404, detail="Action card not found")

    append_review_event(
        action_card_id=action_card.id,
        from_status=current_action_card.status,
        to_status=payload.status,
    )
    return action_card


@router.get("/{action_card_id}/review-events", response_model=list[ReviewEvent])
def read_action_card_review_events(action_card_id: str) -> tuple[ReviewEvent, ...]:
    action_card = get_action_card(action_card_id)
    if action_card is None:
        raise HTTPException(status_code=404, detail="Action card not found")
    return list_review_events_for_card(action_card.id)


@router.get("/{action_card_id}/evidence", response_model=list[EvidenceItem])
def read_action_card_evidence(action_card_id: str) -> tuple[EvidenceItem, ...]:
    action_card = get_action_card(action_card_id)
    if action_card is None:
        raise HTTPException(status_code=404, detail="Action card not found")
    return list_evidence_by_ids(action_card.evidence_ids)


@router.get("/{action_card_id}/agent-steps", response_model=list[AgentTraceStep])
def read_action_card_agent_steps(action_card_id: str) -> tuple[AgentTraceStep, ...]:
    action_card = get_action_card(action_card_id)
    if action_card is None:
        raise HTTPException(status_code=404, detail="Action card not found")
    return list_agent_steps_for_card(action_card.id)
