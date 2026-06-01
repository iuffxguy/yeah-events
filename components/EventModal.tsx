"use client";

import { useEffect } from "react";
import Image from "next/image";
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

export default function EventModal({
  event,
  onClose,
}: {
  event: Event;
  onClose: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const dateStr = format(new Date(event.startDate), "EEEE, MMMM d, yyyy");
  const timeStr = format(new Date(event.startDate), "h:mm a");
  const endTimeStr = event.endDate
    ? format(new Date(event.endDate), "h:mm a")
    : null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:max-w-lg bg-yeah-ink rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image or color bar */}
        <div className="relative h-48 bg-yeah-navy">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover"
              sizes="512px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-white/10 select-none">
              {(event.themes ?? [])[0] === "music"
                ? "♪"
                : (event.themes ?? [])[0] === "food"
                ? "🍽"
                : (event.themes ?? [])[0] === "art"
                ? "🎨"
                : "✦"}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <h2 className="text-white font-display font-bold text-xl leading-snug">
            {event.title}
          </h2>

          {/* Date & time */}
          <div className="flex items-start gap-3">
            <span className="text-yeah-yellow mt-0.5">&#128197;</span>
            <div>
              <p className="text-white text-sm font-semibold">{dateStr}</p>
              <p className="text-yeah-muted text-sm">
                {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ""}
              </p>
            </div>
          </div>

          {/* Venue & address */}
          {(event.venueName || event.address) && (
            <div className="flex items-start gap-3">
              <span className="text-yeah-yellow mt-0.5">&#128205;</span>
              <div>
                {event.venueName && (
                  <p className="text-white text-sm font-semibold">{event.venueName}</p>
                )}
                {event.address && (
                  <p className="text-yeah-muted text-sm">{event.address}</p>
                )}
              </div>
            </div>
          )}

          {/* Description / summary */}
          {event.description && (
            <p className="text-white/70 text-sm leading-relaxed border-t border-white/10 pt-4">
              {event.description}
            </p>
          )}

          {/* Themes */}
          {(event.themes ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(event.themes ?? []).map((theme) => (
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

          {/* CTA */}
          {event.eventUrl && (
            <a
              href={event.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-yeah-yellow text-yeah-navy font-display font-bold py-3 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              Get Details / Tickets ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
