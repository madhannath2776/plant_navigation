import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { LeaderboardEntry } from "@/types";
import { getBadge } from "@/components/Badge";

const medals = ["🥇", "🥈", "🥉"];

export default function Home() {
  const [top3, setTop3] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState({ plants: 0, contributors: 0 });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, name, avatar_url, points")
      .order("points", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!data) return;
        const entries = data as (typeof data[0] & { verified_count?: number })[];
        Promise.all(
          entries.map((p) =>
            supabase
              .from("plants")
              .select("id", { count: "exact" })
              .eq("submitted_by", p.id)
              .eq("status", "approved")
              .then(({ count }) => ({
                id: p.id,
                name: p.name,
                avatar_url: p.avatar_url,
                points: p.points,
                verified_count: count ?? 0,
              }))
          )
        ).then(setTop3);
      });

    supabase
      .from("plants")
      .select("id", { count: "exact" })
      .eq("status", "approved")
      .then(({ count }) => setStats((s) => ({ ...s, plants: count ?? 0 })));

    supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .then(({ count }) => setStats((s) => ({ ...s, contributors: count ?? 0 })));
  }, []);

  return (
    <div className="min-h-screen bg-[#f0faf5] pb-24 pt-16">
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1a4731 0%, #2d6a4f 60%, #52b788 100%)",
        }}
      >
        <div className="px-5 py-12 relative z-10">
          <div className="text-6xl mb-4">🌿</div>
          <h1 className="font-display font-bold text-4xl text-white leading-tight mb-3">
            Campus Plant<br />Navigation
          </h1>
          <p className="text-[#d8f3dc] text-base max-w-xs mb-8">
            Discover and navigate to plants and trees around your campus.
          </p>

          <div className="flex flex-col gap-3 max-w-xs">
            <Link
              to="/find"
              className="flex items-center gap-3 bg-white text-[#1a4731] rounded-2xl px-5 py-3.5 font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              <span className="text-xl">🔎</span>
              Find a Plant
            </Link>
            <div className="flex gap-3">
              <Link
                to="/add"
                className="flex-1 flex items-center gap-2 bg-[#52b788]/30 text-white border border-white/20 rounded-2xl px-4 py-3 font-semibold hover:bg-[#52b788]/50 transition-all text-sm"
              >
                <span>📷</span> Add a Plant
              </Link>
              <Link
                to="/map"
                className="flex-1 flex items-center gap-2 bg-[#52b788]/30 text-white border border-white/20 rounded-2xl px-4 py-3 font-semibold hover:bg-[#52b788]/50 transition-all text-sm"
              >
                <span>🗺️</span> Explore Map
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -right-4 w-32 h-32 rounded-full bg-white/5" />
      </div>

      {/* Stats */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-sm border border-[#d8f3dc] grid grid-cols-2 divide-x divide-[#d8f3dc]">
          <div className="p-4 text-center">
            <p className="font-display font-bold text-3xl text-[#2d6a4f]">{stats.plants}</p>
            <p className="text-xs text-[#95d5b2] mt-0.5">Verified Plants</p>
          </div>
          <div className="p-4 text-center">
            <p className="font-display font-bold text-3xl text-[#2d6a4f]">{stats.contributors}</p>
            <p className="text-xs text-[#95d5b2] mt-0.5">Contributors</p>
          </div>
        </div>
      </div>

      {/* Top Contributors */}
      <div className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl text-[#1a4731]">🏆 Top Contributors</h2>
          <Link to="/leaderboard" className="text-sm text-[#52b788] font-medium">
            See all →
          </Link>
        </div>

        {top3.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-[#95d5b2] border border-[#d8f3dc]">
            <p className="text-3xl mb-2">🌱</p>
            <p>Be the first contributor!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {top3.map((entry, i) => {
              const badge = getBadge(entry.verified_count);
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl p-4 border border-[#d8f3dc] flex items-center gap-4 shadow-sm"
                >
                  <span className="text-2xl w-8 text-center">{medals[i]}</span>
                  <div className="w-10 h-10 rounded-full bg-[#d8f3dc] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">🧑</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1a4731] truncate">{entry.name}</p>
                    {badge && (
                      <p className="text-xs text-[#95d5b2]">
                        {badge.icon} {badge.label}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-bold text-[#2d6a4f]">{entry.points}</p>
                    <p className="text-xs text-[#95d5b2]">pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="px-4 mt-8">
        <h2 className="font-display font-bold text-xl text-[#1a4731] mb-4">How it works</h2>
        <div className="space-y-3">
          {[
            { icon: "📷", step: "Take a photo", desc: "Snap a plant you find on campus" },
            { icon: "📍", step: "Capture location", desc: "GPS auto-fills coordinates" },
            { icon: "✅", step: "Get verified", desc: "Admin reviews and approves" },
            { icon: "🏆", step: "Earn points", desc: "Climb the leaderboard!" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 bg-white rounded-2xl p-4 border border-[#d8f3dc]">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-[#1a4731] text-sm">{item.step}</p>
                <p className="text-xs text-[#95d5b2] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
