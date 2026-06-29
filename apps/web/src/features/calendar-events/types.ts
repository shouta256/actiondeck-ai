export type CalendarEvent = {
  id: string;
  calendar_id: string;
  title: string;
  start: string;
  end: string;
  location?: string | null;
  source: string;
};
