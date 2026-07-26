import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { ROLE_LABELS, can, requests as allRequests } from '../lib/derive'
import { fmtDate, fmtDateTime, relDue, todayISO } from '../lib/dates'
import { Avatar, Badge, Card, Empty, Field, Modal, PriorityBadge, SearchBox, Seg, StatusBadge } from '../components/ui'
import { I } from '../components/icons'
import type { CoachRequest, Priority, RequestStatus, RequestType } from '../types'

const REQUEST_TYPES: RequestType[] = [
  'Schedule Correction', 'Roster Update', 'Website Update', 'Social Reminder', 'Athlete Spotlight',
  'Signing Announcement', 'Broadcast Request', 'Photography Request', 'Graphic Request', 'General Communications',
]

const FLOW: RequestStatus[] = ['submitted', 'reviewed', 'in_progress', 'completed']
const NEXT_LABEL: Record<RequestStatus, string> = {
  submitted: 'Mark reviewed', reviewed: 'Start work', in_progress: 'Mark completed', completed: '',
}

export default function RequestsPage() {
  const { state, add, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'open' | 'completed' | 'all'>('open')
  const [creating, setCreating] = useState(params.get('new') === '1')
  useEffect(() => { if (params.get('new') === '1') { setCreating(true); setParams({}, { replace: true }) } }, [params, setParams])
  const me = state.users.find(u => u.id === state.currentUserId)!
  const isCoach = me.role === 'coach'

  const rows = useMemo(() => {
    let rs = allRequests(state)
    if (isCoach) rs = rs.filter(r => r.coachId === me.id)
    if (status === 'open') rs = rs.filter(r => r.status !== 'completed')
    if (status === 'completed') rs = rs.filter(r => r.status === 'completed')
    const term = q.trim().toLowerCase()
    if (term) rs = rs.filter(r => r.title.toLowerCase().includes(term) || r.type.toLowerCase().includes(term))
    return rs.sort((a, b) => a.neededBy.localeCompare(b.neededBy))
  }, [state, q, status, isCoach, me.id])

  const counts = FLOW.map(f => allRequests(state).filter(r => r.status === f && (!isCoach || r.coachId === me.id)).length)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{isCoach ? 'My requests' : 'Coach requests'}</h1>
          <p className="page-sub">Structured requests flow Submitted → Reviewed → In progress → Completed.</p>
        </div>
        {can(me.role, 'edit') && <button className="btn primary" onClick={() => setCreating(true)}><I.plus /> New request</button>}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {FLOW.map((f, i) => (
          <div key={f} className="card stat-card">
            <span className="label">{f.replace('_', ' ')}</span>
            <span className="value" style={f === 'submitted' && counts[i] > 0 ? { color: 'var(--warn)' } : undefined}>{counts[i]}</span>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search requests…" />
        <div className="spacer" />
        <Seg options={[{ value: 'open', label: 'Open' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All' }]} value={status} onChange={setStatus} />
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Request</th><th>Team</th><th>Type</th><th>Needed by</th><th>Priority</th><th>Assignee</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7}><div className="empty"><h4>No requests here</h4><p>{isCoach ? 'Submit a request with the button above.' : 'New coach requests will land in this queue.'}</p></div></td></tr>}
            {rows.map(r => {
              const team = state.teams.find(t => t.id === r.teamId)
              const assignee = state.users.find(u => u.id === r.assigneeId)
              const due = relDue(r.neededBy, todayISO())
              return (
                <tr key={r.id} className="clickable" onClick={() => navigate(`/requests/${r.id}`)}>
                  <td><span className="primary">{r.title}</span><div className="tiny">by {state.users.find(u => u.id === r.coachId)?.name}</div></td>
                  <td className="muted small">{team?.name}</td>
                  <td className="muted small">{r.type}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(r.neededBy)}
                    {r.status !== 'completed' && due.overdue && <div><Badge tone="danger">{due.label}</Badge></div>}
                  </td>
                  <td><PriorityBadge p={r.priority} /></td>
                  <td>{assignee ? <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Avatar user={assignee} size="sm" /> <span className="small">{assignee.name.split(' ')[0]}</span></span> : <span className="tiny">—</span>}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && <RequestForm onClose={() => setCreating(false)} onSave={r => {
        add('requests', r)
        logActivity(`submitted request “${r.title}”`, `/requests/${r.id}`)
        toast('Request submitted — the communications team has been notified')
        setCreating(false)
        navigate(`/requests/${r.id}`)
      }} />}
    </>
  )
}

function RequestForm({ onClose, onSave }: { onClose: () => void; onSave: (r: CoachRequest) => void }) {
  const { state } = useStore()
  const me = state.users.find(u => u.id === state.currentUserId)!
  const myTeams = me.role === 'coach' ? state.teams.filter(t => me.teamIds?.includes(t.id)) : state.teams
  const [form, setForm] = useState({
    teamId: myTeams[0]?.id ?? '', type: 'General Communications' as RequestType, title: '', description: '',
    neededBy: '', priority: 'normal' as Priority, attachments: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Give the request a short title.'
    if (form.description.trim().length < 12) errs.description = 'Add enough detail for the comms team to act on (at least a sentence).'
    if (!form.neededBy) errs.neededBy = 'A needed-by date is required.'
    else if (form.neededBy < todayISO()) errs.neededBy = 'Needed-by date can\'t be in the past.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({
      id: `req-new-${Date.now()}`, orgId: state.currentOrgId, coachId: me.id, teamId: form.teamId,
      type: form.type, title: form.title.trim(), description: form.description.trim(), neededBy: form.neededBy,
      priority: form.priority, attachments: form.attachments ? form.attachments.split(',').map(s => s.trim()).filter(Boolean) : [],
      status: 'submitted', internalNotes: [], createdAt: new Date().toISOString(), assigneeId: null,
    })
  }

  return (
    <Modal title="Submit a request" onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Submit request</button>
      </>
    }>
      <div className="form-row">
        <Field label="Team" required>
          <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
            {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Request type" required>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as RequestType }))}>
            {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Title" required error={errors.title}>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="One-line summary of what you need" />
      </Field>
      <Field label="Description" required error={errors.description}>
        <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What do you need, for when, and any specifics (names, dates, links)…" />
      </Field>
      <div className="form-row">
        <Field label="Needed by" required error={errors.neededBy}>
          <input type="date" value={form.neededBy} onChange={e => setForm(f => ({ ...f, neededBy: e.target.value }))} />
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </Field>
      </div>
      <Field label="Attachments (comma-separated file names — mock upload)">
        <input value={form.attachments} onChange={e => setForm(f => ({ ...f, attachments: e.target.value }))} placeholder="roster.xlsx, photo.jpg" />
      </Field>
    </Modal>
  )
}

export function RequestDetail() {
  const { id } = useParams()
  const { state, update, logActivity, toast } = useStore()
  const [note, setNote] = useState('')
  const r = state.requests.find(x => x.id === id)
  const me = state.users.find(u => u.id === state.currentUserId)!
  if (!r) return <Card><Empty icon="?" title="Request not found" /></Card>

  const coach = state.users.find(u => u.id === r.coachId)
  const team = state.teams.find(t => t.id === r.teamId)
  const assignee = state.users.find(u => u.id === r.assigneeId)
  const staffCanWork = ['comms_admin', 'school_admin', 'platform_owner'].includes(me.role)
  const stepIdx = FLOW.indexOf(r.status)

  const advance = () => {
    const next = FLOW[stepIdx + 1]
    if (!next) return
    update('requests', r.id, { status: next, assigneeId: r.assigneeId ?? me.id } as Partial<CoachRequest>)
    logActivity(`moved request “${r.title}” to ${next.replace('_', ' ')}`, `/requests/${r.id}`)
    toast(next === 'completed' ? 'Request completed — the coach will see the update' : `Request ${next.replace('_', ' ')}`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 6 }}><Link to="/requests" className="tiny link">← Requests</Link></div>
          <h1 className="page-title">{r.title}</h1>
          <p className="page-sub">{r.type} · {team?.name} · submitted {fmtDateTime(r.createdAt)}</p>
          <div className="pill-row" style={{ marginTop: 8 }}>
            <StatusBadge status={r.status} />
            <PriorityBadge p={r.priority} />
            <Badge tone={relDue(r.neededBy, todayISO()).overdue && r.status !== 'completed' ? 'danger' : 'outline'}>Needed by {fmtDate(r.neededBy)}</Badge>
          </div>
        </div>
        {staffCanWork && r.status !== 'completed' && (
          <button className="btn primary" onClick={advance}>{NEXT_LABEL[r.status]}</button>
        )}
      </div>

      {/* Workflow steps */}
      <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {FLOW.map((f, i) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 120 }}>
            <span className="badge" style={i <= stepIdx ? { background: 'var(--brand-navy)', color: '#fff' } : {}}>
              {i < stepIdx ? '✓ ' : ''}{f.replace('_', ' ')}
            </span>
            {i < FLOW.length - 1 && <span style={{ flex: 1, height: 2, background: i < stepIdx ? 'var(--brand-navy)' : 'var(--border)', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Description">
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.description}</p>
            {r.attachments.length > 0 && (
              <>
                <div className="divider" />
                <div className="pill-row">
                  {r.attachments.map((a, i) => <Badge key={i} tone="outline">📎 {a}</Badge>)}
                </div>
              </>
            )}
          </Card>
          <Card title="Internal notes" pad={false}>
            <div style={{ padding: '4px 18px' }}>
              {r.internalNotes.length === 0 && <p className="small muted">No internal notes yet. Coaches don't see these.</p>}
              {r.internalNotes.map(n => {
                const author = state.users.find(u => u.id === n.authorId)
                return (
                  <div key={n.id} className="feed-item">
                    <Avatar user={author} size="sm" />
                    <span>{n.text}<div className="when">{author?.name} · {fmtDateTime(n.at)}</div></span>
                  </div>
                )
              })}
            </div>
            {staffCanWork && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
                <input className="input" style={{ flex: 1 }} placeholder="Add an internal note…" value={note} onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && note.trim()) { addNote() } }} />
                <button className="btn sm" onClick={addNote} disabled={!note.trim()}><I.plus /></button>
              </div>
            )}
          </Card>
        </div>
        <Card title="Details">
          <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
            <dt>Coach</dt><dd style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Avatar user={coach} size="sm" /> {coach?.name}</dd>
            <dt>Team</dt><dd><Link className="link" to={`/teams/${r.teamId}`}>{team?.name}</Link></dd>
            <dt>Type</dt><dd>{r.type}</dd>
            <dt>Needed by</dt><dd>{fmtDate(r.neededBy, { weekday: 'short', month: 'long', day: 'numeric' })}</dd>
            <dt>Priority</dt><dd><PriorityBadge p={r.priority} /></dd>
            <dt>Assignee</dt>
            <dd>
              {staffCanWork ? (
                <select className="inline-select" value={r.assigneeId ?? ''} onChange={e => {
                  update('requests', r.id, { assigneeId: e.target.value || null } as Partial<CoachRequest>)
                  toast('Assignee updated')
                }}>
                  <option value="">Unassigned</option>
                  {state.users.filter(u => u.orgId === state.currentOrgId && u.status !== 'revoked').map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role]}</option>)}
                </select>
              ) : (assignee?.name ?? 'Unassigned')}
            </dd>
          </dl>
        </Card>
      </div>
    </>
  )

  function addNote() {
    if (!note.trim()) return
    update('requests', r!.id, {
      internalNotes: [...r!.internalNotes, { id: `rn-${Date.now()}`, at: new Date().toISOString(), authorId: me.id, text: note.trim() }],
    } as Partial<CoachRequest>)
    setNote('')
    toast('Note added')
  }
}
