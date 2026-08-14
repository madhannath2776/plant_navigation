/** Haversine distance in metres between two lat/lon points */
export function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function googleMapsNav(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export interface GpsQuality {
  label: "Excellent" | "Good" | "Fair" | "Poor";
  colorClass: string;
}

/** Honest classification of GPS accuracy in metres — never fabricated,
 * always derived from the real value the browser reported. */
export function gpsQuality(accuracyMetres: number): GpsQuality {
  if (accuracyMetres <= 20) return { label: "Excellent", colorClass: "text-green-600" };
  if (accuracyMetres <= 50) return { label: "Good", colorClass: "text-green-500" };
  if (accuracyMetres <= 100) return { label: "Fair", colorClass: "text-yellow-600" };
  return { label: "Poor", colorClass: "text-red-500" };
}
