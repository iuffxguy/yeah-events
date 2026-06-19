/**
 * Agent 5 — Validate Events
 *
 * Spot-checks eventUrl / imageUrl on upcoming events. Catches two failure
 * modes scraping produces:
 *   1. Dead links — fetch fails or returns a non-2xx status.
 *   2. Wrong-page links — the URL resolves fine but points at a venue's
 *      homepage or a generic listings page instead of the specific event
 *      (e.g. "Godfrey at The Comedy Zone" linking to thecomedyzonecharlotte.com/
 *      instead of that show's page). Ollama checks the fetched page text
 *      against the event's title/venue/date to catch this.
 *
 * Bad links are cleared (set to null) rather than guessed at — the agents
 * don't track per-source page URLs to fall back to, and no link is better
 * than a misleading one.
 *
 * Window: next 30 days (closer-in events matter most; keeps runtime bounded)
 * Schedule: Every 2 days at 5am, after dedup-events (see crontab)
 * Run manually: node validate-events.js
 */

import * as cheerio from "cheerio";
import { db, cities, events } from "./db.js";
import { askForJson } from "./ollama.js";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { addDays, startOfDay } from "date-fns";

const FETCH_TIMEOUT = 10_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Image link check — just needs to resolve to an actual image
// ---------------------------------------------------------------------------

async function isValidImageUrl(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    return type.startsWith("image/");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event link check — must resolve AND describe this specific event
// ---------------------------------------------------------------------------

async function fetchPageSnippet(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`status ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);
  return `Page title: ${title}\nPage text: ${bodyText}`;
}

async function isRelevantLink(snippet, event) {
  const result = await askForJson(
    "You verify whether a webpage actually describes a specific event, rather than being a generic homepage, category listing, or unrelated page.",
    `Event: "${event.title}"${event.venueName ? ` at ${event.venueName}` : ""} on ${event.startDate.toISOString().slice(0, 10)}

Webpage content:
${snippet}

Does this webpage specifically describe this event (not just the venue in general, or a generic listings/homepage)? Return JSON: {"relevant": true} or {"relevant": false}.`
  );
  return Boolean(result?.relevant);
}

async function isValidEventUrl(event) {
  let snippet;
  try {
    snippet = await fetchPageSnippet(event.eventUrl);
  } catch {
    return false; // unreachable / non-2xx — bad link
  }

  try {
    return await isRelevantLink(snippet, event);
  } catch {
    return true; // Ollama hiccup — don't penalize the link for that
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Data hygiene: scraped empty strings should be null, same as never set
  await db.update(events).set({ eventUrl: null }).where(eq(events.eventUrl, ""));
  await db.update(events).set({ imageUrl: null }).where(eq(events.imageUrl, ""));

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

  console.log(`[validate-events] Checking ${candidates.length} events`);

  let urlsCleared = 0;
  let imagesCleared = 0;

  for (const event of candidates) {
    if (event.eventUrl) {
      const ok = await isValidEventUrl(event);
      if (!ok) {
        await db.update(events).set({ eventUrl: null }).where(eq(events.id, event.id));
        urlsCleared++;
        console.log(`[validate-events]   cleared bad eventUrl for "${event.title}" (id ${event.id})`);
      }
    }

    if (event.imageUrl) {
      const ok = await isValidImageUrl(event.imageUrl);
      if (!ok) {
        await db.update(events).set({ imageUrl: null }).where(eq(events.id, event.id));
        imagesCleared++;
        console.log(`[validate-events]   cleared bad imageUrl for "${event.title}" (id ${event.id})`);
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `[validate-events] Done. Cleared ${urlsCleared} event link(s), ${imagesCleared} image(s).`
  );
}

main().catch((err) => {
  console.error("[validate-events] Fatal:", err);
  process.exit(1);
});
