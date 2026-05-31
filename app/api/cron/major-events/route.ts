import { NextRequest, NextResponse } from "next/server";
import { db, eventSources, cities, neighborhoods } from "@/db";
import { eq } from "drizzle-orm";
import { askForJson, systemPrompt } from "@/lib/anthropic";
import { scrapePage } from "@/lib/scraper";
import { buildClaudePayload } from "@/lib/extractor";
import { upsertEvent } from "@/lib/dedup";
import { addMonths, startOfMonth } from "date-fns";

// Vercel Cron: first of every month at 5am UTC
// vercel.json → { "path": "/api/cron/major-events", "schedule": "0 5 1 * *" }

type ParsedMajorEvent = {
  title: string;
  description: string;
  start_date: string;
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

  const now = new Date();
  const windowStart = addMonths(startOfMonth(now), 3);
  const windowEnd = addMonths(startOfMonth(now), 6);

  const activeSources = await db.query.eventSources.findMany({
    where: eq(eventSources.active, true),
  });

  const stats = { scraped: 0, eventsInserted: 0, eventsMerged: 0, errors: 0 };

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

      const parsed = await askForJson<ParsedMajorEvent[]>(
        systemPrompt(
          "an event researcher who identifies large, significant, and noteworthy events in a city"
        ),
        `Extract all MAJOR events (festivals, concerts, conferences, large community events, annual celebrations)
happening between ${windowStart.toISOString()} and ${windowEnd.toISOString()}.
City: ${cityRecord.name}
Known neighborhoods: ${hoods.map((h) => h.name).join(", ")}

Only include events that are genuinely large or notable — skip small meetups and regular weekly events.

For each event return:
- title, description, start_date (ISO 8601), end_date (ISO 8601, optional)
- venue_name, address, neighborhood (match to known neighborhoods if possible)
- is_free (boolean), is_kid_friendly (boolean)
- themes (array: music, art, food, sports, family, comedy, outdoor, market, festival, film)
- image_url (if present), event_url (direct link if present)

Return a JSON array. If none found, return [].

${payload}`
      );

      for (const e of parsed) {
        try {
          const hood = hoods.find(
            (h) =>
              h.name.toLowerCase() === e.neighborhood?.toLowerCase() ||
              h.slug === e.neighborhood?.toLowerCase().replace(/\s+/g, "-")
          );

          const result = await upsertEvent({
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
            isMajor: true,
            imageUrl: e.image_url ?? null,
            eventUrl: e.event_url ?? null,
          });

          if (result === "inserted") stats.eventsInserted++;
          else stats.eventsMerged = (stats.eventsMerged ?? 0) + 1;
        } catch {
          // ignore per-event insert errors
        }
      }

      await db
        .update(eventSources)
        .set({ lastChecked: new Date() })
        .where(eq(eventSources.id, source.id));

      stats.scraped++;
    } catch (err) {
      console.error(`[major-events] Error on source ${source.url}:`, err);
      stats.errors++;
    }
  }

  return NextResponse.json({ ok: true, stats });
}
