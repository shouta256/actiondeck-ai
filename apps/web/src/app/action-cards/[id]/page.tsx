import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Info,
  ListTodo,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
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
      <dd className="text-right font-medium leading-6 text-neutral-950">
        {String(value)}
      </dd>
    </div>
  );
}

function Section({
  title,
  description,
  className = "",
  icon,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-md border border-white bg-white p-5 shadow-sm shadow-neutral-200/70 ${className}`}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-[15px] font-semibold text-neutral-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-neutral-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DisclosureSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-white bg-white p-5 shadow-sm shadow-neutral-200/70">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span className="flex items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
              {icon}
            </span>
          ) : null}
          <span>
            <span className="block text-[15px] font-semibold text-neutral-950">
              {title}
            </span>
            {description ? (
              <span className="mt-1 block text-sm leading-5 text-neutral-500">
                {description}
              </span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-blue-600">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="mt-5 border-t border-neutral-100 pt-5">{children}</div>
    </details>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "blue";
}) {
  const className =
    tone === "green"
      ? "bg-emerald-100 text-emerald-900"
      : tone === "red"
        ? "bg-red-100 text-red-900"
        : tone === "amber"
          ? "bg-amber-100 text-amber-900"
          : tone === "blue"
            ? "bg-blue-100 text-blue-900"
            : "bg-neutral-100 text-neutral-700";

  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function DecisionOverview({ card }: { card: ActionCard }) {
  const hasCalendarConflict = card.safety_notes.some((note) =>
    note.includes("衝突"),
  );
  const approvalTone = card.approval_required ? "amber" : "green";
  const safetyTone = hasCalendarConflict ? "red" : "green";

  return (
    <section className="mb-6 rounded-md border border-white bg-white p-6 shadow-sm shadow-neutral-200/70">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-blue-600">Action Card</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-neutral-950">
            {card.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-neutral-700">
            {card.summary}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge tone={card.status === "pending_review" ? "amber" : "neutral"}>
            {card.status === "pending_review" ? "Review needed" : card.status}
          </Badge>
          <Badge tone={approvalTone}>
            {card.approval_required ? "Needs approval" : "Ready"}
          </Badge>
          <Badge tone={safetyTone}>
            {hasCalendarConflict ? "Conflict found" : "Checked"}
          </Badge>
        </div>
      </div>
    </section>
  );
}
function SourceMessagePanel({ item }: { item: InboxItem | null }) {
  return (
    <Section
      title="Source Message"
      icon={<MessageSquare className="size-4" />}
    >
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
          <p className="mt-4 text-base font-semibold text-neutral-950">
            {item.subject}
          </p>
          <details className="group mt-4 rounded-md bg-neutral-100/70 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-800">
              <span>Message body</span>
              <span className="text-sm font-medium text-blue-600">
                <span className="group-open:hidden">open</span>
                <span className="hidden group-open:inline">close</span>
              </span>
            </summary>
            <p className="mt-4 whitespace-pre-wrap border-t border-neutral-200 pt-4 text-[15px] leading-7 text-neutral-700">
              {item.body}
            </p>
          </details>
        </div>
      ) : (
        <EmptyText>元メッセージを表示できません。</EmptyText>
      )}
    </Section>
  );
}

function ProposalPanel({ card }: { card: ActionCard }) {
  const calendarEvent = card.proposal.calendar_event;
  const hasReplyDraft = Boolean(card.proposal.reply_draft);
  const hasTodos = card.proposal.todos.length > 0;

  return (
    <Section
      title="Proposed Action"
      icon={<CheckCircle2 className="size-4" />}
    >
      <div className="space-y-5">
        {hasReplyDraft ? (
          <div>
            <h3 className="mb-2 text-[15px] font-semibold text-neutral-950">
              Reply Draft
            </h3>
            <p className="whitespace-pre-wrap rounded-md bg-neutral-100/70 p-5 text-[15px] leading-7 text-neutral-800">
              {card.proposal.reply_draft}
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {calendarEvent ? (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-neutral-950">
                <CalendarDays className="size-4 text-neutral-500" />
                Calendar Proposal
              </h3>
              <dl className="rounded-md bg-neutral-100/70 px-4">
                <Field label="Title" value={calendarEvent.title} />
                <Field label="Start" value={formatDateTime(calendarEvent.start)} />
                <Field label="End" value={formatDateTime(calendarEvent.end)} />
                <Field label="Location" value={calendarEvent.location ?? "-"} />
              </dl>
            </div>
          ) : null}

          {hasTodos ? (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-neutral-950">
                <ListTodo className="size-4 text-neutral-500" />
                Todos
              </h3>
              <ul className="rounded-md bg-neutral-100/70 px-4">
                {card.proposal.todos.map((todo) => (
                  <li
                    className="flex items-start justify-between gap-4 border-b border-neutral-200 py-3 text-sm last:border-b-0"
                    key={`${todo.title}-${todo.due_date ?? "none"}`}
                  >
                    <span className="font-medium text-neutral-950">
                      {todo.title}
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      {todo.due_date ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {!hasReplyDraft && !calendarEvent && !hasTodos ? (
          <EmptyText>提案はありません。</EmptyText>
        ) : null}
      </div>
    </Section>
  );
}

function EvidencePanel({ evidenceItems }: { evidenceItems: EvidenceItem[] }) {
  return (
    <DisclosureSection
      title="Evidence"
      icon={<FileText className="size-4" />}
    >
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
    </DisclosureSection>
  );
}

function ReviewHistoryPanel({ events }: { events: ReviewEvent[] }) {
  return (
    <DisclosureSection
      title="Review History"
      icon={<Info className="size-4" />}
    >
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
    </DisclosureSection>
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
        const className = isConflict
          ? "bg-red-50 text-red-950"
          : isAvailable
            ? "bg-emerald-50 text-emerald-950"
            : "bg-neutral-100/70 text-neutral-800";
        const icon = isConflict ? (
          <AlertTriangle className="size-4 text-red-700" />
        ) : isAvailable ? (
          <CheckCircle2 className="size-4 text-emerald-700" />
        ) : (
          <Info className="size-4 text-neutral-500" />
        );

        return (
          <li
            className={`flex items-start gap-3 rounded-md p-4 leading-6 ${className}`}
            key={note}
          >
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{note}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SafetyPanel({ card }: { card: ActionCard }) {
  return (
    <Section
      title="Safety"
      icon={<ShieldCheck className="size-4" />}
    >
      <div className="space-y-4">
        <SafetyNoteList notes={card.safety_notes} />

        {card.missing_info.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">
              Missing Info
            </h3>
            <ul className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              {card.missing_info.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function AgentTracePanel({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <DisclosureSection
      title="Agent Trace"
      icon={<Info className="size-4" />}
    >
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
    </DisclosureSection>
  );
}

function ReviewPanel({
  card,
}: {
  card: ActionCard;
}) {
  return (
    <aside className="space-y-4">
      <Section title="Review">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone={card.status === "pending_review" ? "amber" : "neutral"}>
            {card.status}
          </Badge>
          <Badge tone={card.risk_level === "high" ? "red" : "neutral"}>
            {card.risk_level} risk
          </Badge>
        </div>
        <ReviewActions actionCardId={card.id} currentStatus={card.status} />
      </Section>

      <DisclosureSection
        title="Card Details"
        icon={<Info className="size-4" />}
      >
        <dl className="divide-y divide-neutral-100">
          <Field label="Priority" value={card.priority} />
          <Field label="Confidence" value={card.confidence.toFixed(2)} />
          <Field label="Approval" value={card.approval_required} />
          <Field label="Source" value={card.source_item_id} />
          <Field label="ID" value={card.id} />
        </dl>
      </DisclosureSection>

      <DisclosureSection title="Action Types" icon={<Info className="size-4" />}>
        <div className="flex flex-wrap gap-2">
          {card.actions.map((action) => (
            <Badge key={action}>{action}</Badge>
          ))}
        </div>
      </DisclosureSection>
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
    <main className="min-h-screen bg-[#f5f5f7] text-neutral-950">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur">
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

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <DecisionOverview card={card} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <ProposalPanel card={card} />
            <SafetyPanel card={card} />
            {sourceItem ? (
              <AgentRunPanel inboxItemId={sourceItem.id} />
            ) : null}
            <SourceMessagePanel item={sourceItem} />
            <div className="space-y-3">
              <EvidencePanel evidenceItems={evidenceItems} />
              <AgentTracePanel steps={agentSteps} />
              <ReviewHistoryPanel events={reviewEvents} />
            </div>
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ReviewPanel card={card} />
          </div>
        </div>
      </div>
    </main>
  );
}
