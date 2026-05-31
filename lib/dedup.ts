import { db, events, eventMentions, mentionCountToConfidence } from "@/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";

/**
 * Normalize a title for fuzzy deduplication:
 * lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type UpsertEventInput = {
  cityId: number;
  sourceId: number;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  venueName?: string | null;
  address?: string | null;
  neighborhoodId?: number | null;
  isFree: boolean;
  isKidFriendly: boolean;
  themes: string[];
  isMajor: boolean;
  imageUrl?: string | null;
  eventUrl?: string | null;
};

/**
 * Insert a new event or, if a duplicate is detected, record a new mention
 * and update the confidence score.
 *
 * Duplicate detection: same city + same normalized title + start date falls
 * on the same calendar day.
 *
 * Returns "inserted" | "merged".
 */
export async function upsertEvent(
  input: UpsertEventInput
): Promise<"inserted" | "merged"> {
  const normalized = normalizeTitle(input.title);
  const dayStart = startOfDay(input.startDate);
  const dayEnd = endOfDay(input.startDate);

  // Look for an existing event on the same day with the same normalized title
  const existing = await db.query.events.findFirst({
    where: and(
      eq(events.cityId, input.cityId),
      gte(events.startDate, dayStart),
      lte(events.startDate, dayEnd),
      sql`lower(regexp_replace(title, '[^a-zA-Z0-9 ]', '', 'g')) = ${normalized}`
    ),
  });

  if (existing) {
    // Record this source as a new mention (ignore if already exists)
    await db
      .insert(eventMentions)
      .values({ eventId: existing.id, sourceId: input.sourceId })
      .onConflictDoNothing();

    // Recount mentions and update confidence
    const mentions = await db.query.eventMentions.findMany({
      where: eq(eventMentions.eventId, existing.id),
    });
    const newCount = mentions.length;
    const newConfidence = mentionCountToConfidence(newCount);

    await db
      .update(events)
      .set({
        confidence: newConfidence,
        mentionCount: newCount,
        // Prefer populated fields from newer sources
        imageUrl: input.imageUrl ?? existing.imageUrl,
        eventUrl: input.eventUrl ?? existing.eventUrl,
        description: input.description ?? existing.description,
      })
      .where(eq(events.id, existing.id));

    return "merged";
  }

  // New event — insert and create the first mention
  const [inserted] = await db
    .insert(events)
    .values({
      ...input,
      confidence: "low",
      mentionCount: 1,
    })
    .returning({ id: events.id });

  await db
    .insert(eventMentions)
    .values({ eventId: inserted.id, sourceId: input.sourceId })
    .onConflictDoNothing();

  return "inserted";
}
