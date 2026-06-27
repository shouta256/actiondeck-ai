import Link from "next/link";

import { getActionCardEvalResult } from "@/features/evaluation/api";
import type {
  ActionCardEvalMode,
  ActionCardEvalRunResult,
} from "@/features/evaluation/types";

type EvalPageProps = {
  searchParams: Promise<{
    mode?: string;
  }>;
};

function formatRate(value: number) {
  return value.toFixed(2);
}

function buildMetrics(result: ActionCardEvalRunResult) {
  return [
    ["Mode", result.mode],
    ["LLM configured", String(result.llm_configured)],
    ["Total cases", String(result.total_cases)],
    ["Passed cases", String(result.passed_cases)],
    ["Schema valid", formatRate(result.schema_valid_rate)],
    ["Action match", formatRate(result.action_match_rate)],
    ["Priority match", formatRate(result.priority_match_rate)],
    ["Approval match", formatRate(result.approval_match_rate)],
    ["Missing info", formatRate(result.missing_info_match_rate)],
    ["Evidence recall", formatRate(result.evidence_recall)],
  ];
}

function parseEvalMode(value: string | undefined): ActionCardEvalMode {
  return value === "gemini" ? "gemini" : "deterministic";
}

async function loadEvalResult(mode: ActionCardEvalMode) {
  try {
    return {
      result: await getActionCardEvalResult(mode),
      errorMessage: null,
    };
  } catch {
    return {
      result: null,
      errorMessage: "APIに接続できません。FastAPIを起動してください。",
    };
  }
}

export default async function EvalPage({ searchParams }: EvalPageProps) {
  const { mode: rawMode } = await searchParams;
  const mode = parseEvalMode(rawMode);
  const { result, errorMessage } = await loadEvalResult(mode);
  const metrics = result ? buildMetrics(result) : [];

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-baseline gap-3">
            <Link className="text-base font-semibold" href="/">
              ActionDeck AI
            </Link>
            <span className="text-sm text-neutral-500">Evaluation</span>
          </div>
          <Link className="text-sm text-neutral-500 hover:text-neutral-950" href="/">
            Back to deck
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold">Action Card Evaluation</h1>
          <p className="mt-1 text-sm text-neutral-500">
            評価ケースごとにAgent Workflowを実行し、期待値と比較します。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className={`rounded border px-3 py-1.5 text-sm ${
                mode === "deterministic"
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
              href="/eval?mode=deterministic"
            >
              Deterministic
            </Link>
            <Link
              className={`rounded border px-3 py-1.5 text-sm ${
                mode === "gemini"
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
              href="/eval?mode=gemini"
            >
              Gemini
            </Link>
          </div>
          {mode === "gemini" ? (
            <p className="mt-2 text-xs text-neutral-500">
              Gemini modeは手動確認用です。APIキーが未設定の場合はtemplate fallbackで評価します。
            </p>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">
              Deterministic modeはCI向けの安定した評価です。Geminiを呼ばずにtemplate fallbackで評価します。
            </p>
          )}
          {errorMessage ? (
            <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
          ) : null}
        </div>

        <section className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Summary</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([label, value]) => (
              <div
                className="rounded border border-neutral-200 bg-neutral-50 p-3"
                key={label}
              >
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="mt-2 font-mono text-lg text-neutral-950">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-6 overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-medium uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Input</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Action Card</th>
                <th className="px-4 py-3">Failure</th>
              </tr>
            </thead>
            <tbody>
              {result && result.cases.length > 0 ? (
                result.cases.map((testCase) => (
                  <tr
                    className="border-b border-neutral-100 last:border-b-0"
                    key={testCase.id}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {testCase.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {testCase.input_item_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {testCase.passed ? "pass" : "fail"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {testCase.generation_mode ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {testCase.actions_match ? "ok" : "mismatch"}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {testCase.priority_match ? "ok" : "mismatch"}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {testCase.approval_required_match ? "ok" : "mismatch"}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {testCase.required_evidence_covered
                        ? "ok"
                        : testCase.missing_evidence_ids.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {testCase.schema_valid && testCase.agent_steps_completed
                        ? "ok"
                        : "mismatch"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {testCase.actual_action_card_id ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700">
                      {testCase.failure_reasons.length > 0
                        ? testCase.failure_reasons.join(", ")
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-sm text-neutral-500"
                    colSpan={11}
                  >
                    表示できる評価結果がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
