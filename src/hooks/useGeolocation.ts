import { useState, useRef, useCallback, useEffect } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lon: number; accuracy: number }
  | { status: "denied" }
  | { status: "timeout" }
  | { status: "unavailable" }
  | { status: "unsupported" };

// Collect readings for a short window and keep the most accurate one,
// rather than blindly averaging or trusting the very first fix (which is
// often the least accurate on mobile).
const COLLECTION_WINDOW_MS = 4000;
const EXCELLENT_ACCURACY_M = 15; // good enough to stop early
const MAX_READINGS = 5;
const GEOLOCATION_TIMEOUT_MS = 20000;

export function useGeolocation(): [GeoState, () => void] {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const watchIdRef = useRef<number | null>(null);
  const bestRef = useRef<{ lat: number; lon: number; accuracy: number } | null>(null);
  const readingsRef = useRef(0);
  const windowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (windowTimerRef.current) {
      clearTimeout(windowTimerRef.current);
      windowTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    cleanup();
    if (bestRef.current) {
      setState({ status: "ok", lat: bestRef.current.lat, lon: bestRef.current.lon, accuracy: bestRef.current.accuracy });
    } else {
      setState({ status: "unavailable" });
    }
  }, [cleanup]);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: "unsupported" });
      return;
    }
    cleanup();
    bestRef.current = null;
    readingsRef.current = 0;
    setState({ status: "loading" });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        readingsRef.current += 1;
        const { latitude, longitude, accuracy } = pos.coords;
        if (!bestRef.current || accuracy < bestRef.current.accuracy) {
          bestRef.current = { lat: latitude, lon: longitude, accuracy };
        }
        if (accuracy <= EXCELLENT_ACCURACY_M || readingsRef.current >= MAX_READINGS) {
          finish(); // good enough, or we've sampled enough — stop now
        } else if (!windowTimerRef.current) {
          windowTimerRef.current = setTimeout(finish, COLLECTION_WINDOW_MS);
        }
      },
      (err) => {
        if (bestRef.current) {
          // Already have at least one usable reading — prefer it over a
          // late error from a subsequent watch tick.
          finish();
          return;
        }
        cleanup();
        if (err.code === err.PERMISSION_DENIED) setState({ status: "denied" });
        else if (err.code === err.TIMEOUT) setState({ status: "timeout" });
        else setState({ status: "unavailable" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GEOLOCATION_TIMEOUT_MS }
    );
  }, [cleanup, finish]);

  // Never leak a watch/timer if the component unmounts mid-request.
  useEffect(() => cleanup, [cleanup]);

  return [state, request];
}
