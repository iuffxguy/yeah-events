import { db, events, neighborhoods } from "@/db";
import { getCityContext } from "@/lib/city-context";
import { and, eq, gte, lte, asc, desc } from "drizzle-orm";
import { addDays, startOfDay } from "date-fns";
import EventCard from "@/components/EventCard";
import FilterBar from "@/components/FilterBar";
import WeekNav from "@/components/WeekNav";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { city } = await getCityContext();
  return {
    title: `Yeah ${city.name} — Events This Week`,
    description: `Discover the best local events happening in ${city.name} this week.`,
  };
}

type SearchParams = {
  week?: string; // ISO date string for week start
  neighborhood?: string;
  theme?: string;
  free?: string;
  kids?: string;
  sort?: "date" | "added";
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { city, neighborhoods: hoods } = await getCityContext();

  // Determine week window — default to today, never show past days unless
  // explicitly navigated to via the week param
  const today = startOfDay(new Date());
  const weekStart = searchParams.week
    ? startOfDay(new Date(searchParams.week))
    : today;
  const isPast = weekStart < today;
  const weekEnd = addDays(weekStart, 7);

  // Build filters
  const filters = [
    eq(events.cityId, city.id),
    gte(events.startDate, weekStart),
    lte(events.startDate, weekEnd),
  ];

  if (searchParams.free === "1") {
    filters.push(eq(events.isFree, true));
  }
  if (searchParams.kids === "1") {
    filters.push(eq(events.isKidFriendly, true));
  }
  if (searchParams.neighborhood) {
    const hood = hoods.find((h) => h.slug === searchParams.neighborhood);
    if (hood) filters.push(eq(events.neighborhoodId, hood.id));
  }

  const orderBy =
    searchParams.sort === "added"
      ? desc(events.createdAt)
      : asc(events.startDate);

  const results = await db.query.events.findMany({
    where: and(...filters),
    orderBy,
    limit: 100,
  });

  // Filter by theme in-app (themes is an array column)
  const filtered =
    searchParams.theme
      ? results.filter((e) => (e.themes ?? []).includes(searchParams.theme!))
      : results;

  // Collect unique themes from results for the filter bar
  const allThemes = Array.from(new Set(results.flatMap((e) => e.themes ?? []))).sort();

  return (
    <div className="space-y-6 animate-fade-in">
      <WeekNav weekStart={weekStart} isPast={isPast} />

      <FilterBar
        neighborhoods={hoods}
        themes={allThemes}
        current={{
          neighborhood: searchParams.neighborhood,
          theme: searchParams.theme,
          free: searchParams.free === "1",
          kids: searchParams.kids === "1",
          sort: searchParams.sort ?? "date",
        }}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-yeah-muted space-y-3">
          <p className="text-5xl">&#128247;</p>
          <p className="text-xl font-display font-bold">Nothing yet</p>
          <p className="text-sm">Check back soon — events are being loaded.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
