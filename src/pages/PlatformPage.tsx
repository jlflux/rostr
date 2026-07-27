import { useState } from 'react'
import { useStore, SKINS, type Skin } from '../store/store'
import { CONFIGURABLE_SECTIONS, ROLE_LABELS, SECTION_LABELS, currentOrg, currentUser, sortedByLastName, type Section } from '../lib/derive'
import { Badge, Card, ConfirmDialog, Field, Modal } from '../components/ui'
import { StoredImage } from '../components/StoredImage'
import { removeFromStorage, storageEnabled, uploadToStorage } from '../lib/storage'
import { I } from '../components/icons'
import type { Organization, OrgConfig } from '../types'

const SKIN_NAMES: Record<Skin, string> = {
  classic: 'Classic', modern: 'Modern', 'modern-compact': 'Modern compact',
}

/** Counts shown per school so it's obvious which ones are actually in use. */
function orgStats(state: ReturnType<typeof useStore>['state'], orgId: string) {
  return {
    users: state.users.filter(u => u.orgId === orgId).length,
    events: state.events.filter(e => e.orgId === orgId && !e.deletedAt).length,
    teams: state.teams.filter(t => t.orgId === orgId).length,
    sponsors: state.sponsors.filter(s => s.orgId === orgId).length,
  }
}

/**
 * Platform owner console — the operator view above any single school. Manage the
 * schools on the platform and configure what each one sees.
 */
