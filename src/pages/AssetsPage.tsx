import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { assets as allAssets, can } from '../lib/derive'
import { fmtDate } from '../lib/dates'
import { Badge, Empty, Field, Modal, SearchBox, StatusBadge } from '../components/ui'
import { I } from '../components/icons'
import type { Asset, AssetType } from '../types'

const ASSET_TYPES: AssetType[] = [
  'School Branding', 'Team Logo', 'Opponent Logo', 'Sponsor Logo', 'Athlete Headshot', 'Team Photo',
  'Social Template', 'Video-board Ad', 'Broadcast Commercial', 'Document', 'Audio', 'Video',
]

function fmtSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

export default function AssetsPage() {
  const { state, add, update, logActivity, toast } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [sport, setSport] = useState('')
  const [sponsor, setSponsor] = useState('')
  const [approval, setApproval] = useState('')
  const [uploading, setUploading] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const canApprove = ['school_admin', 'comms_admin', 'platform_owner'].includes(me.role)

  const rows = useMemo(() => {
    let list = allAssets(state)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter(a => a.name.toLowerCase().includes(term))
    if (type) list = list.filter(a => a.type === type)
    if (sport) list = list.filter(a => a.sport === sport)
    if (sponsor) list = list.filter(a => a.sponsorId === sponsor)
    if (approval) list = list.filter(a => a.approvalStatus === approval)
    return list
  }, [state, q, type, sport, sponsor, approval])

  const sports = [...new Set(allAssets(state).map(a => a.sport).filter(Boolean))] as string[]

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Asset library</h1>
          <p className="page-sub">{allAssets(state).length} files · logos, templates, media and documents</p>
        </div>
        {can(me.role, 'edit') && <button className="btn primary" onClick={() => setUploading(true)}><I.plus /> Upload asset</button>}
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search assets…" />
        <select className="inline-select" value={type} onChange={e => setType(e.target.value)} aria-label="Type filter">
          <option value="">All types</option>
          {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="inline-select" value={sport} onChange={e => setSport(e.target.value)} aria-label="Sport filter">
          <option value="">All sports</option>
          {sports.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="inline-select" value={sponsor} onChange={e => setSponsor(e.target.value)} aria-label="Sponsor filter">
          <option value="">All sponsors</option>
          {state.sponsors.filter(s => allAssets(state).some(a => a.sponsorId === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="inline-select" value={approval} onChange={e => setApproval(e.target.value)} aria-label="Approval filter">
          <option value="">Any approval</option>
          <option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty icon="▣" title="No assets match" hint="Try clearing a filter or searching for something else." /></div>
      ) : (
        <div className="asset-grid">
          {rows.map(a => {
            const sp = state.sponsors.find(s => s.id === a.sponsorId)
            const uploader = state.users.find(u => u.id === a.uploadedById)
            return (
              <div key={a.id} className="card asset-card">
                <div className="asset-thumb" style={{ background: a.tint }}>{a.fileType}</div>
                <div className="asset-body">
                  <span className="asset-name">{a.name}</span>
                  <div className="pill-row">
                    <Badge tone="outline">{a.type}</Badge>
                    {sp && <Badge tone="info">{sp.name}</Badge>}
                    {a.sport && <Badge>{a.sport}</Badge>}
                  </div>
                  <div className="tiny">{fmtSize(a.sizeKB)} · {uploader?.name.split(' ')[0]} · {fmtDate(a.uploadedAt)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <StatusBadge status={a.approvalStatus} />
                    {canApprove && a.approvalStatus === 'pending' && (
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button className="btn sm" onClick={() => { update('assets', a.id, { approvalStatus: 'approved' }); toast(`Approved “${a.name}”`) }}>Approve</button>
                        <button className="btn sm ghost" onClick={() => { update('assets', a.id, { approvalStatus: 'rejected' }); toast(`Rejected “${a.name}”`, 'error') }}>Reject</button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {uploading && <UploadForm onClose={() => setUploading(false)} onSave={a => {
        add('assets', a)
        logActivity(`uploaded asset “${a.name}”`, '/assets')
        toast('Asset uploaded (mock) — pending approval')
        setUploading(false)
      }} />}
    </>
  )
}

function UploadForm({ onClose, onSave }: { onClose: () => void; onSave: (a: Asset) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState({ name: '', type: 'Sponsor Logo' as AssetType, fileType: 'PNG', sport: '', sponsorId: '', teamId: '' })
  const [err, setErr] = useState('')
  const tints = ['#d60000', '#12223c', '#0e7490', '#15803d', '#b45309', '#7c3aed']
  return (
    <Modal title="Upload asset (mock)" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          if (!form.name.trim()) { setErr('Give the asset a descriptive name.'); return }
          onSave({
            id: `as-new-${Date.now()}`, orgId: state.currentOrgId, name: form.name.trim(), type: form.type,
            fileType: form.fileType, sizeKB: 500 + Math.floor(Math.random() * 5000),
            sport: form.sport || undefined, teamId: form.teamId || undefined, sponsorId: form.sponsorId || undefined,
            season: 'Fall 2026', approvalStatus: 'pending', uploadedById: state.currentUserId,
            uploadedAt: state.demoToday, tint: tints[Math.floor(Math.random() * tints.length)],
          })
        }}>Upload</button>
      </>
    }>
      <p className="small muted" style={{ marginTop: 0 }}>No file actually uploads in this prototype — this creates a catalog record.</p>
      <Field label="Asset name" required error={err}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Valley Bank video-board slide" />
      </Field>
      <div className="form-row">
        <Field label="Asset type">
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AssetType }))}>
            {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="File format">
          <select value={form.fileType} onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))}>
            {['PNG', 'JPG', 'SVG', 'PDF', 'PSD', 'MP4', 'WAV', 'DOCX', 'ZIP', 'EPS'].map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Sponsor (optional)">
          <select value={form.sponsorId} onChange={e => setForm(f => ({ ...f, sponsorId: e.target.value }))}>
            <option value="">None</option>
            {state.sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Team (optional)">
          <select value={form.teamId} onChange={e => {
            const t = state.teams.find(x => x.id === e.target.value)
            setForm(f => ({ ...f, teamId: e.target.value, sport: t?.sport ?? '' }))
          }}>
            <option value="">None</option>
            {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
