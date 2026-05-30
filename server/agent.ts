import OpenAI from 'openai'
import { normalizeItinerary, type AgentItinerary } from './itinerary'
import { tavilySearch, resultsToContext } from './tavily'
import { getWeather } from './weather'

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// BYOK-aware client factory. A per-request key (the user's own) takes
// precedence over the server's env key. Returns null if neither exists.
function getClient(userKey?: string): OpenAI | null {
  const apiKey = userKey || process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

// Pull the first JSON array out of a model response, tolerating prose or
// ```json fences around it.
function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

const ITINERARY_SHAPE = `Return ONLY a JSON array (no prose) of day objects:
[
  {
    "day": 1,
    "title": "short day theme",
    "activities": [
      {
        "time": "09:00",
        "title": "specific place or activity name",
        "note": "optional short tip",
        "category": "food | sightseeing | activity | transport | nightlife",
        "mapsUrl": "https://www.google.com/maps/search/?api=1&query=<place+name+city>",
        "bookingUrl": "optional official site or booking link if known, else omit"
      }
    ]
  }
]
Use 3 activities per day (morning/afternoon/evening) with realistic times. Name SPECIFIC real places (e.g. "Cenote Dos Ojos", not "a cenote"). Always include a valid Google Maps search URL for each activity.`

// Tavily exposed to the model as a tool. The model calls this whenever it
// needs current, real-world info (open attractions, campsites, restaurants).
const SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web for current, real travel information: attractions, restaurants, campsites, events, opening info. Use this to ground suggestions in real places.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query, e.g. "best ramen near Shibuya Tokyo"' },
      },
      required: ['query'],
    },
  },
}

// Weather tool: real forecast (or seasonal note) for a place + optional date.
// Lets the agent plan weather-dependent activities (skiing, beaches, hikes).
const WEATHER_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description:
      'Get the weather forecast for a place, optionally on a specific date (YYYY-MM-DD). Use this when the plan depends on weather (skiing needs snow, beach days need sun, hikes need no rain).',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'City/location, e.g. "Lake Tahoe"' },
        date: { type: 'string', description: 'Optional YYYY-MM-DD' },
      },
      required: ['place'],
    },
  },
}

const ALL_TOOLS = [SEARCH_TOOL, WEATHER_TOOL]

// Run an OpenAI chat completion, resolving any web_search tool calls via
// Tavily, looping until the model returns a final answer. When `schema` is
// provided, the final answer is forced to match that JSON schema via OpenAI
// Structured Outputs (the API guarantees schema-valid JSON — no fragile
// parsing). Returns the parsed object plus the queries it searched for.
async function runAgent<T>(
  client: OpenAI,
  model: string,
  system: string,
  userContent: string,
  schema: { name: string; schema: Record<string, unknown> },
  maxRounds = 4,
): Promise<{ data: T | null; searches: string[] }> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ]
  const searches: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const isLastRound = round === maxRounds - 1
    const completion = await client.chat.completions.create({
      model,
      messages,
      // Offer the tools until the final round, where we force the answer.
      tools: isLastRound ? undefined : ALL_TOOLS,
      tool_choice: isLastRound ? undefined : 'auto',
      // Structured Outputs: the API guarantees the response matches the schema.
      response_format: {
        type: 'json_schema',
        json_schema: { name: schema.name, schema: schema.schema, strict: true },
      },
      max_tokens: 2000,
    })
    const msg = completion.choices[0].message
    messages.push(msg)

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      // Final structured answer.
      try {
        return { data: JSON.parse(msg.content ?? 'null') as T, searches }
      } catch {
        return { data: null, searches }
      }
    }

    // Resolve each tool call (web_search or get_weather).
    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      let args: any = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        args = {}
      }

      let content = ''
      if (call.function.name === 'web_search') {
        const query = args.query ?? ''
        const results = query ? await tavilySearch(query) : []
        if (query) searches.push(query)
        content = resultsToContext(results) || 'No results found.'
      } else if (call.function.name === 'get_weather') {
        const w = await getWeather(args.place ?? '', args.date)
        if (args.place) searches.push(`weather: ${args.place}${args.date ? ` ${args.date}` : ''}`)
        content = w.forecast
      } else {
        content = 'Unknown tool.'
      }

      messages.push({ role: 'tool', tool_call_id: call.id, content })
    }
  }
  return { data: null, searches }
}

// ---------------------------------------------------------------------------
// JSON Schemas for Structured Outputs. Strict mode requires every property to
// be listed in `required` and additionalProperties:false. Optional fields are
// modeled as nullable (type: [..., "null"]).
// ---------------------------------------------------------------------------

