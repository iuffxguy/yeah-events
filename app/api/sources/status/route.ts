import { NextRequest, NextResponse } from "next/server";
import { db, eventSources, events } from "@/db";
import { eq, count } from "drizzle-orm";

/**
 * GET /api/sources/status
 * Returns each active source with its last_checked time and event count.
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await db.query.eventSources.findMany({
    where: eq(eventSources.active, true),
    orderBy: (s, { asc }) => asc(s.cityId),
  });

  const statusRows = await Promise.all(
    sources.map(async (source) => {
      const [{ value: eventCount }] = await db
        .select({ value: count() })
        .from(events)
        .where(eq(events.sourceId, source.id));

      return {
        id: source.id,
        url: source.url,
        sourceType: source.sourceType,
        lastChecked: source.lastChecked,
        eventCount: Number(eventCount),
        status: source.lastChecked ? "scraped" : "pending",
      };
    })
  );

  const summary = {
    total: statusRows.length,
    scraped: statusRows.filter((s) => s.status === "scraped").length,
    pending: statusRows.filter((s) => s.status === "pending").length,
    totalEvents: statusRows.reduce((sum, s) => sum + s.eventCount, 0),
  };

  return NextResponse.json({ summary, sources: statusRows });
}
