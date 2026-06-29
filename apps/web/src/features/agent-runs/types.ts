import type { AgentTraceStep } from "@/features/agent-trace/types";
import type { ActionCard } from "@/features/action-cards/types";
import type { CalendarEvent } from "@/features/calendar-events/types";
import type { EvidenceItem } from "@/features/evidence/types";

export type AgentRunGenerationMode =
  | "deterministic_template"
  | "gemini_assisted";

export type AgentRunRequest = {
  inbox_item_id: string;
};

export type CalendarAvailabilityCandidate = {
  start: string;
  end: string;
  is_available: boolean;
  conflicting_events: CalendarEvent[];
};

export type CalendarAvailabilityReport = {
  candidates: CalendarAvailabilityCandidate[];
  inspected_event_count: number;
  fallback_reason?: string | null;
};

export type AgentRunResult = {
  run_id: string;
  inbox_item_id: string;
  action_card: ActionCard;
  agent_steps: AgentTraceStep[];
  evidence_items: EvidenceItem[];
  calendar_availability?: CalendarAvailabilityReport | null;
  llm_provider: "gemini";
  llm_model: string;
  llm_configured: boolean;
  generation_mode: AgentRunGenerationMode;
  fallback_reason?: string | null;
  created_at: string;
};
