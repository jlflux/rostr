import type { AppState, Asset } from '../types'
import { copyToPublicBucket, isStoredPath, publicLogoPath } from './storage'

/**
 * Publishing the images the public site shows.
 *
 * `supabase/public-site.sql` names a logo's public path but cannot move the file
 * — the database has no access to storage. This copies exactly the set of images
 * that projection references, and nothing else.
 *
 * The two must agree on which images those are. Keep this list and the SQL in
 * step: school logo, each opponent's primary logo, and the logo of any sponsor
 * actually billed on a game. Anything else — athlete photos, team photos,
 * documents, an opponent's alternate logos — stays in the private bucket.
 */

export interface PublicLogo {
  assetId: string
  ref: string
  publicPath: string
  label: string
}

/** The images the public site for one school will ask for. */
export function publicLogosFor(state: AppState, orgId: string): PublicLogo[] {
  const assets = state.assets.filter(a => a.orgId === orgId)
  const byId = new Map<string, Asset>(assets.map(a => [a.id, a]))
  const out: PublicLogo[] = []

  const add = (assetId: string | undefined, label: string) => {
    if (!assetId) return
    const asset = byId.get(assetId)
    if (!asset || !isStoredPath(asset.storagePath)) return   // placeholder, nothing to copy
    if (out.some(l => l.assetId === assetId)) return
    out.push({ assetId, ref: asset.storagePath!, publicPath: publicLogoPath(orgId, assetId), label })
  }

  const org = state.orgs.find(o => o.id === orgId)
  add((org as { logoAssetId?: string } | undefined)?.logoAssetId, org?.shortName ?? 'School logo')

  for (const o of state.opponents) {
    if (o.orgId !== orgId || o.deletedAt) continue
    add(o.logoAssetId, o.name)
  }

  // Only sponsors actually named on a game reach the public site, so only their
  // logos are published. A pipeline prospect's logo stays private.
  const billed = new Set(
    state.events
      .filter(e => e.orgId === orgId && !e.deletedAt)
      .flatMap(e => e.sponsorActivations.map(a => a.sponsorId)),
  )
  for (const s of state.sponsors) {
    if (s.orgId !== orgId || !billed.has(s.id)) continue
    const logo = assets.find(a => a.sponsorId === s.id && a.type === 'Sponsor Logo')
    add(logo?.id, s.name)
  }

  return out
}

export interface SyncResult {
  copied: number
  failed: { label: string; error: string }[]
}

/** Copy every public logo for a school into the public bucket. */
export async function syncPublicLogos(state: AppState, orgId: string): Promise<SyncResult> {
  const result: SyncResult = { copied: 0, failed: [] }
  for (const logo of publicLogosFor(state, orgId)) {
    const error = await copyToPublicBucket(logo.ref, logo.publicPath)
    if (error) result.failed.push({ label: logo.label, error })
    else result.copied++
  }
  return result
}
