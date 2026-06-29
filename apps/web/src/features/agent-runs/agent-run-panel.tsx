"use client";

import { useEffect, useState, useTransition } from "react";

import { RunAgentButton } from "./run-agent-button";
import { listAgentRuns } from "./api";
import type { AgentRunResult, CalendarAvailabilityReport } from "./types";
import type { ActionCard } from "@/features/action-cards/types";
import type { AgentTraceStep } from "@/features/agent-trace/types";
import type { EvidenceItem } from "@/features/evidence/types";

function formatDateTime(value: string) {
  return value.replace("T", " ");
}

function formatLocalTimeRange(startValue: string, endValue: string) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const date = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${time.format(start)}-${time.format(end)}`;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-neutral-800">
        {String(value)}
      </dd>
    </div>
  );
}

function ActionBadgeList({ actions }: { actions: ActionCard["actions"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <span
          className="rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-[11px] text-neutral-700"
          key={action}
        >
          {action}
        </span>
      ))}
    </div>
  );
}

function GeneratedCardSummary({ card }: { card: ActionCard }) {
  return (
    <div className="border-t border-neutral-200 pt-3">
      <h4 className="text-xs font-semibold text-neutral-700">
        Generated Action Card
      </h4>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-neutral-950">{card.title}</p>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            {card.summary}
          </p>
        </div>
        <ActionBadgeList actions={card.actions} />
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <Field label="Status" value={card.status} />
          <Field label="Risk" value={card.risk_level} />
          <Field label="Priority" value={card.priority} />
          <Field label="Confidence" value={card.confidence.toFixed(2)} />
        </dl>
      </div>
    </div>
  );
}

function RunEvidenceList({ evidenceItems }: { evidenceItems: EvidenceItem[] }) {
  return (
    <div className="border-t border-neutral-200 pt-3">
      <h4 className="text-xs font-semibold text-neutral-700">Run Evidence</h4>
      {evidenceItems.length > 0 ? (
        <ul className="mt-2 divide-y divide-neutral-200">
          {evidenceItems.map((item) => (
            <li className="py-2" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-neutral-950">
                  {item.title}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                  {item.relevance_score.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
                {item.snippet}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">
          この実行で参照した根拠はありません。
        </p>
      )}
    </div>
  );
}

function CalendarAvailabilityPanel({
  report,
}: {
  report?: CalendarAvailabilityReport | null;
}) {
  if (!report) {
    return null;
  }

  return (
    <div className="border-t border-neutral-200 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-neutral-700">
            Calendar Availability
          </h4>
          <p className="mt-1 text-xs text-neutral-500">
            {report.inspected_event_count}件の予定と候補日時を照合しました。
          </p>
        </div>
        {report.fallback_reason ? (
          <span className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-600">
            fallback
          </span>
        ) : null}
      </div>

      {report.candidates.length > 0 ? (
        <ul className="mt-2 divide-y divide-neutral-200">
          {report.candidates.map((candidate) => {
            const status = candidate.is_available ? "available" : "conflict";
            return (
              <li className="py-2" key={`${candidate.start}-${candidate.end}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-neutral-950">
                    {formatLocalTimeRange(candidate.start, candidate.end)}
                  </p>
                  <span
                    className={
                      candidate.is_available
                        ? "shrink-0 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] text-emerald-800"
                        : "shrink-0 rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-[11px] text-red-800"
                    }
                  >
                    {status}
                  </span>
                </div>
                {candidate.conflicting_events.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {candidate.conflicting_events.map((event) => (
                      <li
                        className="flex items-start justify-between gap-3 text-xs text-neutral-600"
                        key={event.id}
                      >
                        <span className="min-w-0 truncate">{event.title}</span>
                        <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                          {event.id}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">
          明示的な候補日時は検出されませんでした。
        </p>
      )}
    </div>
  );
}

function RunTraceList({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <div className="border-t border-neutral-200 pt-3">
      <h4 className="text-xs font-semibold text-neutral-700">Run Trace</h4>
      {steps.length > 0 ? (
        <ol className="mt-2 divide-y divide-neutral-200">
          {steps.map((step) => (
            <li className="py-2" key={`${step.action_card_id}-${step.sequence}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-neutral-950">
                    {step.sequence}. {step.step_name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    {step.output_summary}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                  {step.status}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">
          この実行の処理履歴はありません。
        </p>
      )}
    </div>
  );
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
    <div className="border-y border-neutral-200 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-neutral-700">
            Latest Agent Run
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            実行結果、根拠、処理履歴を確認します。
          </p>
        </div>
        <RunAgentButton
          inboxItemId={inboxItemId}
          onRunCreated={(agentRun) => {
            setAgentRuns((currentRuns) => [agentRun, ...currentRuns]);
          }}
        />
      </div>

      <div className="mt-4">
        {latestRun ? (
          <div className="space-y-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <Field label="Run" value={latestRun.run_id} />
              <Field label="Mode" value={latestRun.generation_mode} />
              <Field label="Model" value={latestRun.llm_model} />
              <Field label="LLM" value={latestRun.llm_configured} />
              <Field label="Evidence" value={latestRun.evidence_items.length} />
              <Field label="Steps" value={latestRun.agent_steps.length} />
              <Field label="Created" value={formatDateTime(latestRun.created_at)} />
            </dl>
            {latestRun.fallback_reason ? (
              <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                Fallback: {latestRun.fallback_reason}
              </p>
            ) : null}
            <GeneratedCardSummary card={latestRun.action_card} />
            <CalendarAvailabilityPanel
              report={latestRun.calendar_availability}
            />
            <RunEvidenceList evidenceItems={latestRun.evidence_items} />
            <RunTraceList steps={latestRun.agent_steps} />
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            {isPending ? "Loading" : "実行履歴はまだありません。"}
          </p>
        )}
      </div>
    </div>
  );
}
