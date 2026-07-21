import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { activeOpponents, events as allEvents, can, eventTitle, matchupLabel, trashedEvents, visibleScore, visibleStatus } from '../lib/derive'
import { addDays, fmtDate, fmtTime } from '../lib/dates'
import { Badge, Card, Empty, Field, HomeAwayBadge, Modal, SearchBox, Seg, StatusBadge } from '../components/ui'
import { I, SportIcon } from '../components/icons'
import type { EventKind, GameType, Opponent, SportEvent } from '../types'

const OPP_TINTS = ['#b45309', '#166534', '#1d4ed8', '#7c3aed', '#be185d', '#0e7490', '#ca8a04', '#4d7c0f']

export default function EventsPage() {
  const { state, add, setState, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [sport, setSport] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const editable = can(me.role, 'edit')
  const trash = trashedEvents(state)

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
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setImporting(true)}>Import schedule</button>
            <button className="btn primary" onClick={() => setCreating(true)}><I.plus /> New event</button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search opponent, venue…" />
        <select className="inline-select" value={sport} onChange={e => setSport(e.target.value)} aria-label="Sport filter">
          <option value="">All sports</option>
          {sports.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="spacer" />
        {editable && <button className={`chip ${showTrash ? 'active' : ''}`} onClick={() => setShowTrash(v => !v)}>Trash ({trash.length})</button>}
        <Seg options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'all', label: 'All' }]} value={scope} onChange={setScope} />
      </div>

      {showTrash && <EventsTrash />}

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Matchup</th><th>H/A</th><th>Venue</th><th>Staffing</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6}><div className="empty"><h4>No events match</h4><p>Adjust the search or filters.</p></div></td></tr>
            )}
            {list.map(e => {
              const open = e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length
              const score = visibleScore(state, e)
              return (
                <tr key={e.id} className="clickable" onClick={() => navigate(`/events/${e.id}`)}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 750 }}>{fmtDate(e.date)}</div>
                    <div className="tiny">{fmtTime(e.time)}</div>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SportIcon sport={e.sport} />
                      <span>
                        <span className="primary">{matchupLabel(e)}</span>
                        {(e.gameType === 'region' || e.gameType === 'area') && <> <Badge tone="navy">{e.gameType === 'region' ? 'Region' : 'Area'}</Badge></>}
                        {e.designation && <> <Badge tone="brand">{e.designation}</Badge></>}
                      </span>
                    </span>
                  </td>
                  <td><HomeAwayBadge ha={e.homeAway} /></td>
                  <td className={e.homeAway === 'home' ? '' : 'muted'} style={e.homeAway === 'home' ? { fontWeight: 700 } : undefined}>{e.venue}</td>
                  <td>
                    {e.staffSlots.length === 0 ? <span className="tiny">—</span>
                      : open > 0 ? <Badge tone="danger">{open} open</Badge> : <Badge tone="ok">Covered</Badge>}
                  </td>
                  <td>{score ? <Badge tone={score.result === 'W' ? 'ok' : 'danger'}>{score.result} {score.us}–{score.them}</Badge> : <StatusBadge status={visibleStatus(state, e)} />}</td>
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
      {importing && <ImportScheduleModal onClose={() => setImporting(false)} />}
    </>
  )
}

