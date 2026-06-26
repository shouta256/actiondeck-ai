import { actionCards } from "@/features/action-cards/sample-data";
import type { ActionCard } from "@/features/action-cards/types";

const reviewStats = [
  ["Pending", "1"],
  ["Draft", "1"],
  ["Evidence", "0"],
  ["Agent runs", "0"],
];

function getDueDate(card: ActionCard) {
  return card.proposal.todos[0]?.due_date ?? "-";
}

export default function Home() {
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
                {actionCards.map((card) => (
                  <tr
                    key={card.title}
                    className="border-b border-neutral-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-950">
                      {card.title}
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
                ))}
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
            Action Card schemaに合わせた型付きデータを表示しています。
          </p>
        </aside>
      </div>
    </main>
  );
}
