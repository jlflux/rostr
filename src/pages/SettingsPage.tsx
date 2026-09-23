import { useRef, useState } from 'react'
import { useStore, type Skin } from '../store/store'
import { ROLE_LABELS, benefitTemplates, can, currentOrg, currentUser, schoolLogo, sortedByLastName, sponsorTiers, tierSettings, users as orgUsers } from '../lib/derive'
import { Avatar, Badge, Card, ConfirmDialog, Field, Modal } from '../components/ui'
import { fmtMoney, todayISO } from '../lib/dates'
import { I } from '../components/icons'
import { StoredImage } from '../components/StoredImage'
import { removeFromStorage, storageEnabled, uploadToStorage } from '../lib/storage'
import { publicLogosFor, syncPublicLogos, type SyncResult } from '../lib/publicLogos'
import { publicSiteUrl } from '../lib/publicSite'
import { legacyFiles, migrateLegacyFiles } from '../lib/storageMigration'
import type { Organization, Role, SponsorTier, User } from '../types'


/** Visual styles offered in Settings → Appearance. Typography and spacing only —
 *  every style uses the same brand colors. */
const SKIN_OPTIONS: { id: Skin; label: string; hint: string; rows: number; gap: number; radius: number }[] = [
  { id: 'classic', label: 'Classic', hint: 'The current look — unchanged', rows: 3, gap: 3, radius: 3 },
  { id: 'modern', label: 'Modern', hint: 'System UI font, roomier rows, cleaner tables', rows: 3, gap: 7, radius: 6 },
  { id: 'modern-compact', label: 'Modern compact', hint: 'Same styling, tighter — more rows on screen', rows: 4, gap: 2, radius: 6 },
]

const AVATAR_COLORS = ['#d60000', '#0e7490', '#15803d', '#b45309', '#7c3aed', '#be185d', '#1d4ed8', '#374151']

