"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  GitBranch,
  Info,
  ListTodo,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { RunAgentButton } from "./run-agent-button";
import { listAgentRuns } from "./api";
import type {
  AgentCriticReport,
  AgentRunResult,
  CalendarAvailabilityReport,
} from "./types";
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

const STEP_COPY: Record<string, { label: string; description: string }> = {
  triage: {
    label: "必要な対応を判定",
    description: "返信・日程・ToDoが必要か確認",
  },
  evidence_retrieval: {
    label: "根拠を集める",
    description: "メモや予定から判断材料を取得",
  },
  action_planning: {
    label: "対応案を作る",
    description: "返信案・予定案・ToDoを作成",
  },
  critic_check: {
    label: "案を点検する",
    description: "根拠不足や承認漏れを確認",
  },
  safety_check: {
    label: "安全を確認する",
    description: "予定衝突や承認要否を確認",
  },
  approval_gate: {
    label: "承認待ちで止める",
    description: "自動実行せずユーザー確認へ",
  },
};

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

function buildDecisionTitle(card: ActionCard) {
  const actions = new Set(card.actions);

  if (actions.has("request_missing_info")) {
    return "情報が足りないため、対応案を確定しません";
  }
  if (actions.has("ignore")) {
    return "追加対応は不要と判断しました";
  }
  if (actions.has("draft_reply") && actions.has("propose_schedule")) {
    return "返信案と予定候補をまとめました";
  }
  if (actions.has("draft_reply")) {
    return "返信案を作成しました";
  }
  if (actions.has("propose_schedule")) {
    return "予定候補を整理しました";
  }
  if (actions.has("create_todo")) {
    return "外部連絡ではなく、確認タスクとして扱います";
  }
  return "対応内容を整理しました";
}

function buildDecisionReasons(run: AgentRunResult) {
  const card = run.action_card;
  const actions = new Set(card.actions);
  const reasons: string[] = [];

  if (actions.has("create_todo") && !actions.has("draft_reply")) {
    reasons.push("返信や予定登録ではなく、自分が確認する作業として分離しました。");
  }
  if (actions.has("request_missing_info")) {
    reasons.push("不足情報があるため、返信文や予定案を確定しない判断にしました。");
  }
  if (actions.has("ignore")) {
    reasons.push("元メッセージに返信・予定・ToDo化が必要な強いシグナルがありません。");
  }

  const conflictCount =
    run.calendar_availability?.candidates.filter(
      (candidate) => !candidate.is_available,
    ).length ?? 0;
  if (conflictCount > 0) {
    reasons.push("候補日時の一部が既存予定と衝突するため、注意が必要です。");
  }

  for (const item of run.evidence_items.slice(0, 2)) {
    reasons.push(`${item.title}: ${item.snippet}`);
  }

  if (card.approval_required) {
    reasons.push("メール送信や予定作成に関わるため、ユーザー承認で止めています。");
  }

  return reasons.slice(0, 4);
}

function buildNotExecutedItems(card: ActionCard) {
  const actions = new Set(card.actions);
  const items = ["メール送信はしていません", "予定登録はしていません"];

  if (!actions.has("draft_reply")) {
    items.push("返信案は作っていません");
  }
  if (!actions.has("propose_schedule")) {
    items.push("予定案は作っていません");
  }

  return items;
}

