import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Sparkles, Bot, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { suggestDestinations } from '../lib/generator'
import { Button, Input, Select, Textarea, Badge } from '../components/ui'
import { agentPlan, agentSuggestDestinations } from '../lib/agentClient'
import type { PlanPath, VibeAnswers, Itinerary } from '../lib/types'

type Step = 0 | '1a' | '1b' | '1c' | 2 | 3

// A destination suggestion shown in the vibe path. `mustKnow` is optional
// because the local hardcoded fallback doesn't provide it.
interface Suggestion {
  destination: string
  blurb: string
  tags: string[]
  mustKnow?: string
}

const SCENERY_OPTIONS = ['mountains', 'beaches', 'city', 'countryside']
const PACE_OPTIONS = ['chill', 'balanced', 'adventure']
const BUDGET_OPTIONS = ['budget', 'mid', 'luxury']

const STEP_ORDER: Step[] = [0, '1a', 2, 3]
const VIBE_STEP_ORDER: Step[] = [0, '1b', 2, 3]
const AGENT_STEP_ORDER: Step[] = [0, '1c', 2, 3]

// Computes the number of itinerary days from a date range: difference in days
// + 1, clamped to 1..6. Falls back to 3 when either date is invalid.
function computeNumDays(startDate: string, endDate: string): number {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return 3
  const start = new Date(startDate.trim())
  const end = new Date(endDate.trim())
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (isNaN(diff)) return 3
  return Math.min(6, Math.max(1, diff))
}

// Accepts YYYY-MM-DD and confirms it's a real calendar date.
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false
  const d = new Date(value.trim())
  return !isNaN(d.getTime())
}

