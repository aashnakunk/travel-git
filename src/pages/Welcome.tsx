import { useNavigate } from 'react-router-dom'
import { GitBranch, GitMerge, Users, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, GitBranchIcon } from '../components/ui'
import FlightBranch from '../components/FlightBranch'

interface Feature {
  title: string
  description: string
  icon: LucideIcon
}

const features: Feature[] = [
  {
    title: 'Plan by vibe or destination',
    description: 'Start from a place you love or just the mood you are chasing.',
    icon: GitBranch,
  },
  {
    title: 'Invite friends to collaborate',
    description: 'Bring your travel crew into the same plan, no spreadsheets required.',
    icon: Users,
  },
  {
    title: 'Review changes with merge requests',
    description: 'Friends propose tweaks, you review the diff and merge what fits.',
    icon: GitMerge,
  },
]

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-16 text-center">
      {/* Decorative ambient glow blooms (purely decorative) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />

      <div
        className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-edge bg-panel px-4 py-1.5 text-sm text-muted shadow-card"
        style={{ animationDelay: '0ms' }}
      >
        <GitBranchIcon className="h-4 w-4 text-accent" />
        <span>Version control for your travel plans</span>
      </div>

      <h1
        className="animate-fade-in font-mono text-4xl font-bold tracking-tight text-gradient sm:text-5xl"
        style={{ animationDelay: '80ms' }}
      >
        Your itinerary, version-controlled.
      </h1>

      <p
        className="mx-auto mt-5 max-w-2xl animate-fade-in text-lg text-muted"
        style={{ animationDelay: '160ms' }}
      >
        A trip is a repo and your itinerary is the main branch. Friends propose changes through merge
        requests, and you merge the ones you love to keep everyone on the same plan.
      </p>

      {/* Interactive git + flight hero — plane flies main, commits light up */}
      <div className="mt-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <FlightBranch />
      </div>

      <div
        className="mt-6 flex animate-fade-in justify-center"
        style={{ animationDelay: '240ms' }}
      >
        <Button
          variant="primary"
          data-testid="start-planning"
          className="group gap-2.5 rounded-full px-9 py-4 text-base font-semibold"
          onClick={() => navigate('/login')}
        >
          Start planning
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
        </Button>
      </div>

      {/* Static feature list — informational, not interactive (no hover/click affordance). */}
      <ul className="mt-16 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {features.map((feature, i) => {
          const Icon = feature.icon
          return (
            <li
              key={feature.title}
              className="animate-fade-in rounded-xl border border-edge bg-panel/60 p-5"
              style={{ animationDelay: `${400 + i * 80}ms` }}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-panel-2 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-gray-100">{feature.title}</h2>
              </div>
              <p className="text-sm text-muted">{feature.description}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
