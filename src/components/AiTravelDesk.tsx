import { useState } from 'react'
import { Compass, Plane, PlaneTakeoff, PlaneLanding, BedDouble, Search, ExternalLink, Star, Luggage } from 'lucide-react'
import type { Itinerary, Trip } from '../lib/types'
import {
  agentOverview,
  agentFlights,
  agentHotels,
  agentEdit,
  type OverviewResponse,
  type FlightResponse,
  type HotelResponse,
} from '../lib/agentClient'
import { Button, Card, Input, Textarea } from './ui'

type Desk = 'overview' | 'flights' | 'hotels' | 'booked'

// The "AI travel desk". We are NOT a booking engine — we build itineraries.
// So: Overview gives trip context; Flights/Hotels SUGGEST options with links so
// the traveler books themselves; then "Booked" lets them paste what they
// actually booked and the AI works it into the plan as a merge request.
export default function AiTravelDesk({
  trip,
  onPropose,
}: {
  trip: Trip
  onPropose: (proposed: Itinerary, title: string, summary: string) => void
}) {
  const [desk, setDesk] = useState<Desk>('overview')

  return (
    <Card className="space-y-4 border-accent/30 bg-accent/5" data-testid="ai-travel-desk">
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-100">AI travel desk</h2>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg border border-edge bg-ink p-1 text-sm sm:grid-cols-4">
        <DeskTab id="overview" active={desk} set={setDesk} label="Overview" />
        <DeskTab id="flights" active={desk} set={setDesk} label="Flights" icon={Plane} />
        <DeskTab id="hotels" active={desk} set={setDesk} label="Hotels" icon={BedDouble} />
        <DeskTab id="booked" active={desk} set={setDesk} label="Booked" icon={Luggage} />
      </div>

      {desk === 'overview' && <OverviewPanel trip={trip} />}
      {desk === 'flights' && <FlightsPanel trip={trip} />}
      {desk === 'hotels' && <HotelsPanel trip={trip} />}
      {desk === 'booked' && <BookedPanel trip={trip} onPropose={onPropose} />}
    </Card>
  )
}

function DeskTab({
  id,
  active,
  set,
  label,
  icon: Icon,
}: {
  id: Desk
  active: Desk
  set: (d: Desk) => void
  label: string
  icon?: typeof Plane
}) {
  const isActive = active === id
  return (
    <button
      type="button"
      data-testid={`desk-tab-${id}`}
      onClick={() => set(id)}
      className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
        isActive ? 'bg-panel-2 text-gray-100' : 'text-muted hover:text-gray-300'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  )
}

// A small external "book it yourself" link.
function BookLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

