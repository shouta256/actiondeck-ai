export type InboxChannel = "email" | "line" | "slack";

export type InboxItem = {
  id: string;
  channel: InboxChannel;
  sender_name: string;
  sender_address?: string | null;
  subject: string;
  received_at: string;
  body: string;
};
