import type { AppState, Organization, PlatformConfig } from '../types'

/**
 * Splitting the workspace into one document per school, and putting it back
 * together.
 *
 * Storage holds one row per school (row id = the school's id) plus a
 * `__platform__` row for settings that belong to the platform rather than any
 * school. The app still works with a single combined AppState, so these two
 * functions are the only place that knows about the split — and they must be
 * exact inverses. `mergeDocuments(splitState(x))` deep-equals `x` is the check
 * that guards the migration.
 */

/** Row holding platform-wide settings (currently just the tab icon). */
export const PLATFORM_ROW_ID = '__platform__'

/** Collections whose every record carries an `orgId`, so they can be split. */
export const ORG_COLLECTIONS = [
  'users', 'teams', 'events', 'opponents', 'sponsors', 'agreements',
  'benefitTemplates', 'tierSettings', 'requests', 'assets', 'tasks', 'activity',
] as const

type OrgCollection = (typeof ORG_COLLECTIONS)[number]

/** One school's stored document — the same shape as the app state, one school wide. */
export type OrgDocument = Pick<AppState, 'version' | 'showSampleResults' | 'orgs'> &
  { [K in OrgCollection]: AppState[K] }

/** The `__platform__` row's stored document. */
export interface PlatformDocument {
  version: number
  platform: PlatformConfig
}

type WithOrg = { orgId: string }

/** Split the combined state into one document per school, plus the platform row. */
export function splitState(state: AppState): {
  orgDocs: Map<string, OrgDocument>
  platformDoc: PlatformDocument
} {
  const orgDocs = new Map<string, OrgDocument>()
  for (const org of state.orgs) {
    const doc = {
      version: state.version,
      showSampleResults: state.showSampleResults,
      orgs: [org],
    } as OrgDocument
    for (const key of ORG_COLLECTIONS) {
      const rows = (state[key] ?? []) as unknown as WithOrg[]
      ;(doc as Record<string, unknown>)[key] = rows.filter(r => r.orgId === org.id)
    }
    orgDocs.set(org.id, doc)
  }
  return {
    orgDocs,
    platformDoc: { version: state.version, platform: state.platform ?? {} },
  }
}

/**
 * Rebuild the combined state from the rows this user was allowed to read.
 * Sorted by school name so the result doesn't depend on what order the server
 * happened to return rows in, and the switcher reads alphabetically.
 */
export function mergeDocuments(
  orgDocs: OrgDocument[],
  platformDoc?: PlatformDocument | null,
): Pick<AppState, 'version' | 'showSampleResults' | 'platform' | 'orgs'> &
   { [K in OrgCollection]: AppState[K] } {
  const name = (d: OrgDocument) => d.orgs?.[0]?.name ?? ''
  const id = (d: OrgDocument) => d.orgs?.[0]?.id ?? ''
  const docs = [...orgDocs].sort((a, b) =>
    name(a).localeCompare(name(b)) || id(a).localeCompare(id(b)))

  const merged = {
    version: docs[0]?.version ?? 0,
    showSampleResults: docs[0]?.showSampleResults ?? true,
    platform: platformDoc?.platform ?? {},
    orgs: docs.flatMap(d => d.orgs ?? []) as Organization[],
  } as ReturnType<typeof mergeDocuments>

  for (const key of ORG_COLLECTIONS) {
    ;(merged as Record<string, unknown>)[key] = docs.flatMap(d => (d[key] ?? []) as unknown[])
  }
  return merged
}

/**
 * Serialize with object keys in a fixed order, so two documents with identical
 * contents compare equal regardless of the order the server happened to send
 * their keys in. Used for the "has this row actually changed?" check — plain
 * JSON.stringify reports a difference on key order alone and would re-upload
 * every school on every save.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v as object).sort().reduce((acc: Record<string, unknown>, k) => {
          acc[k] = (v as Record<string, unknown>)[k]
          return acc
        }, {})
      : v)
}

/**
 * Which school a record belongs to, so a record-level save reaches the right row.
 * `orgs` is keyed by the school's own id; everything else carries `orgId`.
 */
export function orgIdForRecord(
  state: AppState,
  collection: string,
  id: string,
  record?: Record<string, unknown>,
): string | undefined {
  if (collection === 'orgs') return id
  if (record && typeof record.orgId === 'string') return record.orgId
  const rows = (state as unknown as Record<string, unknown>)[collection]
  if (!Array.isArray(rows)) return undefined
  const found = (rows as { id: string; orgId?: string }[]).find(r => r.id === id)
  return found?.orgId
}