const ACTIVITY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    time: { type: 'string', description: 'HH:MM, 24h' },
    title: { type: 'string', description: 'specific real place or activity name' },
    note: { type: ['string', 'null'], description: 'short tip, or null' },
    category: {
      type: 'string',
      enum: ['food', 'sightseeing', 'activity', 'transport', 'nightlife', 'relax'],
    },
    mapsUrl: { type: 'string', description: 'Google Maps search URL for the place' },
    bookingUrl: { type: ['string', 'null'], description: 'official/booking link, or null' },
  },
  required: ['time', 'title', 'note', 'category', 'mapsUrl', 'bookingUrl'],
}

const ITINERARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'integer' },
          title: { type: 'string', description: 'short day theme' },
          activities: { type: 'array', items: ACTIVITY_SCHEMA },
        },
        required: ['day', 'title', 'activities'],
      },
    },
  },
  required: ['days'],
}

// Legacy: kept for the old runWithTools-based functions still referencing it.
async function runWithTools(
  client: OpenAI,
  model: string,
  system: string,
  userContent: string,
  maxRounds = 3,
): Promise<{ text: string; searches: string[] }> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ]
  const searches: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: [SEARCH_TOOL],
      max_tokens: 1800,
    })
    const choice = completion.choices[0]
    const msg = choice.message
    messages.push(msg)

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      return { text: msg.content ?? '', searches }
    }

    // Resolve each tool call (only web_search is defined).
    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      let query = ''
      try {
        query = JSON.parse(call.function.arguments || '{}').query ?? ''
      } catch {
        query = ''
      }
      const results = query ? await tavilySearch(query) : []
      if (query) searches.push(query)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: resultsToContext(results) || 'No results found.',
      })
    }
  }

  // Ran out of rounds — ask once more for the final answer without tools.
  const final = await client.chat.completions.create({ model, messages, max_tokens: 1800 })
  return { text: final.choices[0].message.content ?? '', searches }
}

export interface PlanInput {
  destination: string
  startDate: string
  endDate: string
  prompt?: string
  numDays: number
  apiKey?: string // BYOK: user's own OpenAI key
}

export async function generatePlan(input: PlanInput): Promise<AgentItinerary | null> {
  const client = getClient(input.apiKey)
  if (!client) return null

  const system = `You are an expert travel planner. Create a realistic, well-paced day-by-day itinerary of things to DO and SEE — attractions, food, activities, experiences. Call the web_search tool to ground the plan in real, current, specific places (name actual venues, not generic descriptions). Use 3 activities per day (morning/afternoon/evening) with realistic times. For every activity include a Google Maps search URL of the form https://www.google.com/maps/search/?api=1&query=<place+name+city>.

IMPORTANT: Do NOT include hotel check-in/check-out, lodging, or flights as activities — those are handled separately. Plan only what the traveler does during the day.`
  const user = [
    `Plan a ${input.numDays}-day trip to ${input.destination}.`,
    input.prompt ? `Traveler's request: "${input.prompt}".` : '',
    `Dates: ${input.startDate} to ${input.endDate}.`,
    `Search the web for top highlights before planning, then return the structured itinerary.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { data } = await runAgent<{ days: AgentItinerary }>(
    client,
    DEFAULT_MODEL,
    system,
    user,
    { name: 'itinerary', schema: ITINERARY_SCHEMA },
  )
  if (!data?.days) return null
  return normalizeItinerary(data.days, input.destination)
}

export interface EditInput {
  destination: string
  current: AgentItinerary
  instruction: string
  apiKey?: string // BYOK
}

export interface EditResult {
  proposed: AgentItinerary
  summary: string
  searchedFor?: string
}

// Edit schema = the itinerary plus a one-line summary of the change.
const EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    days: ITINERARY_SCHEMA.properties.days,
    summary: { type: 'string', description: 'one sentence describing what changed' },
  },
  required: ['days', 'summary'],
}

export async function editPlan(input: EditInput): Promise<EditResult | null> {
  const client = getClient(input.apiKey)
  if (!client) return null

  const system = `You are an AI travel collaborator editing an existing itinerary based on a natural-language request. Apply the requested change(s) — which may include ADDING, REMOVING, or REPLACING activities — and keep everything else intact and realistic. Use the web_search tool to find real, specific places. Use the get_weather tool whenever the request is weather-dependent (e.g. skiing needs snow, beach days need sun) and plan accordingly, noting the weather rationale in the activity's note. If the user asks to remove something (e.g. "remove the hotels"), remove those activities. Preserve Google Maps URLs for unchanged activities and add them for new ones. Return the full updated itinerary plus a one-sentence summary of what you changed.`

  const user = [
    `Destination: ${input.destination}.`,
    `Current itinerary (JSON):\n${JSON.stringify(input.current)}`,
    `Requested change: "${input.instruction}".`,
  ].join('\n\n')

  const { data, searches } = await runAgent<{ days: AgentItinerary; summary: string }>(
    client,
    DEFAULT_MODEL,
    system,
    user,
    { name: 'itinerary_edit', schema: EDIT_SCHEMA },
  )
  if (!data?.days) return null

  const proposed = normalizeItinerary(data.days, input.destination)
  if (!proposed) return null

  return {
    proposed,
    summary: data.summary || `Applied your request: "${input.instruction}".`,
    searchedFor: searches[0],
  }
}

// ---------------------------------------------------------------------------
// Trip overview: a short summary + best time to visit + practical tips.
// ---------------------------------------------------------------------------

export interface OverviewInput {
  destination: string
  startDate: string
  endDate: string
  prompt?: string
  apiKey?: string
}

export interface OverviewResult {
  summary: string
  bestTimeToGo: string
  tips: string[]
}

export async function generateOverview(input: OverviewInput): Promise<OverviewResult | null> {
  const client = getClient(input.apiKey)
  if (!client) return null

  const system = `You are a concise travel expert. Call web_search for current info, then return a structured overview: a 2-3 sentence summary, one sentence on the best season/months to visit (and how the traveler's dates compare), and 3 short practical tips.`

  const user = [
    `Destination: ${input.destination}.`,
    input.startDate && input.endDate ? `Planned dates: ${input.startDate} to ${input.endDate}.` : '',
    input.prompt ? `Traveler's interests: "${input.prompt}".` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      bestTimeToGo: { type: 'string' },
      tips: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'bestTimeToGo', 'tips'],
  }

  const { data } = await runAgent<OverviewResult>(client, DEFAULT_MODEL, system, user, {
    name: 'overview',
    schema,
  })
  if (!data) return null
  return {
    summary: String(data.summary ?? ''),
    bestTimeToGo: String(data.bestTimeToGo ?? ''),
    tips: Array.isArray(data.tips) ? data.tips.slice(0, 5) : [],
  }
}

