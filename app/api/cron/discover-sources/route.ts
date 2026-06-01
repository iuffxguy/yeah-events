import { NextRequest, NextResponse } from "next/server";
import { db, cities, neighborhoods, eventSources } from "@/db";
import { eq, and } from "drizzle-orm";
import { askForJson, systemPrompt } from "@/lib/anthropic";

// Vercel Cron: every Monday at 9am UTC
// vercel.json → { "path": "/api/cron/discover-sources", "schedule": "0 9 * * 1" }

type DiscoveredSource = {
  url: string;
  source_type: "website" | "api" | "rss";
  notes: string;
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Verify a URL is reachable before saving it.
 * First tries HEAD; falls back to GET if blocked (many CDNs return 403/405 on HEAD).
 * Accepts 2xx or 403 (page exists but blocks bots — worth trying to scrape anyway).
 */
async function isSourceReachable(url: string): Promise<boolean> {
  const headers = { "User-Agent": UA };
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers,
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (res.ok || res.status === 403) return true;
    // Some servers reject HEAD — retry with GET
    if (res.status === 405 || res.status === 404) {
      const get = await fetch(url, {
        method: "GET",
        headers,
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

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow targeting a specific city via ?cityId=
  const cityIdParam = request.nextUrl.searchParams.get("cityId");

  const activeCities = cityIdParam
    ? await db.query.cities.findMany({
        where: and(eq(cities.active, true), eq(cities.id, Number(cityIdParam))),
      })
    : await db.query.cities.findMany({ where: eq(cities.active, true) });

  const results: Record<string, number> = {};

  for (const city of activeCities) {
    try {
      const hoods = await db.query.neighborhoods.findMany({
        where: eq(neighborhoods.cityId, city.id),
      });
      const hoodList = hoods.map((h) => h.name).join(", ");

      // --- City-wide pass ---
      const cityDiscovered = await askForJson<DiscoveredSource[]>(
        systemPrompt("an expert researcher who finds event listing websites for cities"),
        `Find 15 high-quality event listing websites for ${city.name} that list specific upcoming events with dates.

Prioritize: local newspapers/magazines with event sections, tourism sites, Eventbrite/Meetup city pages, parks & rec calendars, arts org calendars.
Avoid: national sites, anything requiring login or payment.

Return JSON array: [{ "url": "...", "source_type": "website"|"api"|"rss", "notes": "..." }]
Link directly to events/calendar pages, not homepages.`
      );

      // --- Per-neighborhood passes (batch into groups of 4 to limit Claude calls) ---
      const neighborhoodDiscovered: DiscoveredSource[] = [];
      const BATCH = 4;
      for (let i = 0; i < hoods.length; i += BATCH) {
        const batch = hoods.slice(i, i + BATCH).map((h) => h.name);
        const batchResults = await askForJson<DiscoveredSource[]>(
          systemPrompt("an expert researcher who finds hyperlocal neighborhood event websites"),
          `Find event listing websites specifically for these neighborhoods in ${city.name}: ${batch.join(", ")}.

Look for:
- Neighborhood association or BID (Business Improvement District) event pages
- Arts district event calendars (e.g. NoDa Arts District, South End events)
- Neighborhood Facebook pages or community boards with public event listings
- Local venue or bar/restaurant event pages in that neighborhood
- Neighborhood-specific Eventbrite or Meetup searches

Return JSON array: [{ "url": "...", "source_type": "website"|"api"|"rss", "notes": "one sentence about what neighborhood and event types this covers" }]
Only include URLs you are confident are real and publicly accessible.`
        );
        neighborhoodDiscovered.push(...batchResults);
      }

      // --- Validate and save all discovered sources ---
      const allDiscovered = [...cityDiscovered, ...neighborhoodDiscovered];
      let added = 0;
      let rejected = 0;
      for (const source of allDiscovered) {
        const reachable = await isSourceReachable(source.url);
        if (!reachable) {
          console.log(`[discover-sources] rejected unreachable: ${source.url}`);
          rejected++;
          continue;
        }
        try {
          await db
            .insert(eventSources)
            .values({
              cityId: city.id,
              url: source.url,
              sourceType: source.source_type,
              active: true,
            })
            .onConflictDoNothing();
          added++;
        } catch {
          // ignore individual insert errors
        }
      }

      results[city.slug] = added;
      console.log(`[discover-sources] ${city.name}: ${added} added, ${rejected} rejected (${allDiscovered.length} total suggested)`);
    } catch (err) {
      console.error(`[discover-sources] Failed for ${city.name}:`, err);
      results[city.slug] = -1;
    }
  }

  return NextResponse.json({ ok: true, results });
}
