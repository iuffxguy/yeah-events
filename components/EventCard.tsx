"use client";

import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import type { Event } from "@/db/schema";
import clsx from "clsx";
import EventModal from "./EventModal";

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
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className="group relative flex flex-col bg-yeah-ink rounded-2xl overflow-hidden border border-white/5 hover:border-yeah-yellow/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 cursor-pointer animate-slide-up"
        onClick={() => setModalOpen(true)}
      >
        {/* Image — only shown when we actually have one */}
        {event.imageUrl && (
          <div className="relative h-40 bg-yeah-navy overflow-hidden">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 space-y-2">
          {/* Badges + confidence row */}
          <div className="flex items-center gap-1.5">
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
            {event.confidence === "high" && (
              <span className="ml-auto bg-yeah-yellow text-yeah-navy text-xs font-bold px-2 py-0.5 rounded-full" title={`${event.mentionCount} sources`}>
                &#9733;&#9733;&#9733;
              </span>
            )}
            {event.confidence === "medium" && (
              <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full" title={`${event.mentionCount} sources`}>
                &#9733;&#9733;
              </span>
            )}
          </div>

          <p className="text-yeah-yellow text-xs font-semibold tracking-wide uppercase">
            {format(new Date(event.startDate), "EEE, MMM d · h:mm a")}
          </p>

          <h3 className="text-white font-display font-bold text-base leading-snug line-clamp-2">
            {event.title}
          </h3>

          {event.venueName && (
            <p className="text-yeah-muted text-xs truncate">{event.venueName}</p>
          )}

          {(event.themes ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {(event.themes ?? []).slice(0, 3).map((theme) => (
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

      {modalOpen && (
        <EventModal event={event} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
