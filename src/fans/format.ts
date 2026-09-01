import type { PublicEvent, PublicSite, PublicTeam } from './api'

export const isPast = (e: PublicEvent, today: string) => e.date < today
export const todayISO = () => new Date().toISOString().slice(0, 10)

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined,
    { weekday: 'short', month: 'short', day: 'numeric', ...opts })
}

export function fmtTime(t: string | null): string {
  if (!t) return 'TBD'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

/** "Varsity Football" without repeating the sport when the team name has it. */
export function teamLabel(t: PublicTeam | undefined, e: PublicEvent): string {
  return t?.name ?? `${e.level} ${e.sport}`.trim()
}

export const teamOf = (site: PublicSite, e: PublicEvent) =>
  site.teams.find(t => t.id === e.teamId)

export const opponentOf = (site: PublicSite, e: PublicEvent) =>
  site.opponents.find(o => o.id === e.opponentId)

/** Games a fan would call "upcoming", soonest first. */
export function upcoming(site: PublicSite, limit?: number): PublicEvent[] {
  const t = todayISO()
  const list = site.events
    .filter(e => !isPast(e, t) && e.status !== 'canceled')
    .sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
  return limit ? list.slice(0, limit) : list
}

/** Finished games with a score, most recent first. Demo-generated results are skipped. */
export function results(site: PublicSite, limit?: number): PublicEvent[] {
  const list = site.events
    .filter(e => e.score && !e.score.sample)
    .sort((a, b) => b.date.localeCompare(a.date))
  return limit ? list.slice(0, limit) : list
}

/** The sponsor presenting a game, if one is billed that way. */
export function presentedBy(site: PublicSite, e: PublicEvent) {
  const act = e.sponsors.find(s => /present/i.test(s.activation))
  return act ? site.sponsors.find(s => s.id === act.sponsorId) ?? null : null
}
