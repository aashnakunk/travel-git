// Shared itinerary shape between the agent backend and the frontend.
// Kept intentionally in sync with src/lib/types.ts (ActivityItem / ItineraryDay).

export interface AgentActivity {
  time: string // "09:00"
  title: string
  note?: string
  mapsUrl?: string
  bookingUrl?: string
  category?: string
}

export interface AgentDay {
  day: number // 1-based
  title: string
  activities: AgentActivity[]
}

export type AgentItinerary = AgentDay[]

// Build a Google Maps search link for a place + destination. Used as a
// fallback when the model doesn't supply one.
export function mapsLinkFor(title: string, destination: string): string {
  const q = encodeURIComponent(`${title} ${destination}`.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

// Validate + normalize whatever the LLM returns into a clean AgentItinerary.
// Defensive: the model sometimes returns slightly off shapes. We also backfill
// a Google Maps link for every activity so the UI always has one.
export function normalizeItinerary(raw: unknown, destination = ''): AgentItinerary | null {
  if (!Array.isArray(raw)) return null
  const days: AgentItinerary = []
  raw.forEach((d: any, i: number) => {
    if (!d || typeof d !== 'object') return
    const activities = Array.isArray(d.activities) ? d.activities : []
    days.push({
      day: typeof d.day === 'number' ? d.day : i + 1,
      title: typeof d.title === 'string' && d.title.trim() ? d.title : `Day ${i + 1}`,
      activities: activities
        .filter((a: any) => a && typeof a === 'object')
        .map((a: any) => {
          const title = typeof a.title === 'string' ? a.title : 'Activity'
          return {
            time: typeof a.time === 'string' ? a.time : '12:00',
            title,
            note: typeof a.note === 'string' ? a.note : undefined,
            mapsUrl:
              typeof a.mapsUrl === 'string' && a.mapsUrl.startsWith('http')
                ? a.mapsUrl
                : mapsLinkFor(title, destination),
            bookingUrl:
              typeof a.bookingUrl === 'string' && a.bookingUrl.startsWith('http')
                ? a.bookingUrl
                : undefined,
            category: typeof a.category === 'string' ? a.category : undefined,
          }
        }),
    })
  })
  return days.length > 0 ? days : null
}
