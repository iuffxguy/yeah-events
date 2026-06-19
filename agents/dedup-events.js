/**
 * Agent 4 — Dedup Events
 *
 * Runs after scrape-events / major-events. The upsert dedup in those agents
 * only catches exact-ish title matches on the same day, so it misses the
 * same real-world event listed under different wording (e.g. one source
 * says "Live Jazz Night" and another says "Jazz at the Underground"), or
 * the same event posted twice with different time slots.
 *
 * For each city, groups upcoming events by calendar day and asks Ollama to
 * spot duplicate groups within each day. Duplicates are merged into a single
 * canonical event: mentions move over, missing fields are backfilled, and
 * confidence is recalculated from the combined mention count.
 *
 * Window: next 200 days (covers both scrape-events' 14-day window and
 * major-events' 3-6 month window)
 * Schedule: Sundays at 4am, one hour after scrape-events (see crontab)
 * Run manually: node dedup-events.js
 */

import { db, cities, events, eventMentions, mentionCountToConfidence, normalizeTitle } from "./db.js";
import { askForJson } from "./ollama.js";
import { eq, and, gte, lte, asc, inArray } from "drizzle-orm";
import { addDays, startOfDay } from "date-fns";

// Max candidates sent to Ollama in a single prompt. Big event days (e.g.
// holidays) can have 50+ events — cramming them all into one prompt makes
// the model miss duplicates buried in the list, so we chunk instead.
const OLLAMA_CHUNK_SIZE = 20;

// ---------------------------------------------------------------------------
// Ollama duplicate detection
// ---------------------------------------------------------------------------

async function findDuplicateGroups(candidates) {
  if (candidates.length < 2) return [];

  const list = candidates
    .map((c, i) => `${i}: "${c.title}"${c.venueName ? ` @ ${c.venueName}` : ""}`)
    .join("\n");

  const result = await askForJson(
    "You identify duplicate event listings scraped from different websites. Two listings are duplicates only if they describe the exact same real-world event occurrence, even if the wording, venue formatting, or listed time differs. Do not group together different events that merely share a venue or category.",
    `These events are all happening on the same day, in the same city:\n${list}\n\nReturn a JSON array of duplicate groups. Each group is an array of the index numbers above that refer to the same real-world event. Only include groups with 2 or more indices — omit events that are unique. Example: [[0,2],[1,4]]. If there are no duplicates, return [].`
  );

  return Array.isArray(result) ? result : [];
}

// ---------------------------------------------------------------------------
// Merge a group of duplicate event rows into one canonical event
// ---------------------------------------------------------------------------

async function mergeGroup(ids) {
  const full = await db.query.events.findMany({
    where: inArray(events.id, ids),
  });
  if (full.length < 2) return full[0] ?? null;

  // Canonical = most-mentioned, tie-broken by oldest (lowest id)
  full.sort((a, b) => b.mentionCount - a.mentionCount || a.id - b.id);
  const [canonical, ...losers] = full;

  const merged = {
    description: canonical.description,
    imageUrl: canonical.imageUrl,
    eventUrl: canonical.eventUrl,
    venueId: canonical.venueId,
    venueName: canonical.venueName,
    address: canonical.address,
  };

  for (const loser of losers) {
    merged.description ??= loser.description;
    merged.imageUrl ??= loser.imageUrl;
    merged.eventUrl ??= loser.eventUrl;
    merged.venueId ??= loser.venueId;
    merged.venueName ??= loser.venueName;
    merged.address ??= loser.address;

    const mentions = await db.query.eventMentions.findMany({
      where: eq(eventMentions.eventId, loser.id),
    });
    for (const m of mentions) {
      await db
        .insert(eventMentions)
        .values({ eventId: canonical.id, sourceId: m.sourceId })
        .onConflictDoNothing();
    }

    await db.delete(events).where(eq(events.id, loser.id));
  }

  const allMentions = await db.query.eventMentions.findMany({
    where: eq(eventMentions.eventId, canonical.id),
  });
  const mentionCount = allMentions.length;

  await db
    .update(events)
    .set({ ...merged, mentionCount, confidence: mentionCountToConfidence(mentionCount) })
    .where(eq(events.id, canonical.id));

  console.log(
    `[dedup-events]   merged ${losers.length} duplicate(s) into "${canonical.title}" (id ${canonical.id})`
  );

  return { ...canonical, ...merged, mentionCount };
}

// ---------------------------------------------------------------------------
// Exact-title pre-pass — catches byte/normalized-identical duplicates
// (e.g. from overlapping scrape runs racing past the upsert dedup check)
// without needing an Ollama call at all.
// ---------------------------------------------------------------------------

async function exactDedup(dayEvents) {
  const byNormalizedTitle = new Map();
  for (const e of dayEvents) {
    const key = normalizeTitle(e.title);
    if (!byNormalizedTitle.has(key)) byNormalizedTitle.set(key, []);
    byNormalizedTitle.get(key).push(e);
  }

  const survivors = [];
  let merged = 0;

  for (const group of byNormalizedTitle.values()) {
    if (group.length < 2) {
      survivors.push(group[0]);
      continue;
    }
    const ids = group.map((e) => e.id);
    try {
      const canonical = await mergeGroup(ids);
      survivors.push(canonical ?? group[0]);
      merged += ids.length - 1;
    } catch (err) {
      console.error(`[dedup-events]   exact-merge error:`, err.message);
      survivors.push(group[0]);
    }
  }

  return { survivors, merged };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const activeCities = await db.query.cities.findMany({ where: eq(cities.active, true) });

  const windowStart = startOfDay(new Date());
  const windowEnd = addDays(windowStart, 200);

  let totalMerged = 0;

  for (const city of activeCities) {
    const cityEvents = await db.query.events.findMany({
      where: and(
        eq(events.cityId, city.id),
        gte(events.startDate, windowStart),
        lte(events.startDate, windowEnd)
      ),
      orderBy: asc(events.startDate),
    });

    // Bucket events by calendar day
    const byDay = new Map();
    for (const e of cityEvents) {
      const key = startOfDay(e.startDate).toISOString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(e);
    }

    for (const [day, dayEvents] of byDay) {
      if (dayEvents.length < 2) continue;

      // Pass 1: merge exact/normalized-identical titles with plain code
      const { survivors, merged: exactMerged } = await exactDedup(dayEvents);
      totalMerged += exactMerged;

      if (survivors.length < 2) continue;

      // Pass 2: ask Ollama to spot near-duplicates among what's left,
      // chunked so big event days don't overwhelm a single prompt
      for (const batch of chunk(survivors, OLLAMA_CHUNK_SIZE)) {
        if (batch.length < 2) continue;

        const candidates = batch.map((e) => ({
          id: e.id,
          title: e.title,
          venueName: e.venueName,
        }));

        let groups;
        try {
          groups = await findDuplicateGroups(candidates);
        } catch (err) {
          console.error(`[dedup-events] Ollama error for ${city.name} ${day}:`, err.message);
          continue;
        }

        for (const group of groups) {
          if (!Array.isArray(group) || group.length < 2) continue;
          const ids = group.map((i) => candidates[i]?.id).filter(Boolean);
          if (ids.length < 2) continue;

          try {
            await mergeGroup(ids);
            totalMerged += ids.length - 1;
          } catch (err) {
            console.error(`[dedup-events]   merge error:`, err.message);
          }
        }
      }
    }
  }

  console.log(`[dedup-events] Done. Merged ${totalMerged} duplicate event(s).`);
}

main().catch((err) => {
  console.error("[dedup-events] Fatal:", err);
  process.exit(1);
});
