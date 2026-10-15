import type { AppState, Organization } from '../types'
import { schoolLogo } from './derive'
import { todayISO } from './dates'
import { publicFileUrl } from './storage'
import { getSupabase } from './supabase'

/**
 * Looking at the public site the way a fan's browser does.
 *
 * When something doesn't show up publicly there are several places it can have
 * stopped: the save never reached the database, the database's public copy
 * predates the feature, or an image was never copied to the public bucket.
 * They all look the same from the outside — nothing appears — so this reads the
 * real public data and loads the real image addresses, and says which it is.
 */

export interface CheckResult {
  ok: boolean
  label: string
  /** What to do about it, when it isn't ok. */
  fix?: string
}

interface PublicData {
  school?: { logo?: string | null }
  news?: { id: string; title: string }[]
  opponents?: { name: string; logo?: string | null }[]
}

/**
 * Whether an image actually displays — loaded as an image, exactly as the
 * public site loads it, so a browser's cross-site rules on fetch() can't
 * report a working logo as broken.
 */
function loads(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image()
    const done = (ok: boolean) => { clearTimeout(timer); resolve(ok) }
    const timer = setTimeout(() => done(false), 8000)
    img.onload = () => done(img.naturalWidth > 0)
    img.onerror = () => done(false)
    img.src = `${url}${url.includes('?') ? '&' : '?'}check=${Date.now()}`
  })
}

export async function checkPublicSite(state: AppState, org: Organization): Promise<CheckResult[]> {
  const sb = getSupabase()
  if (!sb) return [{ ok: false, label: 'Not connected to the database', fix: 'Cloud sync is not configured for this app.' }]

  const { data: row, error } = await sb
    .from('public_site').select('data, published, updated_at').eq('org_id', org.id).maybeSingle()
  if (error) return [{ ok: false, label: 'Could not read the public site', fix: error.message }]
  if (!row) {
    return [{
      ok: false, label: `${org.shortName} has no public site data, or it isn't switched on`,
      fix: 'Run supabase/public-site.sql, then switch the school on (section 6 of that file).',
    }]
  }

  const data = row.data as PublicData
  const out: CheckResult[] = []
  const rebuilt = new Date(row.updated_at as string).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  out.push({ ok: true, label: `Public site is on — its data was last rebuilt ${rebuilt}` })

  // ---- News ----
  const today = todayISO()
  const live = (state.news ?? []).filter(n =>
    n.orgId === org.id && n.status === 'published' && n.publishedAt <= today)
  if (!('news' in data)) {
    out.push({
      ok: false, label: "The public site can't receive news yet",
      fix: 'Re-run supabase/public-site.sql in the Supabase SQL editor. Your posts are saved; the public copy just predates news.',
    })
  } else if (live.length) {
    const published = new Set((data.news ?? []).map(n => n.id))
    const missing = live.filter(n => !published.has(n.id))
    out.push(missing.length
      ? {
          ok: false,
          label: `${missing.length} live post${missing.length === 1 ? " hasn't" : "s haven't"} reached the public site: ${missing.map(n => `“${n.title}”`).join(', ')}`,
          fix: "They go out when the save reaches the database. If the bar at the top of the app shows a sync problem, that's what's holding them; otherwise wait a few seconds and check again.",
        }
      : { ok: true, label: `All ${live.length} live post${live.length === 1 ? ' is' : 's are'} on the public site` })
  } else {
    out.push({ ok: true, label: 'News is set up — no live posts yet' })
  }

  // ---- The school's logo ----
  const path = data.school?.logo
  if (!path) {
    out.push(schoolLogo(state, org)
      ? { ok: false, label: "The public site doesn't know about the school logo",
          fix: 'Re-run supabase/public-site.sql, then Publish images.' }
      : { ok: false, label: 'No school logo is set — the site shows the initials',
          fix: 'Upload one under Branding above.' })
  } else {
    const url = publicFileUrl(path)
    out.push(url && await loads(url)
      ? { ok: true, label: 'School logo loads on the public site' }
      : { ok: false, label: "The school logo file isn't in the public bucket", fix: 'Click Publish images below.' })
  }

  // ---- Opponent logos ----
  const named = (data.opponents ?? []).filter(o => o.logo)
  if (named.length) {
    const results = await Promise.all(named.slice(0, 60).map(async o => {
      const url = publicFileUrl(o.logo!)
      return { name: o.name, ok: !!url && await loads(url) }
    }))
    const broken = results.filter(r => !r.ok)
    out.push(broken.length
      ? { ok: false, label: `${broken.length} of ${results.length} opponent logos don't load: ${broken.slice(0, 6).map(b => b.name).join(', ')}${broken.length > 6 ? '…' : ''}`,
          fix: 'Click Publish images below.' }
      : { ok: true, label: `All ${results.length} opponent logos load` })
  }

  return out
}
