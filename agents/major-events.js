/**
 * Agent 3 — Major Events
 *
 * Same scrape-and-extract pipeline as scrape-events.js, but targets
 * events 3–6 months out and marks them is_major=true.
 * Intended for festivals, concerts, sporting events, and other large
 * draws that benefit from early calendar placement.
 *
 * Schedule: 1st of each month at 2am (see crontab)
 * Run manually: node major-events.js [--source-id 42]
 */

import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { addMonths, startOfDay } from "date-fns";
import { db, cities, neighborhoods, eventSources, events, eventMentions, normalizeTitle, mentionCountToConfidence } from "./db.js";
import { askForJson } from "./ollama.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const VALID_THEMES = [
  "music", "art", "food", "sports", "family", "comedy",
  "outdoor", "market", "festival", "film", "theater", "dance", "technology",
];

// ---------------------------------------------------------------------------
// HTML extraction (same as scrape-events.js)
// ---------------------------------------------------------------------------

const BOILERPLATE = [
  "script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "aside",
  "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  ".nav", ".navbar", ".header", ".footer", ".sidebar",
  ".cookie", ".cookie-banner", ".ad", ".ads", ".advertisement",
  ".popup", ".breadcrumb", ".social-share",
  "#nav", "#header", "#footer", "#sidebar",
].join(", ");

const CONTENT_CANDIDATES = [
  "main", "[role='main']", "#main", "#content", "#main-content",
  ".main-content", ".events", ".event-list", ".event-listing",
  ".event-listings", "#events", "#event-list", "article", ".content",
];

function extractContent(html) {
  const $ = cheerio.load(html);

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (parsed?.["@graph"]) jsonLd.push(...parsed["@graph"]);
      else jsonLd.push(parsed);
    } catch {}
  });

  $(BOILERPLATE).remove();

  let contentSel = "body";
  for (const sel of CONTENT_CANDIDATES) {
    const $c = $(sel).first();
    if ($c.length && $c.text().trim().length > 200) {
      contentSel = sel;
      break;
    }
  }

  const rawText = $(contentSel)
    .find("*")
    .addBack()
    .map((_, el) => $(el).clone().children().remove().end().text().trim())
    .get()
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 6000);

  const eventLd = jsonLd.filter(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      ["Event", "SportsEvent", "MusicEvent", "FoodEvent", "TheaterEvent"].includes(
        item["@type"]
      )
  );

  const parts = [];
  if (eventLd.length > 0) {
    parts.push("STRUCTURED DATA (JSON-LD):");
    parts.push(JSON.stringify(eventLd).slice(0, 8000));
  }
  if (rawText) {
    parts.push("PAGE TEXT:");
    parts.push(rawText);
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Playwright scraper
// ---------------------------------------------------------------------------

async function scrapePage(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ "User-Agent": UA });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_000);
    const html = await page.content();
    return extractContent(html);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Event upsert (same logic as scrape-events.js, is_major=true)
// ---------------------------------------------------------------------------

async function upsertEvent(input) {
  const normalized = normalizeTitle(input.title);
  const dayStart = startOfDay(input.startDate);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);

  const existing = await db.query.events.findFirst({
    where: and(
      eq(events.cityId, input.cityId),
      gte(events.startDate, dayStart),
      lte(events.startDate, dayEnd),
      sql`lower(regexp_replace(title, '[^a-zA-Z0-9 ]', '', 'g')) = ${normalized}`
    ),
  });

  if (existing) {
    await db
      .insert(eventMentions)
      .values({ eventId: existing.id, sourceId: input.sourceId })
      .onConflictDoNothing();

    const mentions = await db.query.eventMentions.findMany({
      where: eq(eventMentions.eventId, existing.id),
    });
    const newCount = mentions.length;

    await db
      .update(events)
      .set({
        confidence: mentionCountToConfidence(newCount),
        mentionCount: newCount,
        isMajor: true, // promote to major if found again
        imageUrl: input.imageUrl ?? existing.imageUrl,
        eventUrl: input.eventUrl ?? existing.eventUrl,
        description: input.description ?? existing.description,
      })
      .where(eq(events.id, existing.id));

    return "merged";
  }

  const inserted = await db
    .insert(events)
    .values({ ...input, confidence: "low", mentionCount: 1 })
    .onConflictDoNothing()
    .returning({ id: events.id });

  if (inserted.length === 0) {
    const winner = await db.query.events.findFirst({
      where: and(
        eq(events.cityId, input.cityId),
        gte(events.startDate, dayStart),
        lte(events.startDate, dayEnd),
        sql`lower(regexp_replace(title, '[^a-zA-Z0-9 ]', '', 'g')) = ${normalized}`
      ),
    });
    if (winner) {
      await db
        .insert(eventMentions)
        .values({ eventId: winner.id, sourceId: input.sourceId })
        .onConflictDoNothing();
    }
    return "merged";
  }

  await db
    .insert(eventMentions)
    .values({ eventId: inserted[0].id, sourceId: input.sourceId })
    .onConflictDoNothing();

  return "inserted";
}

// ---------------------------------------------------------------------------
// Process one source
// ---------------------------------------------------------------------------