function EventsTrash() {
  const { state, update, remove, toast } = useStore()
  const trash = trashedEvents(state).sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  return (
    <Card title="Trash" pad={false}>
      <p className="small muted" style={{ margin: '12px 18px 4px' }}>Deleted events are kept for 30 days, then removed permanently.</p>
      {trash.length === 0 && <Empty icon="🗑" title="Trash is empty" />}
      {trash.map(e => (
        <div key={e.id} className="notif-item" style={{ alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            <strong>{eventTitle(e, { short: true })}</strong>
            <div className="tiny">{fmtDate(e.date)} · deleted {fmtDate(e.deletedAt!)} · auto-removes {fmtDate(addDays(e.deletedAt!, 30))}</div>
          </span>
          <button className="btn sm" onClick={() => { update('events', e.id, { deletedAt: undefined }); toast('Event restored') }}>Restore</button>
          <button className="btn sm danger" onClick={() => { remove('events', e.id); toast('Event permanently deleted', 'error') }}>Delete forever</button>
        </div>
      ))}
    </Card>
  )
}

/** Opponent picker with an inline "Add new opponent" flow. */
function OpponentPicker({ value, name, onPick, error }: {
  value?: string; name: string; onPick: (id: string | undefined, name: string) => void; error?: string
}) {
  const { state, add } = useStore()
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const opponents = activeOpponents(state).sort((a, b) => a.name.localeCompare(b.name))
  const current = state.opponents.find(o => o.id === value)

  const createOpponent = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const existing = opponents.find(o => o.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      onPick(existing.id, existing.name)
    } else {
      const opp: Opponent = {
        id: `opp-new-${Date.now()}`, orgId: state.currentOrgId, name: trimmed,
        tint: OPP_TINTS[Math.floor(Math.random() * OPP_TINTS.length)],
      }
      add('opponents', opp)
      onPick(opp.id, opp.name)
    }
    setAddingNew(false)
    setNewName('')
  }

  return (
    <Field label="Opponent / event name" required error={error}>
      {!addingNew ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ flex: 1 }} value={value ?? (name && !current ? '__freetext' : '')} onChange={e => {
            if (e.target.value === '__new') { setAddingNew(true); return }
            const opp = state.opponents.find(o => o.id === e.target.value)
            onPick(opp?.id, opp?.name ?? '')
          }}>
            <option value="">— Select opponent —</option>
            {name && !current && <option value="__freetext">{name}</option>}
            {opponents.map(o => <option key={o.id} value={o.id}>{o.name}{o.logoAssetId ? '' : ' (no logo)'}</option>)}
            <option value="__new">+ Add new opponent…</option>
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input autoFocus style={{ flex: 1 }} className="input" placeholder="New opponent name" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createOpponent()} />
          <button type="button" className="btn sm primary" onClick={createOpponent} disabled={!newName.trim()}>Add</button>
          <button type="button" className="btn sm ghost" onClick={() => setAddingNew(false)}>Cancel</button>
        </div>
      )}
    </Field>
  )
}

