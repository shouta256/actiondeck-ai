import type { ActionPlan } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_ACTIONDECK_API_BASE_URL ??
    process.env.ACTIONDECK_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export async function getActionPlan(limit = 5): Promise<ActionPlan> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`${getApiBaseUrl()}/action-plan?${searchParams}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch action plan: ${response.status}`);
  }

  return response.json();
}

export async function runActionPlan(limit = 5): Promise<ActionPlan> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(
    `${getApiBaseUrl()}/action-plan/runs?${searchParams}`,
    {
      method: "POST",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to run action plan: ${response.status}`);
  }

  return response.json();
}
