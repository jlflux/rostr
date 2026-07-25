import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { assets as allAssets, can } from '../lib/derive'
import { fmtDate } from '../lib/dates'
import { Badge, ConfirmDialog, Empty, Field, Modal, SearchBox, StatusBadge } from '../components/ui'
import { I } from '../components/icons'
import { StoredImage } from '../components/StoredImage'
import { removeFromStorage, resolveSignedUrl, storageEnabled, uploadToStorage } from '../lib/storage'
import type { Asset, AssetType, Opponent } from '../types'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
const isImageAsset = (a: Asset): boolean => !!a.storagePath && IMAGE_EXTS.includes(a.fileType.toLowerCase())

const ASSET_TYPES: AssetType[] = [
  'School Branding', 'Team Logo', 'Opponent Logo', 'Sponsor Logo', 'Athlete Headshot', 'Team Photo',
  'Social Template', 'Video-board Ad', 'Broadcast Commercial', 'Document', 'Audio', 'Video',
]

// Folder structure: each top-level folder maps to an asset type.
// "Team Photos" and "Athlete Headshots" get per-team subfolders.
const FOLDERS: { type: AssetType; label: string; icon: string; byTeam?: boolean }[] = [
  { type: 'School Branding', label: 'School Branding', icon: '🏛' },
  { type: 'Team Logo', label: 'Team Logos', icon: '🛡' },
  { type: 'Opponent Logo', label: 'Opponent Logos', icon: '⚔️' },
  { type: 'Sponsor Logo', label: 'Sponsor Logos', icon: '🤝' },
  { type: 'Team Photo', label: 'Team Photos', icon: '📸', byTeam: true },
  { type: 'Athlete Headshot', label: 'Athlete Headshots', icon: '👤', byTeam: true },
  { type: 'Social Template', label: 'Social Templates', icon: '📱' },
  { type: 'Video-board Ad', label: 'Video-board Ads', icon: '🖥' },
  { type: 'Broadcast Commercial', label: 'Broadcast Commercials', icon: '🎬' },
  { type: 'Document', label: 'Documents', icon: '📄' },
  { type: 'Audio', label: 'Audio', icon: '🔊' },
  { type: 'Video', label: 'Video', icon: '🎥' },
]

function fmtSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

interface Path { type?: AssetType; teamId?: string }

