import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabase, requireLogin } from './supabase'

interface AuthState {
  /** Whether login is required (env-configured). When false, the app runs open. */
  enabled: boolean
  /** True once the initial session check has completed. */
  ready: boolean
  /** Email of the signed-in person, or null. */
  email: string | null
  /** Email a one-time sign-in code (and link). Returns an error message on failure. */
  signIn: (email: string) => Promise<string | null>
  /** Finish sign-in with the emailed code. Returns an error message on failure. */
  verifyCode: (email: string, code: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Turn a Supabase auth failure into something a person can act on.
 *
 * supabase-js builds its message by looking for msg/message/error_description/
 * error on the response body and falling back to JSON.stringify(). When the auth
 * server replies with an empty body — which is what a failed SMTP send looks like
 * — that fallback produces a literal "{}". The HTTP status carries the real
 * signal, so lead with that rather than showing the raw text.
 */
function describeAuthError(e: unknown): string {
  const err = (e ?? {}) as { message?: unknown; status?: unknown; code?: unknown; name?: unknown }
  const status = typeof err.status === 'number' ? err.status : undefined
  const code = typeof err.code === 'string' ? err.code : undefined
  const raw = typeof err.message === 'string' ? err.message.trim() : ''
  const unhelpful = !raw || raw === '{}' || raw === 'null' || raw === 'undefined'
  const at = status ? ` (error ${status})` : ''

  if (code === 'over_email_send_rate_limit' || status === 429) {
    return 'Too many sign-in emails have been requested. Wait a few minutes, then try again.'
  }
  // Order matters: supabase-js wraps 5xx responses in AuthRetryableFetchError too,
  // so check the status before treating it as a connectivity problem. A genuine
  // network failure has status 0.
  if (status !== undefined && status >= 500) {
    return `The server couldn't send the email${at}. This is almost always the email (SMTP) settings in Supabase — open Supabase → Logs → Auth to see the exact reason.`
  }
  if (err.name === 'AuthRetryableFetchError' || status === 0) {
    return "Couldn't reach the sign-in server. Check your internet connection and try again."
  }
  if (unhelpful) {
    return `Sign-in failed${at}. Open Supabase → Logs → Auth to see the exact reason.`
  }
  return raw
}

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
      try {
        const { error } = await sb.auth.signInWithOtp({
          email: addr.trim(),
          options: { emailRedirectTo: window.location.origin },
        })
        if (!error) return null
        // Full object to the console so the status/code is recoverable in devtools.
        console.error('[auth] could not send sign-in code', error)
        return describeAuthError(error)
      } catch (e) {
        console.error('[auth] sign-in request threw', e)
        return describeAuthError(e)
      }
    },
    verifyCode: async (addr: string, code: string) => {
      const sb = getSupabase()
      if (!sb) return 'Login is not configured.'
      // Strip spaces/dashes so a pasted code works regardless of formatting.
      const token = code.replace(/[\s-]/g, '')
      const email = addr.trim()
      // Supabase uses the "Magic Link" template for a known email and "Confirm
      // signup" for a first-time one, and each needs a different verify type.
      // Try the sign-in type first, then fall back rather than blaming the user.
      try {
        const first = await sb.auth.verifyOtp({ email, token, type: 'email' })
        if (!first.error) return null
        const second = await sb.auth.verifyOtp({ email, token, type: 'signup' })
        if (!second.error) return null
        console.error('[auth] code verification failed', first.error)
        const msg = describeAuthError(first.error)
        return /expired or is invalid|invalid/i.test(msg)
          ? 'That code is incorrect or has expired. Check the most recent email, or send a new code.'
          : msg
      } catch (e) {
        console.error('[auth] code verification threw', e)
        return describeAuthError(e)
      }
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
