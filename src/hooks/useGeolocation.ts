import { useState, useEffect } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "unsupported" };

export function useGeolocation(watch = false): [GeoState, () => void] {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  function request() {
    if (!navigator.geolocation) {
      setState({ status: "unsupported" });
      return;
    }
    setState({ status: "loading" });
    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 10000 };

    if (watch) {
      navigator.geolocation.watchPosition(
        (pos) =>
          setState({ status: "ok", lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) =>
          setState({ status: err.code === 1 ? "denied" : "unavailable" }),
        opts
      );
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setState({ status: "ok", lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) =>
          setState({ status: err.code === 1 ? "denied" : "unavailable" }),
        opts
      );
    }
  }

  useEffect(() => {
    if (watch) request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [state, request];
}