export default function AssetsPage() {
  const { state, add, update, remove, logActivity, toast } = useStore()
  const [q, setQ] = useState('')
  const [path, setPath] = useState<Path>({})
  const [approval, setApproval] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const canApprove = ['school_admin', 'comms_admin', 'platform_owner'].includes(me.role)
  const canEdit = can(me.role, 'edit')
  const isAdmin = can(me.role, 'admin')
  const placeholders = allAssets(state).filter(a => !a.storagePath)

  /** Delete one asset: remove its stored file, clear any opponent logo link, drop the record. */
  function deleteAsset(a: Asset) {
    removeFromStorage(a.storagePath)
    const primaryFor = state.opponents.find(o => o.logoAssetId === a.id)
    if (primaryFor) update('opponents', primaryFor.id, { logoAssetId: undefined } as Partial<Opponent>)
    remove('assets', a.id)
    logActivity(`deleted asset “${a.name}”`, '/assets')
  }
  const searching = q.trim().length > 0

  const folder = FOLDERS.find(f => f.type === path.type)
  const inFolder = allAssets(state).filter(a => a.type === path.type)
  const seasonLabel = 'Fall 2026'

  const visible = useMemo(() => {
    let list = allAssets(state)
    if (searching) {
      const term = q.trim().toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(term) || a.type.toLowerCase().includes(term))
    } else if (path.type) {
      list = list.filter(a => a.type === path.type)
      if (folder?.byTeam) {
        if (!path.teamId) return [] // showing subfolders instead
        list = list.filter(a => a.teamId === path.teamId)
      }
    } else {
      return []
    }
    if (approval) list = list.filter(a => a.approvalStatus === approval)
    return list
  }, [state, q, path, approval, searching, folder])

  const teamSubfolders = folder?.byTeam && !path.teamId && !searching
    ? state.teams.map(t => ({ team: t, count: inFolder.filter(a => a.teamId === t.id).length }))
        .filter(x => x.count > 0 || true)
    : null

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Asset library</h1>
          <p className="page-sub">{allAssets(state).length} files organized by folder · search finds anything anywhere</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && placeholders.length > 0 && (
            <button className="btn ghost danger" onClick={() => setConfirmClear(true)}>
              <I.x /> Clear {placeholders.length} placeholder{placeholders.length === 1 ? '' : 's'}
            </button>
          )}
          {canEdit && <button className="btn primary" onClick={() => setUploading(true)}><I.plus /> Upload asset</button>}
        </div>
      </div>

      <div className="toolbar">
        {!searching && path.type && (
          <button className="btn" onClick={() => setPath(path.teamId ? { type: path.type } : {})}>
            <I.left /> {path.teamId ? folder?.label : 'All folders'}
          </button>
        )}
        <SearchBox value={q} onChange={setQ} placeholder="Search all assets…" />
        {(searching || path.type) && (
          <select className="inline-select" value={approval} onChange={e => setApproval(e.target.value)} aria-label="Approval filter">
            <option value="">Any approval</option>
            <option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
          </select>
        )}
        <div className="spacer" />
        {!searching && (
          <nav className="crumbs" aria-label="Folder path">
            <a onClick={() => setPath({})} style={{ cursor: 'pointer' }}>All folders</a>
            {folder && (<><span className="sep">/</span>
              {path.teamId
                ? <a onClick={() => setPath({ type: path.type })} style={{ cursor: 'pointer' }}>{folder.label}</a>
                : <span>{folder.label}</span>}
            </>)}
            {path.teamId && (<><span className="sep">/</span><span>{state.teams.find(t => t.id === path.teamId)?.name} · {seasonLabel}</span></>)}
          </nav>
        )}
      </div>

      {/* Root: folder grid */}
      {!searching && !path.type && (
        <div className="folder-grid">
          {FOLDERS.map(f => {
            const count = allAssets(state).filter(a => a.type === f.type).length
            return (
              <div key={f.type} className="card folder-card" onClick={() => setPath({ type: f.type })} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setPath({ type: f.type })}>
                <span className="folder-icon" aria-hidden>{f.icon}</span>
                <span style={{ flex: 1 }}>
                  <div className="folder-name">{f.label}</div>
                  <div className="tiny">{count} file{count === 1 ? '' : 's'}{f.byTeam ? ' · by team & season' : ''}</div>
                </span>
                <I.right />
              </div>
            )
          })}
        </div>
      )}

      {/* Team subfolders */}
      {teamSubfolders && (
        <div className="folder-grid">
          {teamSubfolders.map(({ team, count }) => (
            <div key={team.id} className="card folder-card" onClick={() => setPath({ type: path.type, teamId: team.id })} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setPath({ type: path.type, teamId: team.id })}>
              <span className="folder-icon" aria-hidden>📁</span>
              <span style={{ flex: 1 }}>
                <div className="folder-name">{team.name}</div>
                <div className="tiny">{seasonLabel} · {count} file{count === 1 ? '' : 's'}</div>
              </span>
              {count === 0 ? <Badge tone="warn">Empty</Badge> : <I.right />}
            </div>
          ))}
        </div>
      )}

      {/* Asset grid (search results or open folder) */}
      {(searching || (path.type && !teamSubfolders)) && (
        visible.length === 0 ? (
          <div className="card"><Empty icon="▣" title={searching ? 'No assets match your search' : 'This folder is empty'}
            hint={searching ? 'Try a different term.' : 'Upload the first file with the button above — it will land in this folder.'} /></div>
        ) : (
          <div className="asset-grid">
            {visible.map(a => (
              <AssetCard key={a.id} a={a} canApprove={canApprove} canDelete={canEdit}
                onDelete={() => setConfirmDelete(a)}
                onApprove={ok => { update('assets', a.id, { approvalStatus: ok ? 'approved' : 'rejected' }); toast(ok ? `Approved “${a.name}”` : `Rejected “${a.name}”`, ok ? 'success' : 'error') }}
                onDownload={async () => {
                  if (a.storagePath) {
                    const url = await resolveSignedUrl(a.storagePath)
                    if (url) window.open(url, '_blank', 'noopener')
                    else toast('Could not open file — sign in to view uploads.', 'error')
                  } else toast(`Downloading ${a.name} (mock)`)
                }} />
            ))}
          </div>
        )
      )}

      {uploading && <UploadForm defaultType={path.type} defaultTeamId={path.teamId} onClose={() => setUploading(false)} onSave={a => {
        add('assets', a)
        logActivity(`uploaded asset “${a.name}”`, '/assets')
        toast('Asset uploaded (mock) — pending approval')
        setUploading(false)
      }} />}

      {confirmDelete && (
        <ConfirmDialog title={`Delete “${confirmDelete.name}”?`} danger confirmLabel="Delete asset"
          message={confirmDelete.storagePath
            ? 'This permanently removes the asset and its uploaded file. This cannot be undone.'
            : 'This permanently removes this asset record. This cannot be undone.'}
          onConfirm={() => { deleteAsset(confirmDelete); toast(`Deleted “${confirmDelete.name}”`) }}
          onClose={() => setConfirmDelete(null)} />
      )}

      {confirmClear && (
        <ConfirmDialog title={`Clear ${placeholders.length} placeholder asset${placeholders.length === 1 ? '' : 's'}?`} danger confirmLabel="Delete them all"
          message={`This removes every asset that doesn't have an uploaded file (the sample/placeholder records). Your ${allAssets(state).length - placeholders.length} uploaded file${allAssets(state).length - placeholders.length === 1 ? '' : 's'} will be kept. This cannot be undone.`}
          onConfirm={() => { const n = placeholders.length; placeholders.forEach(deleteAsset); toast(`Cleared ${n} placeholder asset${n === 1 ? '' : 's'}`) }}
          onClose={() => setConfirmClear(false)} />
      )}
    </>
  )
}

