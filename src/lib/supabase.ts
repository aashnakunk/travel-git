import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The anon key is safe in the browser; Row-Level Security governs access.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Single shared client (null only if env vars are missing — the repo layer
// throws a clear error in that case).
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
