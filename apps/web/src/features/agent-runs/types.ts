import type { AgentTraceStep } from "@/features/agent-trace/types";
import type { ActionCard } from "@/features/action-cards/types";
import type { EvidenceItem } from "@/features/evidence/types";

export type AgentRunGenerationMode =
  | "deterministic_template"
  | "gemini_assisted";

export type AgentRunRequest = {
  inbox_item_id: string;
};

export type AgentRunResult = {
  run_id: string;
  inbox_item_id: string;
  action_card: ActionCard;
  agent_steps: AgentTraceStep[];
  evidence_items: EvidenceItem[];
  llm_provider: "gemini";
  llm_model: string;
  llm_configured: boolean;
  generation_mode: AgentRunGenerationMode;
  fallback_reason?: string | null;
  created_at: string;
};
