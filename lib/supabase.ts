import { createClient } from "@supabase/supabase-js";

// Fallback placeholders keep `createClient` from throwing "supabaseUrl is
// required" at import time (e.g. build-time prerender before env vars are set).
// Queries against these fail gracefully and callers already default to `[]`.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

// Read-only anon client (RLS: select-only). Safe for RSC / browser.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

// Service-role client — SERVER ONLY (sync job). Never import from client code.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}
