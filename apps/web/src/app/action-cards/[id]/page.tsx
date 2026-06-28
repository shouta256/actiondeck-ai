import Link from "next/link";
import { notFound } from "next/navigation";

import { listActionCardAgentSteps } from "@/features/agent-trace/api";
import type { AgentTraceStep } from "@/features/agent-trace/types";
import { AgentRunPanel } from "@/features/agent-runs/agent-run-panel";
import { getActionCard } from "@/features/action-cards/api";
import { ReviewActions } from "@/features/action-cards/review-actions";
import type { ActionCard } from "@/features/action-cards/types";
import { listActionCardEvidence } from "@/features/evidence/api";
import type { EvidenceItem } from "@/features/evidence/types";
import { getInboxItem } from "@/features/inbox-items/api";
import type { InboxItem } from "@/features/inbox-items/types";
import { listActionCardReviewEvents } from "@/features/review-events/api";
import type { ReviewEvent } from "@/features/review-events/types";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(value: string) {
  return value.replace("T", " ");
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-950">{String(value)}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function formatSignalLabel(value: string | boolean | number) {
  return String(value);
}

function buildDecisionSignals({
  card,
  evidenceItems,
  agentSteps,
}: {
  card: ActionCard;
  evidenceItems: EvidenceItem[];
  agentSteps: AgentTraceStep[];
}) {
  const calendarToolCalls = agentSteps.flatMap((step) =>
    step.tool_calls.filter(
      (toolCall) => toolCall.name === "calendar_availability_check",
    ),
  );
  const planningSkipped = !agentSteps.some(
    (step) => step.step_name === "action_planning",
  );
  const hasCalendarConflict = card.safety_notes.some((note) =>
    note.includes("衝突"),
  );

  return [
    ["Actions", card.actions.join(", ")],
    ["Evidence", `${evidenceItems.length} items`],
    ["Approval", card.approval_required ? "required" : "not required"],
    ["Safety", hasCalendarConflict ? "calendar conflict" : "checked"],
    ["Workflow", planningSkipped ? "planning skipped" : "full path"],
    [
      "Calendar",
      calendarToolCalls.length > 0
        ? calendarToolCalls[0].output_summary
        : "not checked",
    ],
  ];
}

