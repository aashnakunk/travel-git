import { useEffect, useRef, useState } from 'react'
import { Sparkles, Search } from 'lucide-react'
import type { Itinerary, Trip } from '../lib/types'
import { agentEdit } from '../lib/agentClient'
import DiffView from './DiffView'
import { Button, Card } from './ui'

const LOADING_MESSAGES = ['Spinning up travel agent…', 'Checking the web & weather…', 'Cooking up ideas…']

// An inline "Make changes with AI" section that lives at the BOTTOM of the trip
// page (not a floating widget). The user types a change in plain English; the
// agent (web search + weather + structured output) proposes a new itinerary
// shown as a diff, which can be approved into a merge request.
export default function AgentChatWidget({
  trip,
  onApprove,
}: {
  trip: Trip
  onApprove: (proposed: Itinerary, summary: string, instruction: string) => void | Promise<void>
}) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const [proposed, setProposed] = useState<Itinerary | null>(null)
  const [summary, setSummary] = useState('')
  const [searchedFor, setSearchedFor] = useState<string | undefined>(undefined)
  const [unavailable, setUnavailable] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [])

  function stopLoading() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setLoading(false)
  }

  async function run() {
    const text = instruction.trim()
    if (!text || loading) return
    setUnavailable(false)
    setProposed(null)
    setSummary('')
    setSearchedFor(undefined)
    setLoading(true)
    let i = 0
    setLoadingMsg(LOADING_MESSAGES[0])
    if (intervalRef.current !== null) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length
      setLoadingMsg(LOADING_MESSAGES[i])
    }, 1200)
    try {
      const result = await agentEdit(trip.destination, trip.itinerary, text)
      stopLoading()
      if (!result) {
        setUnavailable(true)
        return
      }
      setProposed(result.proposed)
      setSummary(result.summary)
      setSearchedFor(result.searchedFor)
    } catch {
      stopLoading()
      setUnavailable(true)
    } finally {
      stopLoading()
    }
  }

  async function approve() {
    if (!proposed) return
    await onApprove(proposed, summary, instruction.trim())
    setProposed(null)
    setSummary('')
    setSearchedFor(undefined)
    setInstruction('')
  }

  return (
    <Card className="space-y-3 border-merge/40" data-testid="agent-chat">
      <div className="flex items-center gap-2 text-base font-semibold text-gray-100">
        <Sparkles className="h-4 w-4 text-merge" aria-hidden="true" /> Make changes with AI
      </div>
      <p className="text-xs text-muted">
        Describe a change — add, remove, or rework anything. e.g. “remove the hotels, and we want to
        go skiing — check the weather and plan accordingly.” Your change opens as a merge request to
        review.
      </p>

      <div className="flex items-end gap-2">
        <textarea
          data-testid="agent-instruction"
          rows={2}
          placeholder="Tell the agent what to change…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              run()
            }
          }}
          disabled={loading}
          className="flex-1 resize-none rounded-md border border-edge bg-ink px-3 py-2 text-sm text-gray-100 placeholder-muted focus:border-merge focus:outline-none"
        />
        <Button variant="merge" data-testid="agent-run-btn" onClick={run} disabled={loading || !instruction.trim()}>
          {loading ? '…' : 'Send'}
        </Button>
      </div>

      {loading && (
        <div data-testid="agent-loading" className="flex items-center gap-2 text-sm text-merge">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-merge border-t-transparent" />
          {loadingMsg}
        </div>
      )}
      {unavailable && (
        <p data-testid="agent-unavailable" className="rounded-md border border-edge bg-ink px-3 py-2 text-sm text-muted">
          AI agent isn't available right now.
        </p>
      )}

      {proposed && (
        <div className="space-y-3" data-testid="agent-preview">
          <div data-testid="agent-summary" className="flex gap-2 rounded-md border border-merge/40 bg-merge/10 px-3 py-2 text-sm text-gray-200">
            <Sparkles className="h-4 w-4 shrink-0 text-merge" aria-hidden="true" />
            <p>
              <span className="font-semibold text-merge">Proposed: </span>
              {summary}
            </p>
          </div>
          {searchedFor && (
            <p data-testid="agent-searched" className="flex items-center gap-1.5 text-xs text-muted">
              <Search className="h-3 w-3" /> Used: {searchedFor}
            </p>
          )}
          <DiffView base={trip.itinerary} proposed={proposed} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" data-testid="agent-discard" onClick={() => setProposed(null)}>
              Discard
            </Button>
            <Button variant="merge" data-testid="agent-approve" onClick={approve}>
              Approve → open MR
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
