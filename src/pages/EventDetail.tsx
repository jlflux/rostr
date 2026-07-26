import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { ROLE_LABELS, broadcastState, can, canSee, currentUser, defaultBroadcastChecklist, eventTitle, venueConflicts, visibleScore, visibleStatus } from '../lib/derive'
import { fmtDate, fmtDateLong, fmtTime, relDue, todayISO } from '../lib/dates'
import { resolveSignedUrl } from '../lib/storage'
import { StoredImage } from '../components/StoredImage'
import { Avatar, Badge, Card, Check, ConfirmDialog, Empty, Field, HomeAwayBadge, Modal, PriorityBadge, StatusBadge } from '../components/ui'
import { EventForm } from './EventsPage'
import { I, SportIcon } from '../components/icons'
import type { BroadcastCheckItem, ContentKind, GameMoment, RunOfShowItem, SponsorActivation, SportEvent, StaffRole, StaffSlot, Task } from '../types'

const TABS = ['overview', 'staffing', 'runofshow', 'sponsors', 'tasks', 'assets', 'results'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview', staffing: 'Staffing', runofshow: 'Run of show',
  sponsors: 'Sponsors', tasks: 'Tasks & reminders', assets: 'Assets', results: 'Results & postgame',
}

const ALL_STAFF_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'PA Announcer', 'Scoreboard Operator', 'Video-board Operator', 'Broadcast Crew', 'Photographer', 'Social Media Coverage', 'Student Intern', 'Trainer']

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { state, update, add, logActivity, toast } = useStore()
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const e = state.events.find(x => x.id === id)
  const me = currentUser(state)
  const editable = can(me.role, 'edit')
  const conflicts = useMemo(() => venueConflicts(state), [state])

  if (!e) {
    return <Card><Empty icon="?" title="Event not found" hint="It may have been removed. Return to the events list." /></Card>
  }

  const showSponsors = canSee(state, me.role, 'sponsors')
  let visibleTabs = e.eventKind === 'noncomp' ? TABS.filter(t => t !== 'results') : [...TABS]
  if (!showSponsors) visibleTabs = visibleTabs.filter(t => t !== 'sponsors')
  const tab = (visibleTabs.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const team = state.teams.find(t => t.id === e.teamId)
  const tasks = state.tasks.filter(t => t.eventId === e.id)
  const activationSponsorIds = e.sponsorActivations.map(a => a.sponsorId)
  // Primary logos of every opponent on this event (single or multi-opponent).
  const opponentIds = [e.opponentId, ...(e.opponentIds ?? [])].filter(Boolean) as string[]
  const opponentLogoIds = state.opponents
    .filter(o => opponentIds.includes(o.id) && o.logoAssetId)
    .map(o => o.logoAssetId!)
  const eventAssets = state.assets.filter(a =>
    activationSponsorIds.includes(a.sponsorId ?? '') ||
    a.teamId === e.teamId ||
    opponentLogoIds.includes(a.id))
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
            <SportIcon sport={e.sport} size={26} />
            <span>{eventTitle(e)}</span>
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
            {broadcastState(e) !== 'none' && (
              <Badge tone={broadcastState(e) === 'confirmed' ? 'info' : broadcastState(e) === 'in_progress' ? 'warn' : 'neutral'}>
                <I.broadcast /> {broadcastState(e) === 'archived' ? 'Broadcast archived' : broadcastState(e) === 'confirmed' ? 'Broadcast confirmed' : 'Broadcast in progress'}
              </Badge>
            )}
            {e.gameMoments.length > 0 && <Badge tone="warn">★ {e.gameMoments.length} special moment{e.gameMoments.length > 1 ? 's' : ''}</Badge>}
            {score && <Badge tone={score.result === 'W' ? 'ok' : 'danger'}>Final: {score.result} {score.us}–{score.them}</Badge>}
            {conflictIds.length > 0 && <Badge tone="warn"><I.warn /> Possible venue conflict</Badge>}
          </div>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="inline-select" value={visibleStatus(state, e)} onChange={ev => {
              if (ev.target.value === 'canceled') { setConfirmCancel(true); return }
              patch({ status: ev.target.value as SportEvent['status'] })
              toast(`Status changed to ${ev.target.value}`)
            }} aria-label="Event status">
              {['scheduled', 'confirmed', 'completed', 'postponed', 'canceled'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button className="btn" onClick={() => setEditing(true)}>Edit event</button>
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        )}
      </div>

      {e.deletedAt && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: 'var(--danger)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--danger)' }}><I.warn /></span>
          <span className="small" style={{ flex: 1 }}><strong>This event is in the trash</strong> — deleted {fmtDate(e.deletedAt)}, auto-removes in 30 days.</span>
          {editable && <button className="btn sm" onClick={() => { patch({ deletedAt: undefined }); toast('Event restored') }}>Restore</button>}
        </div>
      )}

      {conflictIds.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: 'var(--warn)', display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--warn)' }}><I.warn /></span>
          <span className="small">
            <strong>Venue check:</strong> {e.venue} has {conflictIds.length} other event{conflictIds.length > 1 ? 's' : ''} within 2 hours:{' '}
            {conflictIds.map((cid, i) => {
              const c = state.events.find(x => x.id === cid)
              return c ? <span key={cid}>{i > 0 && ', '}<Link className="link" to={`/events/${cid}`}>{eventTitle(c)} ({fmtTime(c.time)})</Link></span> : null
            })}
          </span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {visibleTabs.map(t => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)} role="tab" aria-selected={t === tab}>
            {TAB_LABELS[t]}
            {t === 'staffing' && openSlots > 0 && <span className="tab-count" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{openSlots}</span>}
            {t === 'tasks' && tasks.filter(x => x.status !== 'done').length > 0 && <span className="tab-count">{tasks.filter(x => x.status !== 'done').length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview e={e} teamName={team?.name} editable={editable} />}
      {tab === 'staffing' && <Staffing e={e} editable={editable} />}
      {tab === 'runofshow' && <RunOfShow e={e} editable={editable} />}
      {tab === 'sponsors' && <EventSponsors e={e} editable={editable} />}
      {tab === 'tasks' && <EventTasks e={e} tasks={tasks} editable={editable} />}
      {tab === 'assets' && (
        <Card title="Related assets" pad={false}>
          {eventAssets.length === 0 && <Empty icon="▣" title="No linked assets" hint="Assets tagged to this event's team, sponsors, or opponent will appear here." />}
          {eventAssets.map(a => {
            const isImage = !!a.storagePath && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(a.fileType.toLowerCase())
            const download = async () => {
              if (a.storagePath) {
                const url = await resolveSignedUrl(a.storagePath)
                if (url) window.open(url, '_blank', 'noopener')
                else toast('Could not open file — sign in to view uploads.', 'error')
              } else toast(`Downloading ${a.name} (mock)`)
            }
            return (
              <div key={a.id} className="notif-item">
                <span className="org-mark" style={isImage ? { overflow: 'hidden', padding: 0 } : { background: a.tint }}>
                  {isImage
                    ? <StoredImage src={a.storagePath} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={<>{a.fileType.slice(0, 3)}</>} />
                    : a.fileType.slice(0, 3)}
                </span>
                <Link to="/assets" style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
                  {a.name}<div className="tiny">{a.type} · {a.fileType}</div>
                </Link>
                <StatusBadge status={a.approvalStatus} />
                <button className="btn sm" onClick={download}>Download</button>
              </div>
            )
          })}
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
          message={`This marks ${eventTitle(e)} as canceled. Staff assignments and reminders stay attached but the event is flagged across the app.`}
          onConfirm={() => { patch({ status: 'canceled' }); logActivity(`canceled event vs ${e.opponent}`); toast('Event canceled') }}
          onClose={() => setConfirmCancel(false)} />
      )}
      {confirmDelete && (
        <ConfirmDialog title="Delete this event?" danger confirmLabel="Move to trash"
          message={`${eventTitle(e)} will move to the trash for 30 days, then be removed permanently. You can restore it from the Events page any time before then.`}
          onConfirm={() => { patch({ deletedAt: todayISO() }); logActivity(`moved event ${eventTitle(e, { short: true })} to the trash`); toast('Event moved to trash'); navigate('/events') }}
          onClose={() => setConfirmDelete(false)} />
      )}
    </>
  )
}