// ---------------------------------------------------------------------------
// Flight research: uses web search to find realistic flight options. These are
// AI-researched estimates (routes, airlines, typical duration/price), NOT live
// bookable fares. The frontend labels them as such.
// ---------------------------------------------------------------------------

export interface FlightInput {
  origin: string
  destination: string
  startDate: string
  endDate: string
  apiKey?: string
}

export interface FlightOption {
  airline: string
  route: string // e.g. "JFK → CUN"
  direction: 'outbound' | 'return'
  date: string
  departTime: string
  arriveTime: string
  durationHours: number
  approxPrice: string // e.g. "$420"
}

export interface FlightResult {
  options: FlightOption[]
  note: string
}

export async function findFlights(input: FlightInput): Promise<FlightResult | null> {
  const client = getClient(input.apiKey)
  if (!client) return null

  const system = `You are a flight research assistant. Use web_search to find realistic flight options between two places. These are estimates, not live fares. Respond ONLY with a JSON object (no prose, no fences):
{"options":[{"airline":"...","route":"ORIGIN_IATA → DEST_IATA","direction":"outbound|return","date":"YYYY-MM-DD","departTime":"HH:MM","arriveTime":"HH:MM","durationHours":number,"approxPrice":"$NNN"}],"note":"one short sentence caveat that these are AI-researched estimates"}
Provide one outbound option (on the start date) and one return option (on the end date).`

  const user = [
    `Find flights from ${input.origin} to ${input.destination}.`,
    `Outbound on ${input.startDate}, return on ${input.endDate}.`,
    `Search for typical airlines, routes, durations and price ranges.`,
  ].join('\n')

  const { text } = await runWithTools(client, DEFAULT_MODEL, system, user)

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1))
    const options: FlightOption[] = (Array.isArray(obj.options) ? obj.options : []).map((o: any) => ({
      airline: String(o.airline ?? 'Airline'),
      route: String(o.route ?? ''),
      direction: o.direction === 'return' ? 'return' : 'outbound',
      date: String(o.date ?? ''),
      departTime: String(o.departTime ?? ''),
      arriveTime: String(o.arriveTime ?? ''),
      durationHours: Number(o.durationHours) || 0,
      approxPrice: String(o.approxPrice ?? ''),
    }))
    return { options, note: String(obj.note ?? 'AI-researched estimates, not live fares.') }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Hotel research: web-grounded lodging options near the destination. Like
