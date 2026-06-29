from datetime import datetime

from fastapi.testclient import TestClient

from app.routes import calendar_events
from app.schemas import CalendarEvent
from main import app


def test_read_upcoming_calendar_events(monkeypatch):
    def list_events(limit: int = 10):
        assert limit == 2
        return (
            CalendarEvent(
                id="cal_test_001",
                calendar_id="primary",
                title="面談",
                start=datetime(2026, 7, 5, 10, 0),
                end=datetime(2026, 7, 5, 10, 30),
                location="オンライン",
                source="google_calendar",
            ),
        )

    monkeypatch.setattr(
        calendar_events,
        "list_upcoming_calendar_events",
        list_events,
    )
    client = TestClient(app)

    response = client.get("/calendar-events/upcoming?limit=2")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "cal_test_001",
            "calendar_id": "primary",
            "title": "面談",
            "start": "2026-07-05T10:00:00",
            "end": "2026-07-05T10:30:00",
            "location": "オンライン",
            "source": "google_calendar",
        }
    ]
