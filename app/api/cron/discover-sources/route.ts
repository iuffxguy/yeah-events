import { NextRequest, NextResponse } from "next/server";
import { db, cities, eventSources } from "@/db";
import { eq, and } from "drizzle-orm";
import { askForJson, systemPrompt } from "@/lib/anthropic";

// Vercel Cron: every Monday at 9am UTC
// vercel.json → { "path": "/api/cron/discover-sources", "schedule": "0 9 * * 1" }

type DiscoveredSource = {
  url: string;
  source_type: "website" | "api" | "rss";
  notes: string;
};

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
      const discovered = await askForJson<DiscoveredSource[]>(
        systemPrompt(
          "an expert researcher who finds event listing websites and public APIs for cities"
        ),
        `Find the top 10 event listing websites and free public event APIs for ${city.name}.
Include local event calendars, city government event pages, Eventbrite city pages, Meetup city pages,
local newspaper event sections, and any free public APIs.

Return a JSON array with objects containing:
- "url": the full URL of the source
- "source_type": one of "website", "api", or "rss"
- "notes": one sentence about what events this source covers

Only include real, publicly accessible URLs. No paywalls.`
      );

      // Upsert sources — skip duplicates by URL
      let added = 0;
      for (const source of discovered) {
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
      console.log(`[discover-sources] ${city.name}: ${added} new sources`);
    } catch (err) {
      console.error(`[discover-sources] Failed for ${city.name}:`, err);
      results[city.slug] = -1;
    }
  }

  return NextResponse.json({ ok: true, results });
}
