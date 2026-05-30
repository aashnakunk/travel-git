import { useEffect, useState } from 'react'
import { GitBranchIcon } from './ui'

// Once-per-session marketing intro: a big "TravelGit" reveal with the logo
// sliding in, a plane tracing a dotted flight path, then it fades into the app.
// Shown on first load so the product feels like a launch, not just a page.

const SESSION_KEY = 'travelgit:introSeen'

export default function IntroSplash() {
  // Only show if we haven't shown it this session.
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!show) return
    // Hold the splash, then play the exit fade and unmount.
    const holdMs = 2300
    const exitMs = 600
    const t1 = setTimeout(() => setLeaving(true), holdMs)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* ignore */
      }
    }, holdMs + exitMs)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [show])

  function skip() {
    setLeaving(true)
    setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 300)
  }

  if (!show) return null

  return (
    <div
      data-testid="intro-splash"
      onClick={skip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-ink ${
        leaving ? 'animate-splash-out' : ''
      }`}
    >
      {/* Ambient color blooms */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-1/4 bottom-1/4 h-72 w-72 rounded-full bg-merge/20 blur-3xl"
      />

      {/* Dotted flight path with a plane drawing across it */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 120"
        className="absolute top-[28%] h-24 w-[min(90vw,520px)] opacity-70"
      >
        <path
          d="M10,100 C120,20 280,20 390,80"
          fill="none"
          stroke="url(#trail)"
          strokeWidth="2"
          strokeDasharray="6 8"
          className="animate-draw-path"
          style={{ strokeDasharray: '300', strokeDashoffset: '300' }}
        />
        <defs>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b9bff" />
            <stop offset="100%" stopColor="#a371f7" />
          </linearGradient>
        </defs>
      </svg>

      {/* Logo + wordmark */}
      <div className="relative flex items-center gap-4">
        <span className="flex h-20 w-20 animate-slide-in-logo items-center justify-center rounded-3xl bg-accent-gradient text-white shadow-glow">
          <GitBranchIcon className="h-10 w-10" />
        </span>
        <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">
          <span
            className="inline-block animate-slide-in-word text-gray-100"
            style={{ animationDelay: '250ms' }}
          >
            Travel
          </span>
          <span
            className="inline-block animate-slide-in-word text-gradient"
            style={{ animationDelay: '420ms' }}
          >
            Git
          </span>
        </h1>
      </div>

      <p
        className="mt-6 animate-fade-in text-lg text-muted"
        style={{ animationDelay: '700ms' }}
      >
        Plan trips like you ship code.
      </p>

      <button
        onClick={skip}
        className="absolute bottom-8 animate-fade-in text-xs uppercase tracking-widest text-muted transition-colors hover:text-gray-300"
        style={{ animationDelay: '1200ms' }}
      >
        Skip intro →
      </button>
    </div>
  )
}
