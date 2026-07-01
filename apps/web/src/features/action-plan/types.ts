import type {
  ActionCardStatus,
  ActionKind,
  Priority,
  RiskLevel,
} from "@/features/action-cards/types";

export type ActionPlanEffort = "low" | "medium" | "high";

export type ActionPlanItem = {
  rank: number;
  action_card_id: string;
  source_item_id: string;
  title: string;
  summary: string;
  actions: ActionKind[];
  priority: Priority;
  risk_level: RiskLevel;
  status: ActionCardStatus;
  score: number;
  estimated_minutes: number;
  effort: ActionPlanEffort;
  next_action: string;
  reason: string;
  blockers: string[];
};

export type ActionPlan = {
  generated_at: string;
  summary: string;
  processed_inbox_count: number;
  action_card_count: number;
  agent_run_ids: string[];
  llm_configured: boolean | null;
  generation_modes: Record<string, number>;
  items: ActionPlanItem[];
  quick_wins: ActionPlanItem[];
};
