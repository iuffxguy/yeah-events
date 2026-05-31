"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SuggestedNeighborhood = { name: string; slug: string };

export default function NewCityPage() {
  const router = useRouter();
  const [cityName, setCityName] = useState("");
  const [slug, setSlug] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<SuggestedNeighborhood[]>([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(value: string) {
    setCityName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
    setNeighborhoods([]);
  }

  async function suggestNeighborhoods() {
    if (!cityName.trim()) return;
    setLoadingNeighborhoods(true);
    setError("");
    try {
      const res = await fetch("/api/neighborhoods/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityName }),
      });
      const data = await res.json();
      setNeighborhoods(data.neighborhoods ?? []);
    } catch {
      setError("Failed to fetch neighborhood suggestions.");
    } finally {
      setLoadingNeighborhoods(false);
    }
  }

  function removeNeighborhood(index: number) {
    setNeighborhoods((prev) => prev.filter((_, i) => i !== index));
  }

  function addNeighborhood() {
    const name = window.prompt("Neighborhood name:");
    if (!name) return;
    setNeighborhoods((prev) => [
      ...prev,
      {
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
    ]);
  }

  async function handleSave() {
    if (!cityName.trim() || !slug.trim()) {
      setError("City name and slug are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cityName, slug, neighborhoods }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Unknown error");
      }
      router.push("/admin/cities");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save city.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-yeah-navy px-4 py-10 text-white">
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-yeah-yellow">
            Add a City
          </h1>
          <p className="text-yeah-muted text-sm mt-1">
            Once saved, the AI will start discovering event sources.
          </p>
        </div>

        {error && (
          <div className="bg-yeah-coral/20 border border-yeah-coral text-yeah-coral rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* City name */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-white/80">
            City Name
          </label>
          <input
            type="text"
            value={cityName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Charlotte"
            className="w-full bg-yeah-ink border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-yeah-muted focus:outline-none focus:ring-2 focus:ring-yeah-yellow"
          />
        </div>

        {/* Slug */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-white/80">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="charlotte"
            className="w-full bg-yeah-ink border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-yeah-muted focus:outline-none focus:ring-2 focus:ring-yeah-yellow font-mono text-sm"
          />
          {slug && (
            <p className="text-xs text-yeah-muted">
              Will be served at{" "}
              <span className="text-yeah-teal">yeah{slug}.com</span>
            </p>
          )}
        </div>

        {/* Neighborhoods */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-white/80">
              Neighborhoods
            </label>
            <button
              type="button"
              onClick={suggestNeighborhoods}
              disabled={!cityName || loadingNeighborhoods}
              className="text-xs text-yeah-teal hover:underline disabled:opacity-40"
            >
              {loadingNeighborhoods ? "Loading..." : "AI Suggest"}
            </button>
          </div>

          {neighborhoods.length > 0 ? (
            <ul className="space-y-2">
              {neighborhoods.map((n, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-yeah-ink rounded-lg px-3 py-2"
                >
                  <span className="text-sm">
                    {n.name}{" "}
                    <span className="text-yeah-muted font-mono text-xs">
                      {n.slug}
                    </span>
                  </span>
                  <button
                    onClick={() => removeNeighborhood(i)}
                    className="text-yeah-muted hover:text-yeah-coral text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-yeah-muted text-sm">
              No neighborhoods yet. Use &ldquo;AI Suggest&rdquo; or add manually.
            </p>
          )}

          <button
            type="button"
            onClick={addNeighborhood}
            className="text-xs text-white/60 hover:text-white underline"
          >
            + Add manually
          </button>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !cityName}
          className="w-full bg-yeah-yellow text-yeah-navy font-display font-bold text-lg rounded-xl py-3 hover:bg-yellow-300 transition-colors disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save City"}
        </button>
      </div>
    </div>
  );
}
