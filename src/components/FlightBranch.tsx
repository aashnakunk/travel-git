import { useState } from 'react'

// Interactive git + flight hero: a plane flies along the `main` branch while
// the line draws in and commits light up one by one (init → +day → +MR → HEAD).
// Plays once on load and replays on hover. Pure SVG + CSS, no dependencies.
const COMMITS = [
  { x: 56, y: 78, label: 'init', delay: '0.15s', r: 5.5, labelDy: 22 },
  { x: 150, y: 78, label: '+day', delay: '0.8s', r: 5.5, labelDy: 22 },
  { x: 250, y: 40, label: '+MR', delay: '1.5s', r: 5.5, labelDy: -14 },
  { x: 344, y: 78, label: 'HEAD', delay: '2.3s', r: 7, labelDy: 22 },
]

export default function FlightBranch() {
  // Bumping this key re-mounts the SVG, which restarts every CSS animation.
  const [run, setRun] = useState(0)

  return (
    <div
      className="mx-auto w-[min(92vw,440px)] cursor-pointer select-none"
      onMouseEnter={() => setRun((n) => n + 1)}
      role="img"
      aria-label="A plane flying along a git branch as commits light up"
      data-testid="flight-branch"
      title="Hover to replay"
    >
      <svg key={run} viewBox="0 0 400 120" className="h-28 w-full overflow-visible">
        <style>{`
          .fb-line { stroke:#2a323d; stroke-width:2.5; fill:none; }
          .fb-lit  { stroke:#3b9bff; stroke-width:2.5; fill:none; stroke-linecap:round;
                     stroke-dasharray:340; stroke-dashoffset:340; animation: fb-draw 2.4s ease-out forwards; }
          .fb-dot  { fill:#11161d; stroke:#2a323d; stroke-width:2.5; opacity:.5;
                     transform-box: fill-box; transform-origin: center;
                     animation: fb-pop .5s ease-out both; }
          .fb-lbl  { fill:#8b98a8; font-size:11px; font-family: ui-monospace, Menlo, monospace;
                     opacity:0; animation: fb-fade .4s ease-out both; }
          .fb-plane{ animation: fb-fly 2.5s cubic-bezier(.4,0,.3,1) both; }
          @keyframes fb-draw { to { stroke-dashoffset:0; } }
          @keyframes fb-pop {
            0%   { fill:#11161d; stroke:#2a323d; transform:scale(.6); opacity:.4 }
            60%  { transform:scale(1.4) }
            100% { fill:#3b9bff; stroke:#3b9bff; transform:scale(1); opacity:1 }
          }
          @keyframes fb-fade { to { opacity:1 } }
          @keyframes fb-fly {
            0%   { transform: translate(0,0); opacity:0 }
            6%   { opacity:1 }
            48%  { transform: translate(150px,-7px) }
            100% { transform: translate(300px,0); opacity:1 }
          }
          @media (prefers-reduced-motion: reduce) {
            .fb-lit  { animation:none; stroke-dashoffset:0 }
            .fb-dot  { animation:none; fill:#3b9bff; stroke:#3b9bff; opacity:1; transform:none }
            .fb-lbl  { animation:none; opacity:1 }
            .fb-plane{ animation:none; transform: translate(300px,0) }
          }
        `}</style>

        {/* main branch — a base line plus the accent line that "draws" as the plane flies */}
        <line className="fb-line" x1="40" y1="78" x2="360" y2="78" />
        <line className="fb-lit" x1="40" y1="78" x2="360" y2="78" />

        {/* feature branch stub up to the +MR commit */}
        <path className="fb-line" d="M150,78 C200,78 214,40 250,40" />

        {/* commit nodes + labels */}
        {COMMITS.map((c) => (
          <g key={c.label}>
            <circle
              className="fb-dot"
              cx={c.x}
              cy={c.y}
              r={c.r}
              style={{ animationDelay: c.delay }}
            />
            <text
              className="fb-lbl"
              x={c.x}
              y={c.y + c.labelDy}
              textAnchor="middle"
              style={{ animationDelay: c.delay }}
            >
              {c.label}
            </text>
          </g>
        ))}

        {/* the plane, flying left → right along main */}
        <g className="fb-plane">
          <g transform="translate(34,60) scale(0.9) rotate(45)">
            <path
              fill="#a371f7"
              stroke="#a371f7"
              strokeWidth="1"
              strokeLinejoin="round"
              d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 4.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
