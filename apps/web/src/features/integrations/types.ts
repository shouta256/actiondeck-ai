export type GoogleCalendarOAuthStartResponse = {
  authorization_url: string;
  state: string;
  scopes: string[];
};

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  provider: "google_calendar";
  scopes: string[];
  expires_at?: string | null;
  updated_at?: string | null;
};

export type GoogleCalendarSyncResult = {
  calendar_id: string;
  time_min: string;
  time_max: string;
  synced_count: number;
  event_ids: string[];
};
