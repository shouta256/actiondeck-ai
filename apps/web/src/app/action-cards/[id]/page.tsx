import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  MessageSquare,
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

function SourceMessagePanel({ item }: { item: InboxItem | null }) {
  return (
    <Section
      title="メール内容"
      description="この内容をAIが読み取り、対応案を作ります。"
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
          <p className="mt-4 whitespace-pre-wrap rounded-md bg-neutral-100/70 p-4 text-[15px] leading-7 text-neutral-700">
            {item.body}
          </p>
        </div>
      ) : (
        <EmptyText>元メッセージを表示できません。</EmptyText>
      )}
    </Section>
  );
}

function EvidencePanel({ evidenceItems }: { evidenceItems: EvidenceItem[] }) {
  return (
    <DisclosureSection
      title="保存済みの根拠"
      description="保存済みAction Cardに紐づく根拠です。"
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

function AgentTracePanel({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <DisclosureSection
      title="保存済みの処理履歴"
      description="保存済みAction Cardに紐づく履歴です。ボタン実行後の最新履歴は「AIが実行した最新結果」に表示されます。"
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

function SavedCardArchive({
  card,
  evidenceItems,
  agentSteps,
  reviewEvents,
}: {
  card: ActionCard;
  evidenceItems: EvidenceItem[];
  agentSteps: AgentTraceStep[];
  reviewEvents: ReviewEvent[];
}) {
  return (
    <DisclosureSection
      title="保存済みカード・レビュー"
      description="事前に保存されているカード情報です。通常は上のAI生成結果だけ見れば十分です。"
      icon={<Info className="size-4" />}
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-950">
            保存済みの対応案
          </h3>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            {card.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.actions.map((action) => (
              <Badge key={action}>{action}</Badge>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-950">
            保存済みの安全メモ
          </h3>
          <div className="mt-3">
            <SafetyNoteList notes={card.safety_notes} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-950">
            レビュー状態
          </h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            ここで変わるのはレビュー状態だけです。メール送信や予定登録は行いません。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={card.status === "pending_review" ? "amber" : "neutral"}>
              {card.status}
            </Badge>
            <Badge tone={card.risk_level === "high" ? "red" : "neutral"}>
              {card.risk_level} risk
            </Badge>
          </div>
          <div className="mt-4 max-w-sm">
            <ReviewActions actionCardId={card.id} currentStatus={card.status} />
          </div>
        </div>

        <details className="group border-t border-neutral-100 pt-4">
          <summary className="flex cursor-pointer list-none justify-between gap-4 text-sm font-semibold text-neutral-950">
            <span>根拠・保存済みログ・レビュー履歴</span>
            <span className="text-blue-600">
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <EvidencePanel evidenceItems={evidenceItems} />
            <AgentTracePanel steps={agentSteps} />
            <ReviewHistoryPanel events={reviewEvents} />
          </div>
        </details>
      </div>
    </DisclosureSection>
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

      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-950">
            メールから対応案を作成
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            メール内容を確認し、AIで対応案を作ります。結果はボタンの下に表示されます。
          </p>
        </div>

        <div className="space-y-5">
          <SourceMessagePanel item={sourceItem} />
          {sourceItem ? <AgentRunPanel inboxItemId={sourceItem.id} /> : null}
          <SavedCardArchive
            agentSteps={agentSteps}
            card={card}
            evidenceItems={evidenceItems}
            reviewEvents={reviewEvents}
          />
        </div>
      </div>
    </main>
  );
}
