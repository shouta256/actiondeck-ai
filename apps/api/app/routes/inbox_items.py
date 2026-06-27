from fastapi import APIRouter, HTTPException

from app.schemas import InboxItem
from app.services.inbox_item_store import get_inbox_item, list_inbox_items

router = APIRouter(prefix="/inbox-items", tags=["inbox-items"])


@router.get("", response_model=list[InboxItem])
def read_inbox_items() -> tuple[InboxItem, ...]:
    return list_inbox_items()


@router.get("/{inbox_item_id}", response_model=InboxItem)
def read_inbox_item(inbox_item_id: str) -> InboxItem:
    inbox_item = get_inbox_item(inbox_item_id)
    if inbox_item is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return inbox_item
