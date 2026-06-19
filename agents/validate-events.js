/**
 * Agent 5 — Validate Events (DRY RUN — logs candidates, writes nothing)
 *
 * Status: disabled from the cron schedule and from writing to the DB.
 * Two prior approaches both wrongly flagged well-known, definitely-real
 * shows (Chris Stapleton, George Lopez, Charlotte Symphony, etc.) as bad:
 *
 *   1. An Ollama content-relevance check against plain fetch() HTML — most
 *      ticketing sites are client-rendered SPAs, so static HTML has none
 *      of the real content, and the model was correctly judging garbage.
 *   2. Even restricted to confirmed-dead signals only (404/410 or a
 *      network-level failure), major ticketing platforms (Ticketmaster
 *      etc.) appear to bot-block or hang on plain server-side requests
 *      from this box, which then reads as "dead" when it isn't.
 *
 * Both rounds caused real damage (cleared dozens of legitimate links in
 * prod, recovered via re-running scrape-events.js to backfill). Don't
 * re-enable DB writes here, and don't re-add this to crontab, until the
 * detection approach is fixed — most likely by checking links through
 * Playwright (same as the scrapers use) instead of a bare fetch, since
 * that's what's actually getting through these sites' bot detection
 * elsewhere in this codebase.
 *
 * Window: next 30 days (closer-in events matter most; keeps runtime bounded)
 * Run manually: node validate-events.js
 */

import { db, cities, events } from "./db.js";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { addDays, startOfDay } from "date-fns";

const FETCH_TIMEOUT = 10_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Image link check — same conservative rule as event links: only flag
// confirmed-dead (404/410), since some CDNs reject HEAD with a 405 even
// when the image is fine via GET.
// ---------------------------------------------------------------------------

async function isValidImageUrl(url) {
  try {
    let res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": UA },
    });
    if (res.status === 405) {
      res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: { "User-Agent": UA },
      });
    }
    if (res.status === 404 || res.status === 410) return false;
    if (!res.ok) return true; // can't confirm dead, leave alone
    const type = res.headers.get("content-type") ?? "";
    return type === "" || type.startsWith("image/");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event link check — only flag confirmed dead links. Many ticketing sites
// (Ticketmaster, etc.) return 403/429/503 to plain server-side requests as
// bot-detection, not because the link is actually broken — only a genuine
// network failure or 404/410 counts as dead, everything else is left alone.
// ---------------------------------------------------------------------------

async function isValidEventUrl(event) {
  try {
    const res = await fetch(event.eventUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": UA },
    });
    return res.status !== 404 && res.status !== 410;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const activeCities = await db.query.cities.findMany({ where: eq(cities.active, true) });
  const cityIds = activeCities.map((c) => c.id);

  const windowStart = startOfDay(new Date());
  const windowEnd = addDays(windowStart, 30);

  const candidates = await db.query.events.findMany({
    where: and(
      inArray(events.cityId, cityIds),
      gte(events.startDate, windowStart),
      lte(events.startDate, windowEnd)
    ),
  });

  console.log(`[validate-events] Checking ${candidates.length} events (DRY RUN — no writes)`);

  let urlFlags = 0;
  let imageFlags = 0;

  for (const event of candidates) {
    if (event.eventUrl) {
      const ok = await isValidEventUrl(event);
      if (!ok) {
        urlFlags++;
        console.log(`[validate-events]   would clear eventUrl for "${event.title}" (id ${event.id}): ${event.eventUrl}`);
      }
    }

    if (event.imageUrl) {
      const ok = await isValidImageUrl(event.imageUrl);
      if (!ok) {
        imageFlags++;
        console.log(`[validate-events]   would clear imageUrl for "${event.title}" (id ${event.id}): ${event.imageUrl}`);
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `[validate-events] Done. Would have cleared ${urlFlags} event link(s), ${imageFlags} image(s). No writes made.`
  );
}

main().catch((err) => {
  console.error("[validate-events] Fatal:", err);
  process.exit(1);
});
