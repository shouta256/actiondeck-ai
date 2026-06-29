import type {
  GoogleCalendarConnectionStatus,
  GoogleCalendarOAuthStartResponse,
  GoogleCalendarSyncResult,
} from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_ACTIONDECK_API_BASE_URL ??
    process.env.ACTIONDECK_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarConnectionStatus> {
  const response = await fetch(
    `${getApiBaseUrl()}/integrations/google-calendar/status`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Calendar status: ${response.status}`);
  }

  return response.json();
}

export async function startGoogleCalendarOAuth(): Promise<GoogleCalendarOAuthStartResponse> {
  const response = await fetch(
    `${getApiBaseUrl()}/integrations/google-calendar/oauth/start`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to start Google Calendar OAuth: ${response.status}`);
  }

  return response.json();
}

export async function syncGoogleCalendar(): Promise<GoogleCalendarSyncResult> {
  const response = await fetch(
    `${getApiBaseUrl()}/integrations/google-calendar/sync`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to sync Google Calendar: ${response.status}`);
  }

  return response.json();
}
