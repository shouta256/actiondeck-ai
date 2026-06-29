from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.schemas import (
    GoogleCalendarConnectionStatus,
    GoogleCalendarOAuthStartResponse,
    GoogleCalendarSyncResult,
)
from app.settings import get_settings
from app.services.google_calendar_service import (
    GoogleCalendarNotConnectedError,
    GoogleCalendarOAuthExchangeError,
    GoogleCalendarOAuthNotConfiguredError,
    GoogleCalendarOAuthStateError,
    GoogleCalendarSyncError,
    complete_google_calendar_oauth,
    get_google_calendar_connection_status,
    start_google_calendar_oauth,
    sync_google_calendar_events,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get(
    "/google-calendar/oauth/start",
    response_model=GoogleCalendarOAuthStartResponse,
)
async def start_google_calendar_connection() -> GoogleCalendarOAuthStartResponse:
    try:
        return await start_google_calendar_oauth()
    except GoogleCalendarOAuthNotConfiguredError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get(
    "/google-calendar/oauth/callback",
)
async def complete_google_calendar_connection(
    code: str,
    state: str,
) -> RedirectResponse:
    try:
        await complete_google_calendar_oauth(code=code, state=state)
    except GoogleCalendarOAuthNotConfiguredError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except GoogleCalendarOAuthStateError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except GoogleCalendarOAuthExchangeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    web_base_url = get_settings().actiondeck_web_base_url.rstrip("/")
    query = urlencode({"google_calendar": "connected"})
    return RedirectResponse(
        url=f"{web_base_url}/?{query}",
        status_code=303,
    )


@router.get(
    "/google-calendar/status",
    response_model=GoogleCalendarConnectionStatus,
)
async def read_google_calendar_connection_status() -> GoogleCalendarConnectionStatus:
    return await get_google_calendar_connection_status()


@router.post(
    "/google-calendar/sync",
    response_model=GoogleCalendarSyncResult,
)
async def sync_google_calendar_connection(
    calendar_id: str = "primary",
) -> GoogleCalendarSyncResult:
    try:
        return await sync_google_calendar_events(calendar_id=calendar_id)
    except GoogleCalendarOAuthNotConfiguredError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except GoogleCalendarNotConnectedError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except GoogleCalendarSyncError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
