// Shared Supabase client for authentication (magic-link login).
//
// Uses the same env vars as cloud sync (VITE_SUPABASE_URL / VITE_SUPABASE_KEY).
// The login *gate* is turned on separately with VITE_REQUIRE_LOGIN=true, so the
// site can use cloud sync without forcing logins until you're ready to roll them
// out — this avoids anyone getting locked out of live data during setup.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/** The Supabase client, or null if the project isn't configured. Created once. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const env = import.meta.env
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_KEY
  client = url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null
  return client
}

/** Whether the app should require login before showing any data. */
export function requireLogin(): boolean {
  const flag = import.meta.env.VITE_REQUIRE_LOGIN
  return (flag === 'true' || flag === '1') && getSupabase() !== null
}
