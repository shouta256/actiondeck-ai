"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { createAgentRun } from "./api";
import type { AgentRunResult } from "./types";

export function RunAgentButton({
  inboxItemId,
  onRunCreated,
}: {
  inboxItemId: string;
  onRunCreated?: (agentRun: AgentRunResult) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRunAgent() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const nextResult = await createAgentRun(inboxItemId);
        onRunCreated?.(nextResult);
      } catch {
        setErrorMessage("Agent run failed.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        className="rounded-md"
        disabled={isPending}
        onClick={handleRunAgent}
        type="button"
        variant="outline"
      >
        {isPending ? "Running" : "Run agent"}
      </Button>

      {errorMessage ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}
