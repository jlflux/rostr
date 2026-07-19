import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { can, venueConflicts, visibleScore } from '../lib/derive'
import { fmtDateLong, fmtTime, relDue } from '../lib/dates'
import { Avatar, Badge, Card, Check, ConfirmDialog, Empty, Field, HomeAwayBadge, Modal, PriorityBadge, StatusBadge } from '../components/ui'
import { EventForm } from './EventsPage'
import { OpponentMark } from '../components/EventRow'
import { I } from '../components/icons'
import type { ContentKind, RunOfShowItem, SportEvent, StaffRole, StaffSlot, Task } from '../types'

const TABS = ['overview', 'staffing', 'runofshow', 'sponsors', 'tasks', 'assets', 'results'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview', staffing: 'Staffing', runofshow: 'Run of show',
  sponsors: 'Sponsors', tasks: 'Tasks & reminders', assets: 'Assets', results: 'Results & postgame',
}

const ALL_STAFF_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'PA Announcer', 'Scoreboard Operator', 'Video-board Operator', 'Broadcast Crew', 'Photographer', 'Social Media Coverage', 'Student Intern', 'Trainer']

export default function EventDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, update, add, logActivity, toast } = useStore()
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const e = state.events.find(x => x.id === id)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const editable = can(me.role, 'edit')
  const conflicts = useMemo(() => venueConflicts(state), [state])

  if (!e) {
    return <Card><Empty icon="?" title="Event not found" hint="It may have been removed. Return to the events list." /></Card>
  }

  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const team = state.teams.find(t => t.id === e.teamId)
  const tasks = state.tasks.filter(t => t.eventId === e.id)
  const eventAssets = state.assets.filter(a => e.sponsorIds.includes(a.sponsorId ?? '') || a.teamId === e.teamId)
  const conflictIds = conflicts.get(e.id) ?? []
  const openSlots = e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length
  const score = visibleScore(state, e)
  const opp = state.opponents.find(o => o.id === e.opponentId)

  const patch = (p: Partial<SportEvent>) => update('events', e.id, p)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 6 }}>
            <Link to="/events" className="tiny link">← Events</Link>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <OpponentMark opponent={opp} size={34} />
            <span>{e.sport} {e.level !== 'Varsity' ? `(${e.level})` : ''} {e.homeAway === 'home' ? 'vs' : e.homeAway === 'away' ? 'at' : '·'} {e.opponent}</span>
          </h1>
          <p className="page-sub">
            {fmtDateLong(e.date)} · {fmtTime(e.time)} · {e.venue}
            {e.multiDay && ` · ${e.multiDay}`}
          </p>
          <div className="pill-row" style={{ marginTop: 8 }}>
            <HomeAwayBadge ha={e.homeAway} />
            <StatusBadge status={e.status} />
            {(e.gameType === 'region' || e.gameType === 'area') && <Badge tone="navy">{e.gameType === 'region' ? 'Region game' : 'Area game'}</Badge>}
            {e.designation && <Badge tone="brand">{e.designation}</Badge>}
            {e.broadcastStatus !== 'none' && <Badge tone="info"><I.broadcast /> {e.broadcastStatus === 'archived' ? 'Broadcast archived' : `Broadcast ${e.broadcastStatus}`}</Badge>}
            {score && <Badge tone={score.result === 'W' ? 'ok' : 'danger'}>Final: {score.result} {score.us}–{score.them}</Badge>}
            {conflictIds.length > 0 && <Badge tone="warn"><I.warn /> Possible venue conflict</Badge>}
          </div>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="inline-select" value={e.status} onChange={ev => {
              if (ev.target.value === 'canceled') { setConfirmCancel(true); return }
              patch({ status: ev.target.value as SportEvent['status'] })
              toast(`Status changed to ${ev.target.value}`)
            }} aria-label="Event status">
              {['scheduled', 'confirmed', 'completed', 'postponed', 'canceled'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button className="btn" onClick={() => setEditing(true)}>Edit event</button>
          </div>
        )}
      </div>

      {conflictIds.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: 'var(--warn)', display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--warn)' }}><I.warn /></span>
          <span className="small">
            <strong>Venue check:</strong> {e.venue} has {conflictIds.length} other event{conflictIds.length > 1 ? 's' : ''} within 2 hours:{' '}
            {conflictIds.map((cid, i) => {
              const c = state.events.find(x => x.id === cid)
              return c ? <span key={cid}>{i > 0 && ', '}<Link className="link" to={`/events/${cid}`}>{c.sport} {c.level} vs {c.opponent} ({fmtTime(c.time)})</Link></span> : null
            })}
          </span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)} role="tab" aria-selected={t === tab}>
            {TAB_LABELS[t]}
            {t === 'staffing' && openSlots > 0 && <span className="tab-count" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{openSlots}</span>}
            {t === 'tasks' && tasks.filter(x => x.status !== 'done').length > 0 && <span className="tab-count">{tasks.filter(x => x.status !== 'done').length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview e={e} teamName={team?.name} />}
      {tab === 'staffing' && <Staffing e={e} editable={editable} />}
      {tab === 'runofshow' && <RunOfShow e={e} editable={editable} />}
      {tab === 'sponsors' && <EventSponsors e={e} editable={editable} />}
      {tab === 'tasks' && <EventTasks e={e} tasks={tasks} editable={editable} />}
      {tab === 'assets' && (
        <Card title="Related assets" pad={false}>
          {eventAssets.length === 0 && <Empty icon="▣" title="No linked assets" hint="Assets tagged to this event's team or sponsors will appear here." />}
          {eventAssets.map(a => (
            <Link key={a.id} to="/assets" className="notif-item">
              <span className="org-mark" style={{ background: a.tint }}>{a.fileType.slice(0, 3)}</span>
              <span style={{ flex: 1 }}>{a.name}<div className="tiny">{a.type} · {a.fileType}</div></span>
              <StatusBadge status={a.approvalStatus} />
            </Link>
          ))}
        </Card>
      )}
      {tab === 'results' && <Results e={e} editable={editable} />}

      {editing && (
        <EventForm initial={e} onClose={() => setEditing(false)} onSave={ev => {
          update('events', e.id, ev)
          logActivity(`edited event ${ev.sport} vs ${ev.opponent}`, `/events/${e.id}`)
          toast('Event updated')
          setEditing(false)
        }} />
      )}
      {confirmCancel && (
        <ConfirmDialog title="Cancel this event?" danger confirmLabel="Cancel event"
          message={`This marks ${e.sport} vs ${e.opponent} as canceled. Staff assignments and reminders stay attached but the event is flagged across the app.`}
          onConfirm={() => { patch({ status: 'canceled' }); logActivity(`canceled event vs ${e.opponent}`); toast('Event canceled') }}
          onClose={() => setConfirmCancel(false)} />
      )}
    </>
  )
}

