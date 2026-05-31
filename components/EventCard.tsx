import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import type { Event } from "@/db/schema";
import clsx from "clsx";

const THEME_COLORS: Record<string, string> = {
  music: "bg-purple-500/20 text-purple-300",
  art: "bg-pink-500/20 text-pink-300",
  food: "bg-orange-500/20 text-orange-300",
  sports: "bg-green-500/20 text-green-300",
  family: "bg-blue-500/20 text-blue-300",
  comedy: "bg-yellow-500/20 text-yellow-300",
  outdoor: "bg-teal-500/20 text-teal-300",
  market: "bg-red-500/20 text-red-300",
  festival: "bg-yeah-yellow/20 text-yeah-yellow",
  film: "bg-indigo-500/20 text-indigo-300",
};

export default function EventCard({ event }: { event: Event }) {
  const cardContent = (
    <div className="group relative flex flex-col bg-yeah-ink rounded-2xl overflow-hidden border border-white/5 hover:border-yeah-yellow/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40">
      {/* Image */}
      <div className="relative h-40 bg-yeah-navy overflow-hidden">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-white/10 select-none">
            {event.themes[0] === "music"
              ? "♪"
              : event.themes[0] === "food"
              ? "🍽"
              : event.themes[0] === "art"
              ? "🎨"
              : "✦"}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {event.isFree && (
            <span className="bg-yeah-teal text-yeah-navy text-xs font-bold px-2 py-0.5 rounded-full">
              FREE
            </span>
          )}
          {event.isKidFriendly && (
            <span className="bg-blue-400 text-yeah-navy text-xs font-bold px-2 py-0.5 rounded-full">
              KIDS
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 space-y-2">
        {/* Date */}
        <p className="text-yeah-yellow text-xs font-semibold tracking-wide uppercase">
          {format(new Date(event.startDate), "EEE, MMM d · h:mm a")}
        </p>

        {/* Title */}
        <h3 className="text-white font-display font-bold text-base leading-snug line-clamp-2">
          {event.title}
        </h3>

        {/* Venue */}
        {event.venueName && (
          <p className="text-yeah-muted text-xs truncate">{event.venueName}</p>
        )}

        {/* Themes */}
        {event.themes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {event.themes.slice(0, 3).map((theme) => (
              <span
                key={theme}
                className={clsx(
                  "theme-pill",
                  THEME_COLORS[theme] ?? "bg-white/10 text-white/60"
                )}
              >
                {theme}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (event.eventUrl) {
    return (
      <a
        href={event.eventUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block animate-slide-up"
      >
        {cardContent}
      </a>
    );
  }

  return <div className="animate-slide-up">{cardContent}</div>;
}
