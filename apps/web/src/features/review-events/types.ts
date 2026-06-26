import type {
  ActionCardReviewStatus,
  ActionCardStatus,
} from "@/features/action-cards/types";

export type ReviewActor = "user";

export type ReviewEvent = {
  id: string;
  action_card_id: string;
  from_status: ActionCardStatus;
  to_status: ActionCardReviewStatus;
  actor: ReviewActor;
  created_at: string;
  note?: string | null;
  schema_version: "1.0";
};
