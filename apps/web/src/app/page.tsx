import Link from "next/link";

import { listActionCards } from "@/features/action-cards/api";
import type { ActionCard } from "@/features/action-cards/types";

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

async function loadActionCards() {
  try {
    return {
      actionCards: await listActionCards(),
      errorMessage: null,
    };
  } catch {
    return {
      actionCards: [],
      errorMessage: "APIに接続できません。FastAPIを起動してください。",
    };
  }
}

export default async function Home() {
  const { actionCards, errorMessage } = await loadActionCards();
  const reviewStats = buildReviewStats(actionCards);

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
          <div className="text-sm text-neutral-500">MVP setup</div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_280px]">
        <section>
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
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-medium uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Actions</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Confidence</th>
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
                    <td className="px-4 py-6 text-sm text-neutral-500" colSpan={7}>
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
