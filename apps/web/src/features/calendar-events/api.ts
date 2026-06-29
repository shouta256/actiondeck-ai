import type { CalendarEvent } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_ACTIONDECK_API_BASE_URL ??
    process.env.ACTIONDECK_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export async function listUpcomingCalendarEvents(
  limit = 5,
): Promise<CalendarEvent[]> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(
    `${getApiBaseUrl()}/calendar-events/upcoming?${searchParams}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch calendar events: ${response.status}`);
  }

  return response.json();
}
