import type { EvidenceItem } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return process.env.ACTIONDECK_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export async function listActionCardEvidence(
  actionCardId: string,
): Promise<EvidenceItem[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/action-cards/${actionCardId}/evidence`,
    {
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch evidence: ${response.status}`);
  }

  return response.json();
}
