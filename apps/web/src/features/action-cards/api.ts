import type { ActionCard } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return process.env.ACTIONDECK_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export async function listActionCards(): Promise<ActionCard[]> {
  const response = await fetch(`${getApiBaseUrl()}/action-cards`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch action cards: ${response.status}`);
  }

  return response.json();
}
