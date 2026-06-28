from app.services.calendar_event_store import (
    list_seed_calendar_events,
    seed_calendar_events,
)


def main() -> None:
    seeded_count = seed_calendar_events(list_seed_calendar_events())
    print(f"seeded calendar_events: {seeded_count}")


if __name__ == "__main__":
    main()
