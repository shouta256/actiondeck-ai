"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Info,
} from "lucide-react";
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

function RunDisclosure({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-neutral-200 pt-3">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-neutral-800">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              {description}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-sm font-medium text-blue-600">
          <span className="group-open:hidden">open</span>
          <span className="hidden group-open:inline">close</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
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
    <RunDisclosure
      title="Run Evidence"
      description="この実行で参照した根拠です。"
    >
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
    </RunDisclosure>
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
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <CalendarDays className="size-4" />
          </span>
          <h4 className="text-[15px] font-semibold text-neutral-950">
            Availability
          </h4>
        </div>
        {report.fallback_reason ? (
          <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
            fallback
          </span>
        ) : null}
      </div>

      {report.candidates.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {report.candidates.map((candidate) => {
            const status = candidate.is_available ? "available" : "conflict";
            const Icon = candidate.is_available ? CheckCircle2 : AlertTriangle;
            return (
              <li
                className={
                  candidate.is_available
                    ? "rounded-md bg-emerald-50 p-3 text-emerald-950"
                    : "rounded-md bg-red-50 p-3 text-red-950"
                }
                key={`${candidate.start}-${candidate.end}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <p className="text-sm font-medium">
                      {formatLocalTimeRange(candidate.start, candidate.end)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold">{status}</span>
                </div>
                {candidate.conflicting_events.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {candidate.conflicting_events.map((event) => (
                      <li
                        className="flex items-start justify-between gap-3 pl-7 text-xs"
                        key={event.id}
                      >
                        <span className="min-w-0 truncate">{event.title}</span>
                        <span className="shrink-0 text-[11px] opacity-70">
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
    <RunDisclosure
      title="Run Trace"
      description="nodeの実行順と出力です。"
    >
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
    </RunDisclosure>
  );
}

function RunMetadata({ run }: { run: AgentRunResult }) {
  return (
    <RunDisclosure
      title="Run Metadata"
      description="LLM設定、fallback、run idなどの技術情報です。"
    >
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <Field label="Run" value={run.run_id} />
        <Field label="Mode" value={run.generation_mode} />
        <Field label="Model" value={run.llm_model} />
        <Field label="LLM" value={run.llm_configured} />
        <Field label="Evidence" value={run.evidence_items.length} />
        <Field label="Steps" value={run.agent_steps.length} />
        <Field label="Created" value={formatDateTime(run.created_at)} />
        <Field label="Fallback" value={run.fallback_reason ?? "-"} />
      </dl>
    </RunDisclosure>
  );
}

function RunDetails({ run }: { run: AgentRunResult }) {
  return (
    <RunDisclosure
      title="Run Details"
      description="生成結果、根拠、Trace、LLM設定を確認します。"
    >
      <div className="space-y-3">
        <GeneratedCardSummary card={run.action_card} />
        <RunEvidenceList evidenceItems={run.evidence_items} />
        <RunTraceList steps={run.agent_steps} />
        <RunMetadata run={run} />
      </div>
    </RunDisclosure>
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
    <section className="rounded-md border border-white bg-white p-5 shadow-sm shadow-neutral-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
            <Info className="size-4" />
          </span>
          <h3 className="text-[15px] font-semibold text-neutral-950">
            Agent Check
          </h3>
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
            <CalendarAvailabilityPanel
              report={latestRun.calendar_availability}
            />
            <RunDetails run={latestRun} />
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            {isPending ? "Loading" : "実行履歴はまだありません。"}
          </p>
        )}
      </div>
    </section>
  );
}
