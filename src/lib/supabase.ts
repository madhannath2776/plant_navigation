import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * True only when both env vars are present and look like real values
 * (not empty, not left as the placeholder text some templates ship with).
 * The rest of the app can check this to show a clear "not configured"
 * message instead of letting every query fail with a vague network error.
 */
export const isSupabaseConfigured = Boolean(
  rawUrl &&
    rawAnonKey &&
    rawUrl.startsWith("http") &&
    !rawUrl.includes("your-project-ref") &&
    !rawUrl.includes("placeholder")
);

if (!isSupabaseConfigured) {
  // Shows up in the browser console immediately on load, which is far
  // easier to spot than a failed fetch several clicks into the app.
  console.error(
    "[Supabase] Not configured. Create a `.env` file (copy `.env.example`) " +
      "with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase " +
      "project's Settings → API page, then restart `npm run dev`."
  );
}

export const supabase = createClient(
  rawUrl && rawUrl.startsWith("http") ? rawUrl : "https://placeholder.supabase.co",
  rawAnonKey || "placeholder-anon-key"
);
