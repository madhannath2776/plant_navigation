import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";

const MAX_ORIGINAL_FILE_BYTES = 15 * 1024 * 1024; // 15 MB — sanity cap before we even try to compress
const MAX_DIMENSION = 1600; // px, long edge — plenty for a plant photo, keeps uploads small
const JPEG_QUALITY = 0.8;

/** Resizes/compresses an image client-side so we never upload an
 * unnecessarily huge photo straight from a phone camera. Returns a new
 * File; falls back to the original file if anything goes wrong. */
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

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file; // compression is a nice-to-have, never block a submission over it
  }
}

export default function AddPlant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [geo, requestGeo] = useGeolocation();

  const [plantName, setPlantName] = useState("");
  const [landmark, setLandmark] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setPlantName("");
    setLandmark("");
    setImageFile(null);
    setImagePreview(null);
    setImageError("");
  }

  async function handleImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Please upload a valid image (JPG, PNG, etc.).");
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

  const hasLocation = geo.status === "ok";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/auth");
      return;
    }
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
    if (!hasLocation) {
      setError("Please capture your current location first.");
      return;
    }

    setLoading(true);
    setUploadPct(0);

    const ext = imageFile.type === "image/jpeg" ? "jpg" : (imageFile.name.split(".").pop() ?? "jpg");
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("plant-images")
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type || "image/jpeg" });

    if (uploadErr) {
      setError("Unable to connect. Please try again. (" + uploadErr.message + ")");
      setLoading(false);
      setUploadPct(null);
      return;
    }
    setUploadPct(100);

    const { data: urlData } = supabase.storage.from("plant-images").getPublicUrl(path);

    const { error: insertErr } = await supabase.from("plants").insert({
      plant_name: trimmedName,
      photo_url: urlData.publicUrl,
      latitude: geo.lat,
      longitude: geo.lon,
      landmark: landmark.trim() || null,
      submitted_by: user.id,
      status: "pending",
    });

    if (insertErr) {
      setError("Unable to save your plant. Please try again. (" + insertErr.message + ")");
      setLoading(false);
      setUploadPct(null);
      return;
    }

    // Points are awarded entirely server-side by a DB trigger on insert
    // (see supabase-schema.sql) — no client-side point mutation, so a user
    // can never grant themselves points directly.

    setSuccess(true);
    setLoading(false);
    setUploadPct(null);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#d8f3dc] text-center max-w-sm w-full">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="font-display font-bold text-2xl text-[#1a4731] mb-2">Submitted!</h2>
          <p className="text-[#52b788] mb-6">
            Your plant is waiting for admin verification. You'll earn points when it's approved!
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

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      <div className="bg-[#1a4731] px-4 py-6">
        <h1 className="font-display font-bold text-2xl text-white">📷 Add a Plant</h1>
        <p className="text-[#95d5b2] text-sm mt-1">Contribute a new plant to the campus map</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
        {/* Photo upload — required */}
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

        {/* GPS — required, captured automatically, never typed */}
        <div>
          <label className="block text-sm font-semibold text-[#1a4731] mb-2">
            Location <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={requestGeo}
            className="flex items-center justify-center gap-2 bg-[#d8f3dc] text-[#1a4731] rounded-xl px-4 py-3.5 text-base font-medium w-full hover:bg-[#95d5b2] transition-colors"
          >
            {geo.status === "loading" ? <span>⏳ Detecting…</span> : <span>📍 Use My Current Location</span>}
          </button>

          {geo.status === "ok" && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm">
              <p className="text-green-700 font-medium">✅ Location captured successfully</p>
              <p className="text-green-600 text-xs mt-0.5">
                Latitude: {geo.lat.toFixed(6)} &nbsp; Longitude: {geo.lon.toFixed(6)}
              </p>
            </div>
          )}
          {geo.status === "denied" && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              Location permission denied. Please enable location access to find nearby plants, then tap the
              button again.
            </p>
          )}
          {geo.status === "unsupported" && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              Your browser doesn't support location access.
            </p>
          )}
          {geo.status === "unavailable" && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              Couldn't determine your location. Please check your device's GPS/location settings and try again.
            </p>
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
          disabled={loading}
          className="w-full bg-[#2d6a4f] text-white rounded-2xl py-4 font-semibold text-lg hover:bg-[#1a4731] transition-colors disabled:opacity-60"
        >
          {loading
            ? uploadPct !== null && uploadPct < 100
              ? "Uploading photo…"
              : "Saving…"
            : "🌿 Add Plant"}
        </button>
      </form>
    </div>
  );
}
