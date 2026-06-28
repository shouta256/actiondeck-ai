import Link from "next/link";

import { listActionCards } from "@/features/action-cards/api";
import type { ActionCard } from "@/features/action-cards/types";
import { listAgentRuns } from "@/features/agent-runs/api";

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

function getDueDate(card: ActionCard) {
  return card.proposal.todos[0]?.due_date ?? "-";
}

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

function buildCardSignals(card: ActionCard) {
  const signals = new Set<string>();
  const actionSet = new Set(card.actions);

  if (card.evidence_ids.length > 0) {
    signals.add("evidence");
  }
  if (card.approval_required) {
    signals.add("approval");
  }
  if (card.safety_notes.some((note) => note.includes("衝突"))) {
    signals.add("calendar conflict");
  }
  if (actionSet.has("request_missing_info")) {
    signals.add("missing info");
  }
  if (actionSet.has("ignore")) {
    signals.add("ignore");
  }
  if (actionSet.has("create_todo")) {
    signals.add("todo");
  }

  return [...signals];
}

function getScenarioCard(
  actionCards: ActionCard[],
  scenario: DemoScenario,
) {
  return actionCards.find((card) => card.source_item_id === scenario.sourceItemId);
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
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
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

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_280px]">
        <section>
          <div className="mb-6">
            <div className="mb-3">
              <h2 className="text-lg font-semibold">Demo Scenarios</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Agentの判断が分かりやすい代表ケースです。
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {DEMO_SCENARIOS.map((scenario) => {
                const card = getScenarioCard(actionCards, scenario);
                return (
                  <Link
                    className="rounded-md border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:bg-neutral-50"
                    href={card ? `/action-cards/${card.id}` : "/"}
                    key={scenario.sourceItemId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          {scenario.label}
                        </p>
                        <p className="mt-1 font-mono text-xs text-neutral-500">
                          {scenario.sourceItemId}
                        </p>
                      </div>
                      <span className="rounded border border-neutral-200 px-2 py-1 font-mono text-[11px] text-neutral-600">
                        {card?.id ?? "missing"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">
                      {scenario.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scenario.signals.map((signal) => (
                        <span
                          className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-600"
                          key={signal}
                        >
                          {signal}
                        </span>
                      ))}
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
            <button className="h-8 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-100">
              Import
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-medium uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Actions</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Signals</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {actionCards.length > 0 ? (
                  actionCards.map((card) => (
                    <tr
                      key={card.id}
                      className="border-b border-neutral-100 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-neutral-950">
                        <Link
                          className="underline-offset-4 hover:underline"
                          href={`/action-cards/${card.id}`}
                        >
                          {card.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                        {card.actions.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {card.priority}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {card.risk_level}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {card.confidence.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-64 flex-wrap gap-1.5">
                          {buildCardSignals(card).map((signal) => (
                            <span
                              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-600"
                              key={signal}
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {getDueDate(card)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                        {card.status}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-neutral-500" colSpan={8}>
                      表示できるAction Cardがありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-md border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Review Queue</h2>
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
          <p className="mt-4 border-t border-neutral-100 pt-4 text-sm leading-6 text-neutral-500">
            FastAPIのAction Card APIから取得したデータを表示しています。
          </p>
        </aside>
      </div>
    </main>
  );
}