function Overview({ e, teamName }: { e: SportEvent; teamName?: string }) {
  const { state } = useStore()
  const score = visibleScore(state, e)
  return (
    <div className="detail-grid">
      <Card title="Event details">
        <dl className="kv">
          <dt>Team</dt><dd><Link className="link" to={`/teams/${e.teamId}`}>{teamName ?? `${e.sport} ${e.level}`}</Link></dd>
          <dt>Opponent</dt><dd>{e.opponent}</dd>
          <dt>Date</dt><dd>{fmtDateLong(e.date)}{e.multiDay ? ` (${e.multiDay})` : ''}</dd>
          <dt>Time</dt><dd>{fmtTime(e.time)}{e.checkoutTime ? ` · School checkout ${e.checkoutTime}` : ''}</dd>
          <dt>Home / away</dt><dd><HomeAwayBadge ha={e.homeAway} /></dd>
          <dt>Venue</dt><dd>{e.venue}</dd>
          <dt>Status</dt><dd><StatusBadge status={e.status} /></dd>
          <dt>Game type</dt><dd>{e.gameType === 'region' ? 'Region game' : e.gameType === 'area' ? 'Area game' : 'Non-region'}</dd>
          <dt>Designation</dt><dd>{e.designation ?? <span className="muted">—</span>}</dd>
          <dt>Ticket link</dt>
          <dd>{e.ticketLink ? <a className="link" href={e.ticketLink} target="_blank" rel="noreferrer">GoFan tickets <I.external /></a> : <span className="muted">None</span>}</dd>
          <dt>Broadcast</dt>
          <dd>{e.broadcastLink ? <><a className="link" href={e.broadcastLink} target="_blank" rel="noreferrer">NFHS Network <I.external /></a> <StatusBadge status={e.broadcastStatus} /></> : <span className="muted">Not broadcast</span>}</dd>
          <dt>Result</dt>
          <dd>{score ? <strong>{score.result} {score.us}–{score.them}</strong> : <span className="muted">Not played</span>}</dd>
        </dl>
        {e.notes && (<><div className="divider" /><div className="small"><strong>Notes:</strong> {e.notes}</div></>)}
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="Staffing at a glance">
          {e.staffSlots.length === 0
            ? <p className="small muted" style={{ margin: 0 }}>No staff plan for this event{e.homeAway !== 'home' ? ' (away game)' : ''}.</p>
            : (
              <div className="pill-row">
                <Badge tone="ok">{e.staffSlots.filter(s => s.status === 'confirmed').length} confirmed</Badge>
                <Badge tone="warn">{e.staffSlots.filter(s => s.status === 'assigned').length} assigned</Badge>
                <Badge tone="danger">{e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length} open</Badge>
              </div>
            )}
        </Card>
        <Card title="Sponsors on this event">
          {e.sponsorIds.length === 0
            ? <p className="small muted" style={{ margin: 0 }}>No sponsor activation tied to this event.</p>
            : <SponsorLinks ids={e.sponsorIds} />}
        </Card>
      </div>
    </div>
  )
}

