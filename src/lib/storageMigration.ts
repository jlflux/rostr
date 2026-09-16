import type { AppState } from '../types'
import { isLegacyPath, movePath, repathFor, STORAGE_PREFIX } from './storage'

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
  kind: 'asset' | 'orgLogo'
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

  return out
}

export interface MigrationResult {
  moved: number
  failed: { label: string; error: string }[]
  /** Reference updates to apply, once the moves have succeeded. */
  updates: LegacyFile[]
}

/**
 * Move each file under its school's folder. A file is only recorded for a
 * reference update once its move has actually succeeded, so a half-finished run
 * never leaves a record pointing at a file that isn't there.
 */
export async function migrateLegacyFiles(state: AppState): Promise<MigrationResult> {
  const result: MigrationResult = { moved: 0, failed: [], updates: [] }
  for (const file of legacyFiles(state)) {
    const error = await movePath(file.ref, file.newPath)
    if (error) {
      result.failed.push({ label: file.label, error })
      continue
    }
    result.moved++
    result.updates.push({ ...file, ref: STORAGE_PREFIX + file.newPath })
  }
  return result
}
