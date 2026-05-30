import { useState } from 'react'
import type { Itinerary } from '../lib/types'
import { uid } from '../lib/storage'
import { Button } from './ui'

// Lets a collaborator edit a working copy of the itinerary: edit activity
// text, remove activities, or add new ones. Produces a "proposed" itinerary
// that can be turned into a merge request.

export default function ItineraryEditor({
  initial,
  onChange,
}: {
  initial: Itinerary
  onChange: (next: Itinerary) => void
}) {
  const [draft, setDraft] = useState<Itinerary>(() => structuredClone(initial))

  function update(next: Itinerary) {
    setDraft(next)
    onChange(next)
  }

  function editActivity(dayId: string, actId: string, field: 'time' | 'title', value: string) {
    update(
      draft.map((day) =>
        day.id === dayId
          ? { ...day, activities: day.activities.map((a) => (a.id === actId ? { ...a, [field]: value } : a)) }
          : day,
      ),
    )
  }

  function removeActivity(dayId: string, actId: string) {
    update(
      draft.map((day) =>
        day.id === dayId ? { ...day, activities: day.activities.filter((a) => a.id !== actId) } : day,
      ),
    )
  }

  function addActivity(dayId: string) {
    update(
      draft.map((day) =>
        day.id === dayId
          ? { ...day, activities: [...day.activities, { id: uid('act'), time: '15:00', title: 'New activity' }] }
          : day,
      ),
    )
  }

  return (
    <div className="space-y-4" data-testid="itinerary-editor">
      {draft.map((day) => (
        <div key={day.id} className="rounded-md border border-edge bg-ink p-3">
          <div className="mb-2 text-sm font-semibold text-gray-200">
            Day {day.day} — {day.title}
          </div>
          <div className="space-y-2">
            {day.activities.map((act) => (
              <div key={act.id} className="flex items-center gap-2">
                <input
                  aria-label="time"
                  value={act.time}
                  onChange={(e) => editActivity(day.id, act.id, 'time', e.target.value)}
                  className="w-20 rounded border border-edge bg-panel px-2 py-1 text-xs text-gray-100"
                />
                <input
                  aria-label="activity"
                  data-testid="edit-activity-input"
                  value={act.title}
                  onChange={(e) => editActivity(day.id, act.id, 'title', e.target.value)}
                  className="flex-1 rounded border border-edge bg-panel px-2 py-1 text-sm text-gray-100"
                />
                <button
                  type="button"
                  aria-label="remove activity"
                  onClick={() => removeActivity(day.id, act.id)}
                  className="rounded px-2 py-1 text-xs text-muted hover:text-removed"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            data-testid="add-activity"
            onClick={() => addActivity(day.id)}
            className="mt-2 text-xs text-accent hover:underline"
          >
            + Add activity
          </button>
        </div>
      ))}
    </div>
  )
}
