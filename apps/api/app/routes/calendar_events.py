from fastapi import APIRouter, Query

from app.schemas import CalendarEvent
from app.services.calendar_event_store import list_upcoming_calendar_events

router = APIRouter(prefix="/calendar-events", tags=["calendar-events"])


@router.get("/upcoming", response_model=list[CalendarEvent])
def read_upcoming_calendar_events(
    limit: int = Query(default=10, ge=1, le=20),
) -> tuple[CalendarEvent, ...]:
    return list_upcoming_calendar_events(limit=limit)
