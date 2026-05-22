export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string | null;
  end: string | null;
  allDay?: boolean;
  htmlLink?: string | null;
  colorId?: string | null;
};

export type ChatMessage = {
  role: "user" | "model";
  content: string;
};
