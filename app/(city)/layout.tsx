import { getCityContext } from "@/lib/city-context";
import CityHeader from "@/components/CityHeader";

export default async function CityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { city, neighborhoods } = await getCityContext();

  return (
    <div className="min-h-screen flex flex-col">
      <CityHeader city={city} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <footer className="border-t border-white/10 py-6 text-center text-sm text-yeah-muted">
        Yeah {city.name} &mdash; Find what&apos;s happening
      </footer>
    </div>
  );
}
