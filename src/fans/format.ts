import type { PublicEvent, PublicNews, PublicSite, PublicTeam } from './api'

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

/**
 * The score to show, or null.
 *
 * Demo-generated results carry `sample`. A school with sample results switched
 * off in the app must not have them turn up here instead — a fabricated 8-2
 * record on a public site is worse than no record at all.
 */
export function visibleScore(site: PublicSite, e: PublicEvent) {
  if (!e.score) return null
  if (e.score.sample && !site.showSampleResults) return null
  return e.score
}

/** Chronological, soonest first. Used wherever a schedule is listed. */
export const byDate = (a: PublicEvent, b: PublicEvent) =>
  (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99'))

/** Every game for one team, in schedule order. */
export const teamEvents = (site: PublicSite, teamId: string) =>
  site.events.filter(e => e.teamId === teamId).sort(byDate)

/** Won-lost-tied across a set of games, ignoring anything without a score. */
export function record(site: PublicSite, evs: PublicEvent[]) {
  let w = 0, l = 0, t = 0
  for (const e of evs) {
    const sc = visibleScore(site, e)
    if (!sc) continue
    if (sc.result === 'W') w++
    else if (sc.result === 'L') l++
    else t++
  }
  return { w, l, t, played: w + l + t, text: t ? `${w}-${l}-${t}` : `${w}-${l}` }
}

/** A surname to sort on: the last word, ignoring Jr/Sr/III and the like. */
export function lastName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(p => !/^(jr\.?|sr\.?|i{2,3}|iv|v)$/i.test(p))
  return (parts[parts.length - 1] ?? full).toLowerCase()
}

/** Grades sort as school years, not alphabetically: 9 before 10, Fr before So. */
export function gradeRank(grade?: string): number {
  if (!grade) return 99
  const n = parseInt(grade, 10)
  if (Number.isFinite(n)) return n
  const key = grade.trim().slice(0, 2).toLowerCase()
  return { fr: 9, so: 10, jr: 11, sr: 12 }[key] ?? 98
}

/** Jersey numbers are text but read as numbers; blanks sort last. */
export const numRank = (v?: string) =>
  v && Number.isFinite(Number(v)) ? Number(v) : Infinity

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
    .filter(e => visibleScore(site, e))
    .sort((a, b) => b.date.localeCompare(a.date))
  return limit ? list.slice(0, limit) : list
}

/** The sponsor presenting a game, if one is billed that way. */
export function presentedBy(site: PublicSite, e: PublicEvent) {
  const act = e.sponsors.find(s => /present/i.test(s.activation))
  return act ? site.sponsors.find(s => s.id === act.sponsorId) ?? null : null
}

// ---------- news ----------

/**
 * Posts a fan should see: pinned first, then newest. A post dated after today
 * is held back — the public data is only rebuilt when something changes, so
 * the site itself has to notice the day a scheduled post goes live.
 */
export function visibleNews(site: PublicSite, opts: { teamId?: string; limit?: number } = {}): PublicNews[] {
  const t = todayISO()
  const list = site.news
    .filter(n => n.publishedAt <= t && (!opts.teamId || n.teamId === opts.teamId))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt))
  return opts.limit ? list.slice(0, opts.limit) : list
}

/** The front-page teaser: the post's own summary, or the start of the story. */
export function excerpt(n: PublicNews, max = 170): string {
  if (n.summary?.trim()) return n.summary.trim()
  const flat = n.body.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : max).replace(/[,.;:]$/, '') + '…'
}

/** A story as paragraphs: a blank line starts a new one. */
export const paragraphs = (body: string) =>
  body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

// ---------- this week ----------

const addDaysISO = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** The next `days` days of games, grouped by date, soonest first. */
export function thisWeek(site: PublicSite, days = 7): { date: string; games: PublicEvent[] }[] {
  const from = todayISO()
  const to = addDaysISO(from, days - 1)
  const games = site.events
    .filter(e => e.date >= from && e.date <= to && e.status !== 'canceled')
    .sort(byDate)
  const out: { date: string; games: PublicEvent[] }[] = []
  for (const e of games) {
    const last = out[out.length - 1]
    if (last?.date === e.date) last.games.push(e)
    else out.push({ date: e.date, games: [e] })
  }
  return out
}

// ---------- teams, as a school lists them ----------

export const SEASONS = ['Fall', 'Winter', 'Spring'] as const
const LEVELS: Record<string, number> = { Varsity: 0, JV: 1, Freshman: 2, '8th Grade': 3, '7th Grade': 4 }
const GENDERS: Record<string, number> = { Boys: 0, Girls: 1, Coed: 2 }

export interface Program {
  key: string
  /** "Basketball · Girls", or just "Football" when there is only one. */
  label: string
  teams: PublicTeam[]
}

/**
 * Teams grouped the way a school talks about them: by season, then by program
 * (sport and gender), with each program's levels varsity down.
 */
export function programsBySeason(site: PublicSite): { season: string; programs: Program[] }[] {
  const genderedSports = new Set<string>()
  const seen = new Map<string, Set<string>>()
  for (const t of site.teams) {
    const g = seen.get(t.sport) ?? new Set<string>()
    g.add(t.gender ?? '')
    seen.set(t.sport, g)
  }
  // Only worth saying "Boys" or "Girls" when the school fields both — a lone
  // football or softball program is just "Football" or "Softball".
  for (const [sport, gs] of seen) if (gs.size > 1) genderedSports.add(sport)

  return SEASONS.map(season => {
    const by = new Map<string, Program>()
    for (const t of site.teams.filter(t => t.season === season)) {
      const key = `${t.sport}::${t.gender ?? ''}`
      const showGender = genderedSports.has(t.sport) && t.gender && t.gender !== 'Coed'
      const p = by.get(key) ?? { key, label: showGender ? `${t.sport} · ${t.gender}` : t.sport, teams: [] }
      p.teams.push(t)
      by.set(key, p)
    }
    const programs = [...by.values()]
      .map(p => ({ ...p, teams: p.teams.sort((a, b) => (LEVELS[a.level] ?? 9) - (LEVELS[b.level] ?? 9)) }))
      .sort((a, b) => a.label.localeCompare(b.label)
        || (GENDERS[a.teams[0].gender ?? ''] ?? 9) - (GENDERS[b.teams[0].gender ?? ''] ?? 9))
    return { season, programs }
  }).filter(s => s.programs.length > 0)
}
