import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      // Authenticate through Supabase Auth
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        console.error("Login error:", loginError);
        setError("Invalid email or password.");
        return;
      }

      if (!data.user) {
        setError("Authentication failed.");
        return;
      }

      // Verify admin role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Profile lookup error:", profileError);
        console.error({
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        });

        await supabase.auth.signOut();

        setError("Unable to verify your account. Please contact support.");
        return;
      }

      // Security check: only admins can access admin login
      if (profile?.role !== "admin") {
        await supabase.auth.signOut();

        setError("This account does not have administrator access.");
        return;
      }

      // Admin verified - redirect to dashboard
      navigate("/admin");

    } catch (err) {
      console.error("Unexpected error during admin login:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-[#d8eee2]">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🛡️</div>

          <h1 className="font-display text-3xl font-bold text-[#1a4731]">
            CampusFlora
          </h1>

          <p className="text-gray-500 mt-2">
            Administrator Login
          </p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#1a4731] mb-2">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              disabled={loading}
              className="w-full rounded-xl border border-[#cde8d9] bg-[#f0faf5] px-4 py-3 outline-none focus:ring-2 focus:ring-[#52b788]"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#1a4731] mb-2">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-xl border border-[#cde8d9] bg-[#f0faf5] px-4 py-3 outline-none focus:ring-2 focus:ring-[#52b788]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2d6a4f] px-4 py-3 font-semibold text-white hover:bg-[#1f573f] transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Admin Login"}
          </button>

        </form>

        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="w-full mt-5 text-sm text-[#52b788] hover:underline"
        >
          ← Back to User Login
        </button>

      </div>
    </div>
  );
}