import type { AppState } from '../types'
import { fileExistsAt, isLegacyPath, movePath, repathFor, STORAGE_PREFIX } from './storage'
import { PLATFORM_ROW_ID } from './workspace'

/**
 * Moving files uploaded before paths carried the owning school.
 *
 * The bucket's access rules read the school id from the front of a file's path.
 * Files uploaded earlier have no school in their path, so they cannot be
 * protected — and once the rules are tightened they become unreachable.
 *
 * ORDER MATTERS: run this while the old, open policy is still in place. The move
 * needs to read the file at its current path, and the tightened policy would
 * refuse that.
 */

export interface LegacyFile {
  /** Where the reference lives, so it can be rewritten after the move. */
  kind: 'asset' | 'orgLogo' | 'platformFavicon'
  id: string
  orgId: string
  label: string
  ref: string
  newPath: string
}

/** Every stored file whose path doesn't start with the school that owns it. */
export function legacyFiles(state: AppState): LegacyFile[] {
  const out: LegacyFile[] = []

  for (const a of state.assets) {
    // Without a school there is nowhere to file it, and moving it would create
    // a folder named after the missing value.
    if (!a.orgId) continue
    if (!a.storagePath || !isLegacyPath(a.storagePath, a.orgId)) continue
    out.push({
      kind: 'asset', id: a.id, orgId: a.orgId, label: a.name,
      ref: a.storagePath, newPath: repathFor(a.storagePath, a.orgId),
    })
  }

  // A school's own logo is stored on the org record rather than as an asset.
  for (const o of state.orgs) {
    if (!o.logoUrl || !isLegacyPath(o.logoUrl, o.id)) continue
    out.push({
      kind: 'orgLogo', id: o.id, orgId: o.id, label: `${o.shortName} school logo`,
      ref: o.logoUrl, newPath: repathFor(o.logoUrl, o.id),
    })
  }

  // The browser tab icon belongs to the platform, not a school. Its folder is
  // the one every signed-in user may read, so it has to be filed there too —
  // left where it is, the tightened rules would take the tab icon away.
  const favicon = state.platform?.faviconUrl
  if (favicon && isLegacyPath(favicon, PLATFORM_ROW_ID)) {
    out.push({
      kind: 'platformFavicon', id: PLATFORM_ROW_ID, orgId: PLATFORM_ROW_ID,
      label: 'Browser tab icon', ref: favicon, newPath: repathFor(favicon, PLATFORM_ROW_ID),
    })
  }

  return out
}

export interface MigrationResult {
  moved: number
  /** Files already in the right place, whose record just hadn't caught up. */
  relinked: number
  failed: { label: string; error: string }[]
  /** Reference updates to apply, once the moves have succeeded. */
  updates: LegacyFile[]
}

const isMissing = (error: string) => /not found|does not exist/i.test(error)

/**
 * Move each file under its school's folder. A file is only recorded for a
 * reference update once its move has actually succeeded, so a half-finished run
 * never leaves a record pointing at a file that isn't there.
 *
 * A move of a file that isn't there reports the same thing whether it already
 * moved or was never uploaded. Those need telling apart: an earlier run whose
 * reference updates never saved leaves every file already in place, and trying
 * again would otherwise report all of them as errors forever. So when the source
 * is missing, the destination is checked, and a file found there is relinked
 * rather than failed.
 */
export async function migrateLegacyFiles(state: AppState): Promise<MigrationResult> {
  const result: MigrationResult = { moved: 0, relinked: 0, failed: [], updates: [] }
  for (const file of legacyFiles(state)) {
    const error = await movePath(file.ref, file.newPath)
    if (!error) {
      result.moved++
      result.updates.push({ ...file, ref: STORAGE_PREFIX + file.newPath })
      continue
    }
    if (isMissing(error) && await fileExistsAt(file.newPath)) {
      result.relinked++
      result.updates.push({ ...file, ref: STORAGE_PREFIX + file.newPath })
      continue
    }
    result.failed.push({
      label: file.label,
      error: isMissing(error)
        // Deliberately not "it was removed": the storage API answers the same
        // way for a file you may not read, and an unfiled file is exactly the
        // case the bucket's rules can't resolve a school for.
        ? `couldn't reach ${file.ref.slice(STORAGE_PREFIX.length)} — it is missing, or the bucket's rules won't let this account see it`
        : error,
    })
  }
  return result
}
