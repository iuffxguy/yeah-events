import { headers } from "next/headers";
import { db, cities, neighborhoods } from "@/db";
import { eq } from "drizzle-orm";
import type { City, Neighborhood } from "@/db/schema";

export type CityContext = {
  city: City;
  neighborhoods: Neighborhood[];
};

/**
 * Reads the city slug injected by middleware and fetches the full city record.
 * Throws if the city is not found or inactive — triggers the nearest error boundary.
 */
export async function getCityContext(): Promise<CityContext> {
  const headerList = await headers();
  const slug = headerList.get("x-city-slug") ?? "charlotte";

  const city = await db.query.cities.findFirst({
    where: eq(cities.slug, slug),
  });

  if (!city || !city.active) {
    throw new Error(`City not found: ${slug}`);
  }

  const hoods = await db.query.neighborhoods.findMany({
    where: eq(neighborhoods.cityId, city.id),
    orderBy: (n, { asc }) => asc(n.name),
  });

  return { city, neighborhoods: hoods };
}

/**
 * Lightweight version that just returns the slug without a DB call.
 * Useful for layouts that only need the slug for display.
 */
export async function getCitySlug(): Promise<string> {
  const headerList = await headers();
  return headerList.get("x-city-slug") ?? "charlotte";
}