// flights, these are AI-researched suggestions, not live bookable rooms.
// ---------------------------------------------------------------------------

export interface HotelInput {
  destination: string
  startDate: string
  endDate: string
  budget?: string
  apiKey?: string
}

export interface HotelOption {
  name: string
  area: string // neighborhood / area
  priceRange: string // e.g. "$120-160/night"
  rating: string // e.g. "4.5"
  why: string // one line on why it's a good pick
  mapsUrl: string
}

export interface HotelResult {
  options: HotelOption[]
  note: string
}

const HOTELS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          area: { type: 'string' },
          priceRange: { type: 'string', description: 'e.g. $120-160/night' },
          rating: { type: 'string', description: 'e.g. 4.5' },
          why: { type: 'string', description: 'one line on why it fits' },
          mapsUrl: { type: 'string' },
        },
        required: ['name', 'area', 'priceRange', 'rating', 'why', 'mapsUrl'],
      },
    },
    note: { type: 'string' },
  },
  required: ['options', 'note'],
}

export async function findHotels(input: HotelInput): Promise<HotelResult | null> {
  const client = getClient(input.apiKey)
  if (!client) return null

  const system = `You are a hotel research assistant. Use web_search to find 3 real, well-reviewed lodging options in/near the destination that fit the budget. These are AI-researched suggestions, not live bookable rooms. For each, include a Google Maps search URL (https://www.google.com/maps/search/?api=1&query=<hotel+name+city>). Return a short caveat in "note".`

  const user = [
    `Find 3 hotels in ${input.destination}.`,
    `Stay dates: ${input.startDate} to ${input.endDate}.`,
    input.budget ? `Budget: ${input.budget}.` : '',
    `Search for real, currently-operating, well-rated options.`,
  ]
    .filter(Boolean)
    .join('\n')

  const { data } = await runAgent<HotelResult>(client, DEFAULT_MODEL, system, user, {
    name: 'hotels',
    schema: HOTELS_SCHEMA,
  })
  if (!data?.options) return null
  return {
    options: data.options.slice(0, 3),
    note: data.note || 'AI-researched suggestions, not live bookings.',
  }
}

// ---------------------------------------------------------------------------
// AI destination suggestions from a vibe questionnaire. Web-grounded, with a
// reason ("why you'll love it") and must-know notes per destination.
// ---------------------------------------------------------------------------

export interface SuggestInput {
  scenery?: string
  pace?: string
  budget?: string
  food?: string
  company?: string
  apiKey?: string
}

export interface SuggestedDestination {
  destination: string
  blurb: string // why it matches the vibe
  tags: string[]
  mustKnow: string // a can't-miss / must-know tip before planning
}

export async function suggestDestinationsAI(
  input: SuggestInput,
): Promise<SuggestedDestination[] | null> {
  const client = getClient(input.apiKey)
  if (!client) return null

  const system = `You are a destination-matching travel expert. Based on the traveler's vibe, suggest 3 real destinations. You may call web_search to ground them in current, real info. Respond ONLY with a JSON array (no prose, no fences):
[
  {
    "destination": "City, Country",
    "blurb": "1 sentence on why this matches their vibe",
    "tags": ["2-4 short tags"],
    "mustKnow": "1 short can't-miss tip or must-know before planning (best season, a signature experience, or a booking-ahead warning)"
  }
]
Pick 3 DISTINCT destinations that genuinely fit the vibe.`

  const vibe = [
    input.scenery ? `scenery: ${input.scenery}` : '',
    input.pace ? `pace: ${input.pace}` : '',
    input.budget ? `budget: ${input.budget}` : '',
    input.food ? `food: ${input.food}` : '',
    input.company ? `traveling as: ${input.company}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  const user = `Traveler's vibe — ${vibe || 'open to anything'}.\nSuggest 3 destinations that fit. Search the web for current, real recommendations.`

  const { text } = await runWithTools(client, DEFAULT_MODEL, system, user)
  const parsed = extractJsonArray(text)
  if (!Array.isArray(parsed)) return null

  return parsed
    .filter((d: any) => d && typeof d === 'object' && d.destination)
    .map((d: any) => ({
      destination: String(d.destination),
      blurb: String(d.blurb ?? ''),
      tags: Array.isArray(d.tags) ? d.tags.map((t: unknown) => String(t)).slice(0, 4) : [],
      mustKnow: String(d.mustKnow ?? ''),
    }))
    .slice(0, 3)
}
