"use client";

import { useEffect } from "react";
import type { Venue } from "@/db/schema";

export default function VenueDrawer({
  venue,
  onClose,
}: {
  venue: Venue;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mapAddress = venue.address;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative z-10 w-full sm:max-w-sm h-full bg-yeah-ink overflow-y-auto shadow-2xl border-l border-yeah-line/10 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-yeah-line/10 sticky top-0 bg-yeah-ink z-10">
          <div>
            <p className="text-yeah-muted text-xs uppercase tracking-widest mb-1">Venue</p>
            <h2 className="text-yeah-fg font-display font-bold text-lg leading-snug">
              {venue.displayName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors flex-shrink-0 ml-3 mt-0.5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Address */}
          {venue.address && (
            <div className="flex items-start gap-3">
              <span className="text-yeah-yellow mt-0.5">&#128205;</span>
              <p className="text-yeah-fg text-sm">{venue.address}</p>
            </div>
          )}

          {/* Map */}
          {mapAddress && (
            <div className="rounded-xl overflow-hidden h-44 border border-white/10">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Map for ${venue.displayName}`}
              />
            </div>
          )}

          {/* Description */}
          {venue.description ? (
            <p className="text-yeah-fg/70 text-sm leading-relaxed">
              {venue.description}
            </p>
          ) : !venue.enriched ? (
            <p className="text-yeah-muted text-sm italic">
              Gathering venue details...
            </p>
          ) : null}

          {/* Website */}
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-yeah-yellow text-sm hover:underline"
            >
              <span>&#127760;</span>
              {venue.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
