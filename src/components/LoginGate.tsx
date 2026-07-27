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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28, boxShadow: 'var(--shadow-lg)' }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', margin: '6px 0 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'inherit',
}

function LoginScreen({ orgName }: { orgName?: string }) {
  const { signIn, verifyCode } = useAuth()
  const [addr, setAddr] = useState('')
  const [code, setCode] = useState('')
  /** 'idle' → asking for email; 'sent' → asking for the emailed code. */
  const [step, setStep] = useState<'idle' | 'sent'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (!addr.trim()) return
    setBusy(true); setError(null)
    const err = await signIn(addr)
    setBusy(false)
    if (err) setError(err)
    else { setStep('sent'); setCode('') }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true); setError(null)
    const err = await verifyCode(addr, code)
    setBusy(false)
    // On success the auth listener swaps this screen out for the app.
    if (err) setError(err)
  }

  return (
    <Centered>
      <Panel>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{orgName ?? 'Sign in'}</h1>
        <p className="small muted" style={{ marginTop: 0 }}>
          {step === 'sent' ? `Enter the code we emailed to ${addr}.` : 'Sign in to continue.'}
        </p>

        {step === 'sent' ? (
          <form onSubmit={submitCode}>
            {/* No digit count here on purpose — the code's length is a Supabase
                setting, so naming it would go stale the moment that changes. */}
            <label className="small" style={{ fontWeight: 600 }}>Sign-in code</label>
            <input
              // one-time-code lets phones offer the code straight from the email.
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              required
              value={code}
              onChange={e => { setCode(e.target.value); setError(null) }}
              style={{ ...inputStyle, fontSize: '1.35rem', letterSpacing: '0.32em', textAlign: 'center', fontWeight: 600 }}
            />
            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            {error && <p className="tiny" style={{ color: 'var(--danger)', margin: '10px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn sm" disabled={busy}
                onClick={async () => { await sendCode(); setResent(true) }}>
                {resent ? 'Code re-sent' : 'Send a new code'}
              </button>
              <button type="button" className="btn sm ghost"
                onClick={() => { setStep('idle'); setCode(''); setError(null); setResent(false) }}>
                Change email
              </button>
            </div>
            <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
              The same email also contains a sign-in link, which works if you're in a web browser.
            </p>
          </form>
        ) : (
          <form onSubmit={sendCode}>
            <label className="small" style={{ fontWeight: 600 }}>Email address</label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={addr}
              onChange={e => { setAddr(e.target.value); setError(null) }}
              placeholder="you@school.org"
              style={inputStyle}
            />
            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Sending…' : 'Email me a sign-in code'}
            </button>
            {error && <p className="tiny" style={{ color: 'var(--danger)', margin: '10px 0 0' }}>{error}</p>}
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
