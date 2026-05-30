import type { Itinerary, ItineraryDay, VibeAnswers } from './types'
import { uid } from './storage'

// ---------------------------------------------------------------------------
// Mock "AI" generator. Deterministic and keyword-driven so demos are reliable
// and Kane assertions are stable. Swap this module for a Bedrock/Claude call
// later without touching the rest of the app.
// ---------------------------------------------------------------------------

interface DestinationSuggestion {
  destination: string
  blurb: string
  tags: string[]
}

const VIBE_DESTINATIONS: Record<string, DestinationSuggestion[]> = {
  mountains: [
    { destination: 'Interlaken, Switzerland', blurb: 'Alpine peaks, glacier lakes, and paragliding over emerald valleys.', tags: ['adventure', 'scenic'] },
    { destination: 'Banff, Canada', blurb: 'Turquoise lakes ringed by the Rockies, world-class hiking and wildlife.', tags: ['nature', 'hiking'] },
    { destination: 'Pokhara, Nepal', blurb: 'Gateway to the Annapurnas with lakeside calm and Himalaya sunrises.', tags: ['budget', 'trekking'] },
  ],
  beaches: [
    { destination: 'Bali, Indonesia', blurb: 'Surf breaks, rice terraces, and beach clubs with sunset DJs.', tags: ['surf', 'nightlife'] },
    { destination: 'Algarve, Portugal', blurb: 'Golden cliffs, hidden coves, and seafood straight off the boat.', tags: ['relaxed', 'food'] },
    { destination: 'Tulum, Mexico', blurb: 'White-sand beaches, cenotes, and Mayan ruins by the sea.', tags: ['boho', 'culture'] },
  ],
  city: [
    { destination: 'Tokyo, Japan', blurb: 'Neon districts, Michelin ramen, and serene temples between skyscrapers.', tags: ['food', 'culture'] },
    { destination: 'Lisbon, Portugal', blurb: 'Hilly streets, trams, miradouros, and pastel de nata everywhere.', tags: ['walkable', 'budget'] },
    { destination: 'Mexico City, Mexico', blurb: 'World-class museums, street tacos, and rooftop mezcal bars.', tags: ['food', 'art'] },
  ],
  countryside: [
    { destination: 'Tuscany, Italy', blurb: 'Rolling vineyards, hilltop towns, and long lunches with local wine.', tags: ['food', 'relaxed'] },
    { destination: 'Cotswolds, England', blurb: 'Honey-stone villages, country pubs, and gentle walking trails.', tags: ['cozy', 'walking'] },
    { destination: 'Hallstatt, Austria', blurb: 'A storybook lakeside village beneath the Dachstein Alps.', tags: ['scenic', 'quiet'] },
  ],
}

export function suggestDestinations(answers: VibeAnswers): DestinationSuggestion[] {
  const scenery = (answers.scenery ?? 'city').toLowerCase()
  const key = Object.keys(VIBE_DESTINATIONS).find((k) => scenery.includes(k)) ?? 'city'
  return VIBE_DESTINATIONS[key]
}

// A small library of day templates keyed loosely by destination keywords.
function activityPool(destination: string, vibe?: VibeAnswers): string[][] {
  const d = destination.toLowerCase()
  const adventurous = vibe?.pace === 'adventure'

  if (d.includes('switzerland') || d.includes('banff') || d.includes('nepal') || d.includes('interlaken') || d.includes('pokhara')) {
    return [
      ['Arrive and settle into the lodge', 'Lakeside walk and early dinner', 'Plan tomorrow over hot chocolate'],
      [adventurous ? 'Sunrise summit hike' : 'Cable car to the viewpoint', 'Packed picnic with a view', 'Soak at the thermal spa'],
      ['Glacier or canyon excursion', 'Local mountain lunch', 'Souvenir shopping in town'],
      ['Easy valley trail', 'Farewell brunch', 'Departure'],
    ]
  }
  if (d.includes('bali') || d.includes('algarve') || d.includes('tulum')) {
    return [
      ['Check in and beach sunset', 'Fresh seafood dinner', 'Evening stroll along the shore'],
      [adventurous ? 'Surf lesson' : 'Beach club lounging', 'Coastal lunch', 'Sunset viewpoint'],
      ['Day trip to coves / ruins', 'Local market browse', 'Beachfront cocktails'],
      ['Final swim', 'Brunch', 'Departure'],
    ]
  }
  if (d.includes('tokyo') || d.includes('lisbon') || d.includes('mexico')) {
    return [
      ['Arrive and explore the old town', 'Iconic street-food dinner', 'Rooftop bar with city views'],
      ['Top museum in the morning', 'Famous local lunch spot', 'Walking tour of historic district'],
      ['Day trip to a nearby neighborhood', 'Hidden-gem restaurant', 'Live music or night market'],
      ['Last-minute souvenirs', 'Farewell brunch', 'Departure'],
    ]
  }
  // countryside / default
  return [
    ['Arrive and settle in', 'Welcome dinner with local wine', 'Sunset over the hills'],
    ['Visit a nearby village', 'Long countryside lunch', 'Vineyard or garden tour'],
    ['Scenic drive and viewpoints', 'Cooking class or tasting', 'Cozy evening by the fire'],
    ['Morning walk', 'Farewell brunch', 'Departure'],
  ]
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e) || e < s) return 3
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1
  return Math.min(Math.max(diff, 1), 6)
}

const TIMES = ['09:00', '13:00', '19:00']

export function generateItinerary(
  destination: string,
  startDate: string,
  endDate: string,
  vibe?: VibeAnswers,
): Itinerary {
  const numDays = daysBetween(startDate, endDate)
  const pool = activityPool(destination, vibe)

  const days: ItineraryDay[] = []
  for (let i = 0; i < numDays; i++) {
    // Cycle through the middle templates so days don't repeat. Day 0 is always
    // arrival; the last day is always departure; the in-between days rotate
    // through the remaining templates instead of clamping to the last one.
    let template: string[]
    if (i === 0) {
      template = pool[0]
    } else if (i === numDays - 1) {
      template = pool[pool.length - 1]
    } else {
      const middle = pool.slice(1, pool.length - 1)
      template = middle.length > 0 ? middle[(i - 1) % middle.length] : pool[i % pool.length]
    }
    const activities = template.map((title, idx) => ({
      id: uid('act'),
      time: TIMES[idx] ?? '15:00',
      title,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title} ${destination}`)}`,
    }))
    days.push({
      id: uid('day'),
      day: i + 1,
      title: dayTitle(i, numDays, destination),
      activities,
    })
  }
  return days
}

function dayTitle(index: number, total: number, destination: string): string {
  const place = destination.split(',')[0]
  if (index === 0) return `Arrival in ${place}`
  if (index === total - 1) return 'Departure day'
  return `Exploring ${place} — day ${index + 1}`
}
