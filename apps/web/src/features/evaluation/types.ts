import type {
  ActionCardStatus,
  ActionKind,
  Priority,
} from "@/features/action-cards/types";

export type ActionCardEvalMode = "deterministic" | "gemini";
export type AgentRoute =
  | "conflicting_evidence"
  | "ignore"
  | "low_risk_todo"
  | "missing_info"
  | "review_required";

export type ActionCardEvalCaseResult = {
  id: string;
  input_item_id: string;
  actual_action_card_id?: string | null;
  actions_match: boolean;
  priority_match: boolean;
  approval_required_match: boolean;
  missing_info_match: boolean;
  generation_mode_match: boolean;
  route_match: boolean;
  unsafe_action_count_match: boolean;
  required_evidence_covered: boolean;
  schema_valid: boolean;
  agent_steps_completed: boolean;
  expected_actions: ActionKind[];
  actual_actions: ActionKind[];
  expected_priority: Priority;
  actual_priority?: Priority | null;
  expected_approval_required?: boolean | null;
  actual_approval_required?: boolean | null;
  expected_missing_info: string[];
  actual_missing_info: string[];
  required_evidence_ids: string[];
  actual_evidence_ids: string[];
  missing_evidence_ids: string[];
  expected_generation_mode?: "deterministic_template" | "gemini_assisted" | null;
  generation_mode?: "deterministic_template" | "gemini_assisted" | null;
  fallback_reason?: string | null;
  expected_route?: AgentRoute | null;
  actual_route?: AgentRoute | null;
  expected_unsafe_action_count: number;
  actual_unsafe_action_count: number;
  failure_reasons: string[];
  passed: boolean;
};

export type ActionCardEvalRunResult = {
  mode: ActionCardEvalMode;
  llm_configured: boolean;
  gemini_assisted_cases: number;
  deterministic_template_cases: number;
  total_cases: number;
  passed_cases: number;
  action_match_rate: number;
  priority_match_rate: number;
  approval_match_rate: number;
  missing_info_match_rate: number;
  generation_mode_match_rate: number;
  route_match_rate: number;
  unsafe_action_match_rate: number;
  schema_valid_rate: number;
  evidence_recall: number;
  cases: ActionCardEvalCaseResult[];
};

export type EvalStatus = Extract<ActionCardStatus, "completed" | "rejected">;
