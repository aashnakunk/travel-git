import type { TripSettings } from './types'

// ---------------------------------------------------------------------------
// Maps the interactive "trip dials" (0–100) to human labels, and turns a
// settings change into a natural-language instruction the AI uses to rework
// the itinerary. e.g. cranking pace to ~100 → a packed, hectic schedule.
// ---------------------------------------------------------------------------

export interface Dial {
  key: keyof TripSettings
  label: string
  low: string // label at 0
  mid: string // label at 50
  high: string // label at 100
}

export const DIALS: Dial[] = [
  { key: 'pace', label: 'Pace', low: 'Chill', mid: 'Balanced', high: 'Rushed' },
  { key: 'budget', label: 'Budget', low: 'Budget', mid: 'Mid', high: 'Luxury' },
  { key: 'adventure', label: 'Adventure', low: 'Relaxed', mid: 'Mixed', high: 'Adventurous' },
]

// The bucket (low/mid/high) a 0–100 value falls into.
export function bucket(value: number): 'low' | 'mid' | 'high' {
  if (value <= 33) return 'low'
  if (value >= 67) return 'high'
  return 'mid'
}

// Human label for a single dial's current value (e.g. "Rushed").
export function dialLabel(dial: Dial, value: number): string {
  const b = bucket(value)
  return b === 'low' ? dial.low : b === 'high' ? dial.high : dial.mid
}

// A short headline describing the whole vibe, e.g. "Rushed · Luxury · Adventurous".
export function settingsHeadline(settings: TripSettings): string {
  return DIALS.map((d) => dialLabel(d, settings[d.key])).join(' · ')
}

// Rich, AI-facing descriptions per bucket. These steer how the itinerary is
// reworked when a dial changes.
const PACE_DESC: Record<string, string> = {
  low: 'a chill, relaxed pace with lots of downtime, late starts, long meals, and only 1–2 main activities per day',
  mid: 'a balanced pace with a comfortable mix of activities and rest',
  high: 'a packed, hectic, fast-moving schedule — squeeze in as many activities as possible each day, early starts, back-to-back stops, minimal downtime',
}
const BUDGET_DESC: Record<string, string> = {
  low: 'budget-friendly choices: free/cheap attractions, street food, public transport, hostels/affordable stays',
  mid: 'mid-range choices: a sensible mix of paid attractions and casual restaurants',
  high: 'luxury choices: premium experiences, fine dining, private tours, upscale stays',
}
const ADVENTURE_DESC: Record<string, string> = {
  low: 'relaxed, low-effort activities — sightseeing, cafes, easy strolls, no strenuous outings',
  mid: 'a mix of relaxed sightseeing and a few active outings',
  high: 'adventurous, active outings — hikes, water sports, adrenaline activities, off-the-beaten-path experiences',
}

// Build an AI instruction describing how to rework the itinerary, given the
// PREVIOUS settings and the NEW settings. Only mentions dials that changed
// bucket so the agent makes focused, sensible edits.
export function buildSettingsInstruction(prev: TripSettings, next: TripSettings): string {
  const changes: string[] = []

  if (bucket(prev.pace) !== bucket(next.pace)) {
    changes.push(`Make the trip ${PACE_DESC[bucket(next.pace)]}.`)
  }
  if (bucket(prev.budget) !== bucket(next.budget)) {
    changes.push(`Adjust to ${BUDGET_DESC[bucket(next.budget)]}.`)
  }
  if (bucket(prev.adventure) !== bucket(next.adventure)) {
    changes.push(`Lean into ${ADVENTURE_DESC[bucket(next.adventure)]}.`)
  }

  if (changes.length === 0) {
    // No bucket crossed — still nudge using the full current vibe.
    return (
      `Rework the itinerary to match this travel style: ` +
      `${PACE_DESC[bucket(next.pace)]}; ${BUDGET_DESC[bucket(next.budget)]}; ` +
      `${ADVENTURE_DESC[bucket(next.adventure)]}. Keep the destination and dates the same.`
    )
  }

  return (
    `Update trip settings — rework the itinerary accordingly. ${changes.join(' ')} ` +
    `Keep the destination and dates the same, and keep it realistic.`
  )
}

// True when two settings differ in any dial's bucket (i.e. a meaningful change).
export function settingsChanged(a: TripSettings, b: TripSettings): boolean {
  return (
    bucket(a.pace) !== bucket(b.pace) ||
    bucket(a.budget) !== bucket(b.budget) ||
    bucket(a.adventure) !== bucket(b.adventure)
  )
}
