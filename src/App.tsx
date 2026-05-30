import { Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import NavBar from './components/NavBar'
import IntroSplash from './components/IntroSplash'
import Welcome from './pages/Welcome'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import CreateTrip from './pages/CreateTrip'
import TripView from './pages/TripView'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser, ready } = useStore()
  // Wait for the session to restore before deciding, so a logged-in user
  // isn't bounced to /login on a refresh.
  if (!ready) {
    return <div className="py-20 text-center text-muted">Loading…</div>
  }
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Shell() {
  return (
    <div className="flex min-h-full flex-col">
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/create"
            element={
              <RequireAuth>
                <CreateTrip />
              </RequireAuth>
            }
          />
          <Route
            path="/trip/:tripId"
            element={
              <RequireAuth>
                <TripView />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <IntroSplash />
      <Shell />
    </StoreProvider>
  )
}
