import { Link } from "react-router-dom";
import type { Plant } from "@/types";
import { formatDistance, googleMapsNav } from "@/lib/geo";

interface Props {
  plant: Plant;
  nearest?: boolean;
}

export default function PlantCard({ plant, nearest }: Props) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-sm border ${
        nearest ? "border-[#52b788] ring-2 ring-[#52b788]/30" : "border-[#d8f3dc]"
      } overflow-hidden flex gap-3 p-3 relative`}
    >
      {nearest && (
        <span className="absolute top-2 right-2 text-xs bg-[#2d6a4f] text-white px-2 py-0.5 rounded-full font-medium">
          Nearest
        </span>
      )}

      {/* Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#d8f3dc] flex-shrink-0">
        {plant.photo_url ? (
          <img
            src={plant.photo_url}
            alt={plant.plant_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🌳</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-[#1a4731] text-base leading-tight">
          {plant.plant_name}
        </h3>
        {plant.distance !== undefined && (
          <p className="text-sm text-[#2d6a4f] font-semibold mt-1">
            📍 {formatDistance(plant.distance)}
            {plant.landmark && (
              <span className="text-[#95d5b2] font-normal ml-1">· Near {plant.landmark}</span>
            )}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <Link
            to={`/plant/${plant.id}`}
            className="text-xs bg-[#f0faf5] text-[#2d6a4f] border border-[#95d5b2] px-3 py-1 rounded-full font-medium hover:bg-[#d8f3dc] transition-colors"
          >
            Details
          </Link>
          <a
            href={googleMapsNav(plant.latitude, plant.longitude)}
            target="_blank"
            rel="noreferrer"
            className="text-xs bg-[#2d6a4f] text-white px-3 py-1 rounded-full font-medium hover:bg-[#1a4731] transition-colors"
          >
            🧭 Navigate
          </a>
        </div>
      </div>
    </div>
  );
}
