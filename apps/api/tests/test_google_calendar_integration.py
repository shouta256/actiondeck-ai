from fastapi.testclient import TestClient

from app.routes import integrations
from app.services.google_calendar_service import (
    GoogleCalendarNotConnectedError,
    GoogleCalendarSyncError,
)
from main import app
from app.settings import get_settings


def test_google_calendar_oauth_start_requires_client_config(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    get_settings.cache_clear()
    client = TestClient(app)

    response = client.get("/integrations/google-calendar/oauth/start")

    assert response.status_code == 503
    assert "Google OAuth client id and secret" in response.json()["detail"]
    get_settings.cache_clear()


def test_google_calendar_sync_uses_bounded_default_settings():
    settings = get_settings()

    assert settings.google_calendar_sync_days == 90
    assert settings.google_calendar_sync_max_results == 100


def test_google_calendar_sync_requires_connection(monkeypatch):
    async def raise_not_connected(calendar_id: str):
        raise GoogleCalendarNotConnectedError("Google Calendar is not connected")

    monkeypatch.setattr(
        integrations,
        "sync_google_calendar_events",
        raise_not_connected,
    )
    client = TestClient(app)

    response = client.post("/integrations/google-calendar/sync")

    assert response.status_code == 409
    assert "not connected" in response.json()["detail"]


def test_google_calendar_sync_maps_google_api_error(monkeypatch):
    async def raise_sync_error(calendar_id: str):
        raise GoogleCalendarSyncError("Google Calendar API request failed")

    monkeypatch.setattr(
        integrations,
        "sync_google_calendar_events",
        raise_sync_error,
    )
    client = TestClient(app)

    response = client.post("/integrations/google-calendar/sync")

    assert response.status_code == 502
    assert "Google Calendar API request failed" in response.json()["detail"]
