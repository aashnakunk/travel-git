// ---------------------------------------------------------------------------
// TravelGit core data model
//
// The metaphor: a Trip is a "repo". Its itinerary is the "main branch".
// A collaborator proposing changes opens a "merge request" (MR). The trip
// owner reviews the diff and either merges (accept) or closes (reject) it.
// Every merged change becomes a "commit" in the trip's history.
// ---------------------------------------------------------------------------

export interface User {
  id: string
  name: string
  email: string
}

export interface ActivityItem {
  id: string
  time: string // e.g. "09:00"
  title: string // e.g. "Sunrise hike at Tiger's Nest"
  note?: string
  mapsUrl?: string // Google Maps search link for the place
  bookingUrl?: string // optional booking / info link
  category?: string // e.g. "food" | "sightseeing" | "transport" | "activity"
}

export interface ItineraryDay {
  id: string
  day: number // 1-based
  title: string // e.g. "Arrival & old town"
  activities: ActivityItem[]
}

export type Itinerary = ItineraryDay[]

export interface Commit {
  id: string
  message: string
  authorId: string
  authorName: string
  timestamp: number
  // snapshot of the itinerary AFTER this commit was applied
  snapshot: Itinerary
}

export type MergeRequestStatus = 'open' | 'merged' | 'closed'

export interface MergeRequest {
  id: string
  title: string
  description: string
  authorId: string
  authorName: string
  status: MergeRequestStatus
  timestamp: number
  // the proposed itinerary if this MR is merged
  proposedItinerary: Itinerary
  // the itinerary it was branched from, for diffing
  baseItinerary: Itinerary
}

// How the trip was created — drives the questionnaire flow.
export type PlanPath = 'known-destination' | 'vibe' | 'agent'

// Who can see the trip. 'shared' = owner + collaborators; 'private' = owner only.
export type TripVisibility = 'shared' | 'private'

// Interactive "trip dials". Each is 0–100 and maps to a human label that the
// AI uses to rework the itinerary. e.g. pace 100 = packed/rushed, 0 = chill.
export interface TripSettings {
  pace: number // 0 chill · 50 balanced · 100 rushed/packed
  budget: number // 0 budget · 50 mid · 100 luxury
  adventure: number // 0 relaxed · 50 mixed · 100 adventurous
}

export const DEFAULT_TRIP_SETTINGS: TripSettings = {
  pace: 50,
  budget: 50,
  adventure: 50,
}

export interface VibeAnswers {
  scenery?: string // mountains | beaches | city | countryside
  pace?: string // chill | balanced | adventure
  budget?: string // budget | mid | luxury
  food?: string // street-food | fine-dining | mixed
  company?: string // solo | couple | friends | family
}

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  ownerId: string
  collaboratorEmails: string[]
  planPath: PlanPath
  vibeAnswers?: VibeAnswers
  visibility: TripVisibility
  settings: TripSettings
  itinerary: Itinerary
  commits: Commit[]
  mergeRequests: MergeRequest[]
  createdAt: number
}