function DecisionOverview({
  card,
  evidenceItems,
  agentSteps,
}: {
  card: ActionCard;
  evidenceItems: EvidenceItem[];
  agentSteps: AgentTraceStep[];
}) {
  const signals = buildDecisionSignals({ card, evidenceItems, agentSteps });

  return (
    <section className="mb-5 rounded-md border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Agent Decision</h2>
          <p className="mt-1 text-sm text-neutral-500">
            根拠、予定、安全確認、承認境界を1つの判断として確認します。
          </p>
        </div>
        <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-600">
          {card.status}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map(([label, value]) => (
          <div
            className="rounded border border-neutral-200 bg-neutral-50 p-3"
            key={label}
          >
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="mt-2 break-words font-mono text-xs text-neutral-900">
              {formatSignalLabel(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SourceMessagePanel({ item }: { item: InboxItem | null }) {
  return (
    <Section title="Source Message">
      {item ? (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-950">
                {item.sender_name}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {item.sender_address ?? item.channel}
              </p>
            </div>
            <span className="font-mono text-xs text-neutral-500">
              {formatDateTime(item.received_at)}
            </span>
          </div>
          <div className="mt-4">
            <AgentRunPanel inboxItemId={item.id} />
          </div>
          <p className="mt-4 text-base font-semibold text-neutral-950">
            {item.subject}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {item.body}
          </p>
        </div>
      ) : (
        <EmptyText>元メッセージを表示できません。</EmptyText>
      )}
    </Section>
  );
}

function ProposalPanel({ card }: { card: ActionCard }) {
  const calendarEvent = card.proposal.calendar_event;

  return (
    <div className="space-y-4">
      <Section title="Summary">
        <p className="text-sm leading-6 text-neutral-700">{card.summary}</p>
      </Section>

      <Section title="Reply Draft">
        {card.proposal.reply_draft ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {card.proposal.reply_draft}
          </p>
        ) : (
          <EmptyText>返信案はありません。</EmptyText>
        )}
      </Section>

      <Section title="Calendar Proposal">
        {calendarEvent ? (
          <dl className="divide-y divide-neutral-100">
            <Field label="Title" value={calendarEvent.title} />
            <Field label="Start" value={formatDateTime(calendarEvent.start)} />
            <Field label="End" value={formatDateTime(calendarEvent.end)} />
            <Field label="Location" value={calendarEvent.location ?? "-"} />
          </dl>
        ) : (
          <EmptyText>予定案はありません。</EmptyText>
        )}
      </Section>

      <Section title="Todos">
        {card.proposal.todos.length > 0 ? (
          <ul className="divide-y divide-neutral-100">
            {card.proposal.todos.map((todo) => (
              <li
                className="flex items-start justify-between gap-4 py-3 text-sm"
                key={`${todo.title}-${todo.due_date ?? "none"}`}
              >
                <span className="font-medium text-neutral-950">{todo.title}</span>
                <span className="text-neutral-500">{todo.due_date ?? "-"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyText>ToDo案はありません。</EmptyText>
        )}
      </Section>
    </div>
  );
}

function EvidencePanel({ evidenceItems }: { evidenceItems: EvidenceItem[] }) {
  return (
    <Section title="Evidence">
      {evidenceItems.length > 0 ? (
        <ul className="divide-y divide-neutral-100">
          {evidenceItems.map((item) => (
            <li className="py-3" key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-950">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.source_type} / {item.used_for}
                  </p>
                </div>
                <span className="font-mono text-xs text-neutral-500">
                  {item.relevance_score.toFixed(2)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-700">
                {item.snippet}
              </p>
              <p className="mt-2 font-mono text-xs text-neutral-500">
                {item.chunk_id}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyText>表示できる根拠はありません。</EmptyText>
      )}
    </Section>
  );
}

function ReviewHistoryPanel({ events }: { events: ReviewEvent[] }) {
  return (
    <Section title="Review History">
      {events.length > 0 ? (
        <ul className="divide-y divide-neutral-100">
          {events.map((event) => (
            <li className="py-3" key={event.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-neutral-950">
                    {event.to_status}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {event.actor} / {formatDateTime(event.created_at)}
                  </p>
                </div>
                <span className="font-mono text-xs text-neutral-500">
                  {event.id}
                </span>
              </div>
              <p className="mt-3 font-mono text-xs text-neutral-600">
                {event.from_status} → {event.to_status}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyText>レビュー履歴はまだありません。</EmptyText>
      )}
    </Section>
  );
}

function SafetyNoteList({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return <EmptyText>安全メモはありません。</EmptyText>;
  }

  return (
    <ul className="space-y-2 text-sm text-neutral-700">
      {notes.map((note) => {
        const isConflict = note.includes("衝突");
        const isAvailable = note.includes("空いています");
        const label = isConflict ? "conflict" : isAvailable ? "available" : "note";

        return (
          <li
            className="rounded border border-neutral-200 bg-neutral-50 p-3"
            key={note}
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-[11px] text-neutral-600">
                {label}
              </span>
              <span className="leading-6">{note}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AgentTracePanel({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <Section title="Agent Trace">
      {steps.length > 0 ? (
        <ol className="divide-y divide-neutral-100">
          {steps.map((step) => (
            <li className="py-4" key={`${step.action_card_id}-${step.sequence}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded border border-neutral-200 bg-neutral-50 font-mono text-xs text-neutral-600">
                    {step.sequence}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-neutral-950">
                      {step.step_name}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {step.status} / {step.latency_ms}ms
                    </p>
                  </div>
                </div>
                {step.token_usage ? (
                  <span className="font-mono text-xs text-neutral-500">
                    {step.token_usage.total_tokens} tokens
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 text-sm leading-6 text-neutral-700 md:grid-cols-2">
                <p>{step.input_summary}</p>
                <p>{step.output_summary}</p>
              </div>

              {step.tool_calls.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {step.tool_calls.map((toolCall) => (
                    <li
                      className={`rounded border p-3 text-sm ${
                        toolCall.name === "calendar_availability_check"
                          ? "border-neutral-300 bg-white"
                          : "border-neutral-200 bg-neutral-50"
                      }`}
                      key={`${step.sequence}-${toolCall.name}`}
                    >
                      <p className="font-mono text-xs text-neutral-500">
                        {toolCall.name}
                      </p>
                      <p className="mt-2 text-neutral-700">
                        {toolCall.input_summary} → {toolCall.output_summary}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyText>表示できる処理履歴はありません。</EmptyText>
      )}
    </Section>
  );
}

function ReviewPanel({
  card,
  evidenceItems,
  reviewEvents,
}: {
  card: ActionCard;
  evidenceItems: EvidenceItem[];
  reviewEvents: ReviewEvent[];
}) {
  return (
    <aside className="space-y-4">
      <Section title="Card Status">
        <dl className="divide-y divide-neutral-100">
          <Field label="Status" value={card.status} />
          <Field label="Priority" value={card.priority} />
          <Field label="Risk" value={card.risk_level} />
          <Field label="Confidence" value={card.confidence.toFixed(2)} />
          <Field label="Approval" value={card.approval_required} />
          <Field label="Source" value={card.source_item_id} />
        </dl>
      </Section>

      <Section title="Review">
        <ReviewActions actionCardId={card.id} currentStatus={card.status} />
      </Section>

      <ReviewHistoryPanel events={reviewEvents} />

      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          {card.actions.map((action) => (
            <span
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-700"
              key={action}
            >
              {action}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Missing Info">
        {card.missing_info.length > 0 ? (
          <ul className="space-y-2 text-sm text-neutral-700">
            {card.missing_info.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <EmptyText>不足情報はありません。</EmptyText>
        )}
      </Section>

      <Section title="Safety Notes">
        <SafetyNoteList notes={card.safety_notes} />
      </Section>

      <EvidencePanel evidenceItems={evidenceItems} />
    </aside>
  );
}

export default async function ActionCardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const card = await getActionCard(id);

  if (!card) {
    notFound();
  }

  const [sourceItem, evidenceItems, agentSteps, reviewEvents] = await Promise.all([
    getInboxItem(card.source_item_id),
    listActionCardEvidence(id),
    listActionCardAgentSteps(id),
    listActionCardReviewEvents(id),
  ]);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-baseline gap-3">
            <Link className="text-base font-semibold" href="/">
              ActionDeck AI
            </Link>
            <span className="text-sm text-neutral-500">Action Card Detail</span>
          </div>
          <Link className="text-sm text-neutral-500 hover:text-neutral-950" href="/">
            Back to deck
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="mb-5">
          <p className="font-mono text-xs text-neutral-500">{card.id}</p>
          <h1 className="mt-2 text-xl font-semibold">{card.title}</h1>
        </div>

        <DecisionOverview
          card={card}
          evidenceItems={evidenceItems}
          agentSteps={agentSteps}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <SourceMessagePanel item={sourceItem} />
            <ProposalPanel card={card} />
            <AgentTracePanel steps={agentSteps} />
          </div>
          <ReviewPanel
            card={card}
            evidenceItems={evidenceItems}
            reviewEvents={reviewEvents}
          />
        </div>
      </div>
    </main>
  );
}
