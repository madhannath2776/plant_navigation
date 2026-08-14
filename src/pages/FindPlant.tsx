import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineMetres } from "@/lib/geo";
import type { Plant } from "@/types";
import PlantCard from "@/components/PlantCard";
import MapView from "@/components/MapView";

const DEBOUNCE_MS = 300;

interface NameSuggestion {
  plant_name: string;
  match_count: number;
}

export default function FindPlant() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [popular, setPopular] = useState<NameSuggestion[]>([]);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [results, setResults] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [geo, requestGeo] = useGeolocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get location once on mount so results can be distance-sorted as soon
  // as a plant name is picked.
  useEffect(() => {
    requestGeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Popular searches" — generated live from the database (most-contributed
  // approved plant names), never hardcoded.
  useEffect(() => {
    supabase
      .rpc("popular_plant_names", { max_results: 6 })
      .then(({ data, error }) => {
        if (!error && data) setPopular(data as NameSuggestion[]);
      });
  }, []);

  // Debounced, database-driven autocomplete. Every keystroke schedules a
  // fresh query against `search_plant_names`; only approved plants ever
  // come back, and the DB is the single source of truth for what shows up.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestLoading(false);
      setSuggestError("");
      return;
    }

    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_plant_names", {
        q,
        max_results: 8,
      });
      if (error) {
        setSuggestError("Unable to connect. Please try again.");
        setSuggestions([]);
      } else {
        setSuggestError("");
        setSuggestions((data as NameSuggestion[]) ?? []);
      }
      setSuggestLoading(false);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function selectPlantName(name: string) {
    setSelectedName(name);
    setQuery(name);
    setShowSuggestions(false);
    setLoading(true);
    setSearchError("");

    const hasGeo = geo.status === "ok";
    const { data, error } = await supabase.rpc("nearest_plants_by_name", {
      plant_name_query: name,
      user_lat: hasGeo ? geo.lat : null,
      user_lon: hasGeo ? geo.lon : null,
      max_results: 50,
    });

    if (error) {
      setSearchError("Unable to connect. Please try again.");
      setResults([]);
      setLoading(false);
      return;
    }

    let plants = ((data ?? []) as (Plant & { distance_metres: number | null })[]).map((p) => ({
      ...p,
      distance: p.distance_metres ?? undefined,
    })) as Plant[];

    // Fallback client-side sort/compute in case the RPC's distance came
    // back null (no location yet) but we have geo now.
    if (hasGeo) {
      plants = plants
        .map((p) => ({ ...p, distance: haversineMetres(geo.lat, geo.lon, p.latitude, p.longitude) }))
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }

    setResults(plants);
    setLoading(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Enter with no suggestion picked yet — use the top suggestion, or the
    // typed text verbatim as a fallback exact-name search.
    if (suggestions.length > 0) selectPlantName(suggestions[0].plant_name);
    else selectPlantName(q);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPlantName(suggestions[activeIndex].plant_name);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const userLat = geo.status === "ok" ? geo.lat : undefined;
  const userLon = geo.status === "ok" ? geo.lon : undefined;
  const nearest = results[0];

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      {/* Header */}
      <div className="bg-[#1a4731] px-4 py-6">
        <h1 className="font-display font-bold text-2xl text-white mb-1">Find a Plant</h1>
        <p className="text-[#95d5b2] text-sm">Search plants already added to campus</p>

        <form onSubmit={handleSubmit} className="mt-4 relative">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); setSelectedName(null); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing a plant name…"
            autoComplete="off"
            className="w-full rounded-2xl px-5 py-3.5 pr-14 text-sm text-[#1a4731] bg-white focus:outline-none shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2d6a4f] text-white rounded-xl w-10 h-10 flex items-center justify-center text-lg hover:bg-[#52b788] transition-colors"
          >
            🔎
          </button>

          {/* Autocomplete dropdown — entirely database-driven */}
          {showSuggestions && query.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-[#d8f3dc] overflow-hidden z-20 max-h-72 overflow-y-auto">
              {suggestLoading ? (
                <div className="px-4 py-3 text-sm text-[#95d5b2]">⏳ Searching…</div>
              ) : suggestError ? (
                <div className="px-4 py-3 text-sm text-red-500">{suggestError}</div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[#95d5b2]">
                  No approved plants found.{" "}
                  <a href="/add" className="text-[#52b788] underline">Add this plant!</a>
                </div>
              ) : (
                suggestions.map((s, i) => (
                  <button
                    key={s.plant_name}
                    type="button"
                    onMouseDown={() => selectPlantName(s.plant_name)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                      i === activeIndex ? "bg-[#f0faf5]" : "hover:bg-[#f0faf5]"
                    }`}
                  >
                    <span className="text-[#1a4731] font-medium">🌿 {s.plant_name}</span>
                    <span className="text-xs text-[#95d5b2]">
                      {s.match_count} {s.match_count === 1 ? "plant" : "plants"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </form>

        {/* GPS status */}
        <div className="mt-3 text-xs">
          {geo.status === "ok" && (
            <span className="text-[#52b788]">📍 Location detected — sorting by distance</span>
          )}
          {geo.status === "loading" && <span className="text-[#95d5b2]">⏳ Detecting location…</span>}
          {geo.status === "denied" && (
            <span className="text-yellow-300">
              ⚠️ Location permission denied. Enable location access to find nearby plants.
            </span>
          )}
          {geo.status === "unsupported" && (
            <span className="text-yellow-300">⚠️ Browser doesn't support location</span>
          )}
        </div>
      </div>

      {/* Popular searches — dynamic, from the DB, not hardcoded */}
      {!selectedName && popular.length > 0 && (
        <div className="px-4 mt-4">
          <p className="text-xs text-[#95d5b2] font-medium mb-2 uppercase tracking-wide">Popular on campus</p>
          <div className="flex flex-wrap gap-2">
            {popular.map((s) => (
              <button
                key={s.plant_name}
                onClick={() => selectPlantName(s.plant_name)}
                className="bg-white border border-[#d8f3dc] text-[#2d6a4f] text-sm px-4 py-1.5 rounded-full font-medium hover:bg-[#d8f3dc] transition-colors"
              >
                🌿 {s.plant_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl animate-bounce mb-3">🌱</div>
            <p className="text-[#95d5b2]">Searching plants…</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && selectedName && (
        <div className="px-4 mt-6">
          {searchError ? (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {searchError}
            </p>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3">🍃</p>
              <p className="font-display font-semibold text-[#1a4731] text-lg">No approved plants found</p>
              <p className="text-[#95d5b2] text-sm mt-1">
                Try a different name, or{" "}
                <a href="/add" className="text-[#52b788] underline">add this plant!</a>
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#95d5b2] mb-3">
                {results.length} {results.length !== 1 ? "plants" : "plant"} named "{selectedName}"
                {geo.status === "ok" ? " · sorted by distance" : ""}
              </p>

              <div className="mb-4 rounded-2xl overflow-hidden shadow-sm">
                <MapView
                  plants={results}
                  userLat={userLat}
                  userLon={userLon}
                  nearestId={nearest?.id}
                  flyToLat={nearest?.latitude}
                  flyToLon={nearest?.longitude}
                  height="240px"
                />
              </div>

              <div className="space-y-3">
                {results.map((p, i) => (
                  <PlantCard key={p.id} plant={p} nearest={i === 0} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
