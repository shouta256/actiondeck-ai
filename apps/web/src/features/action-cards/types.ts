export type ActionKind =
  | "draft_reply"
  | "propose_schedule"
  | "create_todo"
  | "save_for_later"
  | "ignore"
  | "request_missing_info";

export type Priority = "low" | "medium" | "high" | "urgent";

export type RiskLevel = "low" | "medium" | "high";

export type ActionCardStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "edited"
  | "rejected"
  | "completed";

export type TodoProposal = {
  title: string;
  due_date?: string;
};

export type CalendarEventProposal = {
  title: string;
  start: string;
  end: string;
  location?: string;
};

export type ActionProposal = {
  reply_draft?: string;
  calendar_event?: CalendarEventProposal;
  todos: TodoProposal[];
};

export type ActionCard = {
  schema_version: "1.0";
  id: string;
  source_item_id: string;
  title: string;
  actions: ActionKind[];
  priority: Priority;
  risk_level: RiskLevel;
  confidence: number;
  approval_required: boolean;
  status: ActionCardStatus;
  summary: string;
  proposal: ActionProposal;
  evidence_ids: string[];
  missing_info: string[];
  safety_notes: string[];
};
