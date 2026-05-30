import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Button, GitBranchIcon } from './ui'

export default function NavBar() {
  const { currentUser, users, logOut, switchUser } = useStore()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to={currentUser ? '/dashboard' : '/'} className="flex items-center gap-2 font-mono text-lg font-semibold text-gray-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-glow">
            <GitBranchIcon className="h-4 w-4" />
          </span>
          Travel<span className="text-gradient">Git</span>
        </Link>

        {currentUser && (
          <div className="flex items-center gap-3">
            {/* User switcher — lets us demo collaborators logging in */}
            <div className="flex items-center gap-2 rounded-lg border border-edge bg-ink px-2 py-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-[10px] font-semibold text-white">
                {currentUser.name.charAt(0).toUpperCase()}
              </span>
              <select
                aria-label="Switch user"
                data-testid="user-switcher"
                value={currentUser.id}
                onChange={(e) => switchUser(e.target.value)}
                className="bg-transparent text-sm text-gray-200 focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-panel">
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                logOut()
                navigate('/')
              }}
            >
              Log out
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
