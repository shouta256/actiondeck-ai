from fastapi.testclient import TestClient

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
