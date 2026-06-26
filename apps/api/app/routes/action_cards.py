from fastapi import APIRouter, HTTPException

from app.schemas import ActionCard, AgentTraceStep, EvidenceItem
from app.services.action_card_store import get_action_card, list_action_cards
from app.services.agent_trace_store import list_agent_steps_for_card
from app.services.evidence_store import list_evidence_by_ids

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