function Overview({ e, teamName, editable }: { e: SportEvent; teamName?: string; editable: boolean }) {
  const { state } = useStore()
  const me = currentUser(state)
  const showSponsors = canSee(state, me.role, 'sponsors')
  const score = visibleScore(state, e)
  const opp = state.opponents.find(o => o.id === e.opponentId && !o.deletedAt)
  return (
    <div className="detail-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Event details">
        <dl className="kv">
          <dt>Team</dt><dd><Link className="link" to={`/teams/${e.teamId}`}>{teamName ?? `${e.sport} ${e.level}`}</Link></dd>
          <dt>{e.eventKind === 'single' ? 'Opponent' : 'Event'}</dt>
          <dd>{opp ? <Link className="link" to={`/opponents?open=${opp.id}`}>{e.opponent}</Link> : e.opponent}</dd>
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
          {e.eventKind !== 'noncomp' && (<>
          <dt>Result</dt>
          <dd>{score ? <strong>{score.result} {score.us}–{score.them}</strong> : <span className="muted">Not played</span>}</dd>
          </>)}
        </dl>
        {e.notes && (<><div className="divider" /><div className="small"><strong>Notes:</strong> {e.notes}</div></>)}
      </Card>
      {opp && (opp.mascot || opp.address || opp.website || opp.notes) && (
        <Card title={`About ${opp.name}`} action={<Link className="card-link" to={`/opponents?open=${opp.id}`}>Full profile →</Link>}>
          <dl className="kv">
            {opp.mascot && (<><dt>Mascot</dt><dd>{opp.mascot}</dd></>)}
            {opp.colors && (<><dt>Colors</dt><dd>{opp.colors}</dd></>)}
            {e.homeAway !== 'home' && opp.address && (<>
              <dt>Location</dt>
              <dd>
                {opp.address}{' · '}
                <a className="link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opp.address)}`} target="_blank" rel="noreferrer">Google Maps <I.external /></a>
              </dd>
            </>)}
            {opp.website && (<><dt>Website</dt><dd><a className="link" href={opp.website} target="_blank" rel="noreferrer">{opp.website.replace('https://', '')} <I.external /></a></dd></>)}
          </dl>
          {opp.notes && <p className="small muted" style={{ marginBottom: 0 }}><strong>Notes:</strong> {opp.notes}</p>}
        </Card>
      )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GameMomentsCard e={e} editable={editable} />
        {showSponsors && (
        <Card title="Sponsor activations" action={<Link className="card-link" to={`/events/${e.id}?tab=sponsors`}>Manage →</Link>}>
          {e.sponsorActivations.length === 0
            ? <p className="small muted" style={{ margin: 0 }}>No game-specific sponsor activations. Tier benefits (video board, PA rotation) run automatically.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {e.sponsorActivations.map(a => {
                  const sp = state.sponsors.find(x => x.id === a.sponsorId)
                  return (
                    <div key={a.id} className="small">
                      <Link className="link" to={`/sponsors/${a.sponsorId}`}><strong>{sp?.name}</strong></Link> — {a.activation}
                      {a.notes && <div className="tiny">{a.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}
        </Card>
        )}
        <Card title="Staffing at a glance" action={<Link className="card-link" to={`/events/${e.id}?tab=staffing`}>Manage →</Link>}>
          {e.staffSlots.length === 0
            ? <p className="small muted" style={{ margin: 0 }}>No staff plan for this event{e.homeAway !== 'home' ? ' (away game)' : ''}.</p>
            : <StaffGlance e={e} />}
        </Card>
        {broadcastState(e) !== 'none' && <BroadcastSetupCard e={e} editable={editable} />}
      </div>
    </div>
  )
}

function StaffGlance({ e }: { e: SportEvent }) {
  const { state } = useStore()
  const groups: { label: string; tone: 'ok' | 'warn' | 'danger'; slots: StaffSlot[] }[] = [
    { label: 'Confirmed', tone: 'ok', slots: e.staffSlots.filter(s => s.status === 'confirmed') },
    { label: 'Assigned', tone: 'warn', slots: e.staffSlots.filter(s => s.status === 'assigned') },
    { label: 'Open', tone: 'danger', slots: e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined') },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.filter(g => g.slots.length > 0).map(g => (
        <div key={g.label}>
          <Badge tone={g.tone}>{g.label} · {g.slots.length}</Badge>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {g.slots.map(slot => {
              const u = state.users.find(x => x.id === slot.userId)
              return (
                <div key={slot.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span className="muted">{slot.role}</span>
                  <span style={{ fontWeight: 600 }}>{u?.name ?? '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const MOMENT_TIMINGS = ['Pregame', 'End of Q1', 'Between Q1 & Q2', 'Halftime', 'Between Q3 & Q4', 'Between sets', 'Postgame']

function GameMomentsCard({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, logActivity, toast } = useStore()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', timing: 'Halftime', notes: '' })
  const setMoments = (m: GameMoment[]) => update('events', e.id, { gameMoments: m } as Partial<SportEvent>)
  return (
    <Card title="Special moments" action={editable && !adding && (
      <button className="btn sm" onClick={() => setAdding(true)}><I.plus /> Add</button>
    )}>
      {e.gameMoments.length === 0 && !adding && (
        <p className="small muted" style={{ margin: 0 }}>
          Nothing special planned in-game. Use this for recognitions, check presentations, honor groups — anything that needs
          planning and contacts before gameday.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {e.gameMoments.map(m => {
          const owner = state.users.find(u => u.id === m.ownerId)
          return (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Badge tone="warn">{m.timing}</Badge>
              <span style={{ flex: 1 }} className="small">
                <strong>{m.title}</strong>
                {m.notes && <div className="tiny">{m.notes}</div>}
                {owner && <div className="tiny">Owner: {owner.name}</div>}
              </span>
              {editable && <button className="btn sm ghost" aria-label="Remove moment" onClick={() => { setMoments(e.gameMoments.filter(x => x.id !== m.id)); toast('Special moment removed') }}><I.x /></button>}
            </div>
          )
        })}
      </div>
      {adding && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="input" autoFocus placeholder="What's happening? e.g. Honor 2016 state championship team" value={draft.title} onChange={ev => setDraft(d => ({ ...d, title: ev.target.value }))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="inline-select" value={draft.timing} onChange={ev => setDraft(d => ({ ...d, timing: ev.target.value }))} aria-label="Timing">
              {MOMENT_TIMINGS.map(t => <option key={t}>{t}</option>)}
            </select>
            <input className="input" style={{ flex: 1 }} placeholder="Notes / contacts (optional)" value={draft.notes} onChange={ev => setDraft(d => ({ ...d, notes: ev.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary sm" onClick={() => {
              if (!draft.title.trim()) { toast('Describe the moment first', 'error'); return }
              setMoments([...e.gameMoments, { id: `gm-${Date.now()}`, title: draft.title.trim(), timing: draft.timing, notes: draft.notes.trim() || undefined, ownerId: state.currentUserId }])
              logActivity(`added special moment “${draft.title.trim()}” to ${eventTitle(e)}`, `/events/${e.id}`)
              toast('Special moment added')
              setDraft({ title: '', timing: 'Halftime', notes: '' })
              setAdding(false)
            }}>Save</button>
            <button className="btn sm ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  )
}

function BroadcastSetupCard({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { update, toast } = useStore()
  const list = e.broadcastChecklist ?? defaultBroadcastChecklist()
  const stateNow = broadcastState(e)
  const cycle = (item: BroadcastCheckItem) => {
    if (!editable || e.broadcastStatus === 'archived') return
    const next: BroadcastCheckItem['status'] = item.status === 'pending' ? 'ok' : item.status === 'ok' ? 'na' : 'pending'
    const updated = list.map(i => (i.id === item.id ? { ...i, status: next } : i))
    update('events', e.id, { broadcastChecklist: updated } as Partial<SportEvent>)
    if (updated.every(i => i.status !== 'pending')) toast('Broadcast fully confirmed')
  }
  return (
    <Card title="Broadcast setup" action={
      <Badge tone={stateNow === 'confirmed' ? 'ok' : stateNow === 'archived' ? 'neutral' : 'warn'}>
        {stateNow === 'confirmed' ? 'Confirmed' : stateNow === 'archived' ? 'Archived' : 'In progress'}
      </Badge>
    }>
      <p className="tiny" style={{ marginTop: 0 }}>A link alone doesn't confirm a broadcast — work each item, or mark it N/A. Click to cycle: pending → done → N/A.</p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {list.map(item => (
          <button key={item.id} className="checklist-item" style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: editable ? 'pointer' : 'default', padding: '7px 2px' }}
            onClick={() => cycle(item)} aria-label={`${item.label}: ${item.status}`}>
            <span className={`checkbox ${item.status === 'ok' ? 'checked' : ''}`} style={item.status === 'na' ? { background: 'var(--neutral-bg)', borderColor: 'var(--border-strong)' } : undefined}>
              {item.status === 'ok' && <I.check />}
              {item.status === 'na' && <span style={{ color: 'var(--text-3)', fontSize: '0.6rem', fontWeight: 700 }}>—</span>}
            </span>
            <span className="label small" style={item.status !== 'pending' ? { color: 'var(--text-3)' } : undefined}>{item.label}</span>
            {item.status === 'na' && <span className="tiny">N/A</span>}
          </button>
        ))}
      </div>
      {e.broadcastLink && (
        <p className="small" style={{ marginBottom: 0 }}>
          <a className="link" href={e.broadcastLink} target="_blank" rel="noreferrer">Broadcast link <I.external /></a>
        </p>
      )}
    </Card>
  )
}

function Staffing({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, logActivity, toast } = useStore()
  const [addingRole, setAddingRole] = useState<StaffRole>('Ticket Worker')
  // Anyone with a school account can be assigned to a gameday role
  const staffUsers = state.users.filter(u => u.orgId === e.orgId && u.status !== 'revoked')

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
                      logActivity(`assigned ${u?.name} as ${slot.role} for ${eventTitle(e, { short: true })}`, `/events/${e.id}`)
                      toast(`${u?.name} assigned`)
                    }
                  }} aria-label={`Assign ${slot.role}`}>
                  <option value="">— Unassigned —</option>
                  {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role]}</option>)}
                </select>
              ) : (
                <span style={{ flex: 1 }} className="small">{assigned?.name ?? '—'}</span>
              )}
              <Avatar user={assigned} size="sm" />
              {editable && slot.userId && slot.status !== 'confirmed' && (
                <button className="btn sm ghost" onClick={() => { setSlot(slot.id, { status: 'confirmed' }); toast('Marked confirmed') }}>Confirm</button>
              )}
              <StatusBadge status={slot.status} />
              {editable && (
                <button className="btn sm ghost" aria-label={`Remove ${slot.role} slot`} title="Remove this staffing slot" onClick={() => {
                  update('events', e.id, { staffSlots: e.staffSlots.filter(x => x.id !== slot.id) } as Partial<SportEvent>)
                  toast(`${slot.role} slot removed`)
                }}><I.x /></button>
              )}
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

const ACTIVATION_TYPES = ['Presenting sponsor', 'Halftime promotion', 'First Down sponsor', 'Check presentation', 'Giveaway night', 'Senior Night sponsor', 'National anthem sponsor', 'Other (describe in notes)']

function EventSponsors({ e, editable }: { e: SportEvent; editable: boolean }) {
  const { state, update, logActivity, toast } = useStore()
  const [draft, setDraft] = useState({ sponsorId: '', activation: ACTIVATION_TYPES[0], notes: '' })
  const committed = state.sponsors.filter(s => s.orgId === e.orgId && s.stage === 'committed')
  const setActs = (acts: SponsorActivation[]) => update('events', e.id, { sponsorActivations: acts } as Partial<SportEvent>)
  return (
    <div className="detail-grid">
      <Card title="Game-specific sponsor activations" pad={false}>
        <p className="small muted" style={{ margin: '12px 18px 4px' }}>
          Standard tier benefits (video-board rotation, PA reads, signage) run at every game automatically — don't list sponsors
          here just because they exist. Activate a sponsor only for something specific to <strong>this</strong> game.
        </p>
        {e.sponsorActivations.length === 0 && <Empty icon="◈" title="No game-specific activations" hint="e.g. a presenting sponsor, halftime promotion, or check presentation." />}
        {e.sponsorActivations.map(a => {
          const sp = state.sponsors.find(x => x.id === a.sponsorId)
          const ag = state.agreements.find(x => x.sponsorId === a.sponsorId)
          return (
            <div key={a.id} className="notif-item" style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>
                <Link className="link" to={`/sponsors/${a.sponsorId}`}><strong>{sp?.name}</strong></Link>
                {' — '}<span style={{ fontWeight: 600 }}>{a.activation}</span>
                {a.notes && <div className="tiny">{a.notes}</div>}
                <div className="tiny">{sp?.tier} tier · standard benefits run automatically</div>
              </span>
              {ag && <StatusBadge status={ag.paymentStatus} />}
              {sp && <StatusBadge status={sp.logoStatus} />}
              {editable && <button className="btn sm ghost" onClick={() => { setActs(e.sponsorActivations.filter(x => x.id !== a.id)); toast('Activation removed') }} aria-label="Remove activation"><I.x /></button>}
            </div>
          )
        })}
        {editable && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <select className="inline-select" value={draft.sponsorId} onChange={ev => setDraft(d => ({ ...d, sponsorId: ev.target.value }))} aria-label="Sponsor">
              <option value="">Choose sponsor…</option>
              {committed.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
            </select>
            <select className="inline-select" value={draft.activation} onChange={ev => setDraft(d => ({ ...d, activation: ev.target.value }))} aria-label="Activation type">
              {ACTIVATION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Notes (optional)" value={draft.notes} onChange={ev => setDraft(d => ({ ...d, notes: ev.target.value }))} />
            <button className="btn primary sm" onClick={() => {
              if (!draft.sponsorId) { toast('Choose a sponsor first', 'error'); return }
              setActs([...e.sponsorActivations, { id: `act-${Date.now()}`, sponsorId: draft.sponsorId, activation: draft.activation, notes: draft.notes.trim() || undefined }])
              logActivity(`activated ${state.sponsors.find(x => x.id === draft.sponsorId)?.name} (${draft.activation}) for ${eventTitle(e)}`, `/events/${e.id}?tab=sponsors`)
              toast('Sponsor activation added')
              setDraft({ sponsorId: '', activation: ACTIVATION_TYPES[0], notes: '' })
            }}><I.plus /> Activate</button>
          </div>
        )}
      </Card>
      <Card title="What runs automatically">
        <p className="small muted" style={{ marginTop: 0 }}>Every committed sponsor's tier benefits are fulfilled across the season without per-game assignment:</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}>
          <li>Video-board rotation before and during breaks</li>
          <li>PA reads from the approved script</li>
          <li>Static signage and website placement</li>
        </ul>
        <div className="divider" />
        <p className="tiny" style={{ margin: 0 }}>Track those season-long obligations on each sponsor's fulfillment checklist.</p>
      </Card>
    </div>
  )
}

function EventTasks({ e, tasks, editable }: { e: SportEvent; tasks: Task[]; editable: boolean }) {
  const { state, update, add, remove, toast } = useStore()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ContentKind | 'task'>('task')
  const [err, setErr] = useState('')
  const contentKinds: ContentKind[] = ['Gameday Post', 'Final Score', 'Ticket Link Promo', 'Broadcast Link', 'Sponsor Recognition', 'Results Post', 'Photo Gallery']

  return (
    <Card title="Tasks & content reminders" pad={false}>
      {tasks.length === 0 && <Empty icon="☑" title="Nothing tracked for this event yet" hint="Add operational tasks or social content reminders below." />}
      {tasks.map(t => {
        const assignee = state.users.find(u => u.id === t.assigneeId)
        const due = relDue(t.dueDate, todayISO())
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
            {editable && (
              <button className="btn sm ghost" aria-label="Delete task" title="Delete this task" onClick={() => {
                remove('tasks', t.id)
                toast('Removed from event checklist')
              }}><I.x /></button>
            )}
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
            const finalTitle = title.trim() || (kind !== 'task' ? `${kind} — ${eventTitle(e, { short: true })}` : '')
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
    logActivity(`posted final score ${u}–${t} for ${eventTitle(e, { short: true })}`, `/events/${e.id}`)
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
              {e.date > todayISO() ? 'This event hasn\'t been played yet.' : 'Enter the final score when the game wraps.'}
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
