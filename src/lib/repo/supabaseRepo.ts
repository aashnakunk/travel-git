import type { SupabaseClient } from '@supabase/supabase-js'
import type { Commit, Itinerary, MergeRequest, Trip, TripSettings, TripVisibility, User } from '../types'
import { DEFAULT_TRIP_SETTINGS } from '../types'
import { uid } from '../storage'
import { generateItinerary } from '../generator'
import type { CreateTripInput, Invite, Repo } from './types'

// Maps a DB trip row + its merge-request rows into the app's Trip shape.
function rowToTrip(row: any, mrRows: any[]): Trip {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    ownerId: row.owner_id,
    collaboratorEmails: Array.isArray(row.collaborator_emails) ? row.collaborator_emails : [],
    planPath: row.plan_path,
    vibeAnswers: row.vibe_answers ?? undefined,
    visibility: (row.visibility as TripVisibility) ?? 'shared',
    settings: row.settings ?? { ...DEFAULT_TRIP_SETTINGS },
    itinerary: Array.isArray(row.itinerary) ? row.itinerary : [],
    commits: Array.isArray(row.commits) ? row.commits : [],
    mergeRequests: mrRows.map(rowToMr),
    createdAt: new Date(row.created_at).getTime(),
  }
}

function rowToMr(row: any): MergeRequest {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    authorId: row.author_id,
    authorName: row.author_name,
    status: row.status,
    timestamp: new Date(row.created_at).getTime(),
    proposedItinerary: Array.isArray(row.proposed_itinerary) ? row.proposed_itinerary : [],
    baseItinerary: Array.isArray(row.base_itinerary) ? row.base_itinerary : [],
  }
}

