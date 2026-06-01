"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Neighborhood } from "@/db/schema";
import clsx from "clsx";

type FilterState = {
  neighborhood?: string;
  theme?: string;
  free: boolean;
  kids: boolean;
  sort: "date" | "added";
};

type Props = {
  neighborhoods: Neighborhood[];
  themes: string[];
  current: FilterState;
};

export default function FilterBar({ neighborhoods, themes, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/?${params.toString()}`);
  }

  function toggleBoolean(key: string, cur: boolean) {
    setParam(key, cur ? null : "1");
  }

  const activeCount = [
    current.neighborhood,
    current.theme,
    current.free,
    current.kids,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Mobile toggle — hidden on md+ where filters are always visible */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all",
            expanded || activeCount > 0
              ? "bg-yeah-yellow text-yeah-navy border-yeah-yellow"
              : "text-yeah-fg/60 border-yeah-line/20 hover:border-yeah-line/40 hover:text-yeah-fg"
          )}
        >
          Filters
          {activeCount > 0 && (
            <span className="bg-yeah-navy text-yeah-yellow text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <span className="text-xs">{expanded ? "▲" : "▼"}</span>
        </button>

        {activeCount > 0 && (
          <button
            onClick={() => router.push("/")}
            className="text-xs text-yeah-coral hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter rows — always visible on md+, collapsible on mobile */}
      <div className={clsx("space-y-3", !expanded && "hidden md:block")}>
        {/* Row 1: Toggles + Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => toggleBoolean("free", current.free)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-semibold border transition-all",
              current.free
                ? "bg-yeah-teal text-yeah-navy border-yeah-teal"
                : "bg-transparent text-yeah-fg/60 border-yeah-line/20 hover:border-yeah-teal hover:text-yeah-teal"
            )}
          >
            Free only
          </button>

          <button
            onClick={() => toggleBoolean("kids", current.kids)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-semibold border transition-all",
              current.kids
                ? "bg-blue-400 text-yeah-navy border-blue-400"
                : "bg-transparent text-yeah-fg/60 border-yeah-line/20 hover:border-blue-400 hover:text-blue-400"
            )}
          >
            Kid-friendly
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-yeah-muted">Sort:</span>
            <button
              onClick={() => setParam("sort", "date")}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                current.sort === "date"
                  ? "bg-yeah-line/10 text-yeah-fg border-yeah-line/20"
                  : "text-yeah-fg/40 border-yeah-line/10 hover:text-yeah-fg/60"
              )}
            >
              Date
            </button>
            <button
              onClick={() => setParam("sort", "added")}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                current.sort === "added"
                  ? "bg-yeah-line/10 text-yeah-fg border-yeah-line/20"
                  : "text-yeah-fg/40 border-yeah-line/10 hover:text-yeah-fg/60"
              )}
            >
              New
            </button>
          </div>
        </div>

        {/* Row 2: Neighborhoods */}
        {neighborhoods.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setParam("neighborhood", null)}
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                !current.neighborhood
                  ? "bg-yeah-yellow text-yeah-navy border-yeah-yellow"
                  : "text-yeah-fg/50 border-yeah-line/15 hover:text-yeah-fg hover:border-yeah-line/30"
              )}
            >
              All areas
            </button>
            {neighborhoods.map((n) => (
              <button
                key={n.slug}
                onClick={() =>
                  setParam("neighborhood", current.neighborhood === n.slug ? null : n.slug)
                }
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                  current.neighborhood === n.slug
                    ? "bg-yeah-yellow text-yeah-navy border-yeah-yellow"
                    : "text-yeah-fg/50 border-yeah-line/15 hover:text-yeah-fg hover:border-yeah-line/30"
                )}
              >
                {n.name}
              </button>
            ))}
          </div>
        )}

        {/* Row 3: Themes */}
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <button
                key={theme}
                onClick={() =>
                  setParam("theme", current.theme === theme ? null : theme)
                }
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border transition-all",
                  current.theme === theme
                    ? "bg-yeah-coral text-white border-yeah-coral"
                    : "text-yeah-fg/50 border-yeah-line/15 hover:text-yeah-fg hover:border-yeah-line/30"
                )}
              >
                {theme}
              </button>
            ))}
          </div>
        )}

        {/* Active filter count + clear — desktop only (mobile has it in the toggle row) */}
        {activeCount > 0 && (
          <div className="hidden md:flex items-center gap-2 pt-1">
            <span className="text-xs text-yeah-muted">
              {activeCount} filter{activeCount > 1 ? "s" : ""} active
            </span>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-yeah-coral hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
