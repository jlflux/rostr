import { useState } from 'react'
import { useStore } from '../store/store'
import { ROLE_LABELS, benefitTemplates, can } from '../lib/derive'
import { Avatar, Badge, Card, ConfirmDialog, Field, Modal } from '../components/ui'
import { I } from '../components/icons'
import type { Organization, Role, SponsorTier, User } from '../types'

const SPONSOR_TIERS: SponsorTier[] = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']

const AVATAR_COLORS = ['#d60000', '#0e7490', '#15803d', '#b45309', '#7c3aed', '#be185d', '#1d4ed8', '#374151']

export default function SettingsPage() {
  const { state, update, add, remove, setState, resetDemo, theme, setTheme, toast } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const org = state.orgs.find(o => o.id === state.currentOrgId)!
  const isAdmin = can(me.role, 'admin')

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Organization, users, roles and prototype controls.</p>
        </div>
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Organization branding">
            <p className="small muted" style={{ marginTop: 0 }}>
              Each school configures its own identity — team colors drive home/away accents and badges, while the Flux Athletics chrome (sidebar, buttons) stays consistent for every school.
            </p>
            <div className="form-row">
              <Field label="Organization name">
                <input value={org.name} disabled={!isAdmin} onChange={e => updateOrg({ name: e.target.value })} />
              </Field>
              <Field label="Mascot">
                <input value={org.mascot} disabled={!isAdmin} onChange={e => updateOrg({ mascot: e.target.value })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Primary color">
                <input type="color" value={org.theme.primary} disabled={!isAdmin} style={{ height: 40, padding: 3 }}
                  onChange={e => updateOrg({ theme: { ...org.theme, primary: e.target.value } })} />
              </Field>
              <Field label="Secondary color (badges)">
                <input type="color" value={org.theme.navy} disabled={!isAdmin} style={{ height: 40, padding: 3 }}
                  onChange={e => updateOrg({ theme: { ...org.theme, navy: e.target.value } })} />
              </Field>
            </div>
            <Field label="School logo (shown in the sidebar)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="avatar lg" style={{ background: org.theme.primary, overflow: 'hidden' }}>
                  {org.logoUrl ? <img src={org.logoUrl} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : org.initials}
                </span>
                <input type="file" accept="image/*" disabled={!isAdmin} onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 400 * 1024) { toast('Logo must be under 400 KB for the prototype', 'error'); return }
                  const reader = new FileReader()
                  reader.onload = () => { updateOrg({ logoUrl: String(reader.result) }); toast('School logo updated') }
                  reader.readAsDataURL(f)
                }} />
                {org.logoUrl && isAdmin && <button className="btn sm ghost" onClick={() => { updateOrg({ logoUrl: undefined }); toast('Logo removed') }}>Remove</button>}
              </div>
            </Field>
            {!isAdmin && <p className="tiny">Only school administrators can edit branding. Switch to an Administrator (e.g. Rick Baguley) via the profile menu to try it.</p>}
          </Card>

          <Card title="Users & roles" pad={false} action={isAdmin && (
            <button className="btn sm primary" onClick={() => setAddingUser(true)}><I.plus /> Add user</button>
          )}>
            <table className="tbl">
              <thead><tr><th>User</th><th>Title</th><th>Role</th>{isAdmin && <th>Access</th>}</tr></thead>
              <tbody>
                {state.users.map(u => {
                  const revoked = u.status === 'revoked'
                  return (
                  <tr key={u.id} style={revoked ? { opacity: 0.55 } : undefined}>
                    <td>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Avatar user={u} size="sm" />
                        <span><span className="primary">{u.name}{revoked ? ' · revoked' : ''}</span><div className="tiny">{u.email}</div></span>
                      </span>
                    </td>
                    <td className="muted small">{u.title}</td>
                    <td>
                      {isAdmin && u.role !== 'platform_owner' ? (
                        <select className="inline-select" value={u.role} onChange={e => {
                          update('users', u.id, { role: e.target.value as typeof u.role })
                          toast(`${u.name} is now ${ROLE_LABELS[e.target.value]}`)
                        }}>
                          {Object.entries(ROLE_LABELS).filter(([r]) => r !== 'platform_owner').map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                        </select>
                      ) : <Badge tone={u.role === 'platform_owner' ? 'navy' : 'outline'}>{ROLE_LABELS[u.role]}</Badge>}
                    </td>
                    {isAdmin && (
                      <td>
                        {u.id === me.id || u.role === 'platform_owner' ? <span className="tiny">—</span> : (
                          <span style={{ display: 'flex', gap: 4 }}>
                            <button className="btn sm ghost" onClick={() => {
                              update('users', u.id, { status: revoked ? 'active' : 'revoked' })
                              toast(revoked ? `${u.name} reinstated` : `${u.name}'s access revoked`)
                            }}>{revoked ? 'Reinstate' : 'Revoke'}</button>
                            <button className="btn sm ghost danger" aria-label="Delete user" title="Delete user" onClick={() => setConfirmDeleteUser(u)}><I.x /></button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          <BenefitTemplatesCard />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Role permissions (prototype model)">
            <dl className="kv" style={{ gridTemplateColumns: '1fr', gap: 8 }}>
              <dd><Badge tone="navy">Platform Owner</Badge> <span className="small muted">All organizations, billing, tenant setup</span></dd>
              <dd><Badge tone="brand">School Administrator</Badge> <span className="small muted">Everything within their school</span></dd>
              <dd><Badge tone="info">Communications Admin</Badge> <span className="small muted">Events, content, requests, assets</span></dd>
              <dd><Badge tone="ok">Finance</Badge> <span className="small muted">Agreements, payments, financial reports</span></dd>
              <dd><Badge tone="warn">Coach</Badge> <span className="small muted">Own teams, submit requests</span></dd>
              <dd><Badge>Event Staff</Badge> <span className="small muted">Assignments, run of show, task completion</span></dd>
              <dd><Badge tone="outline">Read-only</Badge> <span className="small muted">View everything, change nothing</span></dd>
            </dl>
            <p className="tiny" style={{ marginBottom: 0 }}>Use the profile menu ("View as") to experience the app in any role.</p>
          </Card>

          <Card title="Appearance">
            <Field label="Theme">
              <select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
          </Card>

          <Card title="Prototype controls">
            <Field label="Sample results">
              <select value={state.showSampleResults ? 'on' : 'off'} onChange={e => {
                const on = e.target.value === 'on'
                setState({ showSampleResults: on })
                toast(on ? 'Sample results are visible' : 'Sample results hidden — preseason view')
              }}>
                <option value="on">Show demo-generated scores</option>
                <option value="off">Hide them (preseason view)</option>
              </select>
            </Field>
            <p className="tiny">Nothing has actually been played yet — scores on past dates are generated for the demo. Turning them off shows the app as it looks before a season starts. Scores you enter yourself always stay visible.</p>
            <div className="divider" />
            <Field label="Demo date (the app's 'today')">
              <input type="date" value={state.demoToday} onChange={e => { setState({ demoToday: e.target.value }); toast(`Demo clock set to ${e.target.value}`) }} />
            </Field>
            <p className="tiny">The fall 2026 schedule runs Aug 20 – Nov 21. Moving the demo date changes what counts as past, upcoming, and overdue.</p>
            <div className="divider" />
            <button className="btn danger" onClick={() => setConfirmReset(true)}>Reset demo data</button>
            <p className="tiny" style={{ marginBottom: 0 }}>Clears your local changes and restores the seeded Homewood dataset.</p>
          </Card>
        </div>
      </div>

      {addingUser && (
        <AddUserModal onClose={() => setAddingUser(false)} onSave={u => {
          add('users', u)
          toast(`${u.name} added as ${ROLE_LABELS[u.role]}`)
          setAddingUser(false)
        }} />
      )}

      {confirmDeleteUser && (
        <ConfirmDialog title={`Delete ${confirmDeleteUser.name}?`} danger confirmLabel="Delete user"
          message={`This permanently removes ${confirmDeleteUser.name}. Any staff assignments, tasks, or requests they held are left unassigned. To keep their history but block sign-in, use Revoke instead.`}
          onConfirm={() => {
            const uid = confirmDeleteUser.id
            // Unassign anywhere the user is referenced so nothing points at a ghost
            setState({
              events: state.events.map(e => ({ ...e, staffSlots: e.staffSlots.map(sl => sl.userId === uid ? { ...sl, userId: null, status: 'unfilled' } : sl), runOfShow: e.runOfShow.map(r => r.ownerId === uid ? { ...r, ownerId: null } : r), gameMoments: e.gameMoments.map(m => m.ownerId === uid ? { ...m, ownerId: null } : m) })),
              tasks: state.tasks.map(t => t.assigneeId === uid ? { ...t, assigneeId: null } : t),
              requests: state.requests.map(r => r.assigneeId === uid ? { ...r, assigneeId: null } : r),
            })
            remove('users', uid)
            toast(`${confirmDeleteUser.name} deleted`)
            setConfirmDeleteUser(null)
          }}
          onClose={() => setConfirmDeleteUser(null)} />
      )}

      {confirmReset && (
        <ConfirmDialog title="Reset demo data?" danger confirmLabel="Reset everything"
          message="This discards every change you've made in the prototype (events, payments, requests, tasks) and restores the original Homewood demo data."
          onConfirm={() => { resetDemo(); toast('Demo data reset') }}
          onClose={() => setConfirmReset(false)} />
      )}
    </>
  )

  function updateOrg(patch: Partial<Organization>) {
    setState({ orgs: state.orgs.map(o => (o.id === org.id ? { ...o, ...patch } : o)) })
  }
}

function BenefitTemplatesCard() {
  const { state, add, update, remove, toast } = useStore()
  const me = state.users.find(u => u.id === state.currentUserId)!
  const canEdit = can(me.role, 'finance')
  const templates = benefitTemplates(state)
  const [label, setLabel] = useState('')
  const [tiers, setTiers] = useState<SponsorTier[]>(['Red', 'White', 'Blue'])
  const flip = (arr: SponsorTier[], t: SponsorTier) => (arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t])

  const TierToggles = ({ value, onToggle }: { value: SponsorTier[]; onToggle: (t: SponsorTier) => void }) => (
    <div className="pill-row" style={{ gap: 4 }}>
      {SPONSOR_TIERS.map(t => (
        <button key={t} type="button" className="tier-toggle" data-on={value.includes(t)} disabled={!canEdit} onClick={() => onToggle(t)}>{t}</button>
      ))}
    </div>
  )

  return (
    <Card title="Sponsor benefit templates" pad={false}>
      <p className="small muted" style={{ padding: '12px 16px 0', margin: 0 }}>
        Define the benefit/fulfillment items and which sponsorship levels each applies to. When you add a sponsor, their
        fulfillment list is auto-filled from the levels that match — you can still add or remove items on any individual sponsor.
        {!canEdit && ' (Finance or an administrator can edit these.)'}
      </p>
      <table className="tbl" style={{ marginTop: 8 }}>
        <thead><tr><th>Benefit</th><th>Applies to levels</th>{canEdit && <th style={{ width: 40 }} />}</tr></thead>
        <tbody>
          {templates.length === 0 && <tr><td colSpan={3}><div className="empty" style={{ padding: 16 }}><p style={{ margin: 0 }}>No benefits defined yet.</p></div></td></tr>}
          {templates.map(tpl => (
            <tr key={tpl.id}>
              <td style={{ minWidth: 200 }}>
                {canEdit
                  ? <input className="input" value={tpl.label} onChange={e => update('benefitTemplates', tpl.id, { label: e.target.value })} />
                  : tpl.label}
              </td>
              <td><TierToggles value={tpl.tiers} onToggle={t => update('benefitTemplates', tpl.id, { tiers: flip(tpl.tiers, t) })} /></td>
              {canEdit && <td><button className="btn sm ghost danger" aria-label="Delete benefit" title="Delete benefit" onClick={() => { remove('benefitTemplates', tpl.id); toast('Benefit removed') }}><I.x /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="New benefit (e.g. Radio mention)" value={label} onChange={e => setLabel(e.target.value)} />
          <TierToggles value={tiers} onToggle={t => setTiers(flip(tiers, t))} />
          <button className="btn primary sm" onClick={() => {
            if (!label.trim()) { toast('Enter a benefit name', 'error'); return }
            if (tiers.length === 0) { toast('Pick at least one level', 'error'); return }
            add('benefitTemplates', { id: `bt-${Date.now()}`, orgId: state.currentOrgId, label: label.trim(), tiers })
            setLabel('')
            toast('Benefit added')
          }}><I.plus /> Add</button>
        </div>
      )}
    </Card>
  )
}

function AddUserModal({ onClose, onSave }: { onClose: () => void; onSave: (u: User) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState({ name: '', email: '', title: '', role: 'event_staff' as Role, teamIds: [] as string[] })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Full name is required.'
    if (!form.email.trim()) errs.email = 'Email is required — it becomes their login.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    else if (state.users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) errs.email = 'A user with this email already exists.'
    if (form.role === 'coach' && form.teamIds.length === 0) errs.teams = 'Pick at least one team for a coach.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const name = form.name.trim()
    const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    onSave({
      id: `u-new-${Date.now()}`, orgId: state.currentOrgId, name, email: form.email.trim(),
      role: form.role, title: form.title.trim() || ROLE_LABELS[form.role], initials,
      color: AVATAR_COLORS[state.users.length % AVATAR_COLORS.length],
      teamIds: form.role === 'coach' ? form.teamIds : undefined,
    })
  }

  return (
    <Modal title="Add user" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Add user</button>
      </>
    }>
      <p className="small muted" style={{ marginTop: 0 }}>In production this sends an email invitation; in the prototype the user is created immediately and appears in every assignee list and the "View as" switcher.</p>
      <div className="form-row">
        <Field label="Full name" required error={errors.name}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jamie Carter" />
        </Field>
        <Field label="Email" required error={errors.email}>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@homewood.k12.al.us" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Role" required>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
            {Object.entries(ROLE_LABELS).filter(([r]) => r !== 'platform_owner').map(([r, l]) => <option key={r} value={r}>{l}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Ticket Gate Lead" />
        </Field>
      </div>
      {form.role === 'coach' && (
        <Field label="Teams they coach" required error={errors.teams}>
          <select multiple size={6} value={form.teamIds}
            onChange={e => setForm(f => ({ ...f, teamIds: [...e.target.selectedOptions].map(o => o.value) }))}>
            {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
    </Modal>
  )
}
