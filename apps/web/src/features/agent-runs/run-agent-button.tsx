"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { createAgentRun } from "./api";
import type { AgentRunResult } from "./types";

export function RunAgentButton({ inboxItemId }: { inboxItemId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRunAgent() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const nextResult = await createAgentRun(inboxItemId);
        setResult(nextResult);
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

      {result ? (
        <div className="space-y-1">
          <p className="font-mono text-xs text-neutral-500">
            {result.run_id} / {result.generation_mode}
          </p>
          {result.fallback_reason ? (
            <p className="text-xs text-neutral-500">{result.fallback_reason}</p>
          ) : null}
        </div>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}
