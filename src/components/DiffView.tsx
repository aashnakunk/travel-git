import { diffItineraries, countChanges } from '../lib/diff'
import type { Itinerary } from '../lib/types'

export default function DiffView({ base, proposed }: { base: Itinerary; proposed: Itinerary }) {
  const diff = diffItineraries(base, proposed)
  const { added, removed } = countChanges(base, proposed)

  return (
    <div data-testid="diff-view" className="overflow-hidden rounded-md border border-edge">
      <div className="flex items-center gap-3 border-b border-edge bg-ink px-3 py-2 text-xs font-mono">
        <span className="text-added">+{added}</span>
        <span className="text-removed">-{removed}</span>
        <span className="text-muted">changes to the itinerary</span>
      </div>
      <div className="bg-panel">
        {diff.length === 0 && (
          <p className="px-3 py-3 text-sm text-muted">No changes proposed.</p>
        )}
        {diff.map((day) => (
          <div key={day.dayLabel} className="border-b border-edge last:border-b-0">
            <div className="bg-ink/50 px-3 py-1.5 text-xs font-semibold text-gray-300">{day.dayLabel}</div>
            <div className="font-mono text-sm">
              {day.lines.map((line, i) => {
                const sign = line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '
                const cls =
                  line.kind === 'added'
                    ? 'bg-green-950/40 text-added'
                    : line.kind === 'removed'
                      ? 'bg-red-950/40 text-removed'
                      : 'text-gray-400'
                return (
                  <div key={i} className={`flex gap-2 px-3 py-0.5 ${cls}`}>
                    <span className="select-none opacity-70">{sign}</span>
                    <span>{line.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
