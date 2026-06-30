import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Layers3,
} from "lucide-react";

import { listActionCards } from "@/features/action-cards/api";
import type { ActionCard } from "@/features/action-cards/types";
import { listAgentRuns } from "@/features/agent-runs/api";
import { GoogleCalendarPanel } from "@/features/integrations/google-calendar-panel";

type DemoScenario = {
  sourceItemId: string;
  label: string;
  description: string;
  signals: string[];
};

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    sourceItemId: "inbox_001",
    label: "面談日程調整",
    description: "返信案、予定案、提出物ToDoを1枚のAction Cardにまとめます。",
    signals: ["pgvector retrieval", "approval required", "todo"],
  },
  {
    sourceItemId: "inbox_006",
    label: "予定衝突あり",
    description: "候補日時をローカルCalendarと照合し、衝突と空き枠を安全メモに残します。",
    signals: ["calendar conflict", "safety check", "approval required"],
  },
  {
    sourceItemId: "inbox_003",
    label: "情報不足",
    description: "候補日時がないため、返信や予定案を確定せず追加情報を求めます。",
    signals: ["missing info", "planning skipped"],
  },
  {
    sourceItemId: "inbox_004",
    label: "返信不要",
    description: "対応不要な案内を検出し、検索と生成を省略して低コストに処理します。",
    signals: ["ignore", "terminal route"],
  },
  {
    sourceItemId: "inbox_007",
    label: "根拠矛盾",
    description: "矛盾した根拠がある場合、返信案を確定せず確認待ちにします。",
    signals: ["conflicting evidence", "planning skipped"],
  },
];

function buildReviewStats(actionCards: ActionCard[]) {
  const pendingCount = actionCards.filter(
    (card) => card.status === "pending_review",
  ).length;
  const draftCount = actionCards.filter((card) => card.status === "draft").length;
  const evidenceCount = new Set(actionCards.flatMap((card) => card.evidence_ids))
    .size;

  return [
    ["Pending", String(pendingCount)],
    ["Draft", String(draftCount)],
    ["Evidence", String(evidenceCount)],
    ["Agent runs", "0"],
  ];
}

function getScenarioCard(
  actionCards: ActionCard[],
  scenario: DemoScenario,
) {
  return actionCards.find((card) => card.source_item_id === scenario.sourceItemId);
}

function StatusBadge({ card }: { card: ActionCard }) {
  const hasConflict = card.safety_notes.some((note) => note.includes("衝突"));
  if (hasConflict) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-900">
        <AlertTriangle className="size-3.5" />
        Conflict
      </span>
    );
  }
  if (card.status === "pending_review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
        <ClipboardList className="size-3.5" />
        Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
      <CheckCircle2 className="size-3.5" />
      Ready
    </span>
  );
}

async function loadActionCards() {
  try {
    const [actionCards, agentRuns] = await Promise.all([
      listActionCards(),
      listAgentRuns(),
    ]);
    return {
      actionCards,
      agentRunCount: agentRuns.length,
      errorMessage: null,
    };
  } catch {
    return {
      actionCards: [],
      agentRunCount: 0,
      errorMessage: "APIに接続できません。FastAPIを起動してください。",
    };
  }
}

export default async function Home() {
  const { actionCards, agentRunCount, errorMessage } = await loadActionCards();
  const reviewStats = buildReviewStats(actionCards).map(([label, value]) =>
    label === "Agent runs" ? [label, String(agentRunCount)] : [label, value],
  );

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-neutral-950">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold">ActionDeck AI</h1>
            <span className="text-sm text-neutral-500">
              Personal Action Review Agent
            </span>
          </div>
          <Link className="text-sm text-neutral-500 hover:text-neutral-950" href="/eval">
            Evaluation
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="mb-7 rounded-md border border-white bg-white p-6 shadow-sm shadow-neutral-200/70">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                <Layers3 className="size-4" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">Demo Scenarios</h2>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  まず見るべき代表ケースです。詳細画面で提案、安全確認、承認を確認します。
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {DEMO_SCENARIOS.map((scenario) => {
                const card = getScenarioCard(actionCards, scenario);
                return (
                  <Link
                    className="group rounded-md bg-neutral-100/70 p-4 transition hover:bg-neutral-200/60"
                    href={card ? `/action-cards/${card.id}` : "/"}
                    key={scenario.sourceItemId}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold text-neutral-950">
                          {scenario.label}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {scenario.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                      {card ? <StatusBadge card={card} /> : null}
                      <span>{scenario.signals[0]}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Action Cards</h2>
              <p className="mt-1 text-sm text-neutral-500">
                ユーザー確認が必要なカードを優先して表示します。
              </p>
              {errorMessage ? (
                <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-white bg-white p-3 shadow-sm shadow-neutral-200/70">
            {actionCards.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {actionCards.map((card) => (
                  <li key={card.id}>
                    <Link
                      className="group flex items-center justify-between gap-4 rounded-md px-3 py-4 hover:bg-neutral-100/70"
                      href={`/action-cards/${card.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[15px] font-semibold text-neutral-950">
                            {card.title}
                          </p>
                          <StatusBadge card={card} />
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
                          {card.summary}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-sm text-neutral-500">
                表示できるAction Cardがありません。
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <GoogleCalendarPanel />

          <section className="rounded-md border border-white bg-white p-5 shadow-sm shadow-neutral-200/70">
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                <ClipboardList className="size-4" />
              </span>
              <h2 className="text-[15px] font-semibold">Review Queue</h2>
            </div>
            <dl className="mt-4 divide-y divide-neutral-100">
              {reviewStats.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="font-medium text-neutral-950">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
