import type { AppState, Asset } from '../types'
import { schoolLogo } from './derive'
import { copyToPublicBucket, isStoredPath, publicLogoPath, publicSchoolLogoPath } from './storage'

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

  // The school's logo is a storage path on the school record rather than an
  // asset id, so it is added directly rather than through `add`.
  const org = state.orgs.find(o => o.id === orgId)
  const orgLogo = org ? schoolLogo(state, org) : undefined
  if (orgLogo && isStoredPath(orgLogo)) {
    out.push({
      assetId: `school:${orgId}`,
      ref: orgLogo,
      publicPath: publicSchoolLogoPath(orgId),
      label: `${org?.shortName ?? 'School'} logo`,
    })
  }

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
  /** Set when every copy would fail for the same reason, with what to do. */
  blocked?: string
}

/** Whether an error means the public bucket itself is missing. */
const isMissingBucket = (error: string) => /bucket not found/i.test(error)

/**
 * Copy every public logo for a school into the public bucket.
 *
 * A missing bucket fails every single file with the same message, which reads
 * as a list of broken logos rather than one thing to go and fix. So it stops at
 * the first one and says what to do instead.
 */
export async function syncPublicLogos(state: AppState, orgId: string): Promise<SyncResult> {
  const result: SyncResult = { copied: 0, failed: [] }
  for (const logo of publicLogosFor(state, orgId)) {
    const error = await copyToPublicBucket(logo.ref, logo.publicPath)
    if (!error) { result.copied++; continue }
    if (/row-level security/i.test(error)) {
      result.blocked = 'The public bucket exists, but no rule lets signed-in staff add files '
        + 'to it. Run "Public bucket, step B" from STORAGE_SETUP.md in the Supabase SQL '
        + 'editor, then publish again.'
      return result
    }
    if (isMissingBucket(error)) {
      result.blocked = 'The public bucket doesn\'t exist yet. In Supabase, go to '
        + 'Storage → New bucket, name it "public-assets", switch Public bucket on, '
        + 'then publish again. Then run "Public bucket, step B" from STORAGE_SETUP.md.'
      return result
    }
    result.failed.push({ label: logo.label, error })
  }
  return result
}
