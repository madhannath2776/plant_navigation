import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Auth() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (tab === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      // Create profile
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          name,
          email,
          role: "user",
          points: 0,
        });
      }
      setDone(true);
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      navigate("/");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f0faf5]">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#d8f3dc] text-center max-w-sm w-full">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="font-display font-bold text-2xl text-[#1a4731] mb-2">Account created!</h2>
          <p className="text-[#52b788] mb-6">Check your email to confirm, then sign in.</p>
          <button
            onClick={() => { setDone(false); setTab("login"); }}
            className="w-full bg-[#2d6a4f] text-white rounded-xl py-3 font-semibold hover:bg-[#1a4731] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f0faf5]">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#d8f3dc] max-w-sm w-full">
        <div className="text-center mb-6">
          <span className="text-5xl">🌿</span>
          <h1 className="font-display font-bold text-2xl text-[#1a4731] mt-2">CampusFlora</h1>
          <p className="text-[#95d5b2] text-sm mt-1">Join the campus plant community</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#f0faf5] rounded-xl p-1 mb-6">
          {(["login", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-white text-[#1a4731] shadow-sm"
                  : "text-[#95d5b2] hover:text-[#2d6a4f]"
              }`}
            >
              {t === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-sm font-medium text-[#1a4731] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full border border-[#d8f3dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#52b788] bg-[#f0faf5]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#1a4731] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@campus.edu"
              required
              className="w-full border border-[#d8f3dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#52b788] bg-[#f0faf5]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a4731] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full border border-[#d8f3dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#52b788] bg-[#f0faf5]"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2d6a4f] text-white rounded-xl py-3 font-semibold hover:bg-[#1a4731] transition-colors disabled:opacity-60"
          >
            {loading ? "..." : tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
