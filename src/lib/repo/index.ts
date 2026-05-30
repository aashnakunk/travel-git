import { supabase } from '../supabase'
import { createSupabaseRepo } from './supabaseRepo'
import type { Repo } from './types'

// Supabase is the single source of truth for all app data.
if (!supabase) {
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
  )
}

export const repo: Repo = createSupabaseRepo(supabase)

export const isRemote = true

export type { Repo, Invite, CreateTripInput } from './types'
