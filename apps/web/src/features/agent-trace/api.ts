import type { AgentTraceStep } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return process.env.ACTIONDECK_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export async function listActionCardAgentSteps(
  actionCardId: string,
): Promise<AgentTraceStep[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/action-cards/${actionCardId}/agent-steps`,
    {
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch agent steps: ${response.status}`);
  }

  return response.json();
}
