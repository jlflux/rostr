// Where a school's public site lives, as seen from the staff app.
import type { Organization } from '../types'

/**
 * The slug the database derives for a school.
 *
 * This must stay identical to `public_site_slug()` in supabase/public-site.sql,
 * including its lack of trimming — a slug that differs by one character points
 * the link at a site that doesn't exist.
 */
export function publicSiteSlug(org: Organization): string {
  const source = org.shortName ?? org.name ?? ''
  return source.toLowerCase().replace(/[^a-z0-9]+/g, '-') || org.id
}

/**
 * The public site's address for this school.
 *
 * `VITE_PUBLIC_SITE_URL` is the public site's own deployment, once it has one.
 * Until then the staff build ships the fan page beside itself at /fans.html, so
 * the link works with nothing configured.
 *
 * `?school=` is carried either way: on a per-school domain it names the school
 * already showing, so it stays correct rather than becoming redundant.
 */
export function publicSiteUrl(org: Organization, origin = window.location.origin): string {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/+$/, '')
  const root = configured || `${origin}/fans.html`
  return `${root}?school=${encodeURIComponent(publicSiteSlug(org))}`
}
