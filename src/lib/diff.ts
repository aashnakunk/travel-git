import type { Itinerary } from './types'

// ---------------------------------------------------------------------------
// Diffing two itineraries into a human-readable, git-style changeset.
// We render per-day "lines" (each activity is a line) and mark them
// added / removed / unchanged by comparing base vs proposed.
// ---------------------------------------------------------------------------

export type DiffLineKind = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  kind: DiffLineKind
  text: string
}

export interface DiffDay {
  dayLabel: string
  lines: DiffLine[]
  hasChanges: boolean
}

function activityLines(it: Itinerary, day: number): string[] {
  const d = it.find((x) => x.day === day)
  if (!d) return []
  return d.activities.map((a) => `${a.time}  ${a.title}`)
}

export function diffItineraries(base: Itinerary, proposed: Itinerary): DiffDay[] {
  const maxDay = Math.max(
    base.reduce((m, d) => Math.max(m, d.day), 0),
    proposed.reduce((m, d) => Math.max(m, d.day), 0),
  )

  const result: DiffDay[] = []

  for (let day = 1; day <= maxDay; day++) {
    const baseLines = activityLines(base, day)
    const propLines = activityLines(proposed, day)

    const baseSet = new Set(baseLines)
    const propSet = new Set(propLines)

    const lines: DiffLine[] = []

    // removed: in base but not proposed
    for (const l of baseLines) {
      if (!propSet.has(l)) lines.push({ kind: 'removed', text: l })
    }
    // added: in proposed but not base
    for (const l of propLines) {
      if (!baseSet.has(l)) lines.push({ kind: 'added', text: l })
    }
    // unchanged: in both (show for context)
    for (const l of propLines) {
      if (baseSet.has(l)) lines.push({ kind: 'unchanged', text: l })
    }

    const hasChanges = lines.some((l) => l.kind !== 'unchanged')
    const proposedDay = proposed.find((d) => d.day === day)
    const baseDay = base.find((d) => d.day === day)
    const label = proposedDay?.title ?? baseDay?.title ?? `Day ${day}`

    if (lines.length > 0) {
      result.push({ dayLabel: `Day ${day} — ${label}`, lines, hasChanges })
    }
  }

  return result
}

export function countChanges(base: Itinerary, proposed: Itinerary): { added: number; removed: number } {
  const diff = diffItineraries(base, proposed)
  let added = 0
  let removed = 0
  for (const day of diff) {
    for (const line of day.lines) {
      if (line.kind === 'added') added++
      if (line.kind === 'removed') removed++
    }
  }
  return { added, removed }
}

// ---------------------------------------------------------------------------
// Natural-language summary of a changeset. Used for the MR summary banner.
// This is the local/no-API version; an LLM can replace it later by reading
// the same diff structure.
// ---------------------------------------------------------------------------

export function summarizeChanges(
  authorName: string,
  base: Itinerary,
  proposed: Itinerary,
): string {
  const diff = diffItineraries(base, proposed)
  const { added, removed } = countChanges(base, proposed)

  if (added === 0 && removed === 0) {
    return `${authorName} opened this request with no changes to the itinerary yet.`
  }

  const changedDays = diff.filter((d) => d.hasChanges).map((d) => d.dayLabel.split(' — ')[0])
  const uniqueDays = Array.from(new Set(changedDays))

  // Collect a few concrete examples of what changed.
  const addedExamples: string[] = []
  const removedExamples: string[] = []
  for (const day of diff) {
    for (const line of day.lines) {
      const text = line.text.replace(/^\d{1,2}:\d{2}\s+/, '').trim()
      if (line.kind === 'added' && addedExamples.length < 2) addedExamples.push(text)
      if (line.kind === 'removed' && removedExamples.length < 2) removedExamples.push(text)
    }
  }

  const parts: string[] = []
  const addedPhrase = added > 0 ? `${added} addition${added === 1 ? '' : 's'}` : ''
  const removedPhrase = removed > 0 ? `${removed} removal${removed === 1 ? '' : 's'}` : ''
  const changePhrase = [addedPhrase, removedPhrase].filter(Boolean).join(' and ')

  const dayPhrase =
    uniqueDays.length === 1
      ? uniqueDays[0]
      : uniqueDays.length === 2
        ? `${uniqueDays[0]} and ${uniqueDays[1]}`
        : `${uniqueDays.slice(0, -1).join(', ')} and ${uniqueDays[uniqueDays.length - 1]}`

  parts.push(`${authorName} proposed ${changePhrase} across ${dayPhrase}.`)

  if (addedExamples.length > 0) {
    parts.push(`Adds: ${addedExamples.map((e) => `“${e}”`).join(', ')}${added > addedExamples.length ? ', and more' : ''}.`)
  }
  if (removedExamples.length > 0) {
    parts.push(`Removes: ${removedExamples.map((e) => `“${e}”`).join(', ')}${removed > removedExamples.length ? ', and more' : ''}.`)
  }

  return parts.join(' ')
}
