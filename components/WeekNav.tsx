"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addDays, subDays, format, isToday } from "date-fns";

export default function WeekNav({ weekStart }: { weekStart: Date }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", format(date, "yyyy-MM-dd"));
    router.push(`/?${params.toString()}`);
  }

  const prevWeek = subDays(weekStart, 7);
  const nextWeek = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = isToday(weekStart) || isToday(addDays(weekStart, -1));

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
          {isCurrentWeek ? (
            <>
              What&apos;s{" "}
              <span className="text-yeah-yellow">Happening</span>
            </>
          ) : (
            <>
              {format(weekStart, "MMM d")}
              <span className="text-yeah-muted mx-1">&ndash;</span>
              {format(weekEnd, "MMM d, yyyy")}
            </>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(prevWeek)}
          className="p-2 rounded-xl bg-yeah-ink border border-white/10 hover:border-yeah-yellow/50 hover:text-yeah-yellow text-white/60 transition-all"
          aria-label="Previous week"
        >
          &#8592;
        </button>

        {!isCurrentWeek && (
          <button
            onClick={() => navigate(new Date())}
            className="px-3 py-1.5 rounded-xl bg-yeah-ink border border-white/10 hover:border-yeah-yellow/50 text-xs font-semibold text-white/60 hover:text-yeah-yellow transition-all"
          >
            Today
          </button>
        )}

        <button
          onClick={() => navigate(nextWeek)}
          className="p-2 rounded-xl bg-yeah-ink border border-white/10 hover:border-yeah-yellow/50 hover:text-yeah-yellow text-white/60 transition-all"
          aria-label="Next week"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
}
