import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AppState, Collection } from '../types'
import { buildSeedState } from '../data/seed'

const STORAGE_KEY = 'headqtrs:state:v9'
const THEME_KEY = 'headqtrs:theme'

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
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  toast: (msg: string, kind?: 'success' | 'error') => void
  toasts: { id: number; msg: string; kind: 'success' | 'error' }[]
}

const StoreCtx = createContext<Store | null>(null)

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === buildSeedState().version) return parsed
    }
  } catch {
    // fall through to fresh seed
  }
  return buildSeedState()
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setFullState] = useState<AppState>(loadState)
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [toasts, setToasts] = useState<Store['toasts']>([])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full / private mode — prototype keeps working in memory
    }
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

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
  }, [])

  const add = useCallback(<T extends Entity>(collection: Collection, record: T) => {
    setFullState(s => ({ ...s, [collection]: [record, ...(s[collection] as unknown as T[])] }))
  }, [])

  const remove = useCallback((collection: Collection, id: string) => {
    setFullState(s => ({ ...s, [collection]: (s[collection] as Entity[]).filter(r => r.id !== id) }))
  }, [])

  const setState = useCallback((patch: Partial<AppState>) => {
    setFullState(s => ({ ...s, ...patch }))
  }, [])

  const logActivity = useCallback((text: string, link?: string) => {
    setFullState(s => ({
      ...s,
      activity: [
        { id: `act-${Date.now()}`, orgId: s.currentOrgId, at: new Date(s.demoToday + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(), userId: s.currentUserId, text, link },
        ...s.activity,
      ],
    }))
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setFullState(buildSeedState())
  }, [])

  const value = useMemo<Store>(() => ({
    state, update, add, remove, setState, logActivity, resetDemo,
    theme, setTheme: setThemeState, toast, toasts,
  }), [state, update, add, remove, setState, logActivity, resetDemo, theme, toast, toasts])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