export default function CreateTrip() {
  const { createTrip } = useStore()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(0)
  const [planPath, setPlanPath] = useState<PlanPath>('known-destination')

  // shared trip state, persisted across steps
  const [destination, setDestination] = useState('')
  const [vibeAnswers, setVibeAnswers] = useState<VibeAnswers>({})
  const [agentPrompt, setAgentPrompt] = useState('')
  const [vibeMustHaves, setVibeMustHaves] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [collaboratorEmails, setCollaboratorEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [planning, setPlanning] = useState(false)
  const [createError, setCreateError] = useState('')

  const order =
    planPath === 'vibe' ? VIBE_STEP_ORDER : planPath === 'agent' ? AGENT_STEP_ORDER : STEP_ORDER
  const currentIndex = Math.max(order.indexOf(step), 0)
  const totalSteps = order.length

  function goBack() {
    if (currentIndex <= 0) return
    setStep(order[currentIndex - 1])
  }

  function addCollaborator() {
    const email = emailInput.trim()
    if (!email) return
    if (collaboratorEmails.some((e) => e.toLowerCase() === email.toLowerCase())) {
      setEmailInput('')
      return
    }
    setCollaboratorEmails((list) => [...list, email])
    setEmailInput('')
  }

  function removeCollaborator(email: string) {
    setCollaboratorEmails((list) => list.filter((e) => e !== email))
  }

  // AI-first destination suggestions with a hardcoded fallback so the local
  // demo always works even if the agent/network is down.
  async function loadSuggestions() {
    if (suggesting) return
    setSuggesting(true)
    try {
      const ai = await agentSuggestDestinations({
        scenery: vibeAnswers.scenery,
        pace: vibeAnswers.pace,
        budget: vibeAnswers.budget,
        food: vibeAnswers.food,
        company: vibeAnswers.company,
        mustHaves: vibeMustHaves.trim() || undefined,
      })
      if (ai && ai.length > 0) {
        setSuggestions(ai)
      } else {
        // Fallback: deterministic local suggestions.
        setSuggestions(suggestDestinations(vibeAnswers))
      }
    } catch {
      setSuggestions(suggestDestinations(vibeAnswers))
    } finally {
      setSuggesting(false)
    }
  }

  async function handleCreate() {
    if (planning) return // guard against double-submits while planning

    // Build a prompt from whatever the chosen path collected, so the AI planner
    // can be used for ALL paths (known destination, vibe, and agent).
    let prompt = agentPrompt
    if (planPath === 'vibe') {
      const v = vibeAnswers
      prompt = [
        v.scenery ? `${v.scenery} scenery` : '',
        v.pace ? `${v.pace} pace` : '',
        v.budget ? `${v.budget} budget` : '',
        vibeMustHaves.trim() ? `must-haves: ${vibeMustHaves.trim()}` : '',
      ]
        .filter(Boolean)
        .join(', ')
    }

    let itinerary: Itinerary | undefined
    setPlanning(true)
    setCreateError('')
    try {
      const numDays = computeNumDays(startDate, endDate)
      const result = await agentPlan({
        destination,
        startDate,
        endDate,
        prompt: prompt || undefined,
        numDays,
      })
      // If the agent is unavailable it returns null — omit itinerary so the
      // store falls back to the mock generator. The trip is never blocked.
      itinerary = result ?? undefined

      const created = await createTrip({
        name: name.trim() || destination || 'Untitled trip',
        destination,
        startDate,
        endDate,
        collaboratorEmails,
        planPath,
        vibeAnswers: planPath === 'vibe' ? vibeAnswers : undefined,
        itinerary,
      })
      navigate(`/trip/${created.id}`)
    } catch (err) {
      setCreateError((err as Error)?.message || 'Could not create the trip. Please try again.')
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-gray-100">Create a Travel Repo</h1>
        <div className="mt-3 flex items-center gap-2" data-testid="step-indicator">
          {order.map((s, idx) => (
            <div
              key={String(s)}
              className={`h-1.5 flex-1 overflow-hidden rounded-full transition-colors ${
                idx <= currentIndex ? 'bg-accent-gradient shadow-glow' : 'bg-edge'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Step {currentIndex + 1} of {totalSteps}
        </p>
      </div>

      {/* STEP 0 — choose path */}
      {step === 0 && (
        <div className="animate-fade-in space-y-4">
          <h2 className="text-lg font-medium text-gray-100">Do you know where you want to go?</h2>
          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            <button
              type="button"
              data-testid="path-known"
              onClick={() => {
                setPlanPath('known-destination')
                setStep('1a')
              }}
              className="group flex h-full flex-col rounded-xl border border-edge bg-panel p-6 text-left shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-accent hover:shadow-glow"
            >
              <span
                aria-hidden="true"
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-panel-2 text-accent transition-colors group-hover:border-accent"
              >
                <Plane className="h-5 w-5" />
              </span>
              <div className="text-base font-semibold text-gray-100">Yes, I know the place</div>
              <p className="mt-1 text-sm text-muted">
                Jump straight to entering your destination.
              </p>
            </button>
            <button
              type="button"
              data-testid="path-vibe"
              onClick={() => {
                setPlanPath('vibe')
                setStep('1b')
              }}
              className="group flex h-full flex-col rounded-xl border border-edge bg-panel p-6 text-left shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-accent hover:shadow-glow"
            >
              <span
                aria-hidden="true"
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-panel-2 text-accent transition-colors group-hover:border-accent"
              >
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="text-base font-semibold text-gray-100">
                Not sure — help me pick a vibe
              </div>
              <p className="mt-1 text-sm text-muted">
                Answer a few questions and we'll suggest destinations.
              </p>
            </button>
            <button
              type="button"
              data-testid="path-agent"
              onClick={() => {
                setPlanPath('agent')
                setStep('1c')
              }}
              className="group flex h-full flex-col rounded-xl border border-edge bg-panel p-6 text-left shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-accent hover:shadow-glow"
            >
              <span
                aria-hidden="true"
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-panel-2 text-accent transition-colors group-hover:border-accent"
              >
                <Bot className="h-5 w-5" />
              </span>
              <div className="text-base font-semibold text-gray-100">Describe your trip to AI</div>
              <p className="mt-1 text-sm text-muted">
                Tell our travel agent what you want and it plans it for you.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* STEP 1a — known destination */}
      {step === '1a' && (
        <div className="animate-fade-in space-y-4">
          <h2 className="text-lg font-medium text-gray-100">Where to?</h2>
          <Input
            label="Where to?"
            data-testid="destination-input"
            placeholder="e.g. Tokyo, Japan"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button
              variant="primary"
              data-testid="dest-continue"
              disabled={!destination.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 1b — vibe questionnaire */}
      {step === '1b' && (
        <div className="animate-fade-in space-y-5">
          <h2 className="text-lg font-medium text-gray-100">What's the vibe?</h2>

          <Select
            label="Scenery"
            data-testid="vibe-scenery"
            value={vibeAnswers.scenery ?? ''}
            onChange={(e) => setVibeAnswers((a) => ({ ...a, scenery: e.target.value }))}
          >
            <option value="">Pick a scenery</option>
            {SCENERY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>

          <Select
            label="Pace"
            data-testid="vibe-pace"
            value={vibeAnswers.pace ?? ''}
            onChange={(e) => setVibeAnswers((a) => ({ ...a, pace: e.target.value }))}
          >
            <option value="">Pick a pace</option>
            {PACE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>

          <Select
            label="Budget"
            data-testid="vibe-budget"
            value={vibeAnswers.budget ?? ''}
            onChange={(e) => setVibeAnswers((a) => ({ ...a, budget: e.target.value }))}
          >
            <option value="">Pick a budget</option>
            {BUDGET_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>

          <Textarea
            label="Any must-haves or can't-miss things? (optional)"
            data-testid="vibe-musthaves"
            rows={2}
            placeholder="e.g. must see Northern Lights, vegetarian food, near the beach, no long flights"
            value={vibeMustHaves}
            onChange={(e) => setVibeMustHaves(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button
              variant="primary"
              data-testid="vibe-submit"
              disabled={suggesting}
              onClick={loadSuggestions}
            >
              {suggesting ? 'Searching the web…' : 'See destinations'}
            </Button>
          </div>

          {suggesting && (
            <p data-testid="vibe-loading" className="flex items-center gap-1.5 pt-2 text-sm text-accent">
              <Search className="h-4 w-4" /> Finding destinations that match your vibe…
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-medium text-gray-300">Suggested destinations</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {suggestions.map((s) => (
                  <button
                    key={s.destination}
                    type="button"
                    data-testid="suggested-destination"
                    onClick={() => {
                      setDestination(s.destination)
                      setStep(2)
                    }}
                    className="group flex h-full flex-col rounded-xl border border-edge bg-panel p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-accent hover:shadow-glow"
                  >
                    <div className="font-mono text-sm font-semibold text-accent">
                      {s.destination}
                    </div>
                    <p className="mt-1 flex-1 text-xs text-muted">{s.blurb}</p>
                    {s.mustKnow && (
                      <p className="mt-2 rounded-md border border-merge/30 bg-merge/10 px-2 py-1 text-[11px] text-gray-300">
                        <span className="font-semibold text-merge">Must know: </span>
                        {s.mustKnow}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.tags.map((tag) => (
                        <Badge key={tag} className="text-gray-300">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 1c — describe your trip to AI */}
      {step === '1c' && (
        <div className="animate-fade-in space-y-4">
          <h2 className="text-lg font-medium text-gray-100">Describe your dream trip</h2>
          <Input
            label="Destination"
            data-testid="agent-destination"
            placeholder="e.g. Northern Italy"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <Textarea
            label="What kind of trip?"
            data-testid="agent-prompt"
            rows={4}
            placeholder="e.g. 5 relaxed days in northern Italy, great food and wine, no early mornings"
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button
              variant="primary"
              data-testid="agent-continue"
              disabled={!destination.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — trip details */}
      {step === 2 && (
        <div className="animate-fade-in space-y-4">
          <h2 className="text-lg font-medium text-gray-100">Trip details</h2>
          {destination && (
            <p className="text-sm text-muted">
              Destination: <span className="text-gray-200">{destination}</span>
            </p>
          )}
          <Input
            label="Trip name"
            data-testid="trip-name"
            placeholder="e.g. Spring break in the Alps"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start date (YYYY-MM-DD)"
              type="text"
              inputMode="numeric"
              placeholder="2026-07-01"
              data-testid="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End date (YYYY-MM-DD)"
              type="text"
              inputMode="numeric"
              placeholder="2026-07-04"
              data-testid="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button
              variant="primary"
              data-testid="details-continue"
              disabled={!name.trim() || !isValidDate(startDate) || !isValidDate(endDate)}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — collaborators */}
      {step === 3 && (
        <div className="animate-fade-in space-y-4">
          <h2 className="text-lg font-medium text-gray-100">Invite collaborators</h2>
          <p className="text-sm text-muted">
            Add people by email so they can propose changes. This is optional.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Collaborator email"
                type="email"
                data-testid="collab-email-input"
                placeholder="friend@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCollaborator()
                  }
                }}
              />
            </div>
            <Button variant="secondary" data-testid="collab-add" onClick={addCollaborator}>
              Add
            </Button>
          </div>

          {collaboratorEmails.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {collaboratorEmails.map((email) => (
                <li key={email}>
                  <span
                    data-testid="collab-chip"
                    className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel-2 px-3 py-1 text-xs text-gray-200 shadow-card transition-colors hover:border-accent"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-gradient text-[10px] font-semibold text-white">
                      {email.charAt(0).toUpperCase()}
                    </span>
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => removeCollaborator(email)}
                      className="text-muted transition-colors hover:text-removed"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button
              variant="primary"
              data-testid="create-submit"
              onClick={handleCreate}
              disabled={planning}
            >
              {planning ? (
                <span data-testid="agent-planning">Planning your trip…</span>
              ) : (
                'Create trip'
              )}
            </Button>
          </div>
          {createError && (
            <p data-testid="create-error" className="rounded-md border border-removed/40 bg-removed/10 px-3 py-2 text-sm text-removed">
              {createError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
