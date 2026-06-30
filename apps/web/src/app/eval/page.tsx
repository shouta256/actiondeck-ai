import Link from "next/link";
import { BarChart3, CheckCircle2, FlaskConical, XCircle } from "lucide-react";

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

function formatBoolean(value: boolean) {
  return value ? "yes" : "no";
}

function formatGenerationMode(
  mode: ActionCardEvalRunResult["cases"][number]["generation_mode"],
) {
  if (mode === "gemini_assisted") {
    return "Gemini";
  }
  if (mode === "deterministic_template") {
    return "Template fallback";
  }
  return "-";
}

function formatStepPath(
  steps: ActionCardEvalRunResult["cases"][number]["actual_step_names"],
) {
  return steps.length > 0 ? steps.join(" -> ") : "-";
}

function parseEvalMode(value: string | undefined): ActionCardEvalMode {
  if (value === "gemini" || value === "graph") {
    return value;
  }
  return "deterministic";
}

function evalModeDescription(mode: ActionCardEvalMode) {
  if (mode === "gemini") {
    return "Gemini modeは手動確認用です。APIキー未設定時はtemplate fallbackで評価します。";
  }
  if (mode === "graph") {
    return "Graph modeはLangGraph runnerの分岐と評価ケースの整合性を確認します。";
  }
  return "Deterministic modeはCI向けの安定評価です。Geminiを呼ばずに評価します。";
}

function buildPrimaryMetrics(result: ActionCardEvalRunResult) {
  return [
    ["Passed", `${result.passed_cases}/${result.total_cases}`],
    ["Schema", formatRate(result.schema_valid_rate)],
    ["Route", formatRate(result.route_match_rate)],
    ["Retrieval", formatRate(result.retrieval_recall)],
  ];
}

function buildAllMetrics(result: ActionCardEvalRunResult) {
  return [
    ["Mode", result.mode],
    ["LLM configured", formatBoolean(result.llm_configured)],
    ["Gemini used", String(result.gemini_assisted_cases)],
    ["Template fallback", String(result.deterministic_template_cases)],
    ["Total cases", String(result.total_cases)],
    ["Passed cases", String(result.passed_cases)],
    ["Schema valid", formatRate(result.schema_valid_rate)],
    ["Action match", formatRate(result.action_match_rate)],
    ["Priority match", formatRate(result.priority_match_rate)],
    ["Approval match", formatRate(result.approval_match_rate)],
    ["Missing info", formatRate(result.missing_info_match_rate)],
    ["Generation match", formatRate(result.generation_mode_match_rate)],
    ["Route match", formatRate(result.route_match_rate)],
    ["Step path", formatRate(result.step_path_match_rate)],
    ["Unsafe match", formatRate(result.unsafe_action_match_rate)],
    ["Safety notes", formatRate(result.safety_note_keywords_match_rate)],
    ["Evidence recall", formatRate(result.evidence_recall)],
    ["Retrieval recall", formatRate(result.retrieval_recall)],
  ];
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
  const primaryMetrics = result ? buildPrimaryMetrics(result) : [];
  const allMetrics = result ? buildAllMetrics(result) : [];

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-neutral-950">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur">
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

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="mb-6 rounded-md border border-white bg-white p-6 shadow-sm shadow-neutral-200/70">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-blue-600">Evaluation</p>
              <h1 className="mt-2 text-2xl font-semibold">
                Action Card Evaluation
              </h1>
              <p className="mt-3 text-base leading-7 text-neutral-700">
                Agent Workflowを評価ケースで確認します。最初は合格率と主要指標だけを見ます。
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              <FlaskConical className="size-5" />
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["deterministic", "graph", "gemini"] as const).map((evalMode) => (
              <Link
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === evalMode
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
                href={`/eval?mode=${evalMode}`}
                key={evalMode}
              >
                {evalMode}
              </Link>
            ))}
          </div>

          <p className="mt-3 text-sm leading-6 text-neutral-500">
            {evalModeDescription(mode)}
          </p>
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
          ) : null}
        </section>

        <section className="rounded-md border border-white bg-white p-5 shadow-sm shadow-neutral-200/70">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
              <BarChart3 className="size-4" />
            </span>
            <h2 className="text-[15px] font-semibold">Summary</h2>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {primaryMetrics.map(([label, value]) => (
              <div className="rounded-md bg-neutral-100/70 p-4" key={label}>
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold text-neutral-950">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <details className="group mt-4 border-t border-neutral-100 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <span className="text-sm font-medium text-neutral-800">
                All metrics
              </span>
              <span className="text-sm font-medium text-blue-600">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {allMetrics.map(([label, value]) => (
                <div className="rounded-md bg-neutral-50 p-3" key={label}>
                  <dt className="text-xs text-neutral-500">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-neutral-950">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>

        <section className="mt-6 rounded-md border border-white bg-white p-5 shadow-sm shadow-neutral-200/70">
          <h2 className="text-[15px] font-semibold">Cases</h2>
          <div className="mt-4">
            {result && result.cases.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {result.cases.map((testCase) => (
                  <li className="py-4" key={testCase.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {testCase.passed ? (
                            <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
                          ) : (
                            <XCircle className="size-5 shrink-0 text-red-700" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-950">
                              {testCase.id}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {testCase.input_item_id} /{" "}
                              {testCase.actual_route ?? "-"}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-blue-600">
                          <span className="group-open:hidden">Show</span>
                          <span className="hidden group-open:inline">Hide</span>
                        </span>
                      </summary>
                      <div className="mt-4 grid gap-3 rounded-md bg-neutral-100/70 p-4 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-xs text-neutral-500">Generation</p>
                          <p className="mt-1 font-medium">
                            {formatGenerationMode(testCase.generation_mode)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Workflow</p>
                          <p className="mt-1 text-sm leading-6 text-neutral-700">
                            {formatStepPath(testCase.actual_step_names)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Retrieval</p>
                          <p className="mt-1">
                            {!testCase.retrieval_evaluated
                              ? "skipped"
                              : testCase.retrieval_evidence_covered
                                ? "ok"
                                : "mismatch"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Failure</p>
                          <p className="mt-1 text-sm leading-6 text-neutral-700">
                            {testCase.failure_reasons.length > 0
                              ? testCase.failure_reasons.join(", ")
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-neutral-500">
                表示できる評価結果がありません。
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
