import { NextRequest, NextResponse } from "next/server";
import { db, cities, neighborhoods } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, neighborhoods: hoods = [] } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 }
      );
    }

    // Insert city
    const [city] = await db
      .insert(cities)
      .values({ name, slug, active: true })
      .returning();

    // Insert neighborhoods
    if (hoods.length > 0) {
      await db.insert(neighborhoods).values(
        hoods.map((h: { name: string; slug: string }) => ({
          cityId: city.id,
          name: h.name,
          slug: h.slug,
        }))
      );
    }

    // Kick off source discovery for this city asynchronously
    // We fire-and-forget the cron endpoint with the city id as a query param
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/cron/discover-sources?cityId=${city.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    }).catch(console.error);

    return NextResponse.json({ city }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/cities]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const all = await db.query.cities.findMany({
    where: eq(cities.active, true),
    orderBy: (c, { asc }) => asc(c.name),
  });
  return NextResponse.json({ cities: all });
}
