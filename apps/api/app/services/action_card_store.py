import json
from functools import lru_cache
from pathlib import Path

from app.schemas import ActionCard, ActionCardStatus


SEED_ACTION_CARDS_PATH = (
    Path(__file__).resolve().parents[4] / "data" / "seed" / "action_cards.json"
)


@lru_cache(maxsize=1)
def _load_action_cards() -> dict[str, ActionCard]:
    raw_cards = json.loads(SEED_ACTION_CARDS_PATH.read_text(encoding="utf-8"))
    cards = tuple(ActionCard.model_validate(raw_card) for raw_card in raw_cards)
    return {card.id: card for card in cards}


def list_action_cards() -> tuple[ActionCard, ...]:
    return tuple(_load_action_cards().values())


def get_action_card(action_card_id: str) -> ActionCard | None:
    return _load_action_cards().get(action_card_id)


def update_action_card_status(
    action_card_id: str,
    status: ActionCardStatus,
) -> ActionCard | None:
    action_cards = _load_action_cards()
    action_card = action_cards.get(action_card_id)
    if action_card is None:
        return None

    updated_action_card = action_card.model_copy(update={"status": status})
    action_cards[action_card_id] = updated_action_card
    return updated_action_card
