import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { AdminStatistics, PlantSubmission } from "@/types";
import MapView from "@/components/MapView";
import LocationPicker from "@/components/LocationPicker";

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PlantSubmission[]>([]);
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLandmark, setEditLandmark] = useState("");
  const [editLatLon, setEditLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [showMapEditFor, setShowMapEditFor] = useState<string | null>(null);
  const [mapViewFor, setMapViewFor] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!authLoading && profile?.role !== "admin") {
      navigate("/");
      return;
    }
    if (profile?.role === "admin") {
      fetchPending();
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading]);

  async function fetchPending() {
    setLoadError("");
    const { data, error } = await supabase
      .from("plant_submissions")
      .select("*, profiles!submitted_by(name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      setLoadError("Unable to connect. Please try again.");
    } else {
      setPending((data as PlantSubmission[]) ?? []);
    }
    setLoading(false);
  }

  // Statistics always come from live database queries, never from stale
  // client state — pending is never folded into the verified total.
  async function fetchStats() {
    const [pendingC, rejectedC, plantsC, contributorsC] = await Promise.all([
      supabase.from("plant_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("plant_submissions").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("plants").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      pending: pendingC.count ?? 0,
      rejected: rejectedC.count ?? 0,
      approved: plantsC.count ?? 0,
      totalPlants: plantsC.count ?? 0,
      contributors: contributorsC.count ?? 0,
    });
  }

  function startEdit(sub: PlantSubmission) {
    setEditingId(sub.id);
    setEditName(sub.plant_name);
    setEditLandmark(sub.landmark ?? "");
    setEditLatLon(null); // null = no override; falls back to the submission's own coordinates
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLatLon(null);
  }

  async function approve(sub: PlantSubmission) {
    setActionLoading(sub.id);
    setActionError("");

    const isEditingThis = editingId === sub.id;
    const { error } = await supabase.rpc("approve_plant_submission", {
      submission_id: sub.id,
      override_plant_name: isEditingThis ? editName.trim() : null,
      override_latitude: isEditingThis && editLatLon ? editLatLon.lat : null,
      override_longitude: isEditingThis && editLatLon ? editLatLon.lon : null,
      override_landmark: isEditingThis ? editLandmark.trim() : null,
    });

    if (error) {
      // e.g. "Submission has already been reviewed" if double-clicked, or
      // an RLS/auth failure — either way, nothing was left half-done,
      // since the RPC is atomic.
      setActionError(error.message);
      setActionLoading(null);
      return;
    }

    setPending((prev) => prev.filter((p) => p.id !== sub.id));
    setEditingId(null);
    setActionLoading(null);
    fetchStats();
  }

  function openReject(id: string) {
    setRejectingId(id);
    setRejectReason("");
  }

  async function confirmReject() {
    if (!rejectingId) return;
    setActionLoading(rejectingId);
    setActionError("");

    const { error } = await supabase.rpc("reject_plant_submission", {
      submission_id: rejectingId,
      reason: rejectReason.trim() || null,
    });

    if (error) {
      setActionError(error.message);
      setActionLoading(null);
      return;
    }

    setPending((prev) => prev.filter((p) => p.id !== rejectingId));
    setRejectingId(null);
    setActionLoading(null);
    fetchStats();
  }

  if (authLoading) return null;
  if (profile?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      <div className="bg-[#1a4731] px-4 py-6">
        <h1 className="font-display font-bold text-2xl text-white">🛡️ Admin Dashboard</h1>
        <p className="text-[#95d5b2] text-sm mt-1">
          {pending.length} pending submission{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats overview — kept strictly separate: pending is never added into verified total */}
      {stats && (
        <div className="px-4 -mt-4 relative z-10">
          <div className="bg-white rounded-2xl shadow-sm border border-[#d8f3dc] grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#d8f3dc]">
            {[
              { label: "Pending", value: stats.pending, color: "text-yellow-500" },
              { label: "Verified Plants", value: stats.totalPlants, color: "text-green-600" },
              { label: "Rejected", value: stats.rejected, color: "text-red-500" },
              { label: "Contributors", value: stats.contributors, color: "text-[#2d6a4f]" },
            ].map((s) => (
              <div key={s.label} className="p-3 text-center">
                <p className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-[#95d5b2] mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {actionError && (
        <div className="px-4 mt-4">
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{actionError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl animate-bounce mb-3">🌿</div>
            <p className="text-[#95d5b2]">Loading submissions…</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="text-center py-16 px-4">
          <p className="text-5xl mb-3">⚠️</p>
          <p className="text-red-500">{loadError}</p>
          <button onClick={fetchPending} className="mt-4 text-[#52b788] underline text-sm">
            Try Again
          </button>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-display font-semibold text-[#1a4731] text-xl">All caught up!</p>
          <p className="text-[#95d5b2] mt-2">No pending submissions right now.</p>
        </div>
      ) : (
        <div className="px-4 py-6 space-y-6">
          {pending.map((sub) => {
            const isEditing = editingId === sub.id;
            const effectiveLat = isEditing && editLatLon ? editLatLon.lat : sub.latitude;
            const effectiveLon = isEditing && editLatLon ? editLatLon.lon : sub.longitude;

            return (
              <div key={sub.id} className="bg-white rounded-2xl border border-[#d8f3dc] overflow-hidden shadow-sm">
                {sub.photo_url && (
                  <img src={sub.photo_url} alt={sub.plant_name} className="w-full h-48 object-cover" />
                )}

                <div className="p-4">
                  {/* Submitter */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-[#d8f3dc] flex items-center justify-center text-sm">🧑</div>
                    <div>
                      <p className="text-xs text-[#95d5b2]">Submitted by</p>
                      <p className="text-sm font-medium text-[#1a4731]">
                        {(sub.profiles as { name?: string } | undefined)?.name ?? "Unknown"}
                      </p>
                    </div>
                    <span className="ml-auto text-xs text-[#95d5b2]">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-xs text-[#95d5b2] mb-1">Plant Name</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#95d5b2] mb-1">Landmark</label>
                        <input
                          value={editLandmark}
                          onChange={(e) => setEditLandmark(e.target.value)}
                          className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788]"
                        />
                      </div>
                      <div className="flex items-center justify-between bg-[#f0faf5] rounded-xl px-3 py-2">
                        <span className="text-xs text-[#3d5244]">
                          📍 {effectiveLat.toFixed(6)}, {effectiveLon.toFixed(6)}
                          {editLatLon && <span className="text-yellow-600 font-medium"> (corrected)</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowMapEditFor(sub.id)}
                          className="text-xs bg-white border border-[#d8f3dc] text-[#2d6a4f] px-3 py-1 rounded-full font-medium hover:bg-[#d8f3dc]"
                        >
                          Edit Location
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <h3 className="font-display font-bold text-lg text-[#1a4731]">🌿 {sub.plant_name}</h3>
                      {sub.landmark && <p className="text-sm text-[#3d5244] mt-1">📌 Near {sub.landmark}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-[#95d5b2]">
                          📍 {sub.latitude.toFixed(5)}, {sub.longitude.toFixed(5)}
                        </span>
                        <span className="text-xs bg-[#f0faf5] text-[#2d6a4f] px-2 py-0.5 rounded-full font-medium">
                          {sub.location_source === "gps"
                            ? `GPS${sub.location_accuracy ? ` · ${Math.round(sub.location_accuracy)} m` : ""}`
                            : sub.location_source === "map"
                            ? "Map-selected"
                            : sub.location_source === "admin_corrected"
                            ? "Admin-corrected"
                            : "Legacy"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Mini map */}
                  <button
                    type="button"
                    onClick={() => setMapViewFor(mapViewFor === sub.id ? null : sub.id)}
                    className="text-xs text-[#52b788] underline mb-2"
                  >
                    {mapViewFor === sub.id ? "Hide map" : "View Location on Map"}
                  </button>
                  {mapViewFor === sub.id && (
                    <div className="rounded-xl overflow-hidden mb-4">
                      <MapView
                        plants={[{
                          id: sub.id,
                          plant_name: sub.plant_name,
                          photo_url: sub.photo_url,
                          latitude: effectiveLat,
                          longitude: effectiveLon,
                          landmark: sub.landmark,
                          submitted_by: sub.submitted_by,
                          created_at: sub.created_at,
                          updated_at: sub.updated_at,
                        }]}
                        height="160px"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => approve(sub)}
                      disabled={actionLoading === sub.id}
                      className="flex-1 bg-green-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60"
                    >
                      {actionLoading === sub.id ? "…" : "✅ Approve"}
                    </button>
                    <button
                      onClick={() => openReject(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-60"
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={() => (isEditing ? cancelEdit() : startEdit(sub))}
                      className="px-4 bg-[#f0faf5] border border-[#d8f3dc] text-[#2d6a4f] rounded-xl py-2.5 font-semibold text-sm hover:bg-[#d8f3dc] transition-colors"
                    >
                      {isEditing ? "Cancel" : "✏️ Edit"}
                    </button>
                  </div>
                </div>

                {showMapEditFor === sub.id && (
                  <LocationPicker
                    initialLat={effectiveLat}
                    initialLon={effectiveLon}
                    onConfirm={(lat, lon) => { setEditLatLon({ lat, lon }); setShowMapEditFor(null); }}
                    onCancel={() => setShowMapEditFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-5">
            <h3 className="font-display font-bold text-[#1a4731] mb-1">Reject submission</h3>
            <p className="text-xs text-[#95d5b2] mb-3">Optional — helps the contributor understand why.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {["Duplicate", "Wrong plant", "Wrong location", "Invalid photo", "Spam", "Outside campus"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    rejectReason === r
                      ? "bg-[#2d6a4f] text-white border-[#2d6a4f]"
                      : "bg-white text-[#2d6a4f] border-[#d8f3dc] hover:border-[#52b788]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              placeholder="Reason (optional)"
              className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788] resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectingId(null)}
                className="flex-1 border border-[#d8f3dc] text-[#2d6a4f] rounded-xl py-2.5 font-semibold text-sm hover:bg-[#f0faf5]"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={actionLoading === rejectingId}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-red-600 disabled:opacity-60"
              >
                {actionLoading === rejectingId ? "…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