function OverviewPanel({ trip }: { trip: Trip }) {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function load() {
    if (loading) return
    setLoading(true)
    setError(false)
    setOverview(null)
    const result = await agentOverview(trip.destination, trip.startDate, trip.endDate)
    if (!result) setError(true)
    else setOverview(result)
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-200">Trip overview &amp; best time to go</h3>
        <Button variant="secondary" data-testid="overview-btn" onClick={load} disabled={loading}>
          {loading ? 'Researching…' : 'Get overview'}
        </Button>
      </div>
      {loading && (
        <p data-testid="overview-loading" className="flex items-center gap-1.5 text-sm text-accent">
          <Search className="h-4 w-4" /> Researching {trip.destination}…
        </p>
      )}
      {error && (
        <p data-testid="overview-unavailable" className="text-sm text-muted">
          AI overview isn't available right now.
        </p>
      )}
      {overview && (
        <div data-testid="overview-result" className="space-y-2 rounded-lg border border-edge bg-panel-2 p-3 text-sm">
          <p className="text-gray-200">{overview.summary}</p>
          <p className="text-gray-300">
            <span className="font-semibold text-accent">Best time to go: </span>
            {overview.bestTimeToGo}
          </p>
          {overview.tips.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-gray-300">
              {overview.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function FlightsPanel({ trip }: { trip: Trip }) {
  const [origin, setOrigin] = useState('')
  const [flights, setFlights] = useState<FlightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function load() {
    if (loading || !origin.trim()) return
    setLoading(true)
    setError(false)
    setFlights(null)
    const result = await agentFlights(origin.trim(), trip.destination, trip.startDate, trip.endDate)
    if (!result) setError(true)
    else setFlights(result)
    setLoading(false)
  }

  // A Google Flights search the traveler opens to actually book.
  function bookUrl(): string {
    const q = encodeURIComponent(`Flights from ${origin.trim()} to ${trip.destination}`)
    return `https://www.google.com/travel/flights?q=${q}`
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-200">Find flights</h3>
      <p className="text-xs text-muted">
        We suggest options — you book directly with the airline or your travel site, then add what
        you booked under the “Booked” tab.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Flying from"
            data-testid="flights-origin"
            placeholder="e.g. New York"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />
        </div>
        <Button variant="secondary" data-testid="flights-btn" onClick={load} disabled={loading || !origin.trim()}>
          {loading ? 'Searching…' : 'Suggest flights'}
        </Button>
      </div>
      {loading && (
        <p data-testid="flights-loading" className="flex items-center gap-1.5 text-sm text-accent">
          <Plane className="h-4 w-4" /> Researching flights to {trip.destination}…
        </p>
      )}
      {error && (
        <p data-testid="flights-unavailable" className="text-sm text-muted">
          Flight research isn't available right now.
        </p>
      )}
      {flights && (
        <div data-testid="flights-result" className="space-y-2">
          {flights.options.map((o, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel-2 p-3 text-sm"
            >
              <div>
                <div className="flex items-center gap-1.5 font-medium text-gray-100">
                  {o.direction === 'outbound' ? (
                    <PlaneTakeoff className="h-4 w-4 text-accent" />
                  ) : (
                    <PlaneLanding className="h-4 w-4 text-accent" />
                  )}
                  {o.direction === 'outbound' ? 'Outbound' : 'Return'} · {o.route}
                </div>
                <div className="text-xs text-muted">
                  {o.airline} · {o.date} · {o.departTime}→{o.arriveTime} · ~{o.durationHours}h
                </div>
              </div>
              <div className="font-mono font-semibold text-added">{o.approxPrice}</div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">{flights.note}</p>
            <BookLink href={bookUrl()}>Book on Google Flights</BookLink>
          </div>
        </div>
      )}
    </div>
  )
}

function HotelsPanel({ trip }: { trip: Trip }) {
  const [hotels, setHotels] = useState<HotelResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function load() {
    if (loading) return
    setLoading(true)
    setError(false)
    setHotels(null)
    const result = await agentHotels(trip.destination, trip.startDate, trip.endDate)
    if (!result) setError(true)
    else setHotels(result)
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-200">Find hotels</h3>
        <Button variant="secondary" data-testid="hotels-btn" onClick={load} disabled={loading}>
          {loading ? 'Searching…' : 'Suggest hotels'}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Suggestions only — book the room yourself, then add it under the “Booked” tab and the AI
        works it into your plan.
      </p>
      {loading && (
        <p data-testid="hotels-loading" className="flex items-center gap-1.5 text-sm text-accent">
          <BedDouble className="h-4 w-4" /> Researching stays in {trip.destination}…
        </p>
      )}
      {error && (
        <p data-testid="hotels-unavailable" className="text-sm text-muted">
          Hotel research isn't available right now.
        </p>
      )}
      {hotels && (
        <div data-testid="hotels-result" className="space-y-2">
          {hotels.options.map((h, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel-2 p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-gray-100">
                  <BedDouble className="h-4 w-4 text-accent" /> {h.name}
                  <span className="text-xs text-muted">· {h.area}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  {h.priceRange} ·
                  <Star className="h-3 w-3 fill-gold text-gold" /> {h.rating} — {h.why}
                </div>
              </div>
              {h.mapsUrl && <BookLink href={h.mapsUrl}>View</BookLink>}
            </div>
          ))}
          <p className="text-xs text-muted">{hotels.note}</p>
        </div>
      )}
    </div>
  )
}

// "Booked" — the traveler pastes what they actually booked and the AI works it
// into the itinerary as a merge request (same review flow as everything else).
function BookedPanel({
  trip,
  onPropose,
}: {
  trip: Trip
  onPropose: (proposed: Itinerary, title: string, summary: string) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function add() {
    const details = text.trim()
    if (!details || loading) return
    setLoading(true)
    setError(false)
    const instruction = `I booked the following for this trip. Work it into the itinerary at the right day and time, and note the key details (name, times, confirmation). Don't invent anything I didn't book. Booking details: "${details}"`
    const result = await agentEdit(trip.destination, trip.itinerary, instruction)
    setLoading(false)
    if (!result) {
      setError(true)
      return
    }
    onPropose(result.proposed, 'AI: add a booking you made', result.summary)
    setText('')
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-200">Add something you booked</h3>
      <p className="text-xs text-muted">
        Booked a flight, hotel, tour, or restaurant? Paste the details and the AI will slot it into
        your itinerary as a merge request to review.
      </p>
      <Textarea
        data-testid="booked-input"
        rows={4}
        placeholder={'e.g. Booked Hotel Lisboa Plaza, check-in Jul 1 3pm, check-out Jul 4 11am, conf #ABC123\nFlight TAP TP202 JFK→LIS Jul 1 dep 22:10 arr 10:30+1'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {loading && (
        <p data-testid="booked-loading" className="flex items-center gap-1.5 text-sm text-accent">
          <Luggage className="h-4 w-4" /> Working your booking into the plan…
        </p>
      )}
      {error && (
        <p data-testid="booked-unavailable" className="text-sm text-muted">
          The AI isn't available right now — try again in a moment.
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="merge" data-testid="booked-add-btn" onClick={add} disabled={loading || !text.trim()}>
          {loading ? 'Adding…' : 'Add to plan (as MR)'}
        </Button>
      </div>
    </div>
  )
}
