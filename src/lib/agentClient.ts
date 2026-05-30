import type { Itinerary, ItineraryDay } from './types'
import { uid } from './storage'

// ---------------------------------------------------------------------------
// Frontend client for the agent backend. Every call degrades gracefully:
// if the backend is down or the agent is disabled, callers fall back to the
// local mock generator so the app never hard-fails during a demo.
// ---------------------------------------------------------------------------

export interface AgentStatus {
  ok: boolean
  agent: boolean
  search: boolean
}

export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return { ok: false, agent: false, search: false }
    return (await res.json()) as AgentStatus
  } catch {
    return { ok: false, agent: false, search: false }
  }
}

// Convert the backend's plain day/activity shape into the frontend Itinerary
// (which needs stable ids on every node). Carries through the enriched fields
// (maps link, booking link, category).
function hydrate(raw: any[]): Itinerary {
  return raw.map((d, i): ItineraryDay => ({
    id: uid('day'),
    day: typeof d.day === 'number' ? d.day : i + 1,
    title: typeof d.title === 'string' ? d.title : `Day ${i + 1}`,
    activities: (Array.isArray(d.activities) ? d.activities : []).map((a: any) => ({
      id: uid('act'),
      time: typeof a.time === 'string' ? a.time : '12:00',
      title: typeof a.title === 'string' ? a.title : 'Activity',
      note: typeof a.note === 'string' ? a.note : undefined,
      mapsUrl: typeof a.mapsUrl === 'string' ? a.mapsUrl : undefined,
      bookingUrl: typeof a.bookingUrl === 'string' ? a.bookingUrl : undefined,
      category: typeof a.category === 'string' ? a.category : undefined,
    })),
  }))
}

export interface PlanRequest {
  destination: string
  startDate: string
  endDate: string
  prompt?: string
  numDays: number
}

// Returns a hydrated Itinerary, or null if the agent is unavailable.
export async function agentPlan(req: PlanRequest): Promise<Itinerary | null> {
  try {
    const res = await fetch('/api/agent/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { itinerary?: any[] }
    if (!data.itinerary) return null
    return hydrate(data.itinerary)
  } catch {
    return null
  }
}

export interface EditResponse {
  proposed: Itinerary
  summary: string
  searchedFor?: string
}

// Natural-language edit. Returns the proposed itinerary + a summary of the
// change, or null if the agent is unavailable.
export async function agentEdit(
  destination: string,
  current: Itinerary,
  instruction: string,
): Promise<EditResponse | null> {
  try {
    // Send a stripped-down current itinerary (ids are regenerated on return).
    const stripped = current.map((d) => ({
      day: d.day,
      title: d.title,
      activities: d.activities.map((a) => ({ time: a.time, title: a.title, note: a.note })),
    }))
    const res = await fetch('/api/agent/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, current: stripped, instruction }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { proposed?: any[]; summary?: string; searchedFor?: string }
    if (!data.proposed) return null
    return {
      proposed: hydrate(data.proposed),
      summary: data.summary ?? `Applied: "${instruction}"`,
      searchedFor: data.searchedFor,
    }
  } catch {
    return null
  }
}

export interface OverviewResponse {
  summary: string
  bestTimeToGo: string
  tips: string[]
}

export async function agentOverview(
  destination: string,
  startDate: string,
  endDate: string,
  prompt?: string,
): Promise<OverviewResponse | null> {
  try {
    const res = await fetch('/api/agent/overview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, startDate, endDate, prompt }),
    })
    if (!res.ok) return null
    return (await res.json()) as OverviewResponse
  } catch {
    return null
  }
}

export interface FlightOption {
  airline: string
  route: string
  direction: 'outbound' | 'return'
  date: string
  departTime: string
  arriveTime: string
  durationHours: number
  approxPrice: string
}

export interface FlightResponse {
  options: FlightOption[]
  note: string
}

export async function agentFlights(
  origin: string,
  destination: string,
  startDate: string,
  endDate: string,
): Promise<FlightResponse | null> {
  try {
    const res = await fetch('/api/agent/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, startDate, endDate }),
    })
    if (!res.ok) return null
    return (await res.json()) as FlightResponse
  } catch {
    return null
  }
}

export interface SuggestedDestinationResponse {
  destination: string
  blurb: string
  tags: string[]
  mustKnow: string
}

export async function agentSuggestDestinations(answers: {
  scenery?: string
  pace?: string
  budget?: string
  food?: string
  company?: string
}): Promise<SuggestedDestinationResponse[] | null> {
  try {
    const res = await fetch('/api/agent/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { destinations?: SuggestedDestinationResponse[] }
    return data.destinations ?? null
  } catch {
    return null
  }
}

export interface HotelOption {
  name: string
  area: string
  priceRange: string
  rating: string
  why: string
  mapsUrl: string
}

export interface HotelResponse {
  options: HotelOption[]
  note: string
}

export async function agentHotels(
  destination: string,
  startDate: string,
  endDate: string,
  budget?: string,
): Promise<HotelResponse | null> {
  try {
    const res = await fetch('/api/agent/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, startDate, endDate, budget }),
    })
    if (!res.ok) return null
    return (await res.json()) as HotelResponse
  } catch {
    return null
  }
}
