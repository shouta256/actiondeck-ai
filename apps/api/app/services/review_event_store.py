from datetime import UTC, datetime

from app.schemas import ActionCardReviewStatus, ActionCardStatus, ReviewEvent


_review_events_by_card: dict[str, list[ReviewEvent]] = {}


def list_review_events_for_card(action_card_id: str) -> tuple[ReviewEvent, ...]:
    events = _review_events_by_card.get(action_card_id, [])
    return tuple(sorted(events, key=lambda event: event.created_at, reverse=True))


def append_review_event(
    action_card_id: str,
    from_status: ActionCardStatus,
    to_status: ActionCardReviewStatus,
) -> ReviewEvent:
    events = _review_events_by_card.setdefault(action_card_id, [])
    event = ReviewEvent(
        id=f"review_{action_card_id}_{len(events) + 1:03d}",
        action_card_id=action_card_id,
        from_status=from_status,
        to_status=to_status,
        created_at=datetime.now(UTC),
    )
    events.append(event)
    return event
