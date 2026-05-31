import Image from "next/image";
import { format, isSameMonth } from "date-fns";
import type { Event } from "@/db/schema";
import clsx from "clsx";

function groupByMonth(events: Event[]): Map<string, Event[]> {
  const map = new Map<string, Event[]>();
  for (const event of events) {
    const key = format(new Date(event.startDate), "yyyy-MM");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return map;
}

export default function CalendarView({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-yeah-muted space-y-3">
        <p className="text-5xl">&#128197;</p>
        <p className="text-xl font-display font-bold">Nothing scheduled yet</p>
        <p className="text-sm">Major events will appear here once discovered.</p>
      </div>
    );
  }

  const grouped = groupByMonth(events);

  return (
    <div className="space-y-10">
      {Array.from(grouped.entries()).map(([monthKey, monthEvents]) => (
        <section key={monthKey}>
          <h2 className="text-xl font-display font-bold text-yeah-yellow mb-4">
            {format(new Date(`${monthKey}-01`), "MMMM yyyy")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {monthEvents.map((event) => (
              <MajorEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MajorEventCard({ event }: { event: Event }) {
  const inner = (
    <div className="group flex gap-4 bg-yeah-ink rounded-2xl overflow-hidden border border-white/5 hover:border-yeah-yellow/40 transition-all duration-200 p-4">
      {/* Date block */}
      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-yeah-yellow text-yeah-navy flex flex-col items-center justify-center font-display font-extrabold leading-none">
        <span className="text-xs uppercase tracking-widest opacity-70">
          {format(new Date(event.startDate), "MMM")}
        </span>
        <span className="text-2xl">{format(new Date(event.startDate), "d")}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-white font-display font-bold text-base leading-snug truncate">
          {event.title}
        </p>
        {event.venueName && (
          <p className="text-yeah-muted text-xs truncate">{event.venueName}</p>
        )}
        {event.description && (
          <p className="text-white/60 text-xs line-clamp-2">{event.description}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {event.isFree && (
            <span className="bg-yeah-teal/20 text-yeah-teal text-xs font-bold px-2 py-0.5 rounded-full">
              FREE
            </span>
          )}
          {event.isKidFriendly && (
            <span className="bg-blue-400/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">
              KIDS
            </span>
          )}
          {(event.themes ?? []).slice(0, 2).map((t) => (
            <span
              key={t}
              className="bg-white/10 text-white/60 text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Thumbnail */}
      {event.imageUrl && (
        <div className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="80px"
          />
        </div>
      )}
    </div>
  );

  if (event.eventUrl) {
    return (
      <a href={event.eventUrl} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return inner;
}
