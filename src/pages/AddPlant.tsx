import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { gpsQuality } from "@/lib/geo";
import LocationPicker from "@/components/LocationPicker";
import type { LocationData } from "@/types";

const MAX_ORIGINAL_FILE_BYTES = 15 * 1024 * 1024; // 15 MB sanity cap before compression
const MAX_DIMENSION = 1600; // px, long edge
const JPEG_QUALITY = 0.8;

/** Resizes/compresses an image client-side. Returns a new File; falls
 * back to the original file if anything goes wrong. */
async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function uniqueStoragePath(userId: string, ext: string) {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${rand}.${ext}`;
}

export default function AddPlant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [geo, requestGeo] = useGeolocation();

  const [plantName, setPlantName] = useState("");
  const [landmark, setLandmark] = useState("");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");

  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const submittingRef = useRef(false); // belt-and-braces guard against double-click, on top of the disabled button
  const fileRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setPlantName("");
    setLandmark("");
    setLocation(null);
    setImageFile(null);
    setImagePreview(null);
    setImageError("");
  }

  async function handleImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Please upload a valid image (JPEG, PNG, or WEBP).");
      return;
    }
    if (file.size > MAX_ORIGINAL_FILE_BYTES) {
      setImageError("That image is too large. Please choose a photo under 15 MB.");
      return;
    }

    const compressed = await compressImage(file);
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  }

  // GPS reading resolved — turn it into a LocationData record.
  if (geo.status === "ok" && location?.source !== "gps") {
    setLocation({ source: "gps", latitude: geo.lat, longitude: geo.lon, accuracy: geo.accuracy });
  }

  function handleMapConfirm(lat: number, lon: number) {
    setLocation({ source: "map", latitude: lat, longitude: lon, accuracy: null });
    setShowMapPicker(false);
  }

  function changeLocation() {
    setLocation(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/auth");
      return;
    }
    if (submittingRef.current) return; // double-click guard
    setError("");

    const trimmedName = plantName.trim();
    if (!trimmedName) {
      setError("Please enter the plant's name.");
      return;
    }
    if (!imageFile) {
      setError("Please upload a valid image.");
      return;
    }
    if (!location) {
      setError("Please capture your location — use GPS or select it on the map.");
      return;
    }

    submittingRef.current = true;
    setStage("uploading");

    const ext = imageFile.type === "image/jpeg" ? "jpg" : (imageFile.name.split(".").pop() ?? "jpg");
    const path = uniqueStoragePath(user.id, ext);

    const { error: uploadErr } = await supabase.storage
      .from("plant-images")
      .upload(path, imageFile, { upsert: false, contentType: imageFile.type || "image/jpeg" });

    if (uploadErr) {
      setError("Unable to connect. Please try again. (" + uploadErr.message + ")");
      setStage("idle");
      submittingRef.current = false;
      return;
    }

    const { data: urlData } = supabase.storage.from("plant-images").getPublicUrl(path);
    setStage("saving");

    const { error: insertErr } = await supabase.from("plant_submissions").insert({
      plant_name: trimmedName,
      photo_url: urlData.publicUrl,
      latitude: location.latitude,
      longitude: location.longitude,
      location_accuracy: location.accuracy,
      location_source: location.source,
      landmark: landmark.trim() || null,
      submitted_by: user.id,
      status: "pending",
    });

    if (insertErr) {
      // The photo uploaded but the record didn't save — clean up the
      // orphaned file rather than leaving it in storage with nothing
      // pointing to it.
      await supabase.storage.from("plant-images").remove([path]);
      setError("Unable to save your plant. Please try again. (" + insertErr.message + ")");
      setStage("idle");
      submittingRef.current = false;
      return;
    }

    // Points are awarded entirely server-side by a DB trigger on insert
    // (see supabase-schema.sql) — never by a client-callable RPC.
    setSuccess(true);
    setStage("idle");
    submittingRef.current = false;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#d8f3dc] text-center max-w-sm w-full">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="font-display font-bold text-2xl text-[#1a4731] mb-2">Submitted!</h2>
          <p className="text-[#52b788] mb-6">
            Your plant has been submitted successfully. It will appear publicly after admin verification.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => { setSuccess(false); resetForm(); }}
              className="w-full bg-[#2d6a4f] text-white rounded-xl py-3 font-semibold hover:bg-[#1a4731] transition-colors"
            >
              Add Another Plant
            </button>
            <button
              onClick={() => navigate("/contributions")}
              className="w-full border border-[#d8f3dc] text-[#2d6a4f] rounded-xl py-3 font-semibold hover:bg-[#f0faf5] transition-colors"
            >
              View My Contributions
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#d8f3dc] text-center max-w-sm w-full">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-display font-bold text-2xl text-[#1a4731] mb-2">Sign in required</h2>
          <p className="text-[#95d5b2] mb-6">Please log in to add a plant to the campus map.</p>
          <button
            onClick={() => navigate("/auth")}
            className="w-full bg-[#2d6a4f] text-white rounded-xl py-3 font-semibold hover:bg-[#1a4731] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const quality = geo.status === "ok" ? gpsQuality(geo.accuracy) : null;
  const isSubmitting = stage !== "idle";

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      <div className="bg-[#1a4731] px-4 py-6">
        <h1 className="font-display font-bold text-2xl text-white">📷 Add a Plant</h1>
        <p className="text-[#95d5b2] text-sm mt-1">Contribute a new plant to the campus map</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
        {/* Photo — required */}
        <div>
          <label className="block text-sm font-semibold text-[#1a4731] mb-2">
            Plant Photo <span className="text-red-400">*</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed transition-colors ${
              imagePreview ? "border-[#52b788]" : "border-[#d8f3dc] hover:border-[#95d5b2]"
            } flex items-center justify-center overflow-hidden`}
            style={{ height: imagePreview ? "220px" : "140px" }}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-[#95d5b2]">
                <p className="text-4xl mb-1">📸</p>
                <p className="text-sm font-medium">Take / Upload Photo</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImage}
          />
          {imageError && <p className="text-red-500 text-xs mt-2">{imageError}</p>}
        </div>

        {/* Plant name — required */}
        <div>
          <label className="block text-sm font-semibold text-[#1a4731] mb-1">
            Plant Name <span className="text-red-400">*</span>
          </label>
          <input
            value={plantName}
            onChange={(e) => setPlantName(e.target.value)}
            required
            maxLength={100}
            placeholder="e.g. Neem, Coconut, Banyan, Banana"
            className="w-full border border-[#d8f3dc] rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#52b788] bg-white"
          />
        </div>

        {/* Location — GPS or map pin, never typed */}
        <div>
          <label className="block text-sm font-semibold text-[#1a4731] mb-2">
            Location <span className="text-red-400">*</span>
          </label>

          {!location ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={requestGeo}
                disabled={geo.status === "loading"}
                className="flex items-center justify-center gap-2 bg-[#d8f3dc] text-[#1a4731] rounded-xl px-4 py-3.5 text-base font-medium w-full hover:bg-[#95d5b2] transition-colors disabled:opacity-70"
              >
                {geo.status === "loading" ? <span>⏳ Detecting…</span> : <span>📍 Use My Current Location</span>}
              </button>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="flex items-center justify-center gap-2 bg-white border border-[#d8f3dc] text-[#2d6a4f] rounded-xl px-4 py-3.5 text-base font-medium w-full hover:bg-[#f0faf5] transition-colors"
              >
                🗺️ Select Location on Map
              </button>

              {geo.status === "denied" && (
                <p className="text-xs text-red-500 mt-1 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  Location permission was denied. Please enable location access and try again, or select your
                  location on the map instead.
                </p>
              )}
              {geo.status === "timeout" && (
                <p className="text-xs text-red-500 mt-1 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  Location request timed out. Please try again, or select your location on the map.
                </p>
              )}
              {geo.status === "unavailable" && (
                <p className="text-xs text-red-500 mt-1 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  Your device could not determine the current location. Please select it on the map instead.
                </p>
              )}
              {geo.status === "unsupported" && (
                <p className="text-xs text-red-500 mt-1 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  Your browser doesn't support location access. Please select your location on the map.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-green-700 font-medium text-sm">
                    {location.source === "gps" ? "📍 GPS location" : "📌 Location selected manually on map"}
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                  {location.source === "gps" && location.accuracy !== null && quality && (
                    <p className={`text-xs mt-1 font-medium ${quality.colorClass}`}>
                      Accuracy: {Math.round(location.accuracy)} m ({quality.label})
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={changeLocation}
                  className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-full font-medium hover:bg-green-100 transition-colors flex-shrink-0"
                >
                  Change
                </button>
              </div>

              {location.source === "gps" && location.accuracy !== null && location.accuracy > 100 && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-xs text-yellow-700">
                    ⚠️ GPS accuracy is currently {Math.round(location.accuracy)} m. Please move to an open area
                    and retry, or select the location manually on the map.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={requestGeo}
                      className="text-xs bg-white border border-yellow-300 text-yellow-800 px-3 py-1.5 rounded-full font-medium hover:bg-yellow-50"
                    >
                      Retry Location
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="text-xs bg-white border border-yellow-300 text-yellow-800 px-3 py-1.5 rounded-full font-medium hover:bg-yellow-50"
                    >
                      Select on Map
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Landmark — optional */}
        <div>
          <label className="block text-sm font-semibold text-[#1a4731] mb-1">Landmark</label>
          <input
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            maxLength={120}
            placeholder="e.g. Near Library / Near Canteen"
            className="w-full border border-[#d8f3dc] rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#52b788] bg-white"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#2d6a4f] text-white rounded-2xl py-4 font-semibold text-lg hover:bg-[#1a4731] transition-colors disabled:opacity-60"
        >
          {stage === "uploading" ? "Uploading photo…" : stage === "saving" ? "Submitting plant…" : "🌿 Add Plant"}
        </button>
      </form>

      {showMapPicker && (
        <LocationPicker
          initialLat={location?.latitude}
          initialLon={location?.longitude}
          onConfirm={handleMapConfirm}
          onCancel={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
}
