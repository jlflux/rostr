import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Collection } from '../types'
import { buildSeedState } from '../data/seed'
import { cloudApplyChange, cloudEnabled, cloudPull, cloudPush, withoutSessionState, type RecordChange } from '../lib/cloud'
import { todayISO } from '../lib/dates'

export type CloudStatus = 'off' | 'idle' | 'syncing' | 'saved' | 'error'

const STORAGE_KEY = 'headqtrs:state:v13'
const THEME_KEY = 'headqtrs:theme'
const SKIN_KEY = 'headqtrs:skin'
/** Set once someone picks a style themselves, so a school default stops overriding it. */
const SKIN_CHOICE_KEY = 'headqtrs:skin:chosen'

/** Visual styles. 'classic' is the original look and stays the default.
 *  Styles change typography/spacing/table treatment only — colors are shared. */
export const SKINS = ['classic', 'modern', 'modern-compact'] as const
export type Skin = (typeof SKINS)[number]

// The schema (shape) version. Bump this ONLY for a breaking change to the data
// shape, and add a matching step in `migrate`. Adding a new *optional* field to a
// type needs no bump — old records simply lack it until edited. Content changes to
// the demo seed must NOT bump this: user data is preserved across every deploy.
const SCHEMA_VERSION = 13

type Entity = { id: string }
type AnyEntity = Entity & Record<string, any>

export interface Store {
  state: AppState
  /** Patch a record in a collection by id */
  update: (collection: Collection, id: string, patch: Partial<AnyEntity>) => void
  /** Insert a record at the front of a collection */
  add: (collection: Collection, record: AnyEntity) => void
  remove: (collection: Collection, id: string) => void
  setState: (patch: Partial<AppState>) => void
  logActivity: (text: string, link?: string) => void
  resetDemo: () => void
  /** Serialize the whole dataset to a JSON string for backup. */
  exportState: () => string
  /** Replace the dataset from a backup JSON string. Returns false if it isn't valid. */
  importState: (raw: string) => boolean
  /** Whether a cloud project is connected (env-configured). */
  cloudEnabled: boolean
  cloudStatus: CloudStatus
  /** Human-readable reason the last cloud action failed, if any. */
  cloudError: string | null
  /** Save this device's data to the shared cloud now. */
  cloudPushNow: () => Promise<void>
  /** Load the shared cloud data onto this device now (keeps your local "view as"). */
  cloudPullNow: () => Promise<void>
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  /** Visual style. Purely cosmetic — no feature depends on it. */
  skin: Skin
  setSkin: (s: Skin) => void
  toast: (msg: string, kind?: 'success' | 'error') => void
  toasts: { id: number; msg: string; kind: 'success' | 'error' }[]
}

const StoreCtx = createContext<Store | null>(null)

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // Keep the user's saved data and bring it up to the current shape — never
      // discard it just because a version changed. This is what stops edits from
      // being wiped every time a feature ships.
      return migrate(JSON.parse(raw) as AppState)
    }
  } catch {
    // corrupt/unreadable storage — fall through to a fresh seed
  }
  return buildSeedState()
}

/**
 * Non-destructively bring stored state up to the current shape. Fills in any
 * top-level field/collection that didn't exist when the data was saved (so the app
 * can't crash on older data) while preserving every user record. Add a step here
 * only for a genuine breaking change, and transform in place — never replace the
 * user's records with seed data.
 */