export default function SettingsPage() {
  const { state, update, add, remove, setState, resetDemo, exportState, importState, cloudEnabled, cloudStatus, cloudError, cloudLoaded, cloudPushNow, cloudPullNow, theme, setTheme, skin, setSkin, toast } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmSeed, setConfirmSeed] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null)
  const [pendingImport, setPendingImport] = useState<{ raw: string; name: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const blob = new Blob([exportState()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `command-center-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Backup downloaded')
  }
  const me = currentUser(state)
  const org = currentOrg(state)
  const logo = schoolLogo(state, org)
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
            <Field label="School logo (shown in the sidebar and on the public site)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="avatar lg" style={{ background: org.theme.primary, overflow: 'hidden' }}>
                  {logo ? <StoredImage src={logo} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={<>{org.initials}</>} /> : org.initials}
                </span>
                <input type="file" accept="image/*" disabled={!isAdmin} onChange={async e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (storageEnabled()) {
                    const res = await uploadToStorage(f, 'logos', org.id)
                    if ('error' in res) { toast(`Logo upload failed: ${res.error}`, 'error'); return }
                    const prev = org.logoUrl
                    updateOrg({ logoUrl: res.ref })
                    toast('School logo updated')
                    removeFromStorage(prev)
                  } else {
                    if (f.size > 400 * 1024) { toast('Logo must be under 400 KB for the prototype', 'error'); return }
                    const reader = new FileReader()
                    reader.onload = () => { updateOrg({ logoUrl: String(reader.result) }); toast('School logo updated') }
                    reader.readAsDataURL(f)
                  }
                }} />
                {org.logoUrl && isAdmin && <button className="btn sm ghost" onClick={() => { const prev = org.logoUrl; updateOrg({ logoUrl: undefined }); removeFromStorage(prev); toast('Logo removed') }}>Remove</button>}
              </div>
            </Field>
            {!org.logoUrl && logo && (
              <p className="tiny muted" style={{ marginTop: -6 }}>
                Using the "School Branding" image from the asset library. Upload one here to set it explicitly.
              </p>
            )}
            {!isAdmin && <p className="tiny">Only school administrators can edit branding. Switch to an Administrator via the profile menu to try it.</p>}
          </Card>

          <Card title="Users & roles" pad={false} action={isAdmin && (
            <button className="btn sm primary" onClick={() => setAddingUser(true)}><I.plus /> Add user</button>
          )}>
            <table className="tbl">
              <thead><tr><th>User</th><th>Title</th><th>Role</th>{isAdmin && <th>Access</th>}</tr></thead>
              <tbody>
                {sortedByLastName(orgUsers(state)).map(u => {
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

          <TierSettingsCard />
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
            <Field label="Style">
              <div style={{ display: 'grid', gap: 8 }}>
                {SKIN_OPTIONS.map(s => (
                  <button key={s.id} type="button" onClick={() => setSkin(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', textAlign: 'left',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: `1px solid ${skin === s.id ? 'var(--app-accent)' : 'var(--border)'}`,
                      background: skin === s.id ? 'var(--surface-2)' : 'var(--surface)',
                      color: 'inherit',
                    }}>
                    <span aria-hidden style={{
                      width: 46, flexShrink: 0, padding: 6, borderRadius: s.radius,
                      border: '1px solid var(--border)', background: 'var(--surface-2)',
                      display: 'flex', flexDirection: 'column', gap: s.gap,
                    }}>
                      {Array.from({ length: s.rows }).map((_, i) => (
                        <span key={i} style={{
                          height: 3, borderRadius: 2, background: 'var(--border-strong)',
                          width: i === 0 ? '60%' : '100%',
                        }} />
                      ))}
                    </span>
                    <span style={{ flex: 1 }}>
                      <div style={{ fontWeight: 650, fontSize: '0.88rem' }}>{s.label}</div>
                      <div className="tiny">{s.hint}</div>
                    </span>
                    {skin === s.id && <Badge tone="ok">Active</Badge>}
                  </button>
                ))}
              </div>
              <p className="tiny" style={{ marginTop: 8, marginBottom: 0 }}>
                Typography and spacing only — your brand colors and every feature stay the same.
                Applies to this device.
              </p>
            </Field>
          </Card>

          <StorageMigrationCard />

          <PublicSiteCard />

          <Card title="Cloud sync" action={cloudEnabled
            ? <Badge tone={cloudStatus === 'saved' || cloudStatus === 'idle' ? 'ok' : cloudStatus === 'error' ? 'danger' : 'neutral'}>
                {cloudStatus === 'syncing' ? 'Syncing…' : cloudStatus === 'saved' ? 'Saved' : cloudStatus === 'error' ? 'Error' : 'Connected'}
              </Badge>
            : <Badge tone="outline">Not connected</Badge>}>
            {cloudEnabled ? (
              <>
                <p className="small muted" style={{ marginTop: 0 }}>
                  This device is connected to your shared cloud dataset. Changes save automatically and every device that
                  opens the site sees the same data.
                </p>
                {!cloudLoaded && (
                  <div style={{ marginBottom: 10, padding: '10px 12px', border: '1px solid var(--warn)', borderRadius: 8, background: 'color-mix(in srgb, var(--warn) 10%, transparent)' }}>
                    <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>Nothing has loaded from the cloud on this device</div>
                    <div className="small">
                      Saving is switched off, because sending what's on this device would replace the shared data with it.
                      Use <strong>Load from cloud</strong>, or reload and sign in again.
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn primary" disabled={cloudStatus === 'syncing' || !cloudLoaded}
                    title={cloudLoaded ? undefined : 'Load from the cloud first'}
                    onClick={async () => { await cloudPushNow(); toast('Saved to cloud') }}>Save to cloud</button>
                  <button className="btn" disabled={cloudStatus === 'syncing'} onClick={async () => { await cloudPullNow(); toast('Loaded latest from cloud') }}>Load from cloud</button>
                </div>
                {!cloudLoaded && (
                  // The one legitimate case for pushing without loading: an empty
                  // project being filled for the first time. Deliberate, and confirmed.
                  <p className="tiny" style={{ margin: '8px 0 0' }}>
                    Setting up a brand-new, empty project?{' '}
                    <button className="btn sm ghost danger" onClick={() => setConfirmSeed(true)}>Save anyway</button>
                  </p>
                )}
                {cloudStatus === 'error' && (
                  <div style={{ marginTop: 10, padding: '10px 12px', border: '1px solid var(--danger)', borderRadius: 8, background: 'color-mix(in srgb, var(--danger) 8%, transparent)' }}>
                    <div className="small" style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>Cloud error</div>
                    <div className="small" style={{ wordBreak: 'break-word' }}>{cloudError ?? 'Unknown error.'}</div>
                    <div className="tiny" style={{ marginTop: 6 }}>
                      Most common fixes: (1) run the SQL from SUPABASE_SETUP.md so the <code>workspaces</code> table and its
                      access policy exist; (2) confirm <code>VITE_SUPABASE_URL</code> is the project URL ending in
                      <code>.supabase.co</code>; (3) confirm <code>VITE_SUPABASE_KEY</code> is the <strong>anon/public</strong> key;
                      (4) redeploy in Vercel after changing any variable.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="small muted" style={{ marginTop: 0 }}>
                  Not connected yet. Connect a free Supabase project so your data lives online and stays in sync across every
                  computer and phone — no more per-device copies. Full step-by-step instructions are in <strong>SUPABASE_SETUP.md</strong> in the project.
                </p>
                <p className="tiny" style={{ marginBottom: 0 }}>
                  In short: create a Supabase project, run the one SQL snippet, then add <code>VITE_SUPABASE_URL</code> and{' '}
                  <code>VITE_SUPABASE_KEY</code> as environment variables in Vercel and redeploy. Until then, use the backup file below to move data between devices.
                </p>
              </>
            )}
          </Card>

          <Card title="Data & backup">
            <p className="small muted" style={{ marginTop: 0 }}>
              Download a full snapshot of your data as a file — a handy archive, or a way to move everything to another
              device: <strong>Export</strong> here, then <strong>Import</strong> the file on the other device.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={doExport}>Export backup</button>
              <button className="btn" onClick={() => importRef.current?.click()}>Import backup…</button>
              <input ref={importRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = () => setPendingImport({ raw: String(reader.result ?? ''), name: f.name })
                reader.readAsText(f)
                e.target.value = ''
              }} />
            </div>
            <p className="tiny" style={{ marginBottom: 0 }}>Importing replaces everything currently in this browser with the backup's data. Export first if you want to keep what's here.</p>
          </Card>

          {isAdmin && (
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
            <button className="btn danger" disabled={cloudLoaded} onClick={() => setConfirmReset(true)}>Reset demo data</button>
            <p className="tiny" style={{ marginBottom: 0 }}>
              {cloudLoaded
                ? 'Unavailable: this school\u2019s data came from the cloud, so resetting would replace a live season with demo content.'
                : 'Clears your local changes and restores the seeded demo dataset.'}
            </p>
          </Card>
          )}
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

      {pendingImport && (
        <ConfirmDialog title="Import this backup?" confirmLabel="Import & replace" danger
          message={`This replaces all data in this browser with the contents of "${pendingImport.name}". This can't be undone.`}
          onConfirm={() => {
            if (importState(pendingImport.raw)) toast('Backup imported')
            else toast("That file couldn't be read as a backup", 'error')
            setPendingImport(null)
          }}
          onClose={() => setPendingImport(null)} />
      )}

      {confirmSeed && (
        <ConfirmDialog title="Save to cloud without loading first?" danger confirmLabel="Replace cloud data"
          message="Nothing has loaded from the cloud on this device, so this will replace whatever is stored there with what's on this screen right now. That is only safe on a brand-new, empty project. If your school's data already exists in the cloud, cancel and use Load from cloud instead."
          onConfirm={async () => { await cloudPushNow({ force: true }); toast('Saved to cloud') }}
          onClose={() => setConfirmSeed(false)} />
      )}

      {confirmReset && (
        <ConfirmDialog title="Reset demo data?" danger confirmLabel="Reset everything"
          message="This discards every change you've made in the prototype (events, payments, requests, tasks) and restores the original Homewood demo data."
          onConfirm={() => {
            const refused = resetDemo()
            toast(refused ?? 'Demo data reset', refused ? 'error' : 'success')
          }}
          onClose={() => setConfirmReset(false)} />
      )}
    </>
  )

  /** Edit this school's own record. Going through `update` keeps it a
   *  record-level save — using setState here re-uploaded the whole workspace on
   *  every keystroke in these fields. */
  function updateOrg(patch: Partial<Organization>) {
    update('orgs', org.id, patch)
  }
}