function CreatedActionPlan({ run }: { run: AgentRunResult }) {
  const card = run.action_card;
  const replyDraft = card.proposal.reply_draft;
  const calendarEvent = card.proposal.calendar_event;
  const todos = card.proposal.todos;
  const hasPlan = Boolean(replyDraft) || Boolean(calendarEvent) || todos.length > 0;
  const isIgnored = card.actions.includes("ignore");
  const needsMissingInfo = card.missing_info.length > 0;
  const decisionReasons = buildDecisionReasons(run);
  const notExecutedItems = buildNotExecutedItems(card);

  return (
    <div className="border-t border-neutral-200 pt-3">
      <div className="mb-3">
        <h4 className="text-[15px] font-semibold text-neutral-950">
          AIの判断結果
        </h4>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          ここがボタンを押した結果です。AIは実行せず、対応判断と案だけを作ります。
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-md bg-blue-50 p-4 text-blue-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            結論
          </p>
          <p className="mt-2 text-base font-semibold leading-7">
            {buildDecisionTitle(card)}
          </p>
          <p className="mt-2 text-sm leading-6">
            {card.summary}
          </p>
        </div>

        {decisionReasons.length > 0 ? (
          <div className="rounded-md bg-neutral-50 p-4">
            <h5 className="text-sm font-semibold text-neutral-950">
              判断理由
            </h5>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
              {decisionReasons.map((reason) => (
                <li className="flex gap-2" key={reason}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {replyDraft ? (
          <div className="rounded-md bg-neutral-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="size-4 text-neutral-500" />
              <h5 className="text-sm font-semibold text-neutral-950">
                返信案
              </h5>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">
              {replyDraft}
            </p>
          </div>
        ) : null}

        {calendarEvent ? (
          <div className="rounded-md bg-neutral-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="size-4 text-neutral-500" />
              <h5 className="text-sm font-semibold text-neutral-950">
                予定案
              </h5>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="予定名" value={calendarEvent.title} />
              <Field
                label="日時"
                value={formatLocalTimeRange(calendarEvent.start, calendarEvent.end)}
              />
              <Field label="場所" value={calendarEvent.location ?? "-"} />
            </dl>
          </div>
        ) : null}

        {todos.length > 0 ? (
          <div className="rounded-md bg-neutral-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ListTodo className="size-4 text-neutral-500" />
              <h5 className="text-sm font-semibold text-neutral-950">
                作成された確認タスク
              </h5>
            </div>
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li
                  className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm"
                  key={`${todo.title}-${todo.due_date ?? "none"}`}
                >
                  <span className="font-medium text-neutral-950">
                    {todo.title}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {todo.due_date ?? "期限なし"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {needsMissingInfo ? (
          <div className="rounded-md bg-amber-50 p-4 text-amber-950">
            <h5 className="text-sm font-semibold">追加で確認が必要なこと</h5>
            <ul className="mt-2 space-y-1 text-sm leading-6">
              {card.missing_info.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!hasPlan && isIgnored ? (
          <div className="rounded-md bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
            AIは、このメッセージには追加対応が不要だと判断しました。
          </div>
        ) : null}

        {!hasPlan && !isIgnored && !needsMissingInfo ? (
          <div className="rounded-md bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
            具体的な返信案・予定案・ToDo案は作成されませんでした。
          </div>
        ) : null}

        <div className="rounded-md bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
          <p className="font-semibold">まだ実行していないこと</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {notExecutedItems.map((item) => (
              <li className="rounded-md bg-white/70 px-2 py-1 text-xs" key={item}>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            次に、内容を確認して必要ならレビュー欄で承認・編集済み・却下を選びます。
          </p>
        </div>
      </div>
    </div>
  );
}

function GeneratedCardSummary({ card }: { card: ActionCard }) {
  return (
    <div className="border-t border-neutral-200 pt-3">
      <h4 className="text-xs font-semibold text-neutral-700">
        カード情報
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
      title="参照した根拠"
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
            予定候補の確認結果
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
            const status = candidate.is_available ? "空きあり" : "衝突あり";
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

function RunStepRail({ steps }: { steps: AgentTraceStep[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-neutral-200 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
          <GitBranch className="size-4" />
        </span>
        <h4 className="text-[15px] font-semibold text-neutral-950">
          AIの確認ステップ
        </h4>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => (
          <li
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
            key={`${step.action_card_id}-${step.sequence}`}
          >
            {(() => {
              const copy = STEP_COPY[step.step_name] ?? {
                label: step.step_name,
                description: step.output_summary,
              };

              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-neutral-500">
                      {String(step.sequence).padStart(2, "0")}
                    </span>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                      {step.status === "completed" ? "完了" : step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-neutral-950">
                    {copy.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                    {copy.description}
                  </p>
                </>
              );
            })()}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CriticReportPanel({
  report,
}: {
  report?: AgentCriticReport | null;
}) {
  if (!report) {
    return null;
  }

  const hasIssues = report.issues.length > 0;

  return (
    <div className="border-t border-neutral-200 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={
              hasIssues
                ? "flex size-7 items-center justify-center rounded-md bg-red-100 text-red-700"
                : "flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700"
            }
          >
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <h4 className="text-[15px] font-semibold text-neutral-950">
              案の点検結果
            </h4>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {hasIssues
                ? "根拠や承認条件に確認が必要な点があります。"
                : "根拠、提案内容、承認条件に大きな問題はありません。"}
            </p>
          </div>
        </div>
        <span
          className={
            hasIssues
              ? "shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
              : "shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
          }
        >
          {hasIssues ? `確認あり ${report.issues.length}件` : "問題なし"}
        </span>
      </div>

      {hasIssues ? (
        <ul className="mt-3 space-y-2">
          {report.issues.map((issue) => (
            <li
              className="rounded-md bg-red-50 px-3 py-2 text-xs leading-5 text-red-950"
              key={issue}
            >
              {issue}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RunTraceList({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <RunDisclosure
      title="開発者向けの詳細ログ"
      description="各処理の入出力とtool callです。通常は開かなくても確認できます。"
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
      title="実行メタデータ"
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
      title="詳細を見る"
      description="AIが何を確認したか、根拠、詳細ログを確認します。"
    >
      <div className="space-y-3">
        <RunStepRail steps={run.agent_steps} />
        <CalendarAvailabilityPanel report={run.calendar_availability} />
        <CriticReportPanel report={run.critic_report} />
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
          <div>
            <h3 className="text-[15px] font-semibold text-neutral-950">
              AIで対応案を作る
            </h3>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              元メッセージを読み取り、根拠検索、対応案作成、安全確認まで実行します。
            </p>
          </div>
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
            <CreatedActionPlan run={latestRun} />
            <RunDetails run={latestRun} />
          </div>
        ) : (
          <div className="rounded-md bg-neutral-100/70 p-4 text-sm leading-6 text-neutral-600">
            {isPending
              ? "Loading"
              : "まだ未実行です。ボタンを押すと、AIが何を確認したかと結果がここに表示されます。"}
          </div>
        )}
      </div>
    </section>
  );
}
