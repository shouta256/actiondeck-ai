export type EvidenceSourceType =
  | "personal_note"
  | "calendar_mock"
  | "document"
  | "past_email"
  | "inbox_item";

export type EvidenceItem = {
  id: string;
  source_type: EvidenceSourceType;
  source_id: string;
  title: string;
  snippet: string;
  relevance_score: number;
  used_for: string;
  chunk_id: string;
};
