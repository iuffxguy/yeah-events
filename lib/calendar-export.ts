import { parseEventDate } from "./format-date";
import type { Event } from "@/db/schema";

/** Format a Date as ICS local datetime string: YYYYMMDDTHHmmss */
function toIcsDate(date: Date | string): string {
  const d = parseEventDate(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/** Escape special chars in ICS text fields */
function icsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Download a .ics file for the event */
export function downloadIcs(event: Event) {
  const start = toIcsDate(event.startDate);
  const end = event.endDate ? toIcsDate(event.endDate) : start;

  const location = [event.venueName, event.address].filter(Boolean).join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yeah Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:yeah-${event.id}@yeahevents.com`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : "",
    location ? `LOCATION:${icsEscape(location)}` : "",
    event.eventUrl ? `URL:${event.eventUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Google Calendar "add event" URL */
export function googleCalendarUrl(event: Event): string {
  const start = toIcsDate(event.startDate);
  const end = event.endDate ? toIcsDate(event.endDate) : start;
  const location = [event.venueName, event.address].filter(Boolean).join(", ");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    ...(event.description && { details: event.description }),
    ...(location && { location }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
