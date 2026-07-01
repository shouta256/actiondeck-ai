"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Clock3, Gauge, Loader2 } from "lucide-react";

import { runActionPlan } from "./api";
import type { ActionPlan, ActionPlanItem } from "./types";

const PRIORITY_LABEL: Record<ActionPlanItem["priority"], string> = {
  urgent: "最優先",
  high: "高",
  medium: "中",
  low: "低",
};

const EFFORT_LABEL: Record<ActionPlanItem["effort"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const STATUS_LABEL: Record<ActionPlanItem["status"], string> = {
  draft: "下書き",
  pending_review: "確認待ち",
  approved: "承認済み",
  edited: "編集済み",
  rejected: "却下",
  completed: "完了",
};

type ActionPlanPanelProps = {
  initialActionPlan: ActionPlan | null;
  initialErrorMessage: string | null;
};

export function ActionPlanPanel({
  initialActionPlan,
  initialErrorMessage,
}: ActionPlanPanelProps) {
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(
    initialActionPlan,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(initialActionPlan !== null);

  async function handleRunActionPlan() {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const nextActionPlan = await runActionPlan();
      setActionPlan(nextActionPlan);
      setHasRun(true);
    } catch {
      setErrorMessage("Action Planを作成できません。FastAPIを起動してください。");
    } finally {
      setIsRunning(false);
    }
  }

  const items = actionPlan?.items ?? [];
  const quickWins = actionPlan?.quick_wins ?? [];
  const geminiCount = actionPlan?.generation_modes.gemini_assisted ?? 0;
  const fallbackCount = actionPlan?.generation_modes.deterministic_template ?? 0;

  return (
    <section className="mb-7 rounded-md border border-white bg-white p-6 shadow-sm shadow-neutral-200/70">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-neutral-950 text-white">
            <Gauge className="size-4" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">今日のAction Plan</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              複数メールを読み取り、必要なアクションを作成してから優先度と作業コストで並べます。
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          disabled={isRunning}
          onClick={handleRunActionPlan}
          type="button"
        >
          {isRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Gauge className="size-4" />
          )}
          {isRunning ? "メールを確認中" : "AIでメールをまとめて整理"}
        </button>
      </div>

      {errorMessage ? (
        <p className="rounded-md bg-red-50 px-4 py-5 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : !hasRun ? (
        <div className="rounded-md bg-neutral-100/70 px-4 py-5">
          <p className="text-sm font-medium text-neutral-900">
            まだ整理していません。
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            ボタンを押すと、メールをまとめて確認し、Action Cardを作成・確認してから、優先度・目安時間・労力で並べます。
          </p>
        </div>
      ) : items.length > 0 ? (
        <>
          {actionPlan ? (
            <div className="mb-4 rounded-md bg-neutral-100/70 px-4 py-3">
              <p className="text-sm font-medium text-neutral-900">
                {actionPlan.summary}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="rounded-md bg-white px-2.5 py-1">
                  確認メール {actionPlan.processed_inbox_count}件
                </span>
                <span className="rounded-md bg-white px-2.5 py-1">
                  Action Card {actionPlan.action_card_count}件
                </span>
                <span className="rounded-md bg-white px-2.5 py-1">
                  Gemini {geminiCount}件
                </span>
                <span className="rounded-md bg-white px-2.5 py-1">
                  ルール補完 {fallbackCount}件
                </span>
              </div>
            </div>
          ) : null}

          <ol className="divide-y divide-neutral-100">
            {items.map((item) => (
              <li className="py-4 first:pt-0 last:pb-0" key={item.action_card_id}>
                <div className="grid gap-3 md:grid-cols-[2rem_minmax(0,1fr)_auto] md:items-center">
                  <span className="flex size-8 items-center justify-center rounded-md bg-neutral-100 text-sm font-semibold text-neutral-700">
                    {item.rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-neutral-950">
                        {item.next_action}
                      </p>
                      {item.blockers[0] ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                          {item.blockers[0]}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {item.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1">
                        優先度 {PRIORITY_LABEL[item.priority]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1">
                        <Clock3 className="size-3.5" />
                        {item.estimated_minutes}分
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1">
                        労力 {EFFORT_LABEL[item.effort]}
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1">
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                  </div>
                  <Link
                    className="inline-flex items-center justify-center gap-1 rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                    href={`/action-cards/${item.action_card_id}`}
                  >
                    確認
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>

          {quickWins.length > 1 ? (
            <details className="mt-5 rounded-md bg-neutral-100/70 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-800">
                短時間で片づく順を見る
              </summary>
              <ol className="mt-3 space-y-2">
                {quickWins.map((item) => (
                  <li
                    className="flex items-center justify-between gap-3 text-sm"
                    key={item.action_card_id}
                  >
                    <Link
                      className="min-w-0 truncate text-neutral-700 hover:text-neutral-950"
                      href={`/action-cards/${item.action_card_id}`}
                    >
                      {item.title}
                    </Link>
                    <span className="shrink-0 text-neutral-500">
                      {item.estimated_minutes}分
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      ) : (
        <p className="rounded-md bg-neutral-100/70 px-4 py-5 text-sm text-neutral-500">
          今すぐ確認が必要なAction Cardはありません。
        </p>
      )}
    </section>
  );
}
