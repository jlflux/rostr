const DAY_MS = 86400000

export function parseISO(iso: string): Date {
  return new Date(iso.slice(0, 10) + 'T12:00:00')
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Real present-day date (local), e.g. for defaulting a payment date. */
export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * DAY_MS))
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS)
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseISO(iso).toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtDateLong(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function fmtTime(hhmm: string | null | undefined): string {
  if (!hhmm) return 'TBD'
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function fmtDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Monday of the week containing iso */
export function weekStart(iso: string): string {
  const d = parseISO(iso)
  const dow = (d.getDay() + 6) % 7 // Mon=0
  return toISO(new Date(d.getTime() - dow * DAY_MS))
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 })
}

export function relDue(iso: string, today: string): { label: string; overdue: boolean } {
  const d = daysBetween(today, iso)
  if (d < 0) return { label: `${-d}d overdue`, overdue: true }
  if (d === 0) return { label: 'Due today', overdue: false }
  if (d === 1) return { label: 'Due tomorrow', overdue: false }
  return { label: `Due in ${d}d`, overdue: false }
}