function SponsorLinks({ ids }: { ids: string[] }) {
  const { state } = useStore()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ids.map(id => {
        const s = state.sponsors.find(x => x.id === id)
        return s ? <Link key={id} className="link small" to={`/sponsors/${id}`}>{s.name} · {s.tier}</Link> : null
      })}
    </div>
  )
}

function Staffing({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, logActivity, toast } = useStore()
  const [addingRole, setAddingRole] = useState<StaffRole>('Ticket Worker')
  const staffUsers = state.users.filter(u => ['event_staff', 'comms_admin', 'school_admin'].includes(u.role))

  const setSlot = (slotId: string, p: Partial<StaffSlot>) => {
    update('events', e.id, {
      staffSlots: e.staffSlots.map(s => (s.id === slotId ? { ...s, ...p } : s)),
    } as Partial<SportEvent>)
  }

  return (
    <div className="detail-grid">
      <Card title={`Staff assignments (${e.staffSlots.length})`} pad={false} action={editable && (
        <span style={{ display: 'flex', gap: 6 }}>
          <select className="inline-select" value={addingRole} onChange={ev => setAddingRole(ev.target.value as StaffRole)} aria-label="Role to add">
            {ALL_STAFF_ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <button className="btn sm" onClick={() => {
            update('events', e.id, { staffSlots: [...e.staffSlots, { id: `slot-${Date.now()}`, role: addingRole, userId: null, status: 'unfilled' }] } as Partial<SportEvent>)
            toast(`${addingRole} slot added`)
          }}><I.plus /> Add role</button>
        </span>
      )}>
        {e.staffSlots.length === 0 && <Empty icon="◌" title="No staff plan yet" hint={editable ? 'Add roles above to build the staffing plan for this event.' : 'Staffing has not been planned for this event.'} />}
        {e.staffSlots.map(slot => {
          const assigned = state.users.find(u => u.id === slot.userId)
          return (
            <div key={slot.id} className="checklist-item" style={{ padding: '10px 18px' }}>
              <span style={{ width: 170, fontWeight: 650, flexShrink: 0 }} className="small">{slot.role}</span>
              {editable ? (
                <select className="inline-select" style={{ flex: 1, maxWidth: 220 }} value={slot.userId ?? ''}
                  onChange={ev => {
                    const uid = ev.target.value || null
                    setSlot(slot.id, { userId: uid, status: uid ? 'assigned' : 'unfilled' })
                    if (uid) {
                      const u = state.users.find(x => x.id === uid)
                      logActivity(`assigned ${u?.name} as ${slot.role} for ${e.sport} vs ${e.opponent}`, `/events/${e.id}`)
                      toast(`${u?.name} assigned`)
                    }
                  }} aria-label={`Assign ${slot.role}`}>
                  <option value="">— Unassigned —</option>
                  {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <span style={{ flex: 1 }} className="small">{assigned?.name ?? '—'}</span>
              )}
              <Avatar user={assigned} size="sm" />
              {editable && slot.userId && slot.status !== 'confirmed' && (
                <button className="btn sm ghost" onClick={() => { setSlot(slot.id, { status: 'confirmed' }); toast('Marked confirmed') }}>Confirm</button>
              )}
              <StatusBadge status={slot.status} />
            </div>
          )
        })}
      </Card>
      <Card title="Coverage summary">
        {ALL_STAFF_ROLES.filter(r => e.staffSlots.some(s => s.role === r)).map(r => {
          const slots = e.staffSlots.filter(s => s.role === r)
          const covered = slots.filter(s => s.userId).length
          return (
            <div key={r} className="rep-bar-row" style={{ gridTemplateColumns: '140px 1fr 46px' }}>
              <span className="small">{r}</span>
              <div className="rep-bar"><div style={{ width: `${(covered / slots.length) * 100}%` }} /></div>
              <span className="small num">{covered}/{slots.length}</span>
            </div>
          )
        })}
        {e.staffSlots.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing to summarize yet.</p>}
      </Card>
    </div>
  )
}

function RunOfShow({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, toast } = useStore()
  const [draft, setDraft] = useState({ time: '', item: '' })
  const [err, setErr] = useState('')
  const setRos = (items: RunOfShowItem[]) => update('events', e.id, { runOfShow: items } as Partial<SportEvent>)
  const sorted = [...e.runOfShow].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <Card title="Run of show" pad={false} action={<span className="tiny">{sorted.filter(i => i.done).length}/{sorted.length} complete</span>}>
      {sorted.length === 0 && <Empty icon="≡" title="No run of show yet" hint="Build the minute-by-minute plan for gameday operations." />}
      {sorted.map(item => {
        const owner = state.users.find(u => u.id === item.ownerId)
        return (
          <div key={item.id} className={`checklist-item ${item.done ? 'done' : ''}`} style={{ padding: '9px 18px' }}>
            <Check checked={item.done} disabled={!editable} onChange={() => setRos(e.runOfShow.map(x => x.id === item.id ? { ...x, done: !x.done } : x))} />
            <span style={{ width: 66, fontWeight: 700, flexShrink: 0 }} className="small">{fmtTime(item.time)}</span>
            <span className="label">{item.item}</span>
            {owner && <span className="tiny">{owner.name.split(' ')[0]}</span>}
            <Avatar user={owner} size="sm" />
            {editable && <button className="btn sm ghost" onClick={() => setRos(e.runOfShow.filter(x => x.id !== item.id))} aria-label="Remove item"><I.x /></button>}
          </div>
        )
      })}
      {editable && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <input className="input" type="time" style={{ width: 120 }} value={draft.time} onChange={ev => setDraft(d => ({ ...d, time: ev.target.value }))} aria-label="Item time" />
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Add run-of-show item…" value={draft.item} onChange={ev => setDraft(d => ({ ...d, item: ev.target.value }))} />
          <button className="btn primary sm" onClick={() => {
            if (!draft.time || !draft.item.trim()) { setErr('Both a time and a description are required.'); return }
            setErr('')
            setRos([...e.runOfShow, { id: `ros-${Date.now()}`, time: draft.time, item: draft.item.trim(), ownerId: null, done: false }])
            setDraft({ time: '', item: '' })
            toast('Run-of-show item added')
          }}><I.plus /> Add</button>
          {err && <div className="error-msg" style={{ width: '100%', color: 'var(--danger)', fontSize: '0.78rem' }}>{err}</div>}
        </div>
      )}
    </Card>
  )
}

