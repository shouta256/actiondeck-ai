"use client";

import { useEffect, useState, useTransition } from "react";

import { RunAgentButton } from "./run-agent-button";
import { listAgentRuns } from "./api";
import type { AgentRunResult } from "./types";

function formatDateTime(value: string) {
  return value.replace("T", " ");
}

export function AgentRunPanel({ inboxItemId }: { inboxItemId: string }) {
  const [agentRuns, setAgentRuns] = useState<AgentRunResult[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        setAgentRuns(await listAgentRuns(inboxItemId));
      } catch {
        setAgentRuns([]);
      }
    });
  }, [inboxItemId]);

  const latestRun = agentRuns[0] ?? null;

  return (
    <div className="space-y-4">
      <RunAgentButton
        inboxItemId={inboxItemId}
        onRunCreated={(agentRun) => {
          setAgentRuns((currentRuns) => [agentRun, ...currentRuns]);
        }}
      />

      <section className="rounded border border-neutral-200 bg-neutral-50 p-3">
        <h3 className="text-xs font-semibold text-neutral-700">Latest Agent Run</h3>
        {latestRun ? (
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-neutral-500">Run</dt>
              <dd className="break-all font-mono text-neutral-700">
                {latestRun.run_id}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Mode</dt>
              <dd className="font-mono text-neutral-700">
                {latestRun.generation_mode}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Model</dt>
              <dd className="font-mono text-neutral-700">{latestRun.llm_model}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Action Card</dt>
              <dd className="font-mono text-neutral-700">
                {latestRun.action_card.id}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Created</dt>
              <dd className="font-mono text-neutral-700">
                {formatDateTime(latestRun.created_at)}
              </dd>
            </div>
            {latestRun.fallback_reason ? (
              <div className="border-t border-neutral-200 pt-2">
                <dt className="text-neutral-500">Fallback</dt>
                <dd className="mt-1 text-neutral-700">
                  {latestRun.fallback_reason}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">
            {isPending ? "Loading" : "実行履歴はまだありません。"}
          </p>
        )}
      </section>
    </div>
  );
}
