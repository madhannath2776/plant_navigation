import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Plant } from "@/types";
import MapView from "@/components/MapView";

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  contributors: number;
}

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Plant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Plant | null>(null);
  const [editForm, setEditForm] = useState<Partial<Plant>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    const { data } = await supabase
      .from("plants")
      .select("*, profiles(name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setPending((data as Plant[]) ?? []);
    setLoading(false);
  }

  async function fetchStats() {
    const [pendingC, approvedC, rejectedC, totalC, contributorsC] = await Promise.all([
      supabase.from("plants").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("plants").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("plants").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("plants").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      pending: pendingC.count ?? 0,
      approved: approvedC.count ?? 0,
      rejected: rejectedC.count ?? 0,
      total: totalC.count ?? 0,
      contributors: contributorsC.count ?? 0,
    });
  }

  async function approve(plant: Plant) {
    setActionLoading(plant.id);
    const updates = editing?.id === plant.id ? editForm : {};
    const { error } = await supabase
      .from("plants")
      .update({
        status: "approved",
        verified_by: profile?.id,
        verified_at: new Date().toISOString(),
        ...updates,
      })
      .eq("id", plant.id);

    if (!error) {
      // Points are awarded entirely server-side by a DB trigger on this
      // status change (10 pts, +20 first-species bonus) — see
      // supabase-schema.sql. No client-side point mutation happens here.
      setPending((prev) => prev.filter((p) => p.id !== plant.id));
      setEditing(null);
      fetchStats();
    }
    setActionLoading(null);
  }

  async function reject(plant: Plant) {
    setActionLoading(plant.id);
    await supabase.from("plants").update({ status: "rejected" }).eq("id", plant.id);
    setPending((prev) => prev.filter((p) => p.id !== plant.id));
    setActionLoading(null);
    fetchStats();
  }

  if (authLoading) return null;
  if (profile?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      <div className="bg-[#1a4731] px-4 py-6">
        <h1 className="font-display font-bold text-2xl text-white">⚙️ Admin Dashboard</h1>
        <p className="text-[#95d5b2] text-sm mt-1">
          {pending.length} pending submission{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="px-4 -mt-4 relative z-10">
          <div className="bg-white rounded-2xl shadow-sm border border-[#d8f3dc] grid grid-cols-3 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-[#d8f3dc]">
            {[
              { label: "Pending", value: stats.pending, color: "text-yellow-500" },
              { label: "Approved", value: stats.approved, color: "text-green-600" },
              { label: "Rejected", value: stats.rejected, color: "text-red-500" },
              { label: "Total Plants", value: stats.total, color: "text-[#2d6a4f]" },
              { label: "Contributors", value: stats.contributors, color: "text-[#2d6a4f]" },
            ].map((s) => (
              <div key={s.label} className="p-3 text-center">
                <p className={`font-display font-bold text-xl ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-[#95d5b2] mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl animate-bounce mb-3">🌿</div>
            <p className="text-[#95d5b2]">Loading submissions…</p>
          </div>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-display font-semibold text-[#1a4731] text-xl">All caught up!</p>
          <p className="text-[#95d5b2] mt-2">No pending submissions right now.</p>
        </div>
      ) : (
        <div className="px-4 py-6 space-y-6">
          {pending.map((plant) => {
            const isEditing = editing?.id === plant.id;
            return (
              <div key={plant.id} className="bg-white rounded-2xl border border-[#d8f3dc] overflow-hidden shadow-sm">
                {plant.photo_url && (
                  <img
                    src={plant.photo_url}
                    alt={plant.plant_name}
                    className="w-full h-48 object-cover"
                  />
                )}

                <div className="p-4">
                  {/* Submitter */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-[#d8f3dc] flex items-center justify-center text-sm">🧑</div>
                    <div>
                      <p className="text-xs text-[#95d5b2]">Submitted by</p>
                      <p className="text-sm font-medium text-[#1a4731]">
                        {(plant.profiles as { name?: string } | undefined)?.name ?? "Unknown"}
                      </p>
                    </div>
                    <span className="ml-auto text-xs text-[#95d5b2]">
                      {new Date(plant.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Fields — editable if in edit mode */}
                  {isEditing ? (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-xs text-[#95d5b2] mb-1">Plant Name</label>
                        <input
                          value={editForm.plant_name ?? plant.plant_name}
                          onChange={(e) => setEditForm((f) => ({ ...f, plant_name: e.target.value }))}
                          className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#95d5b2] mb-1">Landmark</label>
                        <input
                          value={editForm.landmark ?? plant.landmark ?? ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, landmark: e.target.value }))}
                          className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-[#95d5b2] mb-1">Latitude</label>
                          <input
                            type="number"
                            step="any"
                            value={editForm.latitude ?? plant.latitude}
                            onChange={(e) => setEditForm((f) => ({ ...f, latitude: parseFloat(e.target.value) }))}
                            className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#95d5b2] mb-1">Longitude</label>
                          <input
                            type="number"
                            step="any"
                            value={editForm.longitude ?? plant.longitude}
                            onChange={(e) => setEditForm((f) => ({ ...f, longitude: parseFloat(e.target.value) }))}
                            className="w-full border border-[#d8f3dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#52b788]"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <h3 className="font-display font-bold text-lg text-[#1a4731]">🌿 {plant.plant_name}</h3>
                      {plant.landmark && (
                        <p className="text-sm text-[#3d5244] mt-1">📌 Near {plant.landmark}</p>
                      )}
                      <p className="text-xs text-[#95d5b2] mt-2">
                        📍 {plant.latitude.toFixed(5)}, {plant.longitude.toFixed(5)}
                      </p>
                    </div>
                  )}

                  {/* Mini map */}
                  <div className="rounded-xl overflow-hidden mb-4">
                    <MapView plants={[plant]} height="160px" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => approve(plant)}
                      disabled={actionLoading === plant.id}
                      className="flex-1 bg-green-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60"
                    >
                      {actionLoading === plant.id ? "…" : "✅ Approve"}
                    </button>
                    <button
                      onClick={() => reject(plant)}
                      disabled={actionLoading === plant.id}
                      className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-60"
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={() => {
                        if (isEditing) { setEditing(null); setEditForm({}); }
                        else { setEditing(plant); setEditForm({}); }
                      }}
                      className="px-4 bg-[#f0faf5] border border-[#d8f3dc] text-[#2d6a4f] rounded-xl py-2.5 font-semibold text-sm hover:bg-[#d8f3dc] transition-colors"
                    >
                      {isEditing ? "Cancel" : "✏️ Edit"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
