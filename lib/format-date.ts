/**
 * Parse an event date for display.
 *
 * Event times are stored in UTC but represent the city's LOCAL time
 * (Claude returns local times, we store them without timezone conversion).
 * Stripping the Z causes the browser to treat the value as local time,
 * which gives the correct display.
 */
export function parseEventDate(date: Date | string): Date {
  const iso = typeof date === "string" ? date : date.toISOString();
  // Remove timezone indicator so the browser treats it as local time
  return new Date(iso.replace("Z", "").replace(/[+-]\d{2}:\d{2}$/, ""));
}
