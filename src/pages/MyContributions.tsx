import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { PlantSubmission, SubmissionStatus } from "@/types";
import BadgeList from "@/components/Badge";

const statusConfig: Record<SubmissionStatus, { icon: string; label: string; color: string }> = {
  approved: { icon: "🟢", label: "Approved", color: "text-green-600 bg-green-50 border-green-200" },
  pending: { icon: "🟡", label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  rejected: { icon: "🔴", label: "Rejected", color: "text-red-500 bg-red-50 border-red-200" },
};

export default function MyContributions() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<PlantSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function load() {
    setError("");
    // `plant_submissions` is the permanent audit trail of everything this
    // user has ever submitted — pending, approved, or rejected — so it's
    // the single source of truth for this page, rather than trying to
    // merge two tables.
    supabase
      .from("plant_submissions")
      .select("*")
      .eq("submitted_by", user!.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError("Unable to connect. Please try again.");
        setSubmissions((data as PlantSubmission[]) ?? []);
        setLoading(false);
      });
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="font-display font-bold text-xl text-[#1a4731] mb-3">Sign in to view your contributions</h2>
          <button
            onClick={() => navigate("/auth")}
            className="bg-[#2d6a4f] text-white px-6 py-3 rounded-2xl font-semibold hover:bg-[#1a4731] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const approved = submissions.filter((s) => s.status === "approved");
  const pending = submissions.filter((s) => s.status === "pending");

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      {/* Header */}
      <div className="bg-[#1a4731] px-4 py-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">My Contributions</h1>
          <p className="text-[#95d5b2] text-sm mt-1">{profile?.name ?? "Your"} plant journey</p>
        </div>
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="text-xs bg-[#2d6a4f] text-white px-3 py-1.5 rounded-full font-medium hover:bg-[#52b788] transition-colors flex-shrink-0"
        >
          Sign Out
        </button>
      </div>

      {/* Stats card */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-sm border border-[#d8f3dc] p-4">
          <div className="grid grid-cols-4 divide-x divide-[#d8f3dc]">
            <div className="text-center px-2">
              <p className="font-display font-bold text-2xl text-[#2d6a4f]">{submissions.length}</p>
              <p className="text-xs text-[#95d5b2]">Total</p>
            </div>
            <div className="text-center px-2">
              <p className="font-display font-bold text-2xl text-green-600">{approved.length}</p>
              <p className="text-xs text-[#95d5b2]">Approved</p>
            </div>
            <div className="text-center px-2">
              <p className="font-display font-bold text-2xl text-yellow-500">{pending.length}</p>
              <p className="text-xs text-[#95d5b2]">Pending</p>
            </div>
            <div className="text-center px-2">
              <p className="font-display font-bold text-2xl text-[#2d6a4f]">{profile?.points ?? 0}</p>
              <p className="text-xs text-[#95d5b2]">Points</p>
            </div>
          </div>

          {approved.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#d8f3dc]">
              <BadgeList count={approved.length} />
            </div>
          )}
        </div>
      </div>

      {/* Submissions list */}
      <div className="px-4 mt-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl animate-bounce mb-3">🌿</div>
            <p className="text-[#95d5b2]">Loading your plants…</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">⚠️</p>
            <p className="text-red-500">{error}</p>
            <button onClick={load} className="mt-3 text-[#52b788] underline text-sm">Try Again</button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">🌱</p>
            <p className="font-display font-semibold text-[#1a4731] text-lg mb-2">No contributions yet</p>
            <p className="text-[#95d5b2] text-sm mb-6">Start by adding your first plant!</p>
            <Link
              to="/add"
              className="bg-[#2d6a4f] text-white px-6 py-3 rounded-2xl font-semibold hover:bg-[#1a4731] transition-colors"
            >
              📷 Add a Plant
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => {
              const cfg = statusConfig[s.status];
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-[#d8f3dc] p-4 flex gap-3 shadow-sm">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#d8f3dc] flex-shrink-0">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.plant_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🌳</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-semibold text-[#1a4731]">{s.plant_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    {s.landmark && <p className="text-xs text-[#95d5b2] mt-0.5">📌 Near {s.landmark}</p>}

                    {s.status === "approved" && (
                      <p className="text-xs text-green-600 font-semibold mt-1">✅ Now visible on the public map</p>
                    )}
                    {s.status === "pending" && (
                      <p className="text-xs text-yellow-600 mt-1">Awaiting admin review</p>
                    )}
                    {s.status === "rejected" && (
                      <p className="text-xs text-red-500 mt-1">
                        ❌ Rejected{s.rejection_reason ? ` — ${s.rejection_reason}` : ""}
                      </p>
                    )}
                    <p className="text-xs text-[#95d5b2] mt-1">{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && submissions.length > 0 && (
        <div className="px-4 mt-6">
          <Link
            to="/add"
            className="block w-full bg-[#2d6a4f] text-white text-center rounded-2xl py-4 font-semibold hover:bg-[#1a4731] transition-colors"
          >
            📷 Add Another Plant
          </Link>
        </div>
      )}
    </div>
  );
}
