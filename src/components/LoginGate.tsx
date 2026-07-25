import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useStore } from '../store/store'

/**
 * Wraps the app. When login is required, it shows a sign-in screen until the
 * person is authenticated AND matches an active user in the org's Users list.
 * When login is not required (the default), it renders the app unchanged.
 */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const { enabled, ready, email, signOut } = useAuth()
  const { state, setState } = useStore()
  const org = state.orgs.find(o => o.id === state.currentOrgId)

  // Match the signed-in email to a user record (case-insensitive), if any.
  const matched = email
    ? state.users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.status !== 'revoked')
    : undefined

  // Once matched, make that person the active user so their role takes effect.
  useEffect(() => {
    if (enabled && matched && state.currentUserId !== matched.id) {
      setState({ currentUserId: matched.id })
    }
  }, [enabled, matched, state.currentUserId, setState])

  if (!enabled) return <>{children}</>
  if (!ready) return <Centered><div className="muted">Loading…</div></Centered>
  if (!email) return <LoginScreen orgName={org?.name} />
  if (!matched) return <NoAccessScreen email={email} onSignOut={signOut} orgName={org?.name} />
  return <>{children}</>
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>{children}</div>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 28, boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}>
      {children}
    </div>
  )
}

function LoginScreen({ orgName }: { orgName?: string }) {
  const { signIn } = useAuth()
  const [addr, setAddr] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!addr.trim()) return
    setStatus('sending')
    setError(null)
    const err = await signIn(addr)
    if (err) { setError(err); setStatus('error') } else { setStatus('sent') }
  }

  return (
    <Centered>
      <Panel>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{orgName ?? 'Sign in'}</h1>
        <p className="small muted" style={{ marginTop: 0 }}>Sign in to continue.</p>
        {status === 'sent' ? (
          <div style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Check your email</div>
            <div className="small muted">We sent a sign-in link to <strong>{addr}</strong>. Open it on this device to finish signing in. You can close this tab.</div>
            <button className="btn sm" style={{ marginTop: 12 }} onClick={() => { setStatus('idle'); setAddr('') }}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="small" style={{ fontWeight: 600 }}>Email address</label>
            <input
              type="email"
              autoFocus
              required
              value={addr}
              onChange={e => setAddr(e.target.value)}
              placeholder="you@school.org"
              style={{ width: '100%', padding: '10px 12px', margin: '6px 0 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'inherit' }}
            />
            <button className="btn primary" type="submit" disabled={status === 'sending'} style={{ width: '100%' }}>
              {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            {status === 'error' && <p className="tiny" style={{ color: 'var(--danger)', marginBottom: 0 }}>{error}</p>}
            <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Access is by invitation. If your email hasn't been added by an administrator, you won't be able to sign in.
            </p>
          </form>
        )}
      </Panel>
    </Centered>
  )
}

function NoAccessScreen({ email, onSignOut, orgName }: { email: string; onSignOut: () => void; orgName?: string }) {
  return (
    <Centered>
      <Panel>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{orgName ?? 'Access needed'}</h1>
        <p className="small" style={{ marginTop: 0 }}>
          You're signed in as <strong>{email}</strong>, but this email hasn't been granted access yet.
        </p>
        <p className="small muted">
          Ask your athletic director (or whoever manages access) to add your email under Settings → Users &amp; roles, then
          sign in again.
        </p>
        <button className="btn" onClick={onSignOut} style={{ width: '100%' }}>Sign out</button>
      </Panel>
    </Centered>
  )
}
