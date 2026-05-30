import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useStore } from '../lib/store'
import { Button, Card, Badge, GitBranchIcon } from '../components/ui'
import type { Trip } from '../lib/types'
import type { Invite } from '../lib/repo'

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const s = new Date(start)
  const e = new Date(end)
  const sStr = isNaN(s.getTime()) ? start : s.toLocaleDateString(undefined, opts)
  const eStr = isNaN(e.getTime()) ? end : e.toLocaleDateString(undefined, opts)
  return `${sStr} → ${eStr}`
}

export default function Dashboard() {
  const { currentUser, users, loadMyTrips, loadMyInvites, acceptInvite, declineInvite } = useStore()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [invites, setInvites] = useState<Invite[]>([])

  // Resolve a collaborator email to a friendly first name (falls back to the
  // part before the @). Used for the "who's going" line on each trip card.
  function nameForEmail(email: string): string {
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (user) return user.name
    return email.split('@')[0]
  }

  async function refreshTrips() {
    setTrips(await loadMyTrips())
  }

  async function refreshInvites() {
    setInvites(await loadMyInvites())
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [myTrips, myInvites] = await Promise.all([loadMyTrips(), loadMyInvites()])
      if (cancelled) return
      setTrips(myTrips)
      setInvites(myInvites)
    })()
    return () => {
      cancelled = true
    }
  }, [currentUser, loadMyTrips, loadMyInvites])

  async function handleAccept(inviteId: string) {
    await acceptInvite(inviteId)
    await Promise.all([refreshTrips(), refreshInvites()])
  }

  async function handleDecline(inviteId: string) {
    await declineInvite(inviteId)
    await refreshInvites()
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-edge bg-panel/60 p-5 shadow-card">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-2xl font-semibold text-gray-100">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-glow">
              <GitBranchIcon className="h-4 w-4" />
            </span>
            <span className="text-gradient">Your travel repos</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every trip is a repo. Branch it, propose changes, and merge the perfect plan.
          </p>
        </div>
        <Button
          variant="primary"
          data-testid="create-trip-btn"
          className="px-5 py-2.5"
          onClick={() => navigate('/create')}
        >
          <GitBranchIcon className="h-4 w-4" />
          Create a Travel Repo
        </Button>
      </div>

      {invites.length > 0 && (
        <section className="animate-fade-in space-y-3">
          <h2 className="text-lg font-semibold text-gray-100">Pending invites</h2>
          <ul className="space-y-3">
            {invites.map((invite) => (
              <li key={invite.id}>
                <div
                  data-testid="invite-card"
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-merge/40 bg-panel p-5 shadow-card"
                >
                  <p className="min-w-0 text-sm text-gray-200">
                    <span className="font-semibold text-accent">{invite.inviterName}</span> invited you
                    to <span className="font-semibold text-gray-100">{invite.tripName}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="merge"
                      data-testid="accept-invite-btn"
                      onClick={() => handleAccept(invite.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      data-testid="decline-invite-btn"
                      onClick={() => handleDecline(invite.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trips.length === 0 ? (
        <Card className="flex animate-fade-in flex-col items-center gap-4 py-14 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-edge bg-panel-2 shadow-glow">
            <GitBranchIcon className="h-8 w-8 text-accent animate-float" />
          </span>
          <p className="max-w-sm text-sm text-muted">
            No trips yet. Create your first Travel Repo to start planning.
          </p>
          <Button
            variant="primary"
            data-testid="create-trip-btn"
            className="px-5 py-2.5"
            onClick={() => navigate('/create')}
          >
            <GitBranchIcon className="h-4 w-4" />
            Create a Travel Repo
          </Button>
        </Card>
      ) : (
        <ul className="animate-fade-in space-y-3">
          {trips.map((trip, i) => {
            const openMrs = trip.mergeRequests.filter((mr) => mr.status === 'open').length
            return (
              <li
                key={trip.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div
                  data-testid="trip-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/trip/${trip.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/trip/${trip.id}`)
                    }
                  }}
                  className="group cursor-pointer rounded-xl outline-none focus:ring-1 focus:ring-accent"
                >
                  <Card className="relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-glow">
                    {/* Decorative left accent rail, lights up on hover */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-1 bg-accent-gradient opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    />
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-lg font-semibold text-accent">
                          <GitBranchIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{trip.name}</span>
                          {trip.visibility === 'private' && (
                            <span
                              data-testid="private-badge"
                              title="Private to you"
                              className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-muted"
                            >
                              <Lock className="h-3 w-3" /> Private
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-300">{trip.destination}</p>
                        <p className="mt-1 text-xs text-muted">
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </p>
                        {/* Who's going — avatars + names */}
                        {trip.collaboratorEmails.length > 0 && (
                          <div
                            data-testid="trip-collaborators"
                            className="mt-2.5 flex items-center gap-2"
                          >
                            <div className="flex -space-x-2">
                              {trip.collaboratorEmails.slice(0, 4).map((email) => (
                                <span
                                  key={email}
                                  title={email}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-panel bg-accent-gradient text-[10px] font-semibold text-white shadow-card"
                                >
                                  {nameForEmail(email).charAt(0).toUpperCase()}
                                </span>
                              ))}
                            </div>
                            <span className="truncate text-xs text-muted">
                              with{' '}
                              <span className="text-gray-300">
                                {trip.collaboratorEmails.slice(0, 3).map(nameForEmail).join(', ')}
                              </span>
                              {trip.collaboratorEmails.length > 3 &&
                                ` +${trip.collaboratorEmails.length - 3} more`}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-panel-2 text-gray-300">
                          {trip.collaboratorEmails.length}{' '}
                          {trip.collaboratorEmails.length === 1 ? 'collaborator' : 'collaborators'}
                        </Badge>
                        <Badge className="border-added/40 bg-added/10 text-added">
                          {trip.commits.length} {trip.commits.length === 1 ? 'commit' : 'commits'}
                        </Badge>
                        <Badge className="border-merge/40 bg-merge/10 text-merge">
                          {openMrs} open {openMrs === 1 ? 'MR' : 'MRs'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
