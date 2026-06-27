import json
from functools import lru_cache
from pathlib import Path

from app.schemas import InboxItem


SEED_INBOX_ITEMS_PATH = (
    Path(__file__).resolve().parents[4] / "data" / "seed" / "inbox_items.json"
)


@lru_cache(maxsize=1)
def list_inbox_items() -> tuple[InboxItem, ...]:
    raw_items = json.loads(SEED_INBOX_ITEMS_PATH.read_text(encoding="utf-8"))
    return tuple(InboxItem.model_validate(raw_item) for raw_item in raw_items)


def get_inbox_item(inbox_item_id: str) -> InboxItem | None:
    return next(
        (item for item in list_inbox_items() if item.id == inbox_item_id),
        None,
    )
