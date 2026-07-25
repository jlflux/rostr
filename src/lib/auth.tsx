import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabase, requireLogin } from './supabase'

interface AuthState {
  /** Whether login is required (env-configured). When false, the app runs open. */
  enabled: boolean
  /** True once the initial session check has completed. */
  ready: boolean
  /** Email of the signed-in person, or null. */
  email: string | null
  /** Send a magic sign-in link to an email. Returns an error message on failure. */
  signIn: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = requireLogin()
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return
    const sb = getSupabase()
    if (!sb) { setReady(true); return }
    let active = true
    sb.auth.getSession().then(({ data }) => {
      if (!active) return
      setEmail(data.session?.user?.email ?? null)
      setReady(true)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [enabled])

  const value = useMemo<AuthState>(() => ({
    enabled,
    ready,
    email,
    signIn: async (addr: string) => {
      const sb = getSupabase()
      if (!sb) return 'Login is not configured.'
      const { error } = await sb.auth.signInWithOtp({
        email: addr.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      return error ? error.message : null
    },
    signOut: async () => {
      await getSupabase()?.auth.signOut()
      setEmail(null)
    },
  }), [enabled, ready, email])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