export default function PlatformPage() {
  const { state, setState, add, update, removeOrg, toast, setSkin } = useStore()
  const me = currentUser(state)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null)

  // Route guard already blocks non-owners; this is the in-page backstop.
  if (me.role !== 'platform_owner') {
    return <Card><div className="card-pad">Only the platform owner can open this page.</div></Card>
  }

  const current = currentOrg(state)
  const platformFavicon = state.platform?.faviconUrl
  const cfg: OrgConfig = current.config ?? {}

  const patchConfig = (p: Partial<OrgConfig>) =>
    update('orgs', current.id, { config: { ...cfg, ...p } } as Partial<Organization>)

  const toggleSection = (s: Section) => {
    const hidden = cfg.hiddenSections ?? []
    const next = hidden.includes(s) ? hidden.filter(x => x !== s) : [...hidden, s]
    patchConfig({ hiddenSections: next })
    toast(next.includes(s) ? `${SECTION_LABELS[s]} hidden for ${current.shortName}` : `${SECTION_LABELS[s]} enabled`)
  }

  const rename = (s: Section, value: string) =>
    patchConfig({ sectionLabels: { ...(cfg.sectionLabels ?? {}), [s]: value } })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Platform</h1>
          <p className="page-sub">
            Manage the schools on this platform and configure what each one sees.
            Only you can open this page.
          </p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><I.plus /> Add school</button>
      </div>

      <Card title="Platform branding">
        <Field label="Browser tab icon (favicon)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 32, height: 32, borderRadius: 7, overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {platformFavicon
                ? <StoredImage src={platformFavicon} alt="Tab icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={<span className="tiny">—</span>} />
                : <span className="tiny">—</span>}
            </span>
            <input type="file" accept="image/*" disabled={!storageEnabled()} onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              const res = await uploadToStorage(f, 'platform')
              if ('error' in res) { toast(`Icon upload failed: ${res.error}`, 'error'); return }
              const prev = platformFavicon
              setState({ platform: { ...(state.platform ?? {}), faviconUrl: res.ref } })
              toast('Tab icon updated for every school')
              removeFromStorage(prev)
            }} />
            {platformFavicon && (
              <button className="btn sm ghost" onClick={() => {
                const prev = platformFavicon
                setState({ platform: { ...(state.platform ?? {}), faviconUrl: undefined } })
                removeFromStorage(prev)
                toast('Tab icon reset to the default')
              }}>Remove</button>
            )}
          </div>
          <p className="tiny" style={{ marginTop: 6, marginBottom: 0 }}>
            {storageEnabled()
              ? 'Used for every school on the platform — this is your Command Center mark, not a school logo. Square images work best. Schools set their own logo under Settings → Organization branding. Tabs already open may need a refresh.'
              : 'Needs cloud file storage to be connected first — see STORAGE_SETUP.md.'}
          </p>
        </Field>
      </Card>

      <div style={{ height: 16 }} />

      <Card title={`Schools (${state.orgs.length})`} pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>School</th><th>Location</th><th className="num">Users</th><th className="num">Teams</th><th className="num">Events</th><th></th></tr></thead>
            <tbody>
              {state.orgs.map(o => {
                const s = orgStats(state, o.id)
                const isCurrent = o.id === state.currentOrgId
                return (
                  <tr key={o.id}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className="org-mark" style={{ background: o.theme.primary }}>{o.initials}</span>
                        <span>
                          <span className="primary">{o.name}</span>
                          <div className="tiny">{o.mascot}{isCurrent ? ' · currently viewing' : ''}</div>
                        </span>
                      </span>
                    </td>
                    <td>{o.city}, {o.state}</td>
                    <td className="num">{s.users}</td>
                    <td className="num">{s.teams}</td>
                    <td className="num">{s.events}</td>
                    <td>
                      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {isCurrent
                          ? <Badge tone="ok">Viewing</Badge>
                          : <button className="btn sm" onClick={() => { setState({ currentOrgId: o.id }); toast(`Switched to ${o.name}`) }}>Open</button>}
                        {state.orgs.length > 1 && !isCurrent && (
                          <button className="btn sm ghost danger" aria-label={`Delete ${o.name}`} title="Delete school"
                            onClick={() => setConfirmDelete(o)}><I.x /></button>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Who can switch schools" pad={false}>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Everyone else is locked to their own school and never sees that other
            schools exist. Grant this only to people who work across schools with
            you — as platform owner you always have it.
          </p>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Person</th><th>School</th><th>Role</th><th>Can switch</th></tr></thead>
            <tbody>
              {sortedByLastName(state.users.filter(u => u.status !== 'revoked')).map(u => {
                const owner = u.role === 'platform_owner'
                const on = owner || u.canSwitchOrgs === true
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="primary">{u.name}</span>
                      <div className="tiny">{u.email}</div>
                    </td>
                    <td>{state.orgs.find(o => o.id === u.orgId)?.shortName ?? <span className="muted">—</span>}</td>
                    <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td>
                      {owner ? (
                        <Badge tone="navy">Always</Badge>
                      ) : (
                        <button className="tier-toggle" data-on={on} onClick={() => {
                          update('users', u.id, { canSwitchOrgs: !on })
                          toast(!on
                            ? `${u.name} can now switch schools`
                            : `${u.name} is now locked to ${state.orgs.find(o => o.id === u.orgId)?.shortName ?? 'their school'}`)
                        }}>
                          {on ? 'Yes' : 'No'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title={`Sections — ${current.shortName}`}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Switch off anything this school doesn't use, and rename sections to match
          their vocabulary. Hidden sections disappear from the menu and can't be
          reached by URL. Dashboard and Settings can't be switched off.
        </p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Section</th><th>Shown</th><th>Called</th></tr></thead>
            <tbody>
              {CONFIGURABLE_SECTIONS.map(s => {
                const hidden = (cfg.hiddenSections ?? []).includes(s)
                return (
                  <tr key={s}>
                    <td><span className="primary">{SECTION_LABELS[s]}</span></td>
                    <td>
                      <button className="tier-toggle" data-on={!hidden} onClick={() => toggleSection(s)}>
                        {hidden ? 'Off' : 'On'}
                      </button>
                    </td>
                    <td>
                      <input
                        className="inline-select"
                        style={{ minWidth: 150 }}
                        value={cfg.sectionLabels?.[s] ?? ''}
                        placeholder={SECTION_LABELS[s]}
                        disabled={hidden}
                        aria-label={`Rename ${SECTION_LABELS[s]}`}
                        onChange={e => rename(s, e.target.value)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title={`Appearance — ${current.shortName}`}>
        <Field label="Default style for this school">
          <select value={cfg.defaultSkin ?? 'classic'} onChange={e => {
            const next = e.target.value as Skin
            patchConfig({ defaultSkin: next })
            setSkin(next)
            toast(`${current.shortName} now defaults to ${SKIN_NAMES[next]}`)
          }}>
            {SKINS.map(s => <option key={s} value={s}>{SKIN_NAMES[s]}</option>)}
          </select>
          <p className="tiny" style={{ marginTop: 6, marginBottom: 0 }}>
            Applies to everyone at this school who hasn't picked their own style in
            Settings → Appearance. Their choice always wins over this default.
          </p>
        </Field>
      </Card>

      {adding && (
        <AddSchoolModal onClose={() => setAdding(false)} onSave={o => {
          add('orgs', o)
          setState({ currentOrgId: o.id })
          toast(`${o.name} created — you're now viewing it`)
          setAdding(false)
        }} />
      )}

      {confirmDelete && (
        <ConfirmDialog title={`Delete ${confirmDelete.name}?`} danger confirmLabel="Delete school"
          message={`This permanently removes the school and everything belonging to it — every user, team, event, sponsor, agreement, request, task, asset and opponent. This cannot be undone. Export a backup from Settings first if you're unsure.`}
          onConfirm={() => {
            // Deletes the school's whole row, so nothing is left behind.
            void removeOrg(confirmDelete.id)
            toast(`${confirmDelete.name} deleted`)
          }}
          onClose={() => setConfirmDelete(null)} />
      )}
    </>
  )
}

function AddSchoolModal({ onClose, onSave }: { onClose: () => void; onSave: (o: Organization) => void }) {
  const [f, setF] = useState({
    name: '', shortName: '', mascot: '', city: '', state: 'AL',
    primary: '#d60000', navy: '#12223c',
  })
  const [err, setErr] = useState('')

  /** "Homewood High School" → "HH" — a reasonable default badge. */
  const initialsFrom = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'SC'

  return (
    <Modal title="Add a school" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          if (!f.name.trim()) { setErr('Enter the school name.'); return }
          onSave({
            id: `org-${Date.now()}`,
            name: f.name.trim(),
            shortName: (f.shortName.trim() || f.name.trim().split(/\s+/)[0]),
            mascot: f.mascot.trim(),
            city: f.city.trim(),
            state: f.state.trim(),
            initials: initialsFrom(f.shortName || f.name),
            theme: { primary: f.primary, navy: f.navy, accent: '#b8933f' },
          })
        }}>Create school</button>
      </>
    }>
      <p className="small muted" style={{ marginTop: 0 }}>
        Creates an empty school. You'll be switched to it, and can then add its staff
        under Settings → Users &amp; roles.
      </p>
      <Field label="School name" required error={err}>
        <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Vestavia Hills High School" />
      </Field>
      <div className="form-row">
        <Field label="Short name">
          <input value={f.shortName} onChange={e => setF(v => ({ ...v, shortName: e.target.value }))} placeholder="Vestavia" />
        </Field>
        <Field label="Mascot">
          <input value={f.mascot} onChange={e => setF(v => ({ ...v, mascot: e.target.value }))} placeholder="Rebels" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="City">
          <input value={f.city} onChange={e => setF(v => ({ ...v, city: e.target.value }))} placeholder="Vestavia Hills" />
        </Field>
        <Field label="State">
          <input value={f.state} onChange={e => setF(v => ({ ...v, state: e.target.value }))} maxLength={2} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Primary color">
          <input type="color" value={f.primary} style={{ height: 40, padding: 3 }}
            onChange={e => setF(v => ({ ...v, primary: e.target.value }))} />
        </Field>
        <Field label="Secondary color">
          <input type="color" value={f.navy} style={{ height: 40, padding: 3 }}
            onChange={e => setF(v => ({ ...v, navy: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  )
}
