import json
import os
from datetime import UTC, date, datetime, time
from secrets import token_urlsafe

from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from oauthlib.oauth2 import OAuth2Error

from app.schemas import (
    CalendarEvent,
    GoogleCalendarConnectionStatus,
    GoogleCalendarOAuthCallbackResponse,
    GoogleCalendarOAuthStartResponse,
    GoogleCalendarSyncResult,
)
from app.services.calendar_event_store import upsert_calendar_events
from app.services.oauth_connection_store import (
    consume_oauth_state,
    create_oauth_state,
    get_oauth_connection,
    save_oauth_connection,
)
from app.settings import Settings, get_settings


GOOGLE_CALENDAR_PROVIDER = "google_calendar"
GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


class GoogleCalendarOAuthNotConfiguredError(RuntimeError):
    pass


class GoogleCalendarOAuthStateError(RuntimeError):
    pass


class GoogleCalendarOAuthExchangeError(RuntimeError):
    pass


class GoogleCalendarNotConnectedError(RuntimeError):
    pass


async def start_google_calendar_oauth() -> GoogleCalendarOAuthStartResponse:
    settings = get_settings()
    _ensure_google_oauth_configured(settings)
    _allow_localhost_insecure_transport(settings)

    state = token_urlsafe(32)
    flow = _build_google_oauth_flow(settings)
    authorization_url, returned_state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    await create_oauth_state(
        provider=GOOGLE_CALENDAR_PROVIDER,
        state=state,
        code_verifier=flow.code_verifier,
    )
    return GoogleCalendarOAuthStartResponse(
        authorization_url=authorization_url,
        state=returned_state,
        scopes=settings.google_calendar_scope_list,
    )


async def complete_google_calendar_oauth(
    *,
    code: str,
    state: str,
) -> GoogleCalendarOAuthCallbackResponse:
    settings = get_settings()
    _ensure_google_oauth_configured(settings)
    _allow_localhost_insecure_transport(settings)

    code_verifier = await consume_oauth_state(
        provider=GOOGLE_CALENDAR_PROVIDER,
        state=state,
    )
    if code_verifier is None:
        raise GoogleCalendarOAuthStateError("OAuth state is invalid or expired")

    flow = _build_google_oauth_flow(settings, code_verifier=code_verifier)
    try:
        flow.fetch_token(code=code)
    except (GoogleAuthError, OAuth2Error, ValueError) as error:
        raise GoogleCalendarOAuthExchangeError(
            f"Google OAuth token exchange failed: {error}"
        ) from error
    credentials = flow.credentials
    connection = await save_oauth_connection(
        provider=GOOGLE_CALENDAR_PROVIDER,
        token_json=_credentials_to_token_json(credentials),
        scopes=list(credentials.scopes or settings.google_calendar_scope_list),
        expires_at=_normalize_expiry(credentials.expiry),
    )
    return GoogleCalendarOAuthCallbackResponse(
        connected=True,
        scopes=connection.scopes,
        expires_at=connection.expires_at,
    )


async def get_google_calendar_connection_status() -> GoogleCalendarConnectionStatus:
    connection = await get_oauth_connection(GOOGLE_CALENDAR_PROVIDER)
    if connection is None:
        return GoogleCalendarConnectionStatus(connected=False)

    return GoogleCalendarConnectionStatus(
        connected=True,
        scopes=connection.scopes,
        expires_at=connection.expires_at,
        updated_at=connection.updated_at,
    )


async def sync_google_calendar_events(
    *,
    calendar_id: str = "primary",
    max_results: int = 100,
) -> GoogleCalendarSyncResult:
    settings = get_settings()
    _ensure_google_oauth_configured(settings)

    connection = await get_oauth_connection(GOOGLE_CALENDAR_PROVIDER)
    if connection is None:
        raise GoogleCalendarNotConnectedError("Google Calendar is not connected")

    credentials = Credentials.from_authorized_user_info(
        connection.token_json,
        scopes=connection.scopes,
    )
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        await save_oauth_connection(
            provider=GOOGLE_CALENDAR_PROVIDER,
            token_json=_credentials_to_token_json(credentials),
            scopes=list(credentials.scopes or connection.scopes),
            expires_at=_normalize_expiry(credentials.expiry),
        )

    service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
    events_result = (
        service.events()
        .list(
            calendarId=calendar_id,
            maxResults=max_results,
            orderBy="startTime",
            singleEvents=True,
            timeMin=datetime.now(UTC).isoformat(),
        )
        .execute()
    )
    calendar_events = tuple(
        _calendar_event_from_google_event(calendar_id, event)
        for event in events_result.get("items", [])
        if _has_supported_time_range(event)
    )
    synced_count = await upsert_calendar_events(calendar_events)
    return GoogleCalendarSyncResult(
        calendar_id=calendar_id,
        synced_count=synced_count,
        event_ids=[event.id for event in calendar_events],
    )


def _ensure_google_oauth_configured(settings: Settings) -> None:
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise GoogleCalendarOAuthNotConfiguredError(
            "Google OAuth client id and secret are not configured"
        )


def _allow_localhost_insecure_transport(settings: Settings) -> None:
    redirect_uri = settings.google_oauth_redirect_uri
    if redirect_uri.startswith(("http://127.0.0.1", "http://localhost")):
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _build_google_oauth_flow(
    settings: Settings,
    *,
    code_verifier: str | None = None,
) -> Flow:
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "auth_uri": GOOGLE_AUTH_URI,
                "token_uri": GOOGLE_TOKEN_URI,
                "redirect_uris": [settings.google_oauth_redirect_uri],
            }
        },
        scopes=settings.google_calendar_scope_list,
        code_verifier=code_verifier,
    )
    flow.redirect_uri = settings.google_oauth_redirect_uri
    return flow


def _credentials_to_token_json(credentials: Credentials) -> dict:
    return json.loads(credentials.to_json())


def _normalize_expiry(expiry: datetime | None) -> datetime | None:
    if expiry is None:
        return None
    if expiry.tzinfo is None:
        return expiry.replace(tzinfo=UTC)
    return expiry


def _calendar_event_from_google_event(
    calendar_id: str,
    event: dict,
) -> CalendarEvent:
    start = _parse_google_calendar_time(event["start"])
    end = _parse_google_calendar_time(event["end"])
    return CalendarEvent(
        id=f"google_{calendar_id}_{event['id']}",
        calendar_id=calendar_id,
        title=event.get("summary") or "(no title)",
        start=start,
        end=end,
        location=event.get("location"),
        source="google_calendar",
    )


def _has_supported_time_range(event: dict) -> bool:
    return "start" in event and "end" in event and (
        "dateTime" in event["start"] or "date" in event["start"]
    )


def _parse_google_calendar_time(value: dict) -> datetime:
    if "dateTime" in value:
        raw_value = value["dateTime"].replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw_value)
        return parsed.replace(tzinfo=None)

    parsed_date = date.fromisoformat(value["date"])
    return datetime.combine(parsed_date, time.min)
