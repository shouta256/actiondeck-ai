from fastapi import APIRouter, HTTPException

from app.schemas import ActionCard
from app.services.action_card_store import get_action_card, list_action_cards

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
