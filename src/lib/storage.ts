// Small ID helper used across the app. (The old localStorage data layer was
// removed — Supabase is now the single source of truth for app data.)

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}
