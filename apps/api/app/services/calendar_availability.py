import re
from dataclasses import dataclass
from datetime import datetime

from app.schemas import CalendarEvent
from app.services.calendar_event_store import list_calendar_events


@dataclass(frozen=True)
class CalendarCandidate:
    start: datetime
    end: datetime
    conflicting_events: tuple[CalendarEvent, ...] = ()

    @property
    def is_available(self) -> bool:
        return not self.conflicting_events


@dataclass(frozen=True)
class CalendarAvailabilityResult:
    candidates: tuple[CalendarCandidate, ...]
    inspected_event_count: int
    fallback_reason: str | None = None

    @property
    def has_candidates(self) -> bool:
        return bool(self.candidates)

    @property
    def has_conflict(self) -> bool:
        return any(not candidate.is_available for candidate in self.candidates)

    @property
    def available_candidates(self) -> tuple[CalendarCandidate, ...]:
        return tuple(candidate for candidate in self.candidates if candidate.is_available)


def check_calendar_availability(text: str) -> CalendarAvailabilityResult:
    candidates = _extract_candidate_slots(text)
    if not candidates:
        return CalendarAvailabilityResult(candidates=(), inspected_event_count=0)

    events = list_calendar_events()
    checked_candidates = tuple(
        CalendarCandidate(
            start=candidate.start,
            end=candidate.end,
            conflicting_events=tuple(
                event for event in events if _time_ranges_overlap(candidate, event)
            ),
        )
        for candidate in candidates
    )
    return CalendarAvailabilityResult(
        candidates=checked_candidates,
        inspected_event_count=len(events),
    )


def describe_calendar_availability(
    result: CalendarAvailabilityResult,
) -> tuple[str, ...]:
    notes: list[str] = []
    for candidate in result.candidates:
        slot = _format_slot(candidate.start, candidate.end)
        if candidate.is_available:
            notes.append(f"{slot} はカレンダー上空いています")
            continue

        conflicting_titles = "、".join(
            event.title for event in candidate.conflicting_events
        )
        conflicting_ids = ", ".join(event.id for event in candidate.conflicting_events)
        notes.append(
            f"{slot} は既存予定「{conflicting_titles}」と衝突します"
            f" ({conflicting_ids})"
        )
    return tuple(notes)


def proposal_conflicts_with_calendar(
    *,
    start: datetime,
    end: datetime,
) -> tuple[CalendarEvent, ...]:
    proposal_candidate = CalendarCandidate(start=start, end=end)
    return tuple(
        event
        for event in list_calendar_events()
        if _time_ranges_overlap(proposal_candidate, event)
    )


def _extract_candidate_slots(text: str) -> tuple[CalendarCandidate, ...]:
    candidates: list[CalendarCandidate] = []
    for match in re.finditer(
        r"(20\d{2})年(\d{1,2})月(\d{1,2})日\s+"
        r"(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})",
        text,
    ):
        year, month, day, start_hour, start_minute, end_hour, end_minute = (
            int(group) for group in match.groups()
        )
        start = datetime(year, month, day, start_hour, start_minute)
        end = datetime(year, month, day, end_hour, end_minute)
        if end > start:
            candidates.append(CalendarCandidate(start=start, end=end))
    return tuple(candidates)


def _time_ranges_overlap(
    candidate: CalendarCandidate,
    event: CalendarEvent,
) -> bool:
    return event.start < candidate.end and candidate.start < event.end


def _format_slot(start: datetime, end: datetime) -> str:
    return f"{start:%Y-%m-%d %H:%M}-{end:%H:%M}"
