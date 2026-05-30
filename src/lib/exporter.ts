import type { Itinerary, Trip } from './types'

// ---------------------------------------------------------------------------
// Export helpers: turn a trip's itinerary into shareable / downloadable
// artifacts — a clean text plan, and a real .ics calendar file that drops
// every activity straight into Apple/Google/Outlook calendars.
// ---------------------------------------------------------------------------

// Add N days to a YYYY-MM-DD date string, returning a Date. Falls back to
// "today + index" when the start date is missing/invalid so export never fails.
function dayDate(startDate: string, dayIndex: number): Date {
  const base = new Date(startDate)
  if (isNaN(base.getTime())) {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    t.setDate(t.getDate() + dayIndex)
    return t
  }
  const d = new Date(base)
  d.setDate(d.getDate() + dayIndex)
  return d
}

// Parse "HH:MM" → {h, m}. Defaults to noon when unparseable.
function parseTime(time: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim())
  if (!match) return { h: 12, m: 0 }
  return { h: Math.min(23, Number(match[1])), m: Math.min(59, Number(match[2])) }
}

// Format a Date as an iCal local datetime stamp: YYYYMMDDTHHMMSS.
function icsStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

// Escape text per RFC 5545 (commas, semicolons, newlines, backslashes).
function icsEscape(text: string): string {
  return (text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Build a stable, RFC-5545-compliant .ics document for the whole trip. Each
// activity becomes a 1-hour VEVENT (the last one of the day runs 90 min).
export function itineraryToICS(trip: Trip): string {
  const itinerary: Itinerary = trip.itinerary ?? []
  const now = icsStamp(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TravelGit//Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(trip.name)} — ${icsEscape(trip.destination)}`,
  ]

  itinerary.forEach((day, dayIdx) => {
    const date = dayDate(trip.startDate, day.day ? day.day - 1 : dayIdx)
    day.activities.forEach((act, actIdx) => {
      const { h, m } = parseTime(act.time)
      const start = new Date(date)
      start.setHours(h, m, 0, 0)
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + 90)

      const uidValue = `${trip.id}-${day.day}-${actIdx}@travelgit`
      const descParts = [act.note, act.mapsUrl, act.bookingUrl].filter(Boolean)

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uidValue}`,
        `DTSTAMP:${now}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        `SUMMARY:${icsEscape(act.title)}`,
        `LOCATION:${icsEscape(trip.destination)}`,
      )
      if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${icsEscape(descParts.join(' — '))}`)
      }
      lines.push('END:VEVENT')
    })
  })

  lines.push('END:VCALENDAR')
  // iCal lines are CRLF-terminated.
  return lines.join('\r\n')
}

// A clean, human-readable text version of the plan — good for sharing in a
// message or saving as a .txt "trip doc".
export function itineraryToText(trip: Trip): string {
  const out: string[] = []
  out.push(`${trip.name}`)
  out.push(`${trip.destination} · ${trip.startDate} → ${trip.endDate}`)
  if (trip.collaboratorEmails.length > 0) {
    out.push(`Travelers: ${trip.collaboratorEmails.join(', ')}`)
  }
  out.push('')
  for (const day of trip.itinerary) {
    out.push(`Day ${day.day} — ${day.title}`)
    for (const a of day.activities) {
      out.push(`  ${a.time}  ${a.title}${a.note ? `  (${a.note})` : ''}`)
    }
    out.push('')
  }
  out.push('Planned with TravelGit')
  return out.join('\n')
}

// Trigger a client-side file download for arbitrary text content.
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// A filesystem-safe slug for filenames.
export function slugify(text: string): string {
  return (text || 'trip')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'trip'
}
