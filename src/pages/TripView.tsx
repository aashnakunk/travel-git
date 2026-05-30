import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Calendar,
  Download,
  Lock,
  Globe,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Pencil,
  Check,
  X,
  GitCommit,
} from 'lucide-react'
import { useStore } from '../lib/store'
import type { Itinerary, Trip, TripSettings } from '../lib/types'
import { Button, Card, Badge, Input, Textarea, GitBranchIcon } from '../components/ui'
import DiffView from '../components/DiffView'
import ItineraryEditor from '../components/ItineraryEditor'
import AiTravelDesk from '../components/AiTravelDesk'
import AgentChatWidget from '../components/AgentChatWidget'
import TripStyleDials from '../components/TripStyleDials'
import { countChanges, summarizeChanges } from '../lib/diff'
import { itineraryToICS, itineraryToText, downloadFile, slugify } from '../lib/exporter'

type Tab = 'itinerary' | 'merge-requests' | 'history'

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TripView() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const {
    getTrip,
    currentUser,
    users,
    openMergeRequest,
    mergeRequest,
    closeRequest,
    updateTripSettings,
    updateTripVisibility,
    revertToCommit,
  } = useStore()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('itinerary')
  const [proposing, setProposing] = useState(false)
  const [draft, setDraft] = useState<Itinerary | null>(null)
  const [mrTitle, setMrTitle] = useState('')
  const [mrDesc, setMrDesc] = useState('')
  const [showControls, setShowControls] = useState(false)

  // Load (and reload) the trip from the repo.
  const reload = useCallback(async () => {
    if (!tripId) return
    const t = await getTrip(tripId)
    setTrip(t)
    setLoading(false)
  }, [tripId, getTrip])

  useEffect(() => {
    reload()
  }, [reload])

  const openMrs = useMemo(() => trip?.mergeRequests.filter((m) => m.status === 'open') ?? [], [trip])

  if (loading) {
    return <div className="py-20 text-center text-muted">Loading trip…</div>
  }

  if (!trip || !currentUser) {
    return (
      <div className="text-center text-muted">
        <p>Trip not found.</p>
        <Link to="/dashboard" className="text-accent hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const isOwner = trip.ownerId === currentUser.id
  const ownerUser = users.find((u) => u.id === trip.ownerId)
  const ownerLabel = isOwner ? 'you' : ownerUser?.name ?? 'someone else'

  function startProposing() {
    setDraft(structuredClone(trip!.itinerary))
    setMrTitle('')
    setMrDesc('')
    setProposing(true)
  }

  async function submitMergeRequest() {
    if (!draft || !mrTitle.trim()) return
    await openMergeRequest(trip!.id, mrTitle.trim(), mrDesc.trim(), draft)
    setProposing(false)
    setDraft(null)
    await reload()
    setTab('merge-requests')
  }

  // Called by the AI travel desk when the user wants to add researched flights
  // or hotels into the itinerary — opens it as a merge request, consistent
  // with the rest of the git flow.
  async function proposeFlights(proposed: Itinerary, title: string, summary: string) {
    await openMergeRequest(trip!.id, title, summary, proposed)
    await reload()
    setTab('merge-requests')
  }

  // Dials: persist the chosen trip style, then open the AI-reworked itinerary
  // as a merge request for review (same flow as every other AI change).
  async function applyDials(settings: TripSettings, proposed: Itinerary, title: string, summary: string) {
    await updateTripSettings(trip!.id, settings)
    await openMergeRequest(trip!.id, title, summary, proposed)
    setShowControls(false)
    await reload()
    setTab('merge-requests')
  }

  // Per-line manual edit → opens a merge request (same review flow as AI edits).
  async function proposeEdit(proposed: Itinerary, title: string) {
    await openMergeRequest(trip!.id, title, 'Manual edit to a single activity.', proposed)
    await reload()
    setTab('merge-requests')
  }

  // Owner-only: flip the trip between private (owner only) and shared.
  async function toggleVisibility() {
    const next = trip!.visibility === 'private' ? 'shared' : 'private'
    await updateTripVisibility(trip!.id, next)
    await reload()
  }

  // Owner-only: revert the itinerary to a prior commit (records a new commit).
  async function handleRevert(commitId: string) {
    await revertToCommit(trip!.id, commitId)
    await reload()
    setTab('history')
  }

  function exportIcs() {
    downloadFile(`${slugify(trip!.name)}.ics`, itineraryToICS(trip!), 'text/calendar')
  }

  function exportText() {
    downloadFile(`${slugify(trip!.name)}.txt`, itineraryToText(trip!), 'text/plain')
  }

  const draftChanges = draft ? countChanges(trip.itinerary, draft) : { added: 0, removed: 0 }

  return (
    <div className="animate-fade-in space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-edge bg-panel/60 p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2 font-mono text-2xl font-semibold text-gray-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-glow">
              <GitBranchIcon className="h-5 w-5" />
            </span>
            {trip.name}
          </div>
          <p className="mt-1 text-sm text-gray-300">
            {trip.destination} · {trip.startDate} → {trip.endDate}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="text-gray-300">owner: {ownerLabel}</Badge>
            <Badge className="text-gray-300" >
              {trip.collaboratorEmails.length} collaborators
            </Badge>
            <Badge className="text-added">{trip.commits.length} commits</Badge>
            <Badge className="text-merge">{openMrs.length} open MRs</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            ← Repos
          </Button>
          <Button variant="secondary" data-testid="controls-btn" onClick={() => setShowControls(true)} title="Trip style & settings">
            <SlidersHorizontal className="h-4 w-4" />
            Controls
          </Button>
          <Button variant="secondary" data-testid="export-ics-btn" onClick={exportIcs} title="Download an .ics calendar file">
            <Calendar className="h-4 w-4" />
            Add to calendar
          </Button>
          <Button variant="secondary" data-testid="export-txt-btn" onClick={exportText} title="Download the plan as text">
            <Download className="h-4 w-4" />
            Download plan
          </Button>
          {isOwner && (
            <Button
              variant="ghost"
              data-testid="visibility-toggle"
              onClick={toggleVisibility}
              title={trip.visibility === 'private' ? 'Make this trip visible to collaborators' : 'Make this trip private to you'}
            >
              {trip.visibility === 'private' ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {trip.visibility === 'private' ? 'Private' : 'Shared'}
            </Button>
          )}
          {!proposing && (
            <Button variant="merge" data-testid="propose-changes-btn" onClick={startProposing}>
              <GitBranchIcon className="h-4 w-4" />
              Propose changes
            </Button>
          )}
        </div>
      </div>

      {/* collaborators line */}
      {trip.collaboratorEmails.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Collaborators:</span>
          {trip.collaboratorEmails.map((e) => (
            <Badge key={e} className="text-gray-300" >
              {e}
            </Badge>
          ))}
        </div>
      )}

      {/* Two-column layout: main content (left) + AI travel desk sidebar (right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* proposing panel */}
          {proposing && draft && (
            <Card className="space-y-4 border-merge/60">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-100">Propose changes (new merge request)</h2>
                <span className="font-mono text-xs">
                  <span className="text-added">+{draftChanges.added}</span>{' '}
                  <span className="text-removed">-{draftChanges.removed}</span>
                </span>
              </div>
              <p className="text-sm text-muted">
                Edit the itinerary below. Your changes become a merge request the owner can review and merge.
              </p>

              <ItineraryEditor initial={trip.itinerary} onChange={setDraft} />

              <div className="space-y-3 border-t border-edge pt-4">
                <Input
                  label="Merge request title"
                  data-testid="mr-title"
                  placeholder="e.g. Add a food tour on day 2"
                  value={mrTitle}
                  onChange={(e) => setMrTitle(e.target.value)}
                />
            <Textarea
              label="Description"
              data-testid="mr-description"
              placeholder="Why this change?"
              rows={2}
              value={mrDesc}
              onChange={(e) => setMrDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setProposing(false); setDraft(null) }}>
                Cancel
              </Button>
              <Button
                variant="merge"
                data-testid="submit-mr"
                disabled={!mrTitle.trim()}
                onClick={submitMergeRequest}
              >
                Open merge request
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* tabs */}
          {!proposing && (
            <>
              <div className="flex gap-1 border-b border-edge" role="tablist">
                <TabButton id="itinerary" active={tab} set={setTab} label="Itinerary" />
                <TabButton id="merge-requests" active={tab} set={setTab} label={`Merge requests (${openMrs.length})`} />
                <TabButton id="history" active={tab} set={setTab} label={`History (${trip.commits.length})`} />
              </div>

              {tab === 'itinerary' && <ItineraryTab trip={trip} onProposeEdit={proposeEdit} />}
              {tab === 'merge-requests' && (
                <MergeRequestsTab
                  trip={trip}
                  isOwner={isOwner}
                  onMerge={async (mrId) => {
                    await mergeRequest(trip.id, mrId)
                    await reload()
                  }}
                  onClose={async (mrId) => {
                    await closeRequest(trip.id, mrId)
                    await reload()
                  }}
                />
              )}
              {tab === 'history' && (
                <HistoryTab trip={trip} isOwner={isOwner} onRevert={handleRevert} />
              )}
            </>
          )}
        </div>

        {/* Right sidebar: AI travel desk (overview / flights / hotels) */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <AiTravelDesk trip={trip} onPropose={proposeFlights} />
          </div>
        </aside>
      </div>

      {/* Controls drawer: trip style dials + settings, off the main screen. */}
      {showControls && (
        <div className="fixed inset-0 z-40" data-testid="controls-drawer">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowControls(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(92vw,380px)] overflow-y-auto border-l border-edge bg-ink p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-mono text-lg font-semibold text-gray-100">
                <SlidersHorizontal className="h-5 w-5 text-accent" /> Controls
              </h2>
              <button
                onClick={() => setShowControls(false)}
                aria-label="Close controls"
                data-testid="controls-close"
                className="text-muted hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <TripStyleDials trip={trip} onApply={applyDials} />
          </div>
        </div>
      )}

      {/* Inline "Make changes with AI" section at the end of the page */}
      <AgentChatWidget
        trip={trip}
        onApprove={async (proposed, summary, instruction) => {
          await openMergeRequest(trip.id, `AI: ${instruction}`, summary, proposed)
          await reload()
          setTab('merge-requests')
        }}
      />
    </div>
  )
}

function TabButton({ id, active, set, label }: { id: Tab; active: Tab; set: (t: Tab) => void; label: string }) {
  const isActive = active === id
  return (
    <button
      role="tab"
      data-testid={`tab-${id}`}
      onClick={() => set(id)}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        isActive ? 'border-accent text-gray-100' : 'border-transparent text-muted hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function ItineraryTab({
  trip,
  onProposeEdit,
}: {
  trip: Trip
  onProposeEdit: (proposed: Itinerary, title: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editTitle, setEditTitle] = useState('')

  function startEdit(id: string, time: string, title: string) {
    setEditingId(id)
    setEditTime(time)
    setEditTitle(title)
  }

  // Save a single-line edit by proposing it as a merge request (not a direct write).
  function saveEdit(dayId: string, actId: string, dayNum: number) {
    const title = editTitle.trim()
    if (!title) return
    const proposed: Itinerary = trip.itinerary.map((d) =>
      d.id === dayId
        ? {
            ...d,
            activities: d.activities.map((a) =>
              a.id === actId ? { ...a, time: editTime.trim() || a.time, title } : a,
            ),
          }
        : d,
    )
    setEditingId(null)
    onProposeEdit(proposed, `Edit Day ${dayNum}: ${title}`)
  }

  return (
    <div className="space-y-4" data-testid="itinerary-list">
      {/* git-style branch line */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <GitBranchIcon className="h-3.5 w-3.5 text-accent" />
        <span className="font-mono text-gray-300">main</span>
        <span className="flex items-center gap-1">
          · <GitCommit className="h-3.5 w-3.5" /> {trip.commits.length} commits
        </span>
        <span>· edit any line to open a merge request</span>
      </div>

      {trip.itinerary.map((day) => (
        <Card key={day.id}>
          <div className="mb-3 flex items-center gap-2">
            <Badge className="text-accent">Day {day.day}</Badge>
            <h3 className="text-base font-semibold text-gray-100">{day.title}</h3>
          </div>
          <ul className="space-y-2">
            {day.activities.map((a) => (
              <li key={a.id} className="group flex items-center gap-3 text-sm">
                {editingId === a.id ? (
                  <>
                    <input
                      aria-label="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-16 rounded border border-edge bg-panel px-2 py-1 font-mono text-xs text-gray-100"
                    />
                    <input
                      aria-label="activity"
                      data-testid="line-edit-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 rounded border border-edge bg-panel px-2 py-1 text-sm text-gray-100"
                    />
                    <button
                      aria-label="save edit"
                      data-testid="line-edit-save"
                      onClick={() => saveEdit(day.id, a.id, day.day)}
                      className="text-added hover:brightness-125"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="cancel edit"
                      onClick={() => setEditingId(null)}
                      className="text-muted hover:text-gray-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-14 shrink-0 font-mono text-muted">{a.time}</span>
                    <span className="flex-1 text-gray-200">{a.title}</span>
                    <button
                      aria-label={`edit ${a.title}`}
                      data-testid="line-edit-btn"
                      onClick={() => startEdit(a.id, a.time, a.title)}
                      title="Edit this line (opens a merge request)"
                      className="text-muted transition-colors hover:text-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function MergeRequestsTab({
  trip,
  isOwner,
  onMerge,
  onClose,
}: {
  trip: Trip
  isOwner: boolean
  onMerge: (mrId: string) => void
  onClose: (mrId: string) => void
}) {
  const mrs = [...trip.mergeRequests].sort((a, b) => b.timestamp - a.timestamp)
  if (mrs.length === 0) {
    return <p className="py-6 text-center text-sm text-muted" data-testid="no-mrs">No merge requests yet. Use “Propose changes” to open one.</p>
  }
  return (
    <div className="space-y-4">
      {mrs.map((mr) => (
        <Card key={mr.id} data-testid="mr-item" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-100">{mr.title}</h3>
                <StatusBadge status={mr.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                opened by {mr.authorName} · {fmt(mr.timestamp)}
              </p>
              {mr.description && <p className="mt-2 text-sm text-gray-300">{mr.description}</p>}
            </div>
            {mr.status === 'open' && (
              <div className="flex gap-2">
                <Button
                  variant="merge"
                  data-testid="merge-btn"
                  disabled={!isOwner}
                  title={isOwner ? 'Merge this request' : 'Only the owner can merge'}
                  onClick={() => onMerge(mr.id)}
                >
                  Merge
                </Button>
                <Button variant="secondary" data-testid="close-mr-btn" onClick={() => onClose(mr.id)}>
                  Close
                </Button>
              </div>
            )}
          </div>
          {/* AI-style summary banner */}
          <div
            data-testid="mr-summary"
            className="flex gap-2 rounded-md border border-merge/40 bg-merge/10 px-3 py-2 text-sm text-gray-200"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-merge" aria-hidden="true" />
            <p>
              <span className="font-semibold text-merge">AI summary: </span>
              {summarizeChanges(mr.authorName, mr.baseItinerary, mr.proposedItinerary)}
            </p>
          </div>
          <DiffView base={mr.baseItinerary} proposed={mr.proposedItinerary} />
        </Card>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: 'open' | 'merged' | 'closed' }) {
  const map = {
    open: 'text-merge border-merge',
    merged: 'text-added border-added',
    closed: 'text-muted',
  }
  return <Badge className={map[status]} >{status}</Badge>
}

function HistoryTab({
  trip,
  isOwner,
  onRevert,
}: {
  trip: Trip
  isOwner: boolean
  onRevert: (commitId: string) => void
}) {
  const commits = [...trip.commits].sort((a, b) => b.timestamp - a.timestamp)
  return (
    <div className="space-y-0" data-testid="history-list">
      {commits.map((c, i) => (
        <div key={c.id} className="flex gap-3" data-testid="commit-item">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-accent" />
            {i < commits.length - 1 && <div className="w-px flex-1 bg-edge" />}
          </div>
          <div className="flex flex-1 items-start justify-between gap-3 pb-6">
            <div>
              <p className="text-sm font-medium text-gray-100">{c.message}</p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {c.id.slice(-7)} · {c.authorName} · {fmt(c.timestamp)}
              </p>
            </div>
            {/* The most recent commit IS the current plan — no point reverting to it. */}
            {isOwner && i > 0 && (
              <Button
                variant="ghost"
                data-testid="revert-btn"
                onClick={() => onRevert(c.id)}
                title="Reset the itinerary to this point (records a new commit)"
              >
                <RotateCcw className="h-4 w-4" /> Revert to this
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
