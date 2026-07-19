import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { can, eventTitle } from '../lib/derive'
import { fmtDate, fmtTime } from '../lib/dates'
import { Badge, Card, Empty, Field, Modal, SearchBox } from '../components/ui'
import { OpponentMark } from '../components/EventRow'
import { I } from '../components/icons'
import type { Opponent } from '../types'

const OPP_TINTS = ['#b45309', '#166534', '#1d4ed8', '#7c3aed', '#be185d', '#0e7490', '#ca8a04', '#4d7c0f']

function mapsUrl(o: Opponent): string | null {
  const q = o.address || (o.city ? `${o.name} High School, ${o.city}, ${o.state ?? ''}` : null)
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

function profileComplete(o: Opponent): boolean {
  return !!(o.mascot && o.city && o.logoAssetId)
}

export default function OpponentsPage() {
  const { state, add, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(params.get('open'))
  const [creating, setCreating] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const editable = can(me.role, 'edit')

  useEffect(() => {
    if (params.get('open')) setParams({}, { replace: true })
  }, [params, setParams])

  const rows = useMemo(() => {
    let list = state.opponents.filter(o => o.orgId === state.currentOrgId)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter(o => o.name.toLowerCase().includes(term) || o.mascot?.toLowerCase().includes(term) || o.city?.toLowerCase().includes(term))
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [state, q])

  const gamesFor = (id: string) => state.events.filter(e => e.opponentId === id)
  const open = state.opponents.find(o => o.id === openId)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Opponents</h1>
          <p className="page-sub">Build each opponent's profile once — logos, school info, and location flow onto every game against them.</p>
        </div>
        {editable && <button className="btn primary" onClick={() => setCreating(true)}><I.plus /> New opponent</button>}
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search opponents…" />
        <div className="spacer" />
        <span className="tiny">{rows.filter(o => !profileComplete(o)).length} of {rows.length} profiles incomplete</span>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>School</th><th>Mascot</th><th>Location</th><th>Logo</th><th>Games</th><th>Profile</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6}><div className="empty"><h4>No opponents yet</h4><p>Opponents are added here or automatically when events are created.</p></div></td></tr>}
            {rows.map(o => {
              const games = gamesFor(o.id)
              return (
                <tr key={o.id} className="clickable" onClick={() => setOpenId(o.id)}>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <OpponentMark opponent={o} size={24} />
                      <span className="primary">{o.name}</span>
                    </span>
                  </td>
                  <td className="muted small">{o.mascot ?? '—'}</td>
                  <td className="muted small">{o.city ? `${o.city}, ${o.state ?? ''}` : '—'}</td>
                  <td>{o.logoAssetId ? <Badge tone="ok">On file</Badge> : <Badge tone="danger">Missing</Badge>}</td>
                  <td className="small">{games.length}</td>
                  <td>{profileComplete(o) ? <Badge tone="ok">Complete</Badge> : <Badge tone="warn">Incomplete</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && <OpponentDetailModal opponent={open} onClose={() => setOpenId(null)} />}
      {creating && (
        <OpponentEditModal
          title="New opponent"
          initial={{ id: `opp-new-${Date.now()}`, orgId: state.currentOrgId, name: '', tint: OPP_TINTS[Math.floor(Math.random() * OPP_TINTS.length)] }}
          onClose={() => setCreating(false)}
          onSave={o => { add('opponents', o); toast(`${o.name} added to opponents`); setCreating(false); setOpenId(o.id) }}
        />
      )}
    </>
  )
}

function OpponentDetailModal({ opponent: o, onClose }: { opponent: Opponent; onClose: () => void }) {
  const { state, toast } = useStore()
  const [editing, setEditing] = useState(false)
  const { update } = useStore()
  const me = state.users.find(u => u.id === state.currentUserId)!
  const editable = can(me.role, 'edit')
  const games = state.events.filter(e => e.opponentId === o.id).sort((a, b) => a.date.localeCompare(b.date))
  const logoAsset = state.assets.find(a => a.id === o.logoAssetId)
  const maps = mapsUrl(o)

  if (editing) {
    return <OpponentEditModal title={`Edit ${o.name}`} initial={o} onClose={() => setEditing(false)}
      onSave={next => { update('opponents', o.id, next); toast('Opponent profile saved'); setEditing(false) }} />
  }

  return (
    <Modal title={o.name} onClose={onClose} wide footer={
      <>
        {editable && <button className="btn" onClick={() => setEditing(true)}>Edit profile</button>}
        <button className="btn primary" onClick={onClose}>Done</button>
      </>
    }>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <OpponentMark opponent={o} size={44} />
        <div>
          <div style={{ fontWeight: 750, fontSize: '1.05rem' }}>{o.name} {o.mascot ?? ''}</div>
          <div className="tiny">{o.city ? `${o.city}, ${o.state ?? ''}` : 'Location not entered'}{o.colors ? ` · ${o.colors}` : ''}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {o.logoAssetId
            ? <Badge tone="ok">Logo: {logoAsset?.name ?? 'on file'}</Badge>
            : <Link to="/assets" className="btn sm" onClick={onClose}>Upload logo →</Link>}
        </div>
      </div>

      <div className="form-row">
        <Card title="School info">
          <dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}>
            <dt>Mascot</dt><dd>{o.mascot ?? <span className="muted">—</span>}</dd>
            <dt>Colors</dt><dd>{o.colors ?? <span className="muted">—</span>}</dd>
            <dt>Website</dt><dd>{o.website ? <a className="link" href={o.website} target="_blank" rel="noreferrer">{o.website.replace('https://', '')} <I.external /></a> : <span className="muted">—</span>}</dd>
            <dt>Address</dt><dd>{o.address ?? <span className="muted">—</span>}</dd>
          </dl>
          {maps && (
            <p className="small" style={{ marginBottom: 0 }}>
              <a className="link" href={maps} target="_blank" rel="noreferrer">Open in Google Maps <I.external /></a>
            </p>
          )}
          {o.notes && (<><div className="divider" /><p className="small muted" style={{ margin: 0 }}><strong>Notes:</strong> {o.notes}</p></>)}
        </Card>
        <Card title={`Games vs ${o.name} (${games.length})`} pad={false}>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {games.length === 0 && <Empty title="No games scheduled" />}
            {games.map(e => (
              <Link key={e.id} to={`/events/${e.id}`} className="notif-item" onClick={onClose}>
                <span style={{ flex: 1 }}>
                  <strong>{eventTitle(e, { short: true })}</strong>
                  <div className="tiny">{fmtDate(e.date)} · {fmtTime(e.time)} · {e.venue}</div>
                </span>
                <Badge tone={e.homeAway === 'home' ? 'brand' : 'navy'}>{e.homeAway === 'home' ? 'Home' : 'Away'}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      {o.address && (
        <iframe
          title={`Map to ${o.name}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(o.address)}&output=embed`}
          style={{ width: '100%', height: 220, border: 'none', borderRadius: 10, marginTop: 12 }}
          loading="lazy"
        />
      )}
    </Modal>
  )
}

function OpponentEditModal({ title, initial, onClose, onSave }: {
  title: string; initial: Opponent; onClose: () => void; onSave: (o: Opponent) => void
}) {
  const [form, setForm] = useState<Opponent>(initial)
  const [err, setErr] = useState('')
  const set = (p: Partial<Opponent>) => setForm(f => ({ ...f, ...p }))
  return (
    <Modal title={title} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          if (!form.name.trim()) { setErr('School name is required.'); return }
          if (form.website && !/^https?:\/\//.test(form.website)) { setErr('Website must start with http(s)://'); return }
          onSave({ ...form, name: form.name.trim() })
        }}>Save profile</button>
      </>
    }>
      {err && <p className="small" style={{ color: 'var(--danger)', marginTop: 0 }}>{err}</p>}
      <div className="form-row">
        <Field label="School name" required>
          <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Vestavia Hills" />
        </Field>
        <Field label="Mascot">
          <input value={form.mascot ?? ''} onChange={e => set({ mascot: e.target.value || undefined })} placeholder="e.g. Rebels" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="City">
          <input value={form.city ?? ''} onChange={e => set({ city: e.target.value || undefined })} />
        </Field>
        <Field label="State">
          <input value={form.state ?? ''} onChange={e => set({ state: e.target.value || undefined })} placeholder="AL" />
        </Field>
      </div>
      <Field label="Address (drives the map and directions on away games)">
        <input value={form.address ?? ''} onChange={e => set({ address: e.target.value || undefined })} placeholder="Street, city, state, zip" />
      </Field>
      <div className="form-row">
        <Field label="Website">
          <input value={form.website ?? ''} onChange={e => set({ website: e.target.value || undefined })} placeholder="https://…" />
        </Field>
        <Field label="School colors">
          <input value={form.colors ?? ''} onChange={e => set({ colors: e.target.value || undefined })} placeholder="e.g. Green & Gold" />
        </Field>
      </div>
      <Field label="Operations notes (parking, press box contacts, quirks)">
        <textarea rows={2} value={form.notes ?? ''} onChange={e => set({ notes: e.target.value || undefined })} />
      </Field>
      <p className="tiny">Upload their logo in the Asset Library → Opponent Logos folder and mark it "Primary" to show it on games.</p>
    </Modal>
  )
}