/** Pick 2+ opponents for tri/quad matches, with an inline add-new. */
function MultiOpponentPicker({ value, error, onChange }: {
  value: string[]; error?: string; onChange: (ids: string[], names: string[]) => void
}) {
  const { state, add } = useStore()
  const [newName, setNewName] = useState('')
  const opponents = activeOpponents(state).sort((a, b) => a.name.localeCompare(b.name))
  const nameOf = (id: string) => state.opponents.find(o => o.id === id)?.name ?? ''
  const emit = (ids: string[]) => onChange(ids, ids.map(nameOf))
  const toggle = (id: string) => emit(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  const addNew = () => {
    const t = newName.trim()
    if (!t) return
    const existing = opponents.find(o => o.name.toLowerCase() === t.toLowerCase())
    if (existing) { if (!value.includes(existing.id)) emit([...value, existing.id]) }
    else {
      const opp: Opponent = { id: `opp-new-${Date.now()}`, orgId: state.currentOrgId, name: t, tint: OPP_TINTS[Math.floor(Math.random() * OPP_TINTS.length)] }
      add('opponents', opp)
      emit([...value, opp.id])
    }
    setNewName('')
  }
  return (
    <Field label="Opponents (choose 2 or more)" required error={error}>
      <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', padding: '4px 0' }}>
        {opponents.map(o => (
          <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
            {o.name}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Add a new opponent…" value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNew() } }} />
        <button type="button" className="btn sm" onClick={addNew} disabled={!newName.trim()}>Add</button>
      </div>
      {value.length > 0 && <div className="tiny" style={{ marginTop: 6 }}>{value.length} selected: {value.map(nameOf).join(', ')}</div>}
    </Field>
  )
}

export function EventForm({ initial, onClose, onSave }: { initial?: SportEvent; onClose: () => void; onSave: (e: SportEvent) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState(() => initial ?? {
    id: `ev-new-${Date.now()}`, orgId: state.currentOrgId, teamId: state.teams[0]?.id ?? '',
    sport: state.teams[0]?.sport ?? '', level: state.teams[0]?.level ?? 'Varsity',
    date: state.demoToday, time: '19:00', homeAway: 'home', eventKind: 'single', opponent: '', venue: 'Waldrop Stadium',
    gameType: 'non', status: 'scheduled', broadcastStatus: 'none', staffSlots: [], runOfShow: [],
    sponsorActivations: [], gameMoments: [],
  } as SportEvent)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<SportEvent>) => setForm(f => ({ ...f, ...patch }))

  const submit = () => {
    const errs: Record<string, string> = {}
    if (form.eventKind === 'multi') { if ((form.opponentIds ?? []).length < 2) errs.opponent = 'Pick at least two opponents.' }
    else if (!form.opponent.trim()) errs.opponent = form.eventKind === 'single' ? 'Select an opponent or add a new one.' : 'Give the event a name.'
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
        <Field label="Event type" required>
          <select value={form.eventKind} onChange={e => {
            const eventKind = e.target.value as EventKind
            set({ eventKind, opponentId: undefined, opponentIds: undefined, opponent: '' })
          }}>
            <option value="single">Single opponent</option>
            <option value="multi">Multi-opponent (tri / quad match)</option>
            <option value="tournament">Tournament</option>
            <option value="noncomp">Non-competition event</option>
          </select>
        </Field>
      </div>
      {form.eventKind === 'single' && (
        <OpponentPicker value={form.opponentId} name={form.opponent} error={errors.opponent}
          onPick={(opponentId, name) => set({ opponentId, opponent: name })} />
      )}
      {form.eventKind === 'multi' && (
        <MultiOpponentPicker value={form.opponentIds ?? []} error={errors.opponent}
          onChange={(ids, names) => set({ opponentIds: ids, opponent: names.join(', ') })} />
      )}
      {(form.eventKind === 'tournament' || form.eventKind === 'noncomp') && (
        <Field label={form.eventKind === 'tournament' ? 'Tournament / meet name' : 'Event name'} required error={errors.opponent}>
          <input value={form.opponent} onChange={e => set({ opponent: e.target.value, opponentId: undefined })}
            placeholder={form.eventKind === 'tournament' ? 'e.g. Coach Wood Invitational' : 'e.g. Fan Day & Media Night'} />
        </Field>
      )}
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
        <Field label="Game type">
          <select value={form.gameType ?? 'non'} onChange={e => set({ gameType: e.target.value as GameType })}>
            <option value="non">Non-region / non-area</option>
            <option value="region">Region game</option>
            <option value="area">Area game</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={e => set({ status: e.target.value as SportEvent['status'] })}>
            <option value="scheduled">Scheduled</option><option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option><option value="postponed">Postponed</option><option value="canceled">Canceled</option>
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Special designation">
          <input value={form.designation ?? ''} onChange={e => set({ designation: e.target.value || undefined })} placeholder="e.g. Homecoming, Senior Night" />
        </Field>
        <Field label="Ticket link" error={errors.ticketLink}>
          <input value={form.ticketLink ?? ''} onChange={e => set({ ticketLink: e.target.value || undefined })} placeholder="https://gofan.co/…" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Broadcast link" error={errors.broadcastLink}>
          <input value={form.broadcastLink ?? ''} onChange={e => {
            const v = e.target.value
            set({ broadcastLink: v || undefined, broadcastStatus: v ? (form.broadcastStatus === 'none' ? 'planned' : form.broadcastStatus) : 'none' })
          }} placeholder="https://nfhsnetwork.com/…" />
        </Field>
        <Field label="Notes">
          <input value={form.notes ?? ''} onChange={e => set({ notes: e.target.value || undefined })} placeholder="Bus times, gate details…" />
        </Field>
      </div>
    </Modal>
  )
}

// ---------- Spreadsheet (CSV) schedule import ----------

interface ParsedRow {
  line: number
  event?: SportEvent
  newOpponent?: string
  error?: string
  raw: string
}

/** Minimal CSV line parser that handles quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = false
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function parseDate(v: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

function parseTime(v: string): string | null | 'invalid' {
  if (!v) return null
  const m = v.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (!m) return 'invalid'
  let h = Number(m[1])
  const ampm = m[3]?.toLowerCase()
  if (ampm === 'pm' && h < 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  // No am/pm marker: assume afternoon for 1:00–8:59 (typical game times)
  if (!ampm && h >= 1 && h <= 8) h += 12
  if (h > 23 || Number(m[2]) > 59) return 'invalid'
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

function ImportScheduleModal({ onClose }: { onClose: () => void }) {
  const { state, setState, logActivity, toast } = useStore()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parse = (input: string) => {
    const lines = input.split(/\r?\n/).filter(l => l.trim())
    if (lines.length === 0) { setRows([]); return }
    const header = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
    const col = (names: string[]) => header.findIndex(h => names.includes(h))
    const ci = {
      date: col(['date']), time: col(['time']), sport: col(['sport']),
      level: col(['level']), ha: col(['homeaway', 'ha', 'homeoraway']),
      opponent: col(['opponent', 'opp']), venue: col(['venue', 'location']),
      type: col(['gametype', 'type', 'regionarea']), notes: col(['notes', 'note']),
    }
    if (ci.date < 0 || ci.sport < 0 || ci.opponent < 0) {
      setRows([{ line: 1, error: 'Header row must include at least Date, Sport, and Opponent columns.', raw: lines[0] }])
      return
    }
    const out: ParsedRow[] = []
    lines.slice(1).forEach((line, idx) => {
      const cells = splitCsvLine(line)
      const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')
      const raw = line
      const date = parseDate(get(ci.date))
      if (!date) { out.push({ line: idx + 2, error: `Unrecognized date “${get(ci.date)}” (use M/D/YYYY or YYYY-MM-DD)`, raw }); return }
      const time = parseTime(get(ci.time))
      if (time === 'invalid') { out.push({ line: idx + 2, error: `Unrecognized time “${get(ci.time)}” (use H:MM or H:MM PM)`, raw }); return }
      const sport = get(ci.sport)
      const level = get(ci.level) || 'Varsity'
      const team = state.teams.find(t => t.sport.toLowerCase() === sport.toLowerCase() && t.level.toLowerCase() === level.toLowerCase())
        ?? state.teams.find(t => t.sport.toLowerCase() === sport.toLowerCase())
      if (!team) { out.push({ line: idx + 2, error: `No team matches sport “${sport}” — add the team first in Teams`, raw }); return }
      const opponentName = get(ci.opponent)
      if (!opponentName) { out.push({ line: idx + 2, error: 'Opponent is blank', raw }); return }
      const haRaw = get(ci.ha).toLowerCase()
      const homeAway = ['home', 'h'].includes(haRaw) ? 'home' : ['away', 'a'].includes(haRaw) ? 'away' : haRaw === 'neutral' ? 'neutral' : 'tbd'
      const typeRaw = get(ci.type).toLowerCase()
      const gameType: GameType = typeRaw.includes('region') ? 'region' : typeRaw.includes('area') ? 'area' : 'non'
      const isTourney = /tournament|invitational|classic|jamboree|play date/i.test(opponentName)
      const existing = activeOpponents(state).find(o => o.name.toLowerCase() === opponentName.toLowerCase())
      out.push({
        line: idx + 2, raw,
        newOpponent: existing || isTourney ? undefined : opponentName,
        event: {
          id: `ev-imp-${Date.now()}-${idx}`, orgId: state.currentOrgId, teamId: team.id,
          sport: team.sport, level: team.level, date, time,
          homeAway,
          eventKind: /tournament|invitational|classic|jamboree|play date/i.test(opponentName) ? 'tournament' : 'single',
          opponent: opponentName, opponentId: existing?.id, gameType,
          venue: get(ci.venue) || (homeAway === 'home' ? 'Home venue' : 'TBD'),
          status: 'scheduled', broadcastStatus: 'none',
          notes: get(ci.notes) || undefined,
          staffSlots: [], runOfShow: [], sponsorActivations: [], gameMoments: [],
        },
      })
    })
    setRows(out)
  }

  const valid = rows?.filter(r => r.event) ?? []
  const invalid = rows?.filter(r => r.error) ?? []

  const doImport = () => {
    const newOpponents: Opponent[] = []
    const events: SportEvent[] = []
    for (const r of valid) {
      const e = r.event!
      if (r.newOpponent) {
        let opp = newOpponents.find(o => o.name.toLowerCase() === r.newOpponent!.toLowerCase())
        if (!opp) {
          opp = {
            id: `opp-imp-${Date.now()}-${newOpponents.length}`, orgId: state.currentOrgId,
            name: r.newOpponent, tint: OPP_TINTS[newOpponents.length % OPP_TINTS.length],
          }
          newOpponents.push(opp)
        }
        e.opponentId = opp.id
      }
      events.push(e)
    }
    setState({
      events: [...events, ...state.events],
      opponents: [...newOpponents, ...state.opponents],
    })
    logActivity(`imported ${events.length} events from a schedule spreadsheet`, '/events')
    toast(`${events.length} events imported${newOpponents.length ? ` · ${newOpponents.length} new opponents added` : ''}`)
    onClose()
  }

  return (
    <Modal title="Import schedule from spreadsheet" onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        {rows === null
          ? <button className="btn primary" onClick={() => parse(text)} disabled={!text.trim()}>Preview import</button>
          : <button className="btn primary" onClick={doImport} disabled={valid.length === 0}>Import {valid.length} event{valid.length === 1 ? '' : 's'}</button>}
      </>
    }>
      {rows === null ? (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>
            Upload a CSV file (in Excel or Google Sheets: <em>File → Save As / Download → CSV</em>) or paste rows below.
            Expected columns: <strong>Date, Time, Sport, Level, Home/Away, Opponent, Venue, Game Type, Notes</strong> — only Date, Sport
            and Opponent are required, and column order doesn't matter.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn" onClick={() => fileRef.current?.click()}>Choose CSV file…</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              const reader = new FileReader()
              reader.onload = () => { setText(String(reader.result ?? '')); parse(String(reader.result ?? '')) }
              reader.readAsText(f)
            }} />
            <button className="btn ghost" onClick={() => setText('Date,Time,Sport,Level,Home/Away,Opponent,Venue,Game Type\n11/6/2026,7:00 PM,Football,Varsity,Home,Vestavia Hills,Waldrop Stadium,Region\n11/13/2026,6:30 PM,Football,Varsity,Away,Hewitt-Trussville,Hewitt-Trussville Stadium,')}>Paste sample data</button>
          </div>
          <Field label="Or paste CSV rows (first row = headers)">
            <textarea rows={8} value={text} onChange={e => setText(e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              placeholder={'Date,Time,Sport,Level,Home/Away,Opponent,Venue\n11/6/2026,7:00 PM,Football,Varsity,Home,Vestavia Hills,Waldrop Stadium'} />
          </Field>
        </>
      ) : (
        <>
          <div className="pill-row" style={{ marginBottom: 10 }}>
            <Badge tone="ok">{valid.length} ready to import</Badge>
            {invalid.length > 0 && <Badge tone="danger">{invalid.length} row{invalid.length === 1 ? '' : 's'} skipped</Badge>}
            {valid.filter(r => r.newOpponent).length > 0 && <Badge tone="info">{new Set(valid.filter(r => r.newOpponent).map(r => r.newOpponent!.toLowerCase())).size} new opponents will be created</Badge>}
            <button className="btn sm ghost" onClick={() => setRows(null)}>← Edit data</button>
          </div>
          <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Row</th><th>Date</th><th>Matchup</th><th>Venue</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.line}>
                    <td className="tiny">{r.line}</td>
                    {r.event ? (
                      <>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.event.date)}{r.event.time ? ` · ${fmtTime(r.event.time)}` : ''}</td>
                        <td>{eventTitle(r.event)}
                          {r.newOpponent && <> <Badge tone="info">new opponent</Badge></>}
                          {r.event.gameType !== 'non' && <> <Badge tone="navy">{r.event.gameType}</Badge></>}
                        </td>
                        <td className="muted small">{r.event.venue}</td>
                        <td><Badge tone="ok">OK</Badge></td>
                      </>
                    ) : (
                      <td colSpan={4} style={{ color: 'var(--danger)' }} className="small">{r.error}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
