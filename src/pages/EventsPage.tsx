import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { events as allEvents, can } from '../lib/derive'
import { fmtDate, fmtTime } from '../lib/dates'
import { Badge, Field, HomeAwayBadge, Modal, SearchBox, Seg, StatusBadge } from '../components/ui'
import { I } from '../components/icons'
import type { SportEvent } from '../types'

export default function EventsPage() {
  const { state, add, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [sport, setSport] = useState('')
  const [creating, setCreating] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!

  const list = useMemo(() => {
    let evs = allEvents(state)
    if (scope === 'upcoming') evs = evs.filter(e => e.date >= state.demoToday)
    if (scope === 'past') evs = evs.filter(e => e.date < state.demoToday)
    if (sport) evs = evs.filter(e => e.sport === sport)
    const term = q.trim().toLowerCase()
    if (term) evs = evs.filter(e => [e.opponent, e.sport, e.venue, e.level, e.designation].some(s => s?.toLowerCase().includes(term)))
    return evs.sort((a, b) => scope === 'past'
      ? b.date.localeCompare(a.date)
      : (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
  }, [state, q, scope, sport])

  const sports = [...new Set(allEvents(state).map(e => e.sport))].sort()

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-sub">{allEvents(state).length} events on the Fall 2026 composite schedule.</p>
        </div>
        {can(me.role, 'edit') && (
          <button className="btn primary" onClick={() => setCreating(true)}><I.plus /> New event</button>
        )}
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search opponent, venue…" />
        <select className="inline-select" value={sport} onChange={e => setSport(e.target.value)} aria-label="Sport filter">
          <option value="">All sports</option>
          {sports.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="spacer" />
        <Seg options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'all', label: 'All' }]} value={scope} onChange={setScope} />
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Time</th><th>Matchup</th><th>Venue</th><th>H/A</th><th>Staffing</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={7}><div className="empty"><h4>No events match</h4><p>Adjust the search or filters.</p></div></td></tr>
            )}
            {list.map(e => {
              const open = e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length
              return (
                <tr key={e.id} className="clickable" onClick={() => navigate(`/events/${e.id}`)}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                  <td>{fmtTime(e.time)}</td>
                  <td>
                    <span className="primary">{e.sport} {e.level !== 'Varsity' ? `(${e.level})` : ''} {e.homeAway === 'home' ? 'vs' : e.homeAway === 'away' ? 'at' : '·'} {e.opponent}</span>
                    {e.designation && <> <Badge tone="brand">{e.designation}</Badge></>}
                  </td>
                  <td className="muted">{e.venue}</td>
                  <td><HomeAwayBadge ha={e.homeAway} /></td>
                  <td>
                    {e.staffSlots.length === 0 ? <span className="tiny">—</span>
                      : open > 0 ? <Badge tone="danger">{open} open</Badge> : <Badge tone="ok">Covered</Badge>}
                  </td>
                  <td>{e.score ? <Badge tone={e.score.result === 'W' ? 'ok' : 'danger'}>{e.score.result} {e.score.us}–{e.score.them}</Badge> : <StatusBadge status={e.status} />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <EventForm
          onClose={() => setCreating(false)}
          onSave={ev => {
            add('events', ev)
            logActivity(`created event ${ev.sport} vs ${ev.opponent}`, `/events/${ev.id}`)
            toast('Event created')
            setCreating(false)
            navigate(`/events/${ev.id}`)
          }}
        />
      )}
    </>
  )
}

export function EventForm({ initial, onClose, onSave }: { initial?: SportEvent; onClose: () => void; onSave: (e: SportEvent) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState(() => initial ?? {
    id: `ev-new-${Date.now()}`, orgId: state.currentOrgId, teamId: state.teams[0]?.id ?? '',
    sport: state.teams[0]?.sport ?? '', level: state.teams[0]?.level ?? 'Varsity',
    date: state.demoToday, time: '19:00', homeAway: 'home', opponent: '', venue: 'Waldrop Stadium',
    status: 'scheduled', broadcastStatus: 'none', staffSlots: [], runOfShow: [], sponsorIds: [],
  } as SportEvent)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<SportEvent>) => setForm(f => ({ ...f, ...patch }))

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.opponent.trim()) errs.opponent = 'Opponent (or event name) is required.'
    if (!form.date) errs.date = 'Date is required.'
    if (!form.venue.trim()) errs.venue = 'Venue is required.'
    if (form.ticketLink && !/^https?:\/\//.test(form.ticketLink)) errs.ticketLink = 'Must be a full URL starting with http(s)://'
    if (form.broadcastLink && !/^https?:\/\//.test(form.broadcastLink)) errs.broadcastLink = 'Must be a full URL starting with http(s)://'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave(form)
  }

  return (
    <Modal title={initial ? 'Edit event' : 'New event'} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>{initial ? 'Save changes' : 'Create event'}</button>
      </>
    }>
      <div className="form-row">
        <Field label="Team" required>
          <select value={form.teamId} onChange={e => {
            const t = state.teams.find(x => x.id === e.target.value)
            set({ teamId: e.target.value, sport: t?.sport ?? form.sport, level: t?.level ?? form.level })
          }}>
            {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Opponent / event name" required error={errors.opponent}>
          <input value={form.opponent} onChange={e => set({ opponent: e.target.value })} placeholder="e.g. Vestavia Hills" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Date" required error={errors.date}>
          <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} />
        </Field>
        <Field label="Time">
          <input type="time" value={form.time ?? ''} onChange={e => set({ time: e.target.value || null })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Home / away" required>
          <select value={form.homeAway} onChange={e => set({ homeAway: e.target.value as SportEvent['homeAway'] })}>
            <option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option><option value="tbd">TBD</option>
          </select>
        </Field>
        <Field label="Venue" required error={errors.venue}>
          <input value={form.venue} onChange={e => set({ venue: e.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Status">
          <select value={form.status} onChange={e => set({ status: e.target.value as SportEvent['status'] })}>
            <option value="scheduled">Scheduled</option><option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option><option value="postponed">Postponed</option><option value="canceled">Canceled</option>
          </select>
        </Field>
        <Field label="Special designation">
          <input value={form.designation ?? ''} onChange={e => set({ designation: e.target.value || undefined })} placeholder="e.g. Homecoming, Senior Night" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Ticket link" error={errors.ticketLink}>
          <input value={form.ticketLink ?? ''} onChange={e => set({ ticketLink: e.target.value || undefined })} placeholder="https://gofan.co/…" />
        </Field>
        <Field label="Broadcast link" error={errors.broadcastLink}>
          <input value={form.broadcastLink ?? ''} onChange={e => {
            const v = e.target.value
            set({ broadcastLink: v || undefined, broadcastStatus: v ? (form.broadcastStatus === 'none' ? 'planned' : form.broadcastStatus) : 'none' })
          }} placeholder="https://nfhsnetwork.com/…" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={2} value={form.notes ?? ''} onChange={e => set({ notes: e.target.value || undefined })} placeholder="Bus times, gate details, special instructions…" />
      </Field>
    </Modal>
  )
}
