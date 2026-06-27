import type {
  ActionCardStatus,
  ActionKind,
  Priority,
} from "@/features/action-cards/types";

export type ActionCardEvalCaseResult = {
  id: string;
  input_item_id: string;
  actual_action_card_id?: string | null;
  actions_match: boolean;
  priority_match: boolean;
  required_evidence_covered: boolean;
  expected_actions: ActionKind[];
  actual_actions: ActionKind[];
  expected_priority: Priority;
  actual_priority?: Priority | null;
  required_evidence_ids: string[];
  actual_evidence_ids: string[];
  missing_evidence_ids: string[];
  passed: boolean;
};

export type ActionCardEvalRunResult = {
  total_cases: number;
  passed_cases: number;
  action_match_rate: number;
  priority_match_rate: number;
  evidence_recall: number;
  cases: ActionCardEvalCaseResult[];
};

export type EvalStatus = Extract<ActionCardStatus, "completed" | "rejected">;
