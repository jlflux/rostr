/**
 * The fan site's only data source: the `public_site` table, read anonymously.
 *
 * This never touches `workspaces`. That table holds staffing, sponsorship terms
 * and athlete records, and anonymous readers are denied it at the database. What
 * arrives here is the whitelisted projection built by `supabase/public-site.sql`.
 */

const env = import.meta.env as Record<string, string | undefined>

export const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const anonKey = env.VITE_SUPABASE_KEY ?? ''

export interface PublicSchool {
  id: string
  name: string
  shortName: string
  mascot: string
  city: string
  state: string
  initials: string
  theme: { primary: string; navy: string; accent: string }
  logo: string | null
}

export interface PublicTeam {
  id: string; name: string; sport: string; level: string
  gender?: string; season: string; seasonLabel: string
  postseasonFinish?: string
  roster: { id: string; number?: string; name: string; grade?: string; position?: string }[]
}

export interface PublicEvent {
  id: string; teamId: string; sport: string; level: string
  date: string; time: string | null
  homeAway: 'home' | 'away' | 'neutral' | 'tbd'
  eventKind: string
  opponent: string; opponentId?: string; opponentIds?: string[]
  gameType?: string; venue: string; status: string
  designation?: string
  ticketLink?: string; broadcastLink?: string; broadcastStatus?: string
  multiDay?: string
  score: { us: number; them: number; result: 'W' | 'L' | 'T'; recap?: string; sample: boolean } | null
  moments: { title: string; timing: string }[]
  sponsors: { sponsorId: string; activation: string }[]
}

export interface PublicOpponent {
  id: string; name: string; mascot?: string; tint?: string; logo: string | null
}

export interface PublicSponsor {
  id: string; name: string; website?: string; logo: string | null
}

export interface PublicSite {
  school: PublicSchool
  teams: PublicTeam[]
  events: PublicEvent[]
  opponents: PublicOpponent[]
  sponsors: PublicSponsor[]
}

/**
 * Which school this page is for.
 *
 * In production each school has its own hostname, so the subdomain is the slug.
 * `?school=` overrides it, which is how previews and local development address a
 * school before any domain exists.
 */
export function slugFromLocation(loc: Location = window.location): string | null {
  const override = new URLSearchParams(loc.search).get('school')
  if (override) return override
  const host = loc.hostname
  // Bare hosts and IPs carry no school.
  if (host === 'localhost' || /^[\d.]+$/.test(host)) return null
  const [first, ...rest] = host.split('.')
  if (rest.length < 2) return null            // "fluxathletics.com" — no subdomain
  if (first === 'www' || first === 'app') return null
  return first
}

/** A logo's public URL. Files live at `<schoolId>/<assetId>` in the public bucket. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path || !supabaseUrl) return null
  return `${supabaseUrl}/storage/v1/object/public/public-assets/${path}`
}

export async function loadSite(slug: string): Promise<PublicSite> {
  if (!supabaseUrl || !anonKey) throw new Error('This site is not configured yet.')
  const res = await fetch(
    `${supabaseUrl}/rest/v1/public_site?slug=eq.${encodeURIComponent(slug)}&select=data&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
  )
  if (!res.ok) throw new Error(`Couldn't load this school (${res.status}).`)
  const rows = (await res.json()) as { data: PublicSite }[]
  // An unpublished school is filtered out by the database, so it reads as absent.
  if (!rows.length) throw new Error('notfound')
  return rows[0].data
}
