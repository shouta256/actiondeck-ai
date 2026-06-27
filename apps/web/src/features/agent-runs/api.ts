import type { AgentRunResult } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_ACTIONDECK_API_BASE_URL ??
    process.env.ACTIONDECK_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export async function createAgentRun(
  inboxItemId: string,
): Promise<AgentRunResult> {
  const response = await fetch(`${getApiBaseUrl()}/agent-runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inbox_item_id: inboxItemId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to run agent: ${response.status}`);
  }

  return response.json();
}

export async function listAgentRuns(
  inboxItemId?: string,
): Promise<AgentRunResult[]> {
  const searchParams = new URLSearchParams();
  if (inboxItemId) {
    searchParams.set("inbox_item_id", inboxItemId);
  }
  const query = searchParams.toString();
  const response = await fetch(
    `${getApiBaseUrl()}/agent-runs${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch agent runs: ${response.status}`);
  }

  return response.json();
}
