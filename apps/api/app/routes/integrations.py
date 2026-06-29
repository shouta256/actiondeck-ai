from fastapi import APIRouter, HTTPException

from app.schemas import (
    GoogleCalendarConnectionStatus,
    GoogleCalendarOAuthCallbackResponse,
    GoogleCalendarOAuthStartResponse,
    GoogleCalendarSyncResult,
)
from app.services.google_calendar_service import (
    GoogleCalendarNotConnectedError,
    GoogleCalendarOAuthExchangeError,
    GoogleCalendarOAuthNotConfiguredError,
    GoogleCalendarOAuthStateError,
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
    response_model=GoogleCalendarOAuthCallbackResponse,
)
async def complete_google_calendar_connection(
    code: str,
    state: str,
) -> GoogleCalendarOAuthCallbackResponse:
    try:
        return await complete_google_calendar_oauth(code=code, state=state)
    except GoogleCalendarOAuthNotConfiguredError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except GoogleCalendarOAuthStateError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except GoogleCalendarOAuthExchangeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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
