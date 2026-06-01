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

/**
 * Verify a URL is reachable before saving it.
 * Returns true only on 2xx responses. Treats 403/405 as blocked (not valid
 * for scraping). Times out after 8s to stay within function limits.
 */
async function isSourceReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; YeahEventsBot/1.0; +https://yeah-events.com/bot)",
      },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    // Accept 2xx and 3xx final redirects; reject 4xx/5xx
    return res.ok;
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

      const discovered = await askForJson<DiscoveredSource[]>(
        systemPrompt(
          "an expert researcher who finds event listing websites and public APIs for cities"
        ),
        `Find 20 high-quality event listing websites for ${city.name} that are especially good for weekend events, community happenings, and things to do.

Known neighborhoods in ${city.name}: ${hoodList}

Prioritize sources that:
- List specific upcoming events with dates (not just venue directories)
- Cover weekends well: festivals, markets, concerts, outdoor events, family events
- Are free to access with no login or paywall
- Are local or city-specific (not just national sites with a city filter)

Good source types to look for:
- Local "things to do this weekend" pages (newspapers, city magazines, tourism sites)
- Neighborhood-specific event pages (e.g. NoDa arts district, South End, Uptown, Plaza Midwood)
- Local parks & recreation event pages
- Community organization and BID (Business Improvement District) event calendars
- Local arts/music venue listing pages
- Free ticketing pages (Eventbrite, Ticketmaster city pages)
- Local alternative newspapers or city magazines with event listings

Return a JSON array with objects containing:
- "url": the full URL (be specific — link directly to the events/calendar page, not the homepage)
- "source_type": one of "website", "api", or "rss"
- "notes": one sentence about what kinds of events this source covers

Only include real URLs you are confident exist and are publicly accessible.`
      );

      // Validate then upsert sources
      let added = 0;
      let rejected = 0;
      for (const source of discovered) {
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
      console.log(`[discover-sources] ${city.name}: ${added} added, ${rejected} rejected`);
    } catch (err) {
      console.error(`[discover-sources] Failed for ${city.name}:`, err);
      results[city.slug] = -1;
    }
  }

  return NextResponse.json({ ok: true, results });
}