export function createSupabaseRepo(sb: SupabaseClient): Repo {
  async function getUsers(): Promise<User[]> {
    const { data } = await sb.from('users').select('*')
    return (data ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email }))
  }

  async function getUserByEmail(email: string): Promise<User | null> {
    const { data } = await sb.from('users').select('*').ilike('email', email).maybeSingle()
    return data ? { id: data.id, name: data.name, email: data.email } : null
  }

  async function createUser(name: string, email: string): Promise<User> {
    const existing = await getUserByEmail(email)
    if (existing) return existing
    const user: User = { id: uid('user'), name, email }
    await sb.from('users').insert({ id: user.id, name: user.name, email: user.email })
    return user
  }

  async function loadMrs(tripId: string): Promise<any[]> {
    const { data } = await sb.from('merge_requests').select('*').eq('trip_id', tripId)
    return data ?? []
  }

  async function getTrip(tripId: string): Promise<Trip | null> {
    const { data } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle()
    if (!data) return null
    const mrs = await loadMrs(tripId)
    return rowToTrip(data, mrs)
  }

  async function tripsForUser(user: User): Promise<Trip[]> {
    // Trips the user owns OR is a collaborator on (by email, stored in JSONB).
    const { data: owned } = await sb.from('trips').select('*').eq('owner_id', user.id)
    const { data: collab } = await sb
      .from('trips')
      .select('*')
      .contains('collaborator_emails', JSON.stringify([user.email]))

    const byId = new Map<string, any>()
    for (const t of owned ?? []) byId.set(t.id, t)
    // Collaborators only see trips that are shared (not private to the owner).
    for (const t of collab ?? []) {
      if (t.owner_id === user.id || (t.visibility ?? 'shared') !== 'private') {
        byId.set(t.id, t)
      }
    }

    const rows = Array.from(byId.values())
    const trips = await Promise.all(
      rows.map(async (r) => rowToTrip(r, await loadMrs(r.id))),
    )
    return trips.sort((a, b) => b.createdAt - a.createdAt)
  }

  async function createTrip(owner: User, input: CreateTripInput): Promise<Trip> {
    const itinerary =
      input.itinerary && input.itinerary.length > 0
        ? input.itinerary
        : generateItinerary(input.destination, input.startDate, input.endDate, input.vibeAnswers)

    const initialCommit: Commit = {
      id: uid('commit'),
      message: 'Initial itinerary generated',
      authorId: owner.id,
      authorName: owner.name,
      timestamp: Date.now(),
      snapshot: itinerary,
    }

    const id = uid('trip')
    await sb.from('trips').insert({
      id,
      name: input.name,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      owner_id: owner.id,
      collaborator_emails: input.collaboratorEmails,
      plan_path: input.planPath,
      vibe_answers: input.vibeAnswers ?? null,
      visibility: 'shared',
      settings: { ...DEFAULT_TRIP_SETTINGS },
      itinerary,
      commits: [initialCommit],
    })

    // Create pending invites for each collaborator email.
    for (const email of input.collaboratorEmails) {
      await sb.from('invites').insert({
        id: uid('inv'),
        trip_id: id,
        trip_name: input.name,
        inviter_name: owner.name,
        invitee_email: email,
        status: 'pending',
      })
    }

    const trip = await getTrip(id)
    return trip!
  }

  async function updateTripSettings(tripId: string, settings: TripSettings): Promise<void> {
    await sb.from('trips').update({ settings }).eq('id', tripId)
  }

  async function updateTripVisibility(tripId: string, visibility: TripVisibility): Promise<void> {
    await sb.from('trips').update({ visibility }).eq('id', tripId)
  }

  async function deleteTrip(tripId: string): Promise<void> {
    // merge_requests and invites cascade-delete via FK on trip_id.
    await sb.from('trips').delete().eq('id', tripId)
  }

  async function revertToCommit(tripId: string, commitId: string, author: User): Promise<void> {
    const trip = await getTrip(tripId)
    if (!trip) return
    const target = trip.commits.find((c) => c.id === commitId)
    if (!target) return

    // Reverting records a NEW commit whose snapshot is the target's snapshot,
    // preserving full history (true to the git metaphor — nothing is erased).
    const commit: Commit = {
      id: uid('commit'),
      message: `Revert to “${target.message}”`,
      authorId: author.id,
      authorName: author.name,
      timestamp: Date.now(),
      snapshot: target.snapshot,
    }
    await sb
      .from('trips')
      .update({ itinerary: target.snapshot, commits: [...trip.commits, commit] })
      .eq('id', tripId)
  }

  async function openMergeRequest(
    tripId: string,
    author: User,
    title: string,
    description: string,
    proposed: Itinerary,
  ): Promise<MergeRequest | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null
    const id = uid('mr')
    await sb.from('merge_requests').insert({
      id,
      trip_id: tripId,
      title,
      description,
      author_id: author.id,
      author_name: author.name,
      status: 'open',
      proposed_itinerary: proposed,
      base_itinerary: trip.itinerary,
    })
    const { data } = await sb.from('merge_requests').select('*').eq('id', id).maybeSingle()
    return data ? rowToMr(data) : null
  }

  async function mergeRequest(tripId: string, mrId: string): Promise<void> {
    const { data: mrRow } = await sb.from('merge_requests').select('*').eq('id', mrId).maybeSingle()
    if (!mrRow || mrRow.status !== 'open') return
    const trip = await getTrip(tripId)
    if (!trip) return

    const commit: Commit = {
      id: uid('commit'),
      message: `Merge: ${mrRow.title}`,
      authorId: mrRow.author_id,
      authorName: mrRow.author_name,
      timestamp: Date.now(),
      snapshot: mrRow.proposed_itinerary,
    }

    await sb
      .from('trips')
      .update({ itinerary: mrRow.proposed_itinerary, commits: [...trip.commits, commit] })
      .eq('id', tripId)
    await sb.from('merge_requests').update({ status: 'merged' }).eq('id', mrId)
  }

  async function closeRequest(_tripId: string, mrId: string): Promise<void> {
    await sb.from('merge_requests').update({ status: 'closed' }).eq('id', mrId)
  }

  async function invitesForEmail(email: string): Promise<Invite[]> {
    const { data } = await sb
      .from('invites')
      .select('*')
      .ilike('invitee_email', email)
      .eq('status', 'pending')
    return (data ?? []).map((r) => ({
      id: r.id,
      tripId: r.trip_id,
      tripName: r.trip_name,
      inviterName: r.inviter_name,
      inviteeEmail: r.invitee_email,
      status: r.status,
      createdAt: new Date(r.created_at).getTime(),
    }))
  }

  async function acceptInvite(inviteId: string): Promise<void> {
    await sb.from('invites').update({ status: 'accepted' }).eq('id', inviteId)
  }

  async function declineInvite(inviteId: string): Promise<void> {
    await sb.from('invites').update({ status: 'declined' }).eq('id', inviteId)
  }

  return {
    getUsers,
    getUserByEmail,
    createUser,
    getTrip,
    tripsForUser,
    createTrip,
    updateTripSettings,
    updateTripVisibility,
    deleteTrip,
    revertToCommit,
    openMergeRequest,
    mergeRequest,
    closeRequest,
    invitesForEmail,
    acceptInvite,
    declineInvite,
  }
}
