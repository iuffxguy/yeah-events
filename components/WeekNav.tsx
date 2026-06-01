"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addDays, subDays, format, isToday } from "date-fns";

export default function WeekNav({ weekStart, isPast }: { weekStart: Date; isPast: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", format(date, "yyyy-MM-dd"));
    router.push(`/?${params.toString()}`);
  }

  function goToToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("week");
    router.push(`/?${params.toString()}`);
  }

  const prevWeek = subDays(weekStart, 7);
  const nextWeek = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-yeah-fg">
          {!isPast ? (
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
        {/* Back arrow — always visible so you can browse past weeks */}
        <button
          onClick={() => navigate(prevWeek)}
          className="p-2 rounded-xl bg-yeah-ink border border-yeah-line/10 hover:border-yeah-yellow/50 hover:text-yeah-yellow text-yeah-fg/60 transition-all"
          aria-label="Previous week"
        >
          &#8592;
        </button>

        {isPast && (
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl bg-yeah-ink border border-yeah-line/10 hover:border-yeah-yellow/50 text-xs font-semibold text-yeah-fg/60 hover:text-yeah-yellow transition-all"
          >
            Today
          </button>
        )}

        <button
          onClick={() => navigate(nextWeek)}
          className="p-2 rounded-xl bg-yeah-ink border border-yeah-line/10 hover:border-yeah-yellow/50 hover:text-yeah-yellow text-yeah-fg/60 transition-all"
          aria-label="Next week"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
}