async function processSource(browser, source, city, hoods) {
  console.log(`[major-events] Scraping: ${source.url}`);

  let payload;
  try {
    payload = await scrapePage(browser, source.url);
  } catch (err) {
    console.error(`[major-events]   fetch error: ${err.message}`);
    return { inserted: 0, merged: 0, error: err.message };
  }

  if (!payload.trim()) {
    console.log(`[major-events]   empty page, skipping`);
    return { inserted: 0, merged: 0 };
  }

  const now = startOfDay(new Date());
  const windowStart = addMonths(now, 3);
  const windowEnd = addMonths(now, 6);
  const hoodNames = hoods.map((h) => h.name).join(", ");

  let parsed = [];
  try {
    parsed = await askForJson(
      "You are an event data extraction specialist focused on major upcoming events. Extract large-scale events from the provided page content and return structured JSON only.",
      `Extract MAJOR upcoming events happening between ${windowStart.toISOString()} and ${windowEnd.toISOString()}.
City: ${city.name} (timezone: America/New_York)
Known neighborhoods: ${hoodNames}

Focus ONLY on major events: festivals, concerts with named performers, sporting events, large community gatherings, fairs, air shows, marathons, conventions.
Skip small recurring events (weekly trivia, monthly book clubs, etc.).

For each event return:
- title
- description: 2-3 sentence human-readable summary of what makes this event notable
- start_date: local time as ISO 8601 without timezone offset, e.g. "2026-09-15T12:00:00". Use noon if time unknown.
- end_date: same format, optional (for multi-day events this is the last day)
- venue_name, address
- neighborhood: match to known neighborhoods list if possible
- is_free (boolean), is_kid_friendly (boolean)
- themes: array from ONLY these tags: ${VALID_THEMES.join(", ")}. Max 3.
- image_url (if present), event_url (direct link if present)

Rules:
- No duplicates
- Only events physically in or directly associated with ${city.name}

Return a JSON array. If no major events found in this window, return [].

${payload}`
    );
  } catch (err) {
    console.error(`[major-events]   Ollama error: ${err.message}`);
    return { inserted: 0, merged: 0, error: err.message };
  }

  let inserted = 0;
  let merged = 0;

  for (const e of parsed) {
    if (!e.title || !e.start_date) continue;

    let startDate;
    try {
      startDate = new Date(e.start_date);
      if (isNaN(startDate.getTime())) continue;
      // Only accept events in the 3-6 month window
      if (startDate < windowStart || startDate > windowEnd) continue;
    } catch {
      continue;
    }

    const hood = hoods.find(
      (h) =>
        h.name.toLowerCase() === (e.neighborhood ?? "").toLowerCase() ||
        h.slug === (e.neighborhood ?? "").toLowerCase().replace(/\s+/g, "-")
    );

    const validThemes = (e.themes ?? []).filter((t) => VALID_THEMES.includes(t));

    try {
      const result = await upsertEvent({
        cityId: source.cityId,
        sourceId: source.id,
        title: e.title,
        description: e.description ?? null,
        startDate,
        endDate: e.end_date ? new Date(e.end_date) : null,
        venueName: e.venue_name ?? null,
        address: e.address ?? null,
        neighborhoodId: hood?.id ?? null,
        isFree: Boolean(e.is_free),
        isKidFriendly: Boolean(e.is_kid_friendly),
        themes: validThemes,
        isMajor: true,
        imageUrl: e.image_url ?? null,
        eventUrl: e.event_url ?? null,
      });

      if (result === "inserted") inserted++;
      else merged++;
    } catch (err) {
      console.error(`[major-events]   upsert error for "${e.title}":`, err.message);
    }
  }

  await db
    .update(eventSources)
    .set({ lastChecked: new Date() })
    .where(eq(eventSources.id, source.id));

  console.log(
    `[major-events]   done: ${inserted} inserted, ${merged} merged (${parsed.length} extracted)`
  );
  return { inserted, merged };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const sourceIdArg = process.argv.find((a) => a.startsWith("--source-id="))?.split("=")[1];

  const activeSources = sourceIdArg
    ? await db.query.eventSources.findMany({
        where: and(eq(eventSources.active, true), eq(eventSources.id, Number(sourceIdArg))),
      })
    : await db.query.eventSources.findMany({ where: eq(eventSources.active, true) });

  if (activeSources.length === 0) {
    console.log("[major-events] No active sources found.");
    return;
  }

  console.log(`[major-events] Processing ${activeSources.length} sources for major events (3–6 months out)`);

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });

  let totalInserted = 0;
  let totalMerged = 0;

  try {
    for (const source of activeSources) {
      const city = await db.query.cities.findFirst({ where: eq(cities.id, source.cityId) });
      if (!city) continue;

      const hoods = await db.query.neighborhoods.findMany({
        where: eq(neighborhoods.cityId, source.cityId),
      });

      const result = await processSource(browser, source, city, hoods);
      totalInserted += result.inserted ?? 0;
      totalMerged += result.merged ?? 0;

      await new Promise((r) => setTimeout(r, 2_000));
    }
  } finally {
    await browser.close();
  }

  console.log(
    `[major-events] Done. Total: ${totalInserted} inserted, ${totalMerged} merged`
  );
}

main().catch((err) => {
  console.error("[major-events] Fatal:", err);
  process.exit(1);
});
