import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineMetres } from "@/lib/geo";
import type { Plant } from "@/types";
import MapView from "@/components/MapView";

export default function MapExplore() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [geo, requestGeo] = useGeolocation();

  useEffect(() => {
    requestGeo();
    supabase
      .from("plants")
      .select("*")
      .eq("status", "approved")
      .then(({ data }) => {
        setPlants((data as Plant[]) ?? []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plantsWithDist =
    geo.status === "ok"
      ? plants.map((p) => ({
          ...p,
          distance: haversineMetres(geo.lat, geo.lon, p.latitude, p.longitude),
        }))
      : plants;

  const nearest = plantsWithDist.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0];

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      <div className="bg-[#1a4731] px-4 py-6">
        <h1 className="font-display font-bold text-2xl text-white">🗺️ Explore Map</h1>
        <p className="text-[#95d5b2] text-sm mt-1">
          {plants.length} verified plants on campus
        </p>
        <div className="mt-2 text-xs">
          {geo.status === "ok" && <span className="text-[#52b788]">📍 Your location detected</span>}
          {geo.status === "loading" && <span className="text-[#95d5b2]">⏳ Detecting location…</span>}
          {geo.status === "denied" && <span className="text-yellow-300">⚠️ Location denied</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl animate-bounce mb-3">🗺️</div>
            <p className="text-[#95d5b2]">Loading map…</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <MapView
              plants={plantsWithDist}
              userLat={geo.status === "ok" ? geo.lat : undefined}
              userLon={geo.status === "ok" ? geo.lon : undefined}
              nearestId={nearest?.id}
              height="calc(100vh - 220px)"
            />
          </div>

          <div className="mt-4 bg-white rounded-2xl p-4 border border-[#d8f3dc] flex items-center gap-3">
            <span className="text-2xl">ℹ️</span>
            <p className="text-sm text-[#3d5244]">
              Tap any plant marker to see details and navigate. <span className="text-yellow-500">⭐</span> marks the nearest plant to you.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
