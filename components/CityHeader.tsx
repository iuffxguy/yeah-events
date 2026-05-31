import Link from "next/link";
import type { City } from "@/db/schema";

const THEME_COLORS: Record<string, string> = {
  charlotte: "bg-yeah-teal",
  atlanta: "bg-yeah-coral",
  nashville: "bg-purple-500",
  miami: "bg-pink-500",
  austin: "bg-orange-500",
};

export default function CityHeader({ city }: { city: City }) {
  const accentClass = THEME_COLORS[city.slug] ?? "bg-yeah-yellow";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-yeah-navy/90 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo / City name */}
        <Link href="/" className="flex items-center gap-2 group">
          <span
            className={`${accentClass} text-yeah-navy font-display font-extrabold text-sm px-2 py-0.5 rounded`}
          >
            YEAH
          </span>
          <span className="font-display font-bold text-lg text-white group-hover:text-yeah-yellow transition-colors">
            {city.name}
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            This Week
          </Link>
          <Link
            href="/calendar"
            className="px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Big Events
          </Link>
        </nav>
      </div>
    </header>
  );
}