function TierSettingsCard() {
  const { state, update } = useStore()
  const me = currentUser(state)
  const canEdit = can(me.role, 'finance')
  const sports = [...new Set(state.teams.map(t => t.sport))].sort((a, b) => a.localeCompare(b))
  const order = sponsorTiers(state)
  const rows = [...tierSettings(state)].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))

  return (
    <Card title="Sponsorship levels" pad={false}>
      <p className="small muted" style={{ padding: '12px 16px 0', margin: 0 }}>
        Set a default agreement amount per level, whether it's recorded as paid on entry (e.g. a prepaid web-portal level),
        and a sport its money is earmarked to by default. Everything stays editable on each individual sponsor.
        {!canEdit && ' (Finance or an administrator can edit these.)'}
      </p>
      <table className="tbl" style={{ marginTop: 8 }}>
        <thead><tr><th>Level</th><th>Default amount</th><th>On entry</th><th>Default earmark</th></tr></thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id}>
              <td><strong className="small">{t.tier}</strong></td>
              <td>
                {canEdit
                  ? <input className="input" type="number" min={0} style={{ width: 120 }} value={t.defaultAmount ?? ''} placeholder="Custom"
                      onChange={e => update('tierSettings', t.id, { defaultAmount: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  : (t.defaultAmount != null ? fmtMoney(t.defaultAmount) : 'Custom')}
              </td>
              <td>
                <button type="button" className="tier-toggle" data-on={t.autoPaid} disabled={!canEdit}
                  onClick={() => update('tierSettings', t.id, { autoPaid: !t.autoPaid })}>{t.autoPaid ? 'Paid' : 'Invoiced'}</button>
              </td>
              <td>
                {canEdit
                  ? <select className="inline-select" value={t.earmarkSport ?? ''} onChange={e => update('tierSettings', t.id, { earmarkSport: e.target.value || undefined })}>
                      <option value="">Athletic dept</option>
                      {sports.map(sp => <option key={sp}>{sp}</option>)}
                    </select>
                  : (t.earmarkSport ?? 'Athletic dept')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function BenefitTemplatesCard() {
  const { state, add, update, remove, toast } = useStore()
  const me = currentUser(state)
  const canEdit = can(me.role, 'finance')
  const templates = benefitTemplates(state)
  const [label, setLabel] = useState('')
  // Default a new benefit to the school's top three levels, whatever they're called.
  const [tiers, setTiers] = useState<SponsorTier[]>(() => sponsorTiers(state).slice(0, 3))
  const flip = (arr: SponsorTier[], t: SponsorTier) => (arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t])

  const TierToggles = ({ value, onToggle }: { value: SponsorTier[]; onToggle: (t: SponsorTier) => void }) => (
    <div className="pill-row" style={{ gap: 4 }}>
      {sponsorTiers(state).map(t => (
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
    else if (orgUsers(state).some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) errs.email = 'A user with this email already exists.'
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

/**
 * Publishing this school's logos to the public site.
 *
 * The database builds the public data automatically, but it cannot move image
 * files — storage is outside its reach. So the images the public site needs are
 * copied here, on demand, from the private bucket into the public one.
 */
function PublicSiteCard() {
  const { state, toast } = useStore()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const me = currentUser(state)
  const org = currentOrg(state)
  if (!can(me.role, 'admin') || !storageEnabled()) return null

  const logos = publicLogosFor(state, org.id)
  const hasSchoolLogo = logos.some(l => l.assetId === `school:${org.id}`)

  const sync = async () => {
    setBusy(true)
    const r = await syncPublicLogos(state, org.id)
    setBusy(false)
    setResult(r)
    if (r.blocked) toast('Nothing could be published — see below', 'error')
    else toast(r.failed.length
      ? `${r.copied} published, ${r.failed.length} failed`
      : `${r.copied} logo${r.copied === 1 ? '' : 's'} published`,
      r.failed.length ? 'error' : 'success')
  }

  return (
    <Card title="Public site">
      <p className="small muted" style={{ marginTop: 0 }}>
        Schedules, scores and rosters reach the public site on their own. Logos are files,
        so they have to be copied across — do this after adding or changing one.
      </p>
      <p className="small" style={{ marginBottom: 10 }}>
        {org.shortName}'s public site:{' '}
        <a href={publicSiteUrl(org)} target="_blank" rel="noreferrer" style={{ color: 'var(--app-accent)', fontWeight: 600 }}>
          {publicSiteUrl(org)} <I.external />
        </a>
      </p>
      {/* Naming what will be copied, because the usual question when a logo
          doesn't appear publicly is whether it was ever in this list. */}
      <p className="small" style={{ marginBottom: 6 }}>
        <strong>{logos.length}</strong> logo{logos.length === 1 ? '' : 's'} to publish
        {logos.length > 0 && ':'}
      </p>
      {logos.length > 0 && (
        <ul className="small muted" style={{ margin: '0 0 6px', paddingLeft: 18, columns: logos.length > 6 ? 2 : 1 }}>
          {logos.map(l => <li key={l.assetId}>{l.label}</li>)}
        </ul>
      )}
      {!hasSchoolLogo && (
        <p className="tiny" style={{ color: 'var(--warn)', marginTop: 0, marginBottom: 10 }}>
          {org.shortName}'s own logo isn't in that list. Upload it under Branding above —
          until then the public site shows the school's initials.
        </p>
      )}
      <button className="btn primary" disabled={busy || logos.length === 0} onClick={sync}>
        {busy ? 'Publishing…' : 'Publish logos'}
      </button>
      {result?.blocked && (
        <p className="small" style={{ color: 'var(--danger)', marginBottom: 0 }}>{result.blocked}</p>
      )}
      {result && result.failed.length > 0 && (
        <ul className="small" style={{ color: 'var(--danger)', marginBottom: 0 }}>
          {result.failed.map((f, i) => <li key={i}>{f.label}: {f.error}</li>)}
        </ul>
      )}
      {logos.length === 0 && (
        <p className="tiny muted" style={{ marginBottom: 0, marginTop: 8 }}>
          Nothing to publish yet — upload the school's logo under Branding, or an opponent
          logo in the asset library, first.
        </p>
      )}
    </Card>
  )
}

/**
 * Moving files uploaded before every path carried the school that owns it.
 *
 * Shown only while such files exist, because it is a one-off: once they have
 * moved, the bucket's access rules can tell which school a file belongs to and
 * this disappears.
 */
function StorageMigrationCard() {
  const { state, setState, logActivity, toast } = useStore()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<{ label: string; error: string }[]>([])
  const me = currentUser(state)
  const pending = storageEnabled() && can(me.role, 'admin') ? legacyFiles(state) : []
  if (pending.length === 0) return null

  const run = async () => {
    setBusy(true)
    const res = await migrateLegacyFiles(state)
    // Only rewrite references whose file actually moved.
    if (res.updates.length) {
      setState({
        assets: state.assets.map(a => {
          const u = res.updates.find(x => x.kind === 'asset' && x.id === a.id)
          return u ? { ...a, storagePath: u.ref } : a
        }),
        orgs: state.orgs.map(o => {
          const u = res.updates.find(x => x.kind === 'orgLogo' && x.id === o.id)
          return u ? { ...o, logoUrl: u.ref } : o
        }),
      })
      logActivity(`moved ${res.moved} files into per-school folders`)
    }
    setBusy(false)
    setFailed(res.failed)
    const done = res.moved + res.relinked
    toast(res.failed.length
      ? `${done} sorted out, ${res.failed.length} couldn't be`
      : `${done} file${done === 1 ? '' : 's'} sorted out`,
      res.failed.length ? 'error' : 'success')
  }

  return (
    <Card title="Files need moving" action={<Badge tone="warn">Action needed</Badge>}>
      <p className="small" style={{ marginTop: 0 }}>
        <strong>{pending.length}</strong> file{pending.length === 1 ? ' was' : 's were'} uploaded before
        files were filed by school. Until they move, the bucket cannot tell which school they belong to,
        so its access rules cannot protect them.
      </p>
      <p className="tiny muted" style={{ marginBottom: 10 }}>
        Do this <strong>before</strong> tightening the bucket policy in STORAGE_SETUP.md — the move reads
        each file where it is now, which the new rules would refuse.
      </p>
      {/* Naming each file and where it is going, because an error here is about
          one specific path and is unreadable without seeing it. */}
      <ul className="tiny muted" style={{ margin: '0 0 12px', paddingLeft: 18 }}>
        {pending.map(f => (
          <li key={`${f.kind}-${f.id}`}>
            {f.label} — <code>{f.ref.replace('storage:', '')}</code> → <code>{f.newPath}</code>
          </li>
        ))}
      </ul>
      <button className="btn primary" disabled={busy} onClick={run}>
        {busy ? 'Moving…' : `Move ${pending.length} file${pending.length === 1 ? '' : 's'}`}
      </button>
      {failed.length > 0 && (
        <>
          <ul className="small" style={{ color: 'var(--danger)', marginBottom: 6 }}>
            {failed.map((f, i) => <li key={i}>{f.label}: {f.error}</li>)}
          </ul>
          {failed.every(f => /couldn't reach/.test(f.error)) && (
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              Storage answers the same way for a file that isn't there and one this account
              may not read, so this doesn't say which. Run <code>supabase/find-missing-files.sql</code>
              in the Supabase SQL editor — it sees every file regardless of the rules, and says
              which of the two it is.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
