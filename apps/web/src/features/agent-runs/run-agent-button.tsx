"use client";

import { LoaderCircle, Play } from "lucide-react";
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
        setErrorMessage("Agent run failed. APIを確認してください。");
      }
    });
  }

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <Button
        className="w-full rounded-md px-4 sm:w-auto"
        disabled={isPending}
        onClick={handleRunAgent}
        size="lg"
        type="button"
      >
        {isPending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            AIが確認中
          </>
        ) : (
          <>
            <Play className="size-4" />
            AIで対応案を作る
          </>
        )}
      </Button>

      {errorMessage ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}