function EventSponsors({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, toast } = useStore()
  const linked = state.sponsors.filter(s => e.sponsorIds.includes(s.id))
  const available = state.sponsors.filter(s => s.orgId === e.orgId && !e.sponsorIds.includes(s.id))
  return (
    <div className="detail-grid">
      <Card title="Sponsor activations" pad={false} action={editable && available.length > 0 && (
        <select className="inline-select" value="" aria-label="Add sponsor" onChange={ev => {
          if (!ev.target.value) return
          update('events', e.id, { sponsorIds: [...e.sponsorIds, ev.target.value] } as Partial<SportEvent>)
          toast('Sponsor assigned to event')
        }}>
          <option value="">+ Assign sponsor…</option>
          {available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}>
        {linked.length === 0 && <Empty icon="◈" title="No sponsors assigned" hint="Assign a sponsor to track gameday recognition and fulfillment." />}
        {linked.map(s => {
          const ag = state.agreements.find(a => a.sponsorId === s.id)
          return (
            <div key={s.id} className="notif-item" style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>
                <Link className="link" to={`/sponsors/${s.id}`}><strong>{s.name}</strong></Link>
                <div className="tiny">{s.tier} · {s.benefitSummary}</div>
              </span>
              {ag && <StatusBadge status={ag.paymentStatus} />}
              <StatusBadge status={s.logoStatus} />
              {editable && <button className="btn sm ghost" onClick={() => {
                update('events', e.id, { sponsorIds: e.sponsorIds.filter(x => x !== s.id) } as Partial<SportEvent>)
                toast('Sponsor removed from event')
              }} aria-label="Remove sponsor"><I.x /></button>}
            </div>
          )
        })}
      </Card>
      <Card title="Gameday recognition checklist">
        <p className="small muted" style={{ marginTop: 0 }}>Recognition items for assigned sponsors are tracked as content reminders on the Tasks tab.</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}>
          <li>PA reads during breaks</li>
          <li>Video-board rotation before kickoff</li>
          <li>Social recognition post</li>
        </ul>
      </Card>
    </div>
  )
}

function EventTasks({ e, tasks, editable }: { e: SportEvent; tasks: Task[]; editable: boolean }) {
  const { state, update, add, toast } = useStore()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ContentKind | 'task'>('task')
  const [err, setErr] = useState('')
  const contentKinds: ContentKind[] = ['Gameday Post', 'Final Score', 'Ticket Link Promo', 'Broadcast Link', 'Sponsor Recognition', 'Results Post', 'Photo Gallery']

  return (
    <Card title="Tasks & content reminders" pad={false}>
      {tasks.length === 0 && <Empty icon="☑" title="Nothing tracked for this event yet" hint="Add operational tasks or social content reminders below." />}
      {tasks.map(t => {
        const assignee = state.users.find(u => u.id === t.assigneeId)
        const due = relDue(t.dueDate, state.demoToday)
        return (
          <div key={t.id} className={`checklist-item ${t.status === 'done' ? 'done' : ''}`} style={{ padding: '10px 18px' }}>
            <Check checked={t.status === 'done'} disabled={!editable}
              onChange={() => { update('tasks', t.id, { status: t.status === 'done' ? 'open' : 'done' }); toast(t.status === 'done' ? 'Reopened' : 'Marked complete') }} />
            <span className="label">
              {t.title}
              <div className="tiny">{t.kind === 'content' ? t.contentKind : 'Task'} · {t.status === 'done' ? 'Complete' : due.label}</div>
            </span>
            {t.status !== 'done' && due.overdue && <Badge tone="danger">Overdue</Badge>}
            {editable ? (
              <select className="inline-select" value={t.assigneeId ?? ''} onChange={ev => update('tasks', t.id, { assigneeId: ev.target.value || null })} aria-label="Assignee">
                <option value="">Unassigned</option>
                {state.users.filter(u => u.role !== 'read_only' && u.role !== 'platform_owner').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : <span className="tiny">{assignee?.name ?? 'Unassigned'}</span>}
            <Avatar user={assignee} size="sm" />
          </div>
        )
      })}
      {editable && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <select className="inline-select" value={kind} onChange={ev => setKind(ev.target.value as ContentKind | 'task')} aria-label="Reminder type">
            <option value="task">Task</option>
            {contentKinds.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder={kind === 'task' ? 'Add a task…' : `Add "${kind}" reminder…`} value={title} onChange={ev => setTitle(ev.target.value)} />
          <button className="btn primary sm" onClick={() => {
            const finalTitle = title.trim() || (kind !== 'task' ? `${kind} — ${e.sport} vs ${e.opponent}` : '')
            if (!finalTitle) { setErr('Give the task a short title.'); return }
            setErr('')
            add('tasks', {
              id: `task-${Date.now()}`, orgId: e.orgId, title: finalTitle,
              kind: kind === 'task' ? 'task' : 'content', contentKind: kind === 'task' ? undefined : kind,
              eventId: e.id, teamId: e.teamId, assigneeId: null, dueDate: e.date, status: 'open', priority: 'normal',
            } as Task)
            setTitle('')
            toast('Added to event checklist')
          }}><I.plus /> Add</button>
          {err && <div style={{ width: '100%', color: 'var(--danger)', fontSize: '0.78rem' }}>{err}</div>}
        </div>
      )}
    </Card>
  )
}

function Results({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, add, logActivity, toast } = useStore()
  const score = visibleScore(state, e)
  const [us, setUs] = useState(score?.us?.toString() ?? '')
  const [them, setThem] = useState(score?.them?.toString() ?? '')
  const [err, setErr] = useState('')
  const postgame = state.tasks.filter(t => t.eventId === e.id && ['Final Score', 'Results Post', 'Photo Gallery'].includes(t.contentKind ?? ''))

  const save = () => {
    const u = Number(us), t = Number(them)
    if (us === '' || them === '' || Number.isNaN(u) || Number.isNaN(t) || u < 0 || t < 0) {
      setErr('Enter both scores as non-negative numbers.')
      return
    }
    setErr('')
    update('events', e.id, { score: { us: u, them: t, result: u > t ? 'W' : u < t ? 'L' : 'T' }, status: 'completed' } as Partial<SportEvent>)
    logActivity(`posted final score ${u}–${t} for ${e.sport} vs ${e.opponent}`, `/events/${e.id}`)
    toast('Final score saved')
  }

  return (
    <div className="detail-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {score ? (
          <div className="score-hero">
            <span className="big">{score.us}–{score.them}</span>
            <span>
              <div style={{ fontWeight: 700 }}>{score.result === 'W' ? 'Win' : score.result === 'L' ? 'Loss' : 'Tie'} {e.homeAway === 'home' ? 'vs' : 'at'} {e.opponent}</div>
              <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{fmtDateLong(e.date)} · {e.venue}</div>
            </span>
          </div>
        ) : (
          <Card title="No result yet">
            <p className="small muted" style={{ margin: 0 }}>
              {e.date > state.demoToday ? 'This event hasn\'t been played yet.' : 'Enter the final score when the game wraps.'}
            </p>
          </Card>
        )}
        {editable && (
          <Card title={score ? 'Correct the score' : 'Enter final score'}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label={`${state.orgs.find(o => o.id === e.orgId)?.shortName ?? 'Us'}`}>
                <input type="number" min={0} style={{ width: 90 }} value={us} onChange={ev => setUs(ev.target.value)} />
              </Field>
              <Field label={e.opponent}>
                <input type="number" min={0} style={{ width: 90 }} value={them} onChange={ev => setThem(ev.target.value)} />
              </Field>
              <div className="field"><button className="btn primary" onClick={save}>Save result</button></div>
            </div>
            {err && <div style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err}</div>}
          </Card>
        )}
      </div>
      <Card title="Postgame checklist" pad={false}>
        {postgame.length === 0 && <Empty icon="☑" title="No postgame reminders" hint="Add Final Score / Photo Gallery reminders on the Tasks tab." />}
        {postgame.map(t => (
          <div key={t.id} className={`checklist-item ${t.status === 'done' ? 'done' : ''}`} style={{ padding: '9px 18px' }}>
            <Check checked={t.status === 'done'} disabled={!editable}
              onChange={() => update('tasks', t.id, { status: t.status === 'done' ? 'open' : 'done' })} />
            <span className="label">{t.title}<div className="tiny">{t.contentKind}</div></span>
          </div>
        ))}
      </Card>
    </div>
  )
}
