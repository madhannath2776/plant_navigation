import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import type { Plant } from "@/types";
import { formatDistance, googleMapsNav } from "@/lib/geo";

// Fix default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userIcon = L.divIcon({
  html: `<div style="background:#2563eb;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const plantIcon = (nearest: boolean) =>
  L.divIcon({
    html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">${nearest ? "⭐" : "🌳"}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

function FlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  map.flyTo([lat, lon], 17, { duration: 1.2 });
  return null;
}

interface Props {
  plants: Plant[];
  userLat?: number;
  userLon?: number;
  nearestId?: string;
  flyToLat?: number;
  flyToLon?: number;
  height?: string;
}

export default function MapView({
  plants,
  userLat,
  userLon,
  nearestId,
  flyToLat,
  flyToLon,
  height = "400px",
}: Props) {
  const center: [number, number] =
    userLat && userLon
      ? [userLat, userLon]
      : plants.length
      ? [plants[0].latitude, plants[0].longitude]
      : [11.0168, 76.9558]; // default: Coimbatore

  return (
    <MapContainer
      center={center}
      zoom={16}
      style={{ height, width: "100%", borderRadius: "12px" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {flyToLat && flyToLon && <FlyTo lat={flyToLat} lon={flyToLon} />}

      {userLat && userLon && (
        <Marker position={[userLat, userLon]} icon={userIcon}>
          <Popup>📍 You are here</Popup>
        </Marker>
      )}

      {plants.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={plantIcon(p.id === nearestId)}
        >
          <Popup>
            <div className="min-w-[180px]">
              {p.photo_url && (
                <img
                  src={p.photo_url}
                  alt={p.plant_name}
                  className="w-full h-28 object-cover rounded-lg mb-2"
                />
              )}
              <p className="font-semibold text-[#1a4731]">{p.plant_name}</p>
              {p.landmark && (
                <p className="text-xs text-gray-500">Near {p.landmark}</p>
              )}
              {p.distance !== undefined && (
                <p className="text-xs text-[#2d6a4f] mt-1">
                  📍 {formatDistance(p.distance)}
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <Link
                  to={`/plant/${p.id}`}
                  className="text-xs bg-[#f0faf5] text-[#2d6a4f] border border-[#95d5b2] px-2 py-1 rounded-full"
                >
                  Details
                </Link>
                <a
                  href={googleMapsNav(p.latitude, p.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-[#2d6a4f] text-white px-2 py-1 rounded-full"
                >
                  Navigate
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
