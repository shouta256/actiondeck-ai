import json
from functools import lru_cache
from pathlib import Path

from app.schemas import ActionCard


SEED_ACTION_CARDS_PATH = (
    Path(__file__).resolve().parents[4] / "data" / "seed" / "action_cards.json"
)


@lru_cache(maxsize=1)
def list_action_cards() -> tuple[ActionCard, ...]:
    raw_cards = json.loads(SEED_ACTION_CARDS_PATH.read_text(encoding="utf-8"))
    return tuple(ActionCard.model_validate(raw_card) for raw_card in raw_cards)


def get_action_card(action_card_id: str) -> ActionCard | None:
    return next(
        (card for card in list_action_cards() if card.id == action_card_id),
        None,
    )
