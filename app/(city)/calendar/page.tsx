import { db, events } from "@/db";
import { getCityContext } from "@/lib/city-context";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { addMonths, startOfMonth } from "date-fns";
import CalendarView from "@/components/CalendarView";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { city } = await getCityContext();
  return {
    title: `Yeah ${city.name} — Major Events Calendar`,
    description: `Big events and festivals coming up in ${city.name} over the next few months.`,
  };
}

export default async function CalendarPage() {
  const { city } = await getCityContext();

  const now = new Date();
  const threeMonthsOut = addMonths(startOfMonth(now), 3);
  const sixMonthsOut = addMonths(startOfMonth(now), 6);

  const majorEvents = await db.query.events.findMany({
    where: and(
      eq(events.cityId, city.id),
      eq(events.isMajor, true),
      gte(events.startDate, threeMonthsOut),
      lte(events.startDate, sixMonthsOut)
    ),
    orderBy: asc(events.startDate),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-yeah-yellow">
          Big Events in {city.name}
        </h1>
        <p className="text-yeah-muted text-sm mt-1">
          Major happenings 3&ndash;6 months out
        </p>
      </div>

      <CalendarView events={majorEvents} />
    </div>
  );
}