function migrate(s: AppState): AppState {
  const seed = buildSeedState()
  return {
    ...seed,          // supplies defaults for anything missing below
    ...s,             // user's data always wins
    // Guard against any collection being absent in older saves:
    orgs: s.orgs ?? seed.orgs,
    users: s.users ?? seed.users,
    teams: s.teams ?? seed.teams,
    events: s.events ?? seed.events,
    opponents: s.opponents ?? seed.opponents,
    sponsors: s.sponsors ?? seed.sponsors,
    agreements: s.agreements ?? seed.agreements,
    benefitTemplates: s.benefitTemplates ?? seed.benefitTemplates,
    tierSettings: s.tierSettings ?? seed.tierSettings,
    requests: s.requests ?? seed.requests,
    assets: s.assets ?? seed.assets,
    tasks: s.tasks ?? seed.tasks,
    activity: s.activity ?? seed.activity,
    currentOrgId: s.currentOrgId ?? seed.currentOrgId,
    currentUserId: s.currentUserId ?? seed.currentUserId,
    showSampleResults: s.showSampleResults ?? seed.showSampleResults,
    version: SCHEMA_VERSION,
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setFullState] = useState<AppState>(loadState)
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const isSkin = (v: unknown): v is Skin => (SKINS as readonly unknown[]).includes(v)
  const [skin, setSkinState] = useState<Skin>(() => {
    const saved = localStorage.getItem(SKIN_KEY)
    // A style someone picked themselves always wins over the school's default.
    if (localStorage.getItem(SKIN_CHOICE_KEY) === '1' && isSkin(saved)) return saved
    const orgDefault = state.orgs.find(o => o.id === state.currentOrgId)?.config?.defaultSkin
    if (isSkin(orgDefault)) return orgDefault
    return isSkin(saved) ? saved : 'classic'
  })
  const [toasts, setToasts] = useState<Store['toasts']>([])
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(cloudEnabled() ? 'idle' : 'off')
  const [cloudError, setCloudError] = useState<string | null>(null)

  // Cloud sync bookkeeping: latest state (for manual actions), the last snapshot we
  // synced (so pulling doesn't echo back as a push), whether the first pull ran,
  // and a debounce handle for auto-save.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const lastSyncedJson = useRef<string | null>(null)
  const cloudReady = useRef(false)
  const pushTimer = useRef<ReturnType<typeof setTimeout>>()
  /** Record-level edits waiting to be sent, in the order they happened. */
  const changeQueue = useRef<RecordChange[]>([])
  /** Set when an edit can't be expressed as a single record and needs a full save. */
  const needsFullPush = useRef(false)

  const queueChange = (c: RecordChange) => { changeQueue.current.push(c) }
  /** logActivity also mutates a collection, so route it through the queue too. */
  const queueActivity = (rec: Record<string, unknown>) =>
    queueChange({ collection: 'activity', id: String(rec.id), patch: rec, op: 'add' })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full / private mode — prototype keeps working in memory
    }
  }, [state])

  // On startup, if a cloud project is connected, load the shared dataset once.
  useEffect(() => {
    if (!cloudEnabled()) return
    let cancelled = false
    setCloudStatus('syncing')
    cloudPull()
      .then(res => {
        if (cancelled) return
        if (res) {
          setFullState(prev => {
            // Keep this device's own view: which school and which user are per-person,
            // so a pull must never adopt whatever another device last wrote.
            const applied = { ...migrate(res.data), currentUserId: prev.currentUserId, currentOrgId: prev.currentOrgId }
            lastSyncedJson.current = JSON.stringify(withoutSessionState(applied))
            return applied
          })
        }
        cloudReady.current = true
        setCloudStatus('idle')
      })
      .catch((e: unknown) => { cloudReady.current = true; setCloudError(String((e as Error)?.message ?? e)); setCloudStatus('error') })
    return () => { cancelled = true }
  }, [])

  // Auto-save to the cloud (debounced) after the first load.
  //
  // Record-level edits send only the record that changed and let Postgres merge
  // it, so an edit costs ~1 KB instead of the whole workspace, and two people
  // editing different records don't overwrite each other. Anything that can't be
  // expressed as a single record — or a record change the server couldn't apply —
  // falls back to saving the whole document, so no edit is ever silently dropped.
  useEffect(() => {
    if (!cloudEnabled() || !cloudReady.current) return
    // Only the shared portion counts as a change — switching schools or
    // changing who you're viewing as is local and must not trigger an upload.
    const json = JSON.stringify(withoutSessionState(state))
    if (json === lastSyncedJson.current) return
    setCloudStatus('syncing')
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      const queued = changeQueue.current
      changeQueue.current = []
      const wantsFull = needsFullPush.current
      needsFullPush.current = false
      try {
        let full = wantsFull || queued.length === 0
        if (!full) {
          for (const c of queued) {
            if (!(await cloudApplyChange(c))) { full = true; break }
          }
        }
        if (full) await cloudPush(stateRef.current)
        lastSyncedJson.current = JSON.stringify(withoutSessionState(stateRef.current))
        setCloudError(null)
        setCloudStatus('saved')
      } catch (e: unknown) {
        // Put the work back so a retry or a later full save still carries it.
        changeQueue.current = [...queued, ...changeQueue.current]
        needsFullPush.current = true
        setCloudError(String((e as Error)?.message ?? e))
        setCloudStatus('error')
      }
    }, 1200)
    return () => clearTimeout(pushTimer.current)
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    localStorage.setItem(SKIN_KEY, skin)
  }, [skin])

  /** Someone picking a style themselves opts out of the school default from then on. */
  const setSkin = useCallback((s: Skin) => {
    localStorage.setItem(SKIN_CHOICE_KEY, '1')
    setSkinState(s)
  }, [])

  // Switching schools adopts that school's default, unless a style was chosen here.
  useEffect(() => {
    if (localStorage.getItem(SKIN_CHOICE_KEY) === '1') return
    const orgDefault = state.orgs.find(o => o.id === state.currentOrgId)?.config?.defaultSkin
    if (isSkin(orgDefault) && orgDefault !== skin) setSkinState(orgDefault)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentOrgId, state.orgs])

  const toast = useCallback((msg: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  const update = useCallback(<T extends Entity>(collection: Collection, id: string, patch: Partial<T>) => {
    setFullState(s => ({
      ...s,
      [collection]: (s[collection] as unknown as T[]).map(r => (r.id === id ? { ...r, ...patch } : r)),
    }))
    queueChange({ collection, id, patch: patch as Record<string, unknown>, op: 'update' })
  }, [])

  const add = useCallback(<T extends Entity>(collection: Collection, record: T) => {
    setFullState(s => ({ ...s, [collection]: [record, ...(s[collection] as unknown as T[])] }))
    queueChange({ collection, id: record.id, patch: record as Record<string, unknown>, op: 'add' })
  }, [])

  const remove = useCallback((collection: Collection, id: string) => {
    setFullState(s => ({ ...s, [collection]: (s[collection] as Entity[]).filter(r => r.id !== id) }))
    queueChange({ collection, id, patch: {}, op: 'remove' })
  }, [])

  /** Top-level/structural edits can't be expressed as one record, so these
   *  still save the whole document. */
  const setState = useCallback((patch: Partial<AppState>) => {
    setFullState(s => ({ ...s, ...patch }))
    needsFullPush.current = true
  }, [])

  const logActivity = useCallback((text: string, link?: string) => {
    const entry = {
      id: `act-${Date.now()}`,
      orgId: stateRef.current.currentOrgId,
      at: new Date().toISOString(),
      userId: stateRef.current.currentUserId,
      text,
      link,
    }
    setFullState(s => ({ ...s, activity: [entry, ...s.activity] }))
    queueActivity(entry as unknown as Record<string, unknown>)
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setFullState(buildSeedState())
  }, [])

  const exportState = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importState = useCallback((raw: string): boolean => {
    try {
      const parsed = JSON.parse(raw)
      // Sanity-check it looks like our dataset before replacing anything.
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sponsors) || !Array.isArray(parsed.teams) || !Array.isArray(parsed.users)) return false
      setFullState(migrate(parsed as AppState))
      return true
    } catch {
      return false
    }
  }, [])

  const cloudPushNow = useCallback(async () => {
    if (!cloudEnabled()) return
    setCloudStatus('syncing')
    try {
      await cloudPush(stateRef.current)
      lastSyncedJson.current = JSON.stringify(withoutSessionState(stateRef.current))
      cloudReady.current = true
      setCloudError(null)
      setCloudStatus('saved')
    } catch (e: unknown) {
      setCloudError(String((e as Error)?.message ?? e))
      setCloudStatus('error')
    }
  }, [])

  const cloudPullNow = useCallback(async () => {
    if (!cloudEnabled()) return
    setCloudStatus('syncing')
    try {
      const res = await cloudPull()
      if (res) {
        setFullState(prev => {
          // Keep this device's own view: which school and which user are per-person,
            // so a pull must never adopt whatever another device last wrote.
            const applied = { ...migrate(res.data), currentUserId: prev.currentUserId, currentOrgId: prev.currentOrgId }
          lastSyncedJson.current = JSON.stringify(withoutSessionState(applied))
          return applied
        })
      }
      cloudReady.current = true
      setCloudError(null)
      setCloudStatus('idle')
    } catch (e: unknown) {
      setCloudError(String((e as Error)?.message ?? e))
      setCloudStatus('error')
    }
  }, [])

  const value = useMemo<Store>(() => ({
    state, update, add, remove, setState, logActivity, resetDemo, exportState, importState,
    cloudEnabled: cloudEnabled(), cloudStatus, cloudError, cloudPushNow, cloudPullNow,
    theme, setTheme: setThemeState, skin, setSkin, toast, toasts,
  }), [state, update, add, remove, setState, logActivity, resetDemo, exportState, importState, cloudStatus, cloudError, cloudPushNow, cloudPullNow, theme, skin, setSkin, toast, toasts])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
