// Optional cloud sync via Supabase's REST API (no SDK dependency).
//
// The whole workspace is stored as one JSON document in a `workspaces` table, so
// every device that points at the same Supabase project shares one live dataset.
// It stays completely OFF until the two env vars are set at build time, so the app
// runs on local storage exactly as before until you connect a project.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   VITE_SUPABASE_URL   your project URL, e.g. https://abcd.supabase.co
//   VITE_SUPABASE_KEY   the project's anon public key (safe to expose in a browser)
//   VITE_WORKSPACE_ID   optional label for the shared dataset (default "default")
import type { AppState } from '../types'
import { getSupabase } from './supabase'

interface CloudConfig { url: string; key: string; workspace: string }

export function cloudConfig(): CloudConfig | null {
  const env = import.meta.env as Record<string, string | undefined>
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/+$/, ''), key, workspace: env.VITE_WORKSPACE_ID || 'default' }
}

export const cloudEnabled = (): boolean => cloudConfig() !== null

// When someone is signed in, use their access token so the database sees an
// authenticated user (needed once row-level security is tightened to logins).
// Falls back to the anon key, which is all that's needed while access is open.
async function authToken(): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data } = await sb.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function headers(cfg: CloudConfig, token: string | null, extra?: Record<string, string>): Record<string, string> {
  return { apikey: cfg.key, Authorization: `Bearer ${token ?? cfg.key}`, 'Content-Type': 'application/json', ...extra }
}

// Fetch with a human-readable error that includes the HTTP status and Supabase's
// own message, so the UI can tell the user exactly what to fix.
async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    let host = url
    try { host = new URL(url).host } catch { /* keep url */ }
    throw new Error(`Couldn't reach ${host}. Check that VITE_SUPABASE_URL is your project URL (https://…supabase.co) and that you're online.`)
  }
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 300) } catch { /* ignore */ }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`${res.status}: access denied. Check the anon key and that the "workspace open access" SQL policy was run.${detail ? ` (${detail})` : ''}`)
    }
    if (res.status === 404) {
      throw new Error(`404: not found. Check the project URL, and that the SQL creating the "workspaces" table was run.${detail ? ` (${detail})` : ''}`)
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`)
  }
  return res
}

/** Fetch the shared dataset, or null if none has been saved yet. */
export async function cloudPull(): Promise<{ data: AppState; updatedAt: string } | null> {
  const cfg = cloudConfig()
  if (!cfg) return null
  const res = await request(
    `${cfg.url}/rest/v1/workspaces?id=eq.${encodeURIComponent(cfg.workspace)}&select=data,updated_at`,
    { headers: headers(cfg, await authToken()) },
  )
  const rows = (await res.json()) as { data: AppState; updated_at: string }[]
  return rows.length ? { data: rows[0].data, updatedAt: rows[0].updated_at } : null
}

/** A stored row: one school's document, or the platform row. */
export interface WorkspaceRow {
  id: string
  data: unknown
  updated_at: string
}

/**
 * Fetch every row this user is allowed to read — deliberately with no id filter.
 *
 * The row policy grants access when the signed-in email appears in *that row's*
 * user list, so the database returns exactly the schools this person belongs to.
 * That's the whole membership lookup: no directory table, no extra query.
 */
export async function cloudPullAll(): Promise<WorkspaceRow[]> {
  const cfg = cloudConfig()
  if (!cfg) return []
  const res = await request(
    `${cfg.url}/rest/v1/workspaces?select=id,data,updated_at`,
    { headers: headers(cfg, await authToken()) },
  )
  return (await res.json()) as WorkspaceRow[]
}

/** Write one row (one school's document, or the platform row). */
export async function cloudPushRow(rowId: string, data: unknown): Promise<void> {
  const cfg = cloudConfig()
  if (!cfg) return
  const body = [{ id: rowId, data, updated_at: new Date().toISOString() }]
  await request(`${cfg.url}/rest/v1/workspaces?on_conflict=id`, {
    method: 'POST',
    headers: headers(cfg, await authToken(), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(body),
  })
}

/** Remove a school's row entirely — used when a school is deleted. */
export async function cloudDeleteRow(rowId: string): Promise<void> {
  const cfg = cloudConfig()
  if (!cfg) return
  await request(`${cfg.url}/rest/v1/workspaces?id=eq.${encodeURIComponent(rowId)}`, {
    method: 'DELETE',
    headers: headers(cfg, await authToken(), { Prefer: 'return=minimal' }),
  })
}

/** One record-level change, applied server-side instead of re-uploading everything. */
export interface RecordChange {
  collection: string
  id: string
  /** update: the changed fields. add: the whole record. remove: ignored. */
  patch: Record<string, unknown>
  op: 'update' | 'add' | 'remove'
  /** Which school's row this belongs to. Without it a change can hit the wrong row. */
  orgId?: string
}

/**
 * Send a single changed record for Postgres to merge into the stored document.
 *
 * This is what avoids re-uploading the entire workspace on every edit, and
 * because the merge happens against the row's current contents, two people
 * editing different records no longer overwrite one another.
 *
 * Returns false when the server couldn't apply it (e.g. the record isn't there),
 * so the caller can fall back to a full save rather than silently losing the edit.
 */
export async function cloudApplyChange(change: RecordChange): Promise<boolean> {
  const cfg = cloudConfig()
  if (!cfg) return false
  try {
    const res = await request(`${cfg.url}/rest/v1/rpc/apply_record_change`, {
      method: 'POST',
      headers: headers(cfg, await authToken()),
      body: JSON.stringify({
        // Route to the row that owns this record. Falls back to the single
        // shared workspace so this still works before the split is migrated.
        p_workspace: change.orgId ?? cfg.workspace,
        p_collection: change.collection,
        p_id: change.id,
        p_patch: change.op === 'remove' ? {} : change.patch,
        p_op: change.op,
      }),
    })
    return (await res.json()) === true
  } catch {
    // The function may not be installed yet (or the request failed). Report "not
    // applied" so the caller saves the whole document instead — that keeps this
    // safe to deploy before the SQL is run, and safe if it's ever dropped.
    return false
  }
}

/**
 * Which school you're viewing and who you're signed in as are *per person*, but
 * they live on the same object as the shared data. Strip them before anything is
 * sent, or whoever saves last writes their view onto everyone else.
 */
export function withoutSessionState(state: AppState): AppState {
  const shared = { ...state }
  delete (shared as Partial<AppState>).currentOrgId
  delete (shared as Partial<AppState>).currentUserId
  return shared
}

/** Upsert the shared dataset (last write wins). Used for bulk/structural saves. */
export async function cloudPush(state: AppState): Promise<void> {
  const cfg = cloudConfig()
  if (!cfg) return
  const body = [{ id: cfg.workspace, data: withoutSessionState(state), updated_at: new Date().toISOString() }]
  await request(`${cfg.url}/rest/v1/workspaces?on_conflict=id`, {
    method: 'POST',
    headers: headers(cfg, await authToken(), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(body),
  })
}
