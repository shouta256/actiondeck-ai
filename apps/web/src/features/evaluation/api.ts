import type { ActionCardEvalRunResult } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_ACTIONDECK_API_BASE_URL ??
    process.env.ACTIONDECK_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export async function getActionCardEvalResult(): Promise<ActionCardEvalRunResult> {
  const response = await fetch(`${getApiBaseUrl()}/eval/action-cards`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch action card eval: ${response.status}`);
  }

  return response.json();
}
