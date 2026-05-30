import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Itinerary, Trip, TripSettings, TripVisibility, User } from './types'
import { repo, isRemote, type CreateTripInput, type Invite } from './repo'

// Where the current logged-in user id is persisted (per browser/device).
const CURRENT_USER_KEY = 'travelgit:currentUserId'

interface StoreContextValue {
  isRemote: boolean
  currentUser: User | null
  users: User[]
  ready: boolean
  // auth
  signUp: (name: string, email: string) => Promise<User>
  logIn: (email: string) => Promise<User | null>
  logOut: () => void
  switchUser: (userId: string) => void
  // trips
  createTrip: (input: CreateTripInput) => Promise<Trip>
  getTrip: (tripId: string) => Promise<Trip | null>
  loadMyTrips: () => Promise<Trip[]>
  updateTripSettings: (tripId: string, settings: TripSettings) => Promise<void>
  updateTripVisibility: (tripId: string, visibility: TripVisibility) => Promise<void>
  deleteTrip: (tripId: string) => Promise<void>
  revertToCommit: (tripId: string, commitId: string) => Promise<void>
  // merge requests
  openMergeRequest: (
    tripId: string,
    title: string,
    description: string,
    proposed: Itinerary,
  ) => Promise<void>
  mergeRequest: (tripId: string, mrId: string) => Promise<void>
  closeRequest: (tripId: string, mrId: string) => Promise<void>
  // invites
  loadMyInvites: () => Promise<Invite[]>
  acceptInvite: (inviteId: string) => Promise<void>
  declineInvite: (inviteId: string) => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [ready, setReady] = useState(false)

  // On mount: load the user list and restore the persisted session.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const allUsers = await repo.getUsers()
      if (cancelled) return
      setUsers(allUsers)
      const savedId = localStorage.getItem(CURRENT_USER_KEY)
      if (savedId) {
        const found = allUsers.find((u) => u.id === savedId) ?? null
        setCurrentUser(found)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshUsers = useCallback(async () => {
    setUsers(await repo.getUsers())
  }, [])

  const persistCurrent = useCallback((user: User | null) => {
    setCurrentUser(user)
    if (user) localStorage.setItem(CURRENT_USER_KEY, user.id)
    else localStorage.removeItem(CURRENT_USER_KEY)
  }, [])

  const signUp = useCallback(
    async (name: string, email: string) => {
      const user = await repo.createUser(name, email)
      await refreshUsers()
      persistCurrent(user)
      return user
    },
    [refreshUsers, persistCurrent],
  )

  const logIn = useCallback(
    async (email: string) => {
      const user = await repo.getUserByEmail(email)
      if (user) persistCurrent(user)
      return user
    },
    [persistCurrent],
  )

  const logOut = useCallback(() => persistCurrent(null), [persistCurrent])

  const switchUser = useCallback(
    (userId: string) => {
      const found = users.find((u) => u.id === userId) ?? null
      persistCurrent(found)
    },
    [users, persistCurrent],
  )

  const createTrip = useCallback(
    async (input: CreateTripInput) => {
      if (!currentUser) throw new Error('not logged in')
      return repo.createTrip(currentUser, input)
    },
    [currentUser],
  )

  const getTrip = useCallback((tripId: string) => repo.getTrip(tripId), [])

  const loadMyTrips = useCallback(async () => {
    if (!currentUser) return []
    return repo.tripsForUser(currentUser)
  }, [currentUser])

  const updateTripSettings = useCallback(
    (tripId: string, settings: TripSettings) => repo.updateTripSettings(tripId, settings),
    [],
  )
  const updateTripVisibility = useCallback(
    (tripId: string, visibility: TripVisibility) => repo.updateTripVisibility(tripId, visibility),
    [],
  )
  const deleteTrip = useCallback((tripId: string) => repo.deleteTrip(tripId), [])
  const revertToCommit = useCallback(
    async (tripId: string, commitId: string) => {
      if (!currentUser) return
      await repo.revertToCommit(tripId, commitId, currentUser)
    },
    [currentUser],
  )

  const openMergeRequest = useCallback(
    async (tripId: string, title: string, description: string, proposed: Itinerary) => {
      if (!currentUser) return
      await repo.openMergeRequest(tripId, currentUser, title, description, proposed)
    },
    [currentUser],
  )

  const mergeRequest = useCallback((tripId: string, mrId: string) => repo.mergeRequest(tripId, mrId), [])
  const closeRequest = useCallback((tripId: string, mrId: string) => repo.closeRequest(tripId, mrId), [])

  const loadMyInvites = useCallback(async () => {
    if (!currentUser) return []
    return repo.invitesForEmail(currentUser.email)
  }, [currentUser])

  const acceptInvite = useCallback((inviteId: string) => repo.acceptInvite(inviteId), [])
  const declineInvite = useCallback((inviteId: string) => repo.declineInvite(inviteId), [])

  const value: StoreContextValue = {
    isRemote,
    currentUser,
    users,
    ready,
    signUp,
    logIn,
    logOut,
    switchUser,
    createTrip,
    getTrip,
    loadMyTrips,
    updateTripSettings,
    updateTripVisibility,
    deleteTrip,
    revertToCommit,
    openMergeRequest,
    mergeRequest,
    closeRequest,
    loadMyInvites,
    acceptInvite,
    declineInvite,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
