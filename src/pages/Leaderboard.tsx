import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeaderboardEntry } from "@/types";
import { getBadge, BadgeList } from "@/components/Badge";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, name, avatar_url, points")
      .order("points", { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        const withCounts = await Promise.all(
          data.map((p) =>
            supabase
              .from("plants")
              .select("id", { count: "exact" })
              .eq("submitted_by", p.id)
              .then(({ count }) => ({
                id: p.id,
                name: p.name,
                avatar_url: p.avatar_url,
                points: p.points,
                verified_count: count ?? 0,
              }))
          )
        );
        setEntries(withCounts);
        setLoading(false);
      });
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen bg-[#f0faf5] pt-16 pb-24">
      {/* Header */}
      <div
        className="px-4 py-8 text-center"
        style={{
          background: "linear-gradient(135deg, #1a4731 0%, #2d6a4f 60%, #52b788 100%)",
        }}
      >
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="font-display font-bold text-3xl text-white">Campus Plant Champions</h1>
        <p className="text-[#d8f3dc] text-sm mt-2">Only verified contributions count</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl animate-bounce mb-3">🌿</div>
            <p className="text-[#95d5b2]">Loading rankings…</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="text-5xl mb-3">🌱</p>
          <p className="font-display font-semibold text-[#1a4731] text-xl">No contributors yet</p>
          <p className="text-[#95d5b2] mt-2">Be the first to add a verified plant!</p>
        </div>
      ) : (
        <div className="px-4 mt-6">
          {/* Top 3 podium */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {top3.map((entry, i) => {
              const badge = getBadge(entry.verified_count);
              return (
                <div
                  key={entry.id}
                  className={`bg-white rounded-2xl p-3 text-center border shadow-sm ${
                    i === 0
                      ? "border-yellow-300 ring-2 ring-yellow-200"
                      : i === 1
                      ? "border-gray-300"
                      : "border-orange-200"
                  }`}
                >
                  <div className="text-2xl mb-1">{medals[i]}</div>
                  <div className="w-12 h-12 rounded-full bg-[#d8f3dc] mx-auto flex items-center justify-center overflow-hidden mb-2">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🧑</span>
                    )}
                  </div>
                  <p className="font-semibold text-[#1a4731] text-sm truncate">{entry.name}</p>
                  <p className="font-display font-bold text-[#2d6a4f]">{entry.points}</p>
                  <p className="text-xs text-[#95d5b2]">{entry.verified_count} plants</p>
                  {badge && (
                    <span className="text-xs">
                      {badge.icon}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Badge reference */}
          <div className="bg-white rounded-2xl border border-[#d8f3dc] p-4 mb-6">
            <h3 className="font-display font-semibold text-[#1a4731] mb-3">Badges</h3>
            <div className="space-y-2">
              {[
                { min: 5, icon: "🌱", label: "Plant Starter" },
                { min: 10, icon: "🌿", label: "Green Explorer" },
                { min: 25, icon: "🌳", label: "Plant Hunter" },
                { min: 50, icon: "🏆", label: "Biodiversity Champion" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-lg">{b.icon}</span>
                  <span className="text-sm text-[#1a4731]">{b.label}</span>
                  <span className="ml-auto text-xs text-[#95d5b2]">{b.min}+ verified</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full rankings */}
          {rest.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-[#1a4731] mb-3">Full Rankings</h3>
              <div className="space-y-2">
                {rest.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl p-3 border border-[#d8f3dc] flex items-center gap-3"
                  >
                    <span className="w-6 text-center text-sm text-[#95d5b2] font-mono">
                      {i + 4}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-[#d8f3dc] flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>🧑</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1a4731] text-sm truncate">{entry.name}</p>
                      <BadgeList count={entry.verified_count} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display font-bold text-[#2d6a4f] text-sm">{entry.points}</p>
                      <p className="text-xs text-[#95d5b2]">{entry.verified_count} plants</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
