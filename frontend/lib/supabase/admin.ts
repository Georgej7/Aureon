import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only for server contexts with
// no user session (e.g. the Stripe webhook route), never exposed to the
// browser. SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  console.log("DIAG service role key", {
    length: serviceRoleKey.length,
    codes: Array.from(serviceRoleKey.slice(0, 15)).map((c) => c.charCodeAt(0)),
  });
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
