/**
 * Agent 1 — Discover Event Sources
 *
 * For each active city, asks Ollama to suggest event listing websites,
 * validates that each URL is reachable, and writes new ones to event_sources.
 *
 * Schedule: Sundays at 1am (see crontab)
 * Run manually: node discover-sources.js [--city charlotte]
 */

import { db, cities, neighborhoods, eventSources } from "./db.js";
import { askForJson } from "./ollama.js";
import { eq, and } from "drizzle-orm";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// URL reachability check
// ---------------------------------------------------------------------------

async function isReachable(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (res.ok || res.status === 403) return true;
    // Some servers reject HEAD — retry with GET
    if (res.status === 405 || res.status === 404) {
      const get = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8_000),
        redirect: "follow",
      });
      return get.ok || get.status === 403;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Per-city source discovery
// ---------------------------------------------------------------------------

async function discoverForCity(city, hoods) {
  const hoodNames = hoods.map((h) => h.name);
  let added = 0;
  let rejected = 0;

  // --- City-wide pass ---
  let cityResults = [];
  try {
    cityResults = await askForJson(
      "You are an expert researcher who finds event listing websites for cities. You only return real, publicly accessible URLs.",
      `Find 15 high-quality event listing websites for ${city.name} that list specific upcoming events with dates.

Prioritize: local newspapers/magazines with event sections, tourism boards, Eventbrite/Meetup city pages, parks & rec calendars, arts org calendars.
Avoid: national sites, anything requiring login or payment.

Known neighborhoods to look for: ${hoodNames.join(", ")}

Return a JSON array only — no prose:
[{ "url": "https://...", "source_type": "website" | "api" | "rss", "notes": "brief description" }]

Link directly to events/calendar pages, not homepages.`
    );
  } catch (err) {
    console.error(`[discover-sources] City pass failed for ${city.name}:`, err.message);
  }

  // --- Per-neighborhood passes (batches of 4 to limit LLM calls) ---
  const neighborhoodResults = [];
  const BATCH = 4;
  for (let i = 0; i < hoods.length; i += BATCH) {
    const batch = hoods.slice(i, i + BATCH).map((h) => h.name);
    try {
      const batchResults = await askForJson(
        "You are an expert researcher who finds hyperlocal neighborhood event websites. Return only real, accessible URLs.",
        `Find event listing websites specifically for these neighborhoods in ${city.name}: ${batch.join(", ")}.

Look for:
- Neighborhood association or BID (Business Improvement District) event pages
- Arts district event calendars
- Local venue or bar/restaurant event pages in these neighborhoods
- Neighborhood-specific Eventbrite or Meetup searches

Return a JSON array only:
[{ "url": "https://...", "source_type": "website" | "api" | "rss", "notes": "one sentence about what neighborhood and event types this covers" }]`
      );
      neighborhoodResults.push(...batchResults);
    } catch (err) {
      console.error(
        `[discover-sources] Neighborhood batch failed for ${city.name} (${batch.join(", ")}):`,
        err.message
      );
    }
  }

  // --- Validate and save ---
  const all = [...cityResults, ...neighborhoodResults];
  console.log(`[discover-sources] ${city.name}: ${all.length} suggestions from Ollama`);

  for (const source of all) {
    if (!source.url || typeof source.url !== "string") continue;

    const reachable = await isReachable(source.url);
    if (!reachable) {
      console.log(`[discover-sources]   skip (unreachable): ${source.url}`);
      rejected++;
      continue;
    }

    try {
      await db
        .insert(eventSources)
        .values({
          cityId: city.id,
          url: source.url,
          sourceType: source.source_type ?? "website",
          active: true,
        })
        .onConflictDoNothing();
      added++;
      console.log(`[discover-sources]   added: ${source.url}`);
    } catch (err) {
      console.error(`[discover-sources]   insert error for ${source.url}:`, err.message);
    }
  }

  console.log(
    `[discover-sources] ${city.name}: ${added} added, ${rejected} rejected (${all.length} total)`
  );
  return { added, rejected };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Optional --city flag for targeted runs
  const cityArg = process.argv.find((a) => a.startsWith("--city="))?.split("=")[1];

  const activeCities = cityArg
    ? await db.query.cities.findMany({
        where: and(eq(cities.active, true), eq(cities.slug, cityArg)),
      })
    : await db.query.cities.findMany({ where: eq(cities.active, true) });

  if (activeCities.length === 0) {
    console.log("[discover-sources] No active cities found.");
    return;
  }

  const totals = { added: 0, rejected: 0 };

  for (const city of activeCities) {
    const hoods = await db.query.neighborhoods.findMany({
      where: eq(neighborhoods.cityId, city.id),
    });

    const result = await discoverForCity(city, hoods);
    totals.added += result.added;
    totals.rejected += result.rejected;
  }

  console.log(
    `[discover-sources] Done. Total: ${totals.added} added, ${totals.rejected} rejected`
  );
}

main().catch((err) => {
  console.error("[discover-sources] Fatal:", err);
  process.exit(1);
});
