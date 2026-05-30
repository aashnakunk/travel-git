import type {
  Itinerary,
  MergeRequest,
  Trip,
  TripSettings,
  TripVisibility,
  User,
  VibeAnswers,
  PlanPath,
} from '../types'

// A collaboration invite: an owner invites an email to a trip; the invitee
// accepts to become a collaborator.
export interface Invite {
  id: string
  tripId: string
  tripName: string
  inviterName: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
}

export interface CreateTripInput {
  name: string
  destination: string
  startDate: string
  endDate: string
  collaboratorEmails: string[]
  planPath: PlanPath
  vibeAnswers?: VibeAnswers
  itinerary?: Itinerary
}

// The data-access contract. Both the localStorage repo and the Supabase repo
// implement this, so the store can swap between them with one flag. Everything
// is async so the same interface works for a real network-backed DB.
export interface Repo {
  // users
  getUsers(): Promise<User[]>
  getUserByEmail(email: string): Promise<User | null>
  createUser(name: string, email: string): Promise<User>

  // trips
  getTrip(tripId: string): Promise<Trip | null>
  tripsForUser(user: User): Promise<Trip[]>
  createTrip(owner: User, input: CreateTripInput): Promise<Trip>
  // trip settings / visibility / lifecycle
  updateTripSettings(tripId: string, settings: TripSettings): Promise<void>
  updateTripVisibility(tripId: string, visibility: TripVisibility): Promise<void>
  deleteTrip(tripId: string): Promise<void>
  // revert the itinerary to a prior commit's snapshot (records a new commit)
  revertToCommit(tripId: string, commitId: string, author: User): Promise<void>

  // merge requests
  openMergeRequest(
    tripId: string,
    author: User,
    title: string,
    description: string,
    proposed: Itinerary,
  ): Promise<MergeRequest | null>
  mergeRequest(tripId: string, mrId: string): Promise<void>
  closeRequest(tripId: string, mrId: string): Promise<void>

  // invites
  invitesForEmail(email: string): Promise<Invite[]>
  acceptInvite(inviteId: string): Promise<void>
  declineInvite(inviteId: string): Promise<void>
}
