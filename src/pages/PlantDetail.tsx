import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineMetres, formatDistance, googleMapsNav } from "@/lib/geo";
import MapView from "@/components/MapView";
import type { Plant } from "@/types";

export default function PlantDetail() {
  const { id } = useParams<{ id: string }>();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [geo, requestGeo] = useGeolocation();

  useEffect(() => {
    requestGeo();
    if (!id) return;
    supabase
      .from("plants")
      .select("*, profiles!submitted_by(name)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        setPlant((data as Plant | null) ?? null);
        setNotFound(!!error || !data);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0faf5]">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">🌿</div>
          <p className="text-[#95d5b2]">Loading plant…</p>
        </div>
      </div>
    );
  }

  if (notFound || !plant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
        <div className="text-center">
          <p className="text-5xl mb-3">🍃</p>
          <p className="font-display font-semibold text-[#1a4731] text-xl">Plant not found</p>
          <Link to="/find" className="text-[#52b788] underline mt-2 block">Back to search</Link>
        </div>
      </div>
    );
  }

  const distance =
    geo.status === "ok"
      ? haversineMetres(geo.lat, geo.lon, plant.latitude, plant.longitude)
      : null;

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      {/* Image */}
      <div className="relative h-64 bg-[#d8f3dc]">
        {plant.photo_url ? (
          <img src={plant.photo_url} alt={plant.plant_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl">🌳</div>
        )}
        <Link
          to="/find"
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-[#1a4731] shadow-sm hover:bg-white transition-colors"
        >
          ←
        </Link>
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#d8f3dc]">
          <h1 className="font-display font-bold text-2xl text-[#1a4731] mb-4">
            🌿 {plant.plant_name}
          </h1>

          {/* Distance */}
          {distance !== null && (
            <div className="bg-[#f0faf5] rounded-2xl p-3 mb-4 flex items-center gap-2">
              <span className="text-lg">📍</span>
              <div>
                <p className="font-semibold text-[#2d6a4f]">{formatDistance(distance)} away</p>
                {plant.landmark && (
                  <p className="text-xs text-[#95d5b2]">📌 Near {plant.landmark}</p>
                )}
              </div>
            </div>
          )}
          {distance === null && plant.landmark && (
            <div className="bg-[#f0faf5] rounded-2xl p-3 mb-4">
              <p className="text-sm font-medium text-[#1a4731]">📌 Near {plant.landmark}</p>
            </div>
          )}

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#f0faf5] rounded-xl p-3">
              <p className="text-xs text-[#95d5b2] mb-0.5">Latitude</p>
              <p className="text-sm font-medium text-[#1a4731]">{plant.latitude.toFixed(5)}</p>
            </div>
            <div className="bg-[#f0faf5] rounded-xl p-3">
              <p className="text-xs text-[#95d5b2] mb-0.5">Longitude</p>
              <p className="text-sm font-medium text-[#1a4731]">{plant.longitude.toFixed(5)}</p>
            </div>
          </div>

          {/* Navigate button */}
          <a
            href={googleMapsNav(plant.latitude, plant.longitude)}
            target="_blank"
            rel="noreferrer"
            className="block w-full bg-[#2d6a4f] text-white text-center rounded-2xl py-4 font-semibold text-lg hover:bg-[#1a4731] transition-colors"
          >
            🧭 Get Directions
          </a>
        </div>

        {/* Map */}
        <div className="mt-4 rounded-2xl overflow-hidden shadow-sm">
          <MapView
            plants={[{ ...plant, distance: distance ?? undefined }]}
            userLat={geo.status === "ok" ? geo.lat : undefined}
            userLon={geo.status === "ok" ? geo.lon : undefined}
            height="240px"
          />
        </div>

        {/* Contributor */}
        {plant.profiles && (
          <div className="mt-4 bg-white rounded-2xl p-4 border border-[#d8f3dc] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#d8f3dc] flex items-center justify-center text-lg">🧑</div>
            <div>
              <p className="text-xs text-[#95d5b2]">Contributed by</p>
              <p className="font-semibold text-[#1a4731]">{plant.profiles.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
