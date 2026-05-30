import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Button, Input, GitBranchIcon } from '../components/ui'

type Mode = 'signup' | 'login'

export default function Auth() {
  const navigate = useNavigate()
  const { signUp, logIn, users } = useStore()

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()

  function toggleMode() {
    setMode((m) => (m === 'signup' ? 'login' : 'signup'))
    setError('')
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault()
    if (!trimmedName || !trimmedEmail) return
    await signUp(trimmedName, trimmedEmail)
    navigate('/dashboard')
  }

  async function handleLogIn(event: FormEvent) {
    event.preventDefault()
    if (!trimmedEmail) return
    const user = await logIn(trimmedEmail)
    if (!user) {
      setError('No account found for that email.')
      return
    }
    navigate('/dashboard')
  }

  async function quickLogin(email: string) {
    const user = await logIn(email)
    if (user) navigate('/dashboard')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="animate-fade-in rounded-xl border border-edge bg-panel p-6 shadow-glow">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow">
            <GitBranchIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-mono text-2xl font-bold text-gray-100">Welcome to TravelGit</h1>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted">
          {mode === 'signup'
            ? 'Create an account to start planning your next trip.'
            : 'Log in to get back to your trips.'}
        </p>

        {mode === 'signup' ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <Input
              label="Name"
              data-testid="signup-name"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              data-testid="signup-email"
              placeholder="ada@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              data-testid="signup-submit"
              className="w-full"
              disabled={!trimmedName || !trimmedEmail}
            >
              Create account
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogIn} className="space-y-4">
            <Input
              label="Email"
              type="email"
              data-testid="login-email"
              placeholder="ada@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
            />
            {error && (
              <p data-testid="login-error" className="text-sm text-removed">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              data-testid="login-submit"
              className="w-full"
              disabled={!trimmedEmail}
            >
              Log in
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-muted">
          <button
            type="button"
            data-testid="toggle-auth-mode"
            onClick={toggleMode}
            className="text-accent hover:underline"
          >
            {mode === 'signup' ? 'Already have an account? Log in' : 'Need an account? Sign up'}
          </button>
        </div>

        {/* Quick login for seeded demo users */}
        <div className="mt-6 border-t border-edge pt-4">
          <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted">
            Quick login (demo users)
          </p>
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                data-testid={`quick-login-${u.name.toLowerCase()}`}
                onClick={() => quickLogin(u.email)}
                className="group flex items-center gap-3 rounded-lg border border-edge bg-ink px-3 py-2.5 text-left text-sm text-gray-200 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-card"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-sm font-semibold text-white shadow-glow">
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-gray-100">{u.name}</span>
                  <span className="truncate text-xs text-muted">{u.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
