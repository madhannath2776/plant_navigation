import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Renders nothing when Supabase is configured correctly. When it isn't,
 * shows a fixed banner explaining exactly what's missing instead of
 * letting the app fail silently with generic network errors on every
 * page that queries the database.
 */
export default function ConfigWarningBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-xs sm:text-sm px-4 py-2 text-center font-medium shadow-md">
      ⚠️ Supabase isn't configured — copy <code className="bg-red-800/60 px-1 rounded">.env.example</code> to{" "}
      <code className="bg-red-800/60 px-1 rounded">.env</code> with your project's URL + anon key, then restart the dev server.
    </div>
  );
}
