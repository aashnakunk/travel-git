import { useState } from 'react'
import { SlidersHorizontal, Zap, Wallet, Mountain, type LucideIcon } from 'lucide-react'
import type { Itinerary, Trip, TripSettings } from '../lib/types'
import {
  DIALS,
  dialLabel,
  settingsHeadline,
  buildSettingsInstruction,
} from '../lib/tripSettings'
import { agentEdit } from '../lib/agentClient'
import { Button, Card } from './ui'

// Map each dial to a lucide icon (replaces the old emoji glyphs).
const DIAL_ICONS: Record<string, LucideIcon> = {
  pace: Zap,
  budget: Wallet,
  adventure: Mountain,
}

// Interactive "trip dials": pace / budget / adventure sliders. Dragging a dial
// and hitting "Rework with AI" sends a settings-derived instruction to the
// agent, which reworks the itinerary; the result opens as a merge request
// (consistent with the rest of the git flow). The chosen settings are persisted
// so the dials survive a reload.
export default function TripStyleDials({
  trip,
  onApply,
}: {
  trip: Trip
  onApply: (
    settings: TripSettings,
    proposed: Itinerary,
    title: string,
    summary: string,
  ) => void | Promise<void>
}) {
  const [settings, setSettings] = useState<TripSettings>(trip.settings)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const dirty =
    settings.pace !== trip.settings.pace ||
    settings.budget !== trip.settings.budget ||
    settings.adventure !== trip.settings.adventure

  function set(key: keyof TripSettings, value: number) {
    setSettings((s) => ({ ...s, [key]: value }))
    setError(false)
  }

  async function rework() {
    if (loading || !dirty) return
    setLoading(true)
    setError(false)
    const instruction = buildSettingsInstruction(trip.settings, settings)
    const result = await agentEdit(trip.destination, trip.itinerary, instruction)
    setLoading(false)
    if (!result) {
      setError(true)
      return
    }
    await onApply(settings, result.proposed, `AI: trip style → ${settingsHeadline(settings)}`, result.summary)
  }

  return (
    <Card className="space-y-4 border-accent/30 bg-accent/5" data-testid="trip-dials">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-100">Trip style</h2>
      </div>
      <p data-testid="dials-headline" className="text-xs text-muted">
        {settingsHeadline(settings)}
      </p>

      <div className="space-y-4">
        {DIALS.map((dial) => {
          const Icon = DIAL_ICONS[dial.key]
          return (
          <div key={dial.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-gray-200">
                {Icon && <Icon className="h-4 w-4 text-muted" />} {dial.label}
              </span>
              <span className="font-mono text-xs text-accent">
                {dialLabel(dial, settings[dial.key])}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              aria-label={dial.label}
              data-testid={`dial-${dial.key}`}
              value={settings[dial.key]}
              onChange={(e) => set(dial.key, Number(e.target.value))}
              disabled={loading}
              className="w-full cursor-pointer"
              style={{ accentColor: '#3b9bff' }}
            />
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted">
              <span>{dial.low}</span>
              <span>{dial.high}</span>
            </div>
          </div>
          )
        })}
      </div>

      {loading && (
        <p data-testid="dials-loading" className="flex items-center gap-1.5 text-sm text-accent">
          <SlidersHorizontal className="h-4 w-4" /> Reworking your itinerary…
        </p>
      )}
      {error && (
        <p data-testid="dials-unavailable" className="text-sm text-muted">
          AI rework isn't available right now.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          variant="merge"
          data-testid="dials-apply-btn"
          onClick={rework}
          disabled={loading || !dirty}
          title={dirty ? 'Rework the itinerary to match these dials' : 'Move a dial to rework'}
        >
          {loading ? 'Reworking…' : 'Rework with AI'}
        </Button>
      </div>
    </Card>
  )
}
