import type { ReviewEvent } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_ACTIONDECK_API_BASE_URL ??
    process.env.ACTIONDECK_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export async function listActionCardReviewEvents(
  actionCardId: string,
): Promise<ReviewEvent[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/action-cards/${actionCardId}/review-events`,
    {
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch review events: ${response.status}`);
  }

  return response.json();
}