function AssetCard({ a, canApprove, canDelete, onApprove, onDownload, onDelete }: {
  a: Asset; canApprove: boolean; canDelete: boolean; onApprove: (ok: boolean) => void; onDownload: () => void; onDelete: () => void
}) {
  const { state, update, toast } = useStore()
  const sp = state.sponsors.find(s => s.id === a.sponsorId)
  const team = state.teams.find(t => t.id === a.teamId)
  const primaryFor = state.opponents.find(o => o.logoAssetId === a.id)

  return (
    <div className="card asset-card">
      <div className={`asset-thumb${isImageAsset(a) ? ' is-image' : ''}`} style={isImageAsset(a) ? undefined : { background: a.tint }}>
        {isImageAsset(a)
          ? <StoredImage src={a.storagePath} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={<>{a.fileType}</>} />
          : a.fileType}
      </div>
      <div className="asset-body">
        <span className="asset-name">{a.name}</span>
        <div className="pill-row">
          {sp && <Badge tone="info">{sp.name}</Badge>}
          {team && <Badge>{team.name}</Badge>}
          {primaryFor && <Badge tone="navy">Primary logo · {primaryFor.name}</Badge>}
        </div>
        <div className="tiny">{fmtSize(a.sizeKB)} · {fmtDate(a.uploadedAt)}</div>
        {a.type === 'Opponent Logo' && (
          <select className="inline-select" value={primaryFor?.id ?? ''} aria-label="Assign as opponent primary logo"
            onChange={e => {
              if (primaryFor) update('opponents', primaryFor.id, { logoAssetId: undefined } as Partial<Opponent>)
              if (e.target.value) {
                update('opponents', e.target.value, { logoAssetId: a.id } as Partial<Opponent>)
                toast(`Set as primary logo for ${state.opponents.find(o => o.id === e.target.value)?.name}`)
              }
            }}>
            <option value="">Not assigned to opponent</option>
            {state.opponents.filter(o => !o.deletedAt).map(o => <option key={o.id} value={o.id}>Primary for {o.name}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 6, flexWrap: 'wrap' }}>
          <StatusBadge status={a.approvalStatus} />
          <span style={{ display: 'flex', gap: 4 }}>
            {canApprove && a.approvalStatus === 'pending' && (
              <>
                <button className="btn sm" onClick={() => onApprove(true)}>Approve</button>
                <button className="btn sm ghost" onClick={() => onApprove(false)}>Reject</button>
              </>
            )}
            <button className="btn sm" onClick={onDownload}>Download</button>
            {canDelete && <button className="btn sm ghost danger" aria-label="Delete asset" title="Delete asset" onClick={onDelete}><I.x /></button>}
          </span>
        </div>
      </div>
    </div>
  )
}

function UploadForm({ defaultType, defaultTeamId, onClose, onSave }: {
  defaultType?: AssetType; defaultTeamId?: string; onClose: () => void; onSave: (a: Asset) => void
}) {
  const { state } = useStore()
  const [form, setForm] = useState({
    name: '', type: (defaultType ?? 'Sponsor Logo') as AssetType, fileType: 'PNG',
    sport: '', sponsorId: '', teamId: defaultTeamId ?? '', opponentId: '', setPrimary: false,
  })
  const [err, setErr] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const canUpload = storageEnabled()
  const tints = ['#d60000', '#12223c', '#0e7490', '#15803d', '#b45309', '#7c3aed']
  const { update } = useStore()

  async function save() {
    const fallbackName = file ? file.name.replace(/\.[^.]+$/, '') : ''
    const name = form.name.trim() || fallbackName
    if (!name) { setErr('Give the asset a descriptive name or choose a file.'); return }
    let storagePath: string | undefined
    let fileType = form.fileType
    let sizeKB = 500 + Math.floor(Math.random() * 5000)
    if (file && canUpload) {
      setBusy(true)
      const res = await uploadToStorage(file, form.type)
      setBusy(false)
      if ('error' in res) { setErr(`Upload failed: ${res.error}`); return }
      storagePath = res.ref
      fileType = (file.name.split('.').pop() || form.fileType).toUpperCase()
      sizeKB = Math.max(1, Math.round(file.size / 1024))
    }
    const id = `as-new-${Date.now()}`
    onSave({
      id, orgId: state.currentOrgId, name, type: form.type,
      fileType, sizeKB, storagePath,
      sport: form.sport || undefined, teamId: form.teamId || undefined, sponsorId: form.sponsorId || undefined,
      season: 'Fall 2026', approvalStatus: 'pending', uploadedById: state.currentUserId,
      uploadedAt: state.demoToday, tint: tints[Math.floor(Math.random() * tints.length)],
    })
    if (form.type === 'Opponent Logo' && form.opponentId && form.setPrimary) {
      update('opponents', form.opponentId, { logoAssetId: id } as Partial<Opponent>)
    }
  }

  return (
    <Modal title={canUpload ? 'Upload asset' : 'Upload asset (mock)'} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      </>
    }>
      {canUpload ? (
        <Field label="File">
          <input type="file" onChange={e => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f && !form.name.trim()) setForm(v => ({ ...v, name: f.name.replace(/\.[^.]+$/, '') }))
          }} />
          <p className="tiny muted" style={{ marginBottom: 0, marginTop: 4 }}>
            {file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : 'Choose the image or file to upload. Viewing uploaded files requires being signed in.'}
          </p>
        </Field>
      ) : (
        <p className="small muted" style={{ marginTop: 0 }}>No file actually uploads in this prototype — this creates a catalog record{defaultType ? ` in the ${defaultType} folder` : ''}.</p>
      )}
      <Field label="Asset name" required error={err}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Vestavia Hills Rebels logo" />
      </Field>
      <div className="form-row">
        <Field label="Folder / asset type">
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
      {form.type === 'Opponent Logo' ? (
        <div className="form-row">
          <Field label="Opponent">
            <select value={form.opponentId} onChange={e => setForm(f => ({ ...f, opponentId: e.target.value }))}>
              <option value="">None</option>
              {state.opponents.filter(o => !o.deletedAt).sort((a, b) => a.name.localeCompare(b.name)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Use as primary logo?">
            <select value={form.setPrimary ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, setPrimary: e.target.value === 'yes' }))}>
              <option value="no">No</option><option value="yes">Yes — show on events</option>
            </select>
          </Field>
        </div>
      ) : (
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
      )}
    </Modal>
  )
}
