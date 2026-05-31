import { NextRequest, NextResponse } from "next/server";
import { db, eventSources, events, cities, neighborhoods } from "@/db";
import { eq } from "drizzle-orm";
import { askForJson, systemPrompt } from "@/lib/anthropic";
import { scrapePage } from "@/lib/scraper";
import { buildClaudePayload } from "@/lib/extractor";
import { addDays, startOfDay } from "date-fns";

// Vercel Cron: every Tuesday at 4am UTC
// vercel.json → { "path": "/api/cron/scrape-events", "schedule": "0 4 * * 2" }

type ParsedEvent = {
  title: string;
  description: string;
  start_date: string; // ISO 8601
  end_date?: string;
  venue_name?: string;
  address?: string;
  neighborhood?: string;
  is_free: boolean;
  is_kid_friendly: boolean;
  themes: string[];
  image_url?: string;
  event_url?: string;
};

function verifyCronSecret(request: NextRequest): boolean {
  return (
    request.headers.get("authorization") ===
    `Bearer ${process.env.CRON_SECRET}`
  );
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

  const now = startOfDay(new Date());
  const windowEnd = addDays(now, 7);

  const activeSources = await db.query.eventSources.findMany({
    where: eq(eventSources.active, true),
    with: { city: true } as Record<string, unknown>,
  });

  const stats = { scraped: 0, eventsInserted: 0, errors: 0 };

  for (const source of activeSources) {
    try {
      const cityRecord = await db.query.cities.findFirst({
        where: eq(cities.id, source.cityId),
      });
      if (!cityRecord) continue;

      const hoods = await db.query.neighborhoods.findMany({
        where: eq(neighborhoods.cityId, source.cityId),
      });

      const { extracted } = await scrapePage(source.url);
      const payload = buildClaudePayload(extracted);

      const parsed = await askForJson<ParsedEvent[]>(
        systemPrompt(
          "an event data extraction specialist who reads structured and plain-text event data and returns structured JSON"
        ),
        `Extract all events happening between ${now.toISOString()} and ${windowEnd.toISOString()}.
City: ${cityRecord.name}
Known neighborhoods: ${hoods.map((h) => h.name).join(", ")}

For each event return:
- title, description, start_date (ISO 8601), end_date (ISO 8601, optional)
- venue_name, address, neighborhood (match to known neighborhoods list if possible)
- is_free (boolean), is_kid_friendly (boolean)
- themes (array of short tags like: music, art, food, sports, family, comedy, outdoor, market, festival, film)
- image_url (if present), event_url (direct link if present)

Return a JSON array. If no events found, return [].

${payload}`
      );

      // Insert events
      for (const e of parsed) {
        try {
          const hood = hoods.find(
            (h) =>
              h.name.toLowerCase() === e.neighborhood?.toLowerCase() ||
              h.slug === e.neighborhood?.toLowerCase().replace(/\s+/g, "-")
          );

          await db
            .insert(events)
            .values({
              cityId: source.cityId,
              sourceId: source.id,
              title: e.title,
              description: e.description,
              startDate: new Date(e.start_date),
              endDate: e.end_date ? new Date(e.end_date) : null,
              venueName: e.venue_name ?? null,
              address: e.address ?? null,
              neighborhoodId: hood?.id ?? null,
              isFree: e.is_free,
              isKidFriendly: e.is_kid_friendly,
              themes: e.themes,
              isMajor: false,
              imageUrl: e.image_url ?? null,
              eventUrl: e.event_url ?? null,
            })
            .onConflictDoNothing();

          stats.eventsInserted++;
        } catch {
          // ignore per-event insert errors
        }
      }

      // Update last_checked
      await db
        .update(eventSources)
        .set({ lastChecked: new Date() })
        .where(eq(eventSources.id, source.id));

      stats.scraped++;
    } catch (err) {
      console.error(`[scrape-events] Error on source ${source.url}:`, err);
      stats.errors++;
    }
  }

  return NextResponse.json({ ok: true, stats });
}
