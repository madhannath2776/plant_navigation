import { useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Same icon-path fix as MapView — safe to call more than once.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pinIcon = L.divIcon({
  html: `<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📌</div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const DEFAULT_CENTER: [number, number] = [11.0168, 76.9558]; // campus fallback

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  initialLat?: number;
  initialLon?: number;
  onConfirm: (lat: number, lon: number) => void;
  onCancel: () => void;
}

export default function LocationPicker({ initialLat, initialLon, onConfirm, onCancel }: Props) {
  const [pos, setPos] = useState<[number, number] | null>(
    initialLat !== undefined && initialLon !== undefined ? [initialLat, initialLon] : null
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-[#d8f3dc] flex items-center justify-between">
          <h3 className="font-display font-bold text-[#1a4731]">📍 Select Location on Map</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#95d5b2] text-2xl leading-none w-8 h-8 flex items-center justify-center hover:text-[#2d6a4f]"
          >
            ✕
          </button>
        </div>

        <div style={{ height: "320px" }}>
          <MapContainer
            center={pos ?? DEFAULT_CENTER}
            zoom={17}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={(lat, lon) => setPos([lat, lon])} />
            {pos && <Marker position={pos} icon={pinIcon} />}
          </MapContainer>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-[#3d5244] text-center">
            {pos ? (
              <>📌 {pos[0].toFixed(6)}, {pos[1].toFixed(6)}</>
            ) : (
              "Tap anywhere on the map to drop a pin"
            )}
          </p>
          <button
            type="button"
            disabled={!pos}
            onClick={() => pos && onConfirm(pos[0], pos[1])}
            className="w-full bg-[#2d6a4f] text-white rounded-xl py-3.5 font-semibold text-base disabled:opacity-50 hover:bg-[#1a4731] transition-colors"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
