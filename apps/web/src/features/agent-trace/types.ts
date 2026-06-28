export type AgentStepName =
  | "triage"
  | "evidence_retrieval"
  | "action_planning"
  | "safety_check"
  | "approval_gate";

export type AgentStepStatus = "completed" | "skipped" | "failed";

export type AgentToolCall = {
  name: string;
  input_summary: string;
  output_summary: string;
};

export type AgentTokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type AgentTraceStep = {
  action_card_id: string;
  sequence: number;
  step_name: AgentStepName;
  status: AgentStepStatus;
  input_summary: string;
  output_summary: string;
  tool_calls: AgentToolCall[];
  latency_ms: number;
  token_usage?: AgentTokenUsage | null;
};
