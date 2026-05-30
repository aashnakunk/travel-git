import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { generatePlan, editPlan, generateOverview, findFlights, findHotels, suggestDestinationsAI } from './agent'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Railway (and most hosts) inject PORT. Fall back to 8787 for local dev.
const PORT = Number(process.env.PORT) || 8787

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '..', 'dist')

// Pull a BYOK key from the request header if present. We accept it per-request
// and NEVER log or persist it. Falls back to the server's env key.
function userKeyFrom(req: express.Request): string | undefined {
  const header = req.header('x-openai-key')
  return header && header.trim() ? header.trim() : undefined
}

// Health + capability check. The frontend uses this to decide whether the
// agent is available, or it should fall back to the local mock generator.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    agent: Boolean(process.env.OPENAI_API_KEY),
    search: Boolean(process.env.TAVILY_API_KEY),
  })
})

// Generate an itinerary from a destination + optional free-text prompt.
app.post('/api/agent/plan', async (req, res) => {
  try {
    const { destination, startDate, endDate, prompt, numDays } = req.body ?? {}
    if (!destination) return res.status(400).json({ error: 'destination is required' })
    const itinerary = await generatePlan({
      destination,
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      prompt,
      numDays: Number(numDays) || 3,
      apiKey: userKeyFrom(req),
    })
    if (!itinerary) return res.status(503).json({ error: 'agent_unavailable' })
    res.json({ itinerary })
  } catch (err) {
    console.error('plan error:', (err as Error).message)
    res.status(500).json({ error: 'plan_failed' })
  }
})

// Edit an existing itinerary from a natural-language instruction.
app.post('/api/agent/edit', async (req, res) => {
  try {
    const { destination, current, instruction } = req.body ?? {}
    if (!instruction || !Array.isArray(current)) {
      return res.status(400).json({ error: 'instruction and current itinerary are required' })
    }
    const result = await editPlan({
      destination: destination ?? '',
      current,
      instruction,
      apiKey: userKeyFrom(req),
    })
    if (!result) return res.status(503).json({ error: 'agent_unavailable' })
    res.json(result)
  } catch (err) {
    console.error('edit error:', (err as Error).message)
    res.status(500).json({ error: 'edit_failed' })
  }
})

// Generate a short trip overview: summary + best time to go + tips.
app.post('/api/agent/overview', async (req, res) => {
  try {
    const { destination, startDate, endDate, prompt } = req.body ?? {}
    if (!destination) return res.status(400).json({ error: 'destination is required' })
    const result = await generateOverview({
      destination,
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      prompt,
      apiKey: userKeyFrom(req),
    })
    if (!result) return res.status(503).json({ error: 'agent_unavailable' })
    res.json(result)
  } catch (err) {
    console.error('overview error:', (err as Error).message)
    res.status(500).json({ error: 'overview_failed' })
  }
})

// Research realistic flight options between origin and destination.
app.post('/api/agent/flights', async (req, res) => {
  try {
    const { origin, destination, startDate, endDate } = req.body ?? {}
    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination are required' })
    }
    const result = await findFlights({
      origin,
      destination,
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      apiKey: userKeyFrom(req),
    })
    if (!result) return res.status(503).json({ error: 'agent_unavailable' })
    res.json(result)
  } catch (err) {
    console.error('flights error:', (err as Error).message)
    res.status(500).json({ error: 'flights_failed' })
  }
})

// Suggest destinations from a vibe questionnaire (web-grounded).
app.post('/api/agent/suggest', async (req, res) => {
  try {
    const { scenery, pace, budget, food, company } = req.body ?? {}
    const result = await suggestDestinationsAI({
      scenery,
      pace,
      budget,
      food,
      company,
      apiKey: userKeyFrom(req),
    })
    if (!result) return res.status(503).json({ error: 'agent_unavailable' })
    res.json({ destinations: result })
  } catch (err) {
    console.error('suggest error:', (err as Error).message)
    res.status(500).json({ error: 'suggest_failed' })
  }
})

// Research lodging options near the destination.
app.post('/api/agent/hotels', async (req, res) => {
  try {
    const { destination, startDate, endDate, budget } = req.body ?? {}
    if (!destination) return res.status(400).json({ error: 'destination is required' })
    const result = await findHotels({
      destination,
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      budget,
      apiKey: userKeyFrom(req),
    })
    if (!result) return res.status(503).json({ error: 'agent_unavailable' })
    res.json(result)
  } catch (err) {
    console.error('hotels error:', (err as Error).message)
    res.status(500).json({ error: 'hotels_failed' })
  }
})

// In production we serve the built SPA from this same server, so the whole app
// runs as ONE service (the frontend's relative /api calls just work). In dev,
// dist doesn't exist and Vite serves the frontend + proxies /api here instead.
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback: any non-API GET returns index.html so client-side routes
  // (e.g. /trip/:id) work on refresh/deep-link. Express 5-safe (no '*' route).
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'))
    }
    next()
  })
}

app.listen(PORT, () => {
  console.log(`TravelGit server listening on http://localhost:${PORT}`)
  console.log(`  agent:    ${process.env.OPENAI_API_KEY ? 'enabled' : 'disabled (no OPENAI_API_KEY)'}`)
  console.log(`  search:   ${process.env.TAVILY_API_KEY ? 'enabled' : 'disabled (no TAVILY_API_KEY)'}`)
  console.log(`  frontend: ${fs.existsSync(distPath) ? 'serving dist/' : 'dev mode (Vite serves it)'}`)
})
