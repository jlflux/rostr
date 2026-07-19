import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { events as allEvents, venueConflicts } from '../lib/derive'
import { addDays, fmtDate, parseISO, toISO, weekStart } from '../lib/dates'
import { Badge, Empty, Seg } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { I } from '../components/icons'
import type { SportEvent } from '../types'

type View = 'month' | 'week' | 'agenda'

const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Filters {
  sport: string; team: string; type: string; ha: string; venue: string; broadcast: string; staffing: string
}
const NO_FILTERS: Filters = { sport: '', team: '', type: '', ha: '', venue: '', broadcast: '', staffing: '' }

export default function CalendarPage() {
  const { state } = useStore()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(state.demoToday)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const conflicts = useMemo(() => venueConflicts(state), [state])

  const evs = useMemo(() => {
    let list = allEvents(state)
    if (filters.sport) list = list.filter(e => e.sport === filters.sport)
    if (filters.team) list = list.filter(e => e.teamId === filters.team)
    if (filters.type) list = list.filter(e => filters.type === 'special' ? !!e.designation || !!e.multiDay : !e.designation && !e.multiDay)
    if (filters.ha) list = list.filter(e => e.homeAway === filters.ha)
    if (filters.venue) list = list.filter(e => e.venue === filters.venue)
    if (filters.broadcast) list = list.filter(e => filters.broadcast === 'yes' ? e.broadcastStatus !== 'none' : e.broadcastStatus === 'none')
    if (filters.staffing) list = list.filter(e => {
      const open = e.staffSlots.some(s => s.status === 'unfilled' || s.status === 'declined')
      return filters.staffing === 'gaps' ? open : !open
    })
    return list.sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
  }, [state, filters])

  const sports = [...new Set(allEvents(state).map(e => e.sport))].sort()
  const venues = [...new Set(allEvents(state).filter(e => e.homeAway === 'home').map(e => e.venue))].sort()
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const sel = (key: keyof Filters, label: string, opts: { v: string; l: string }[]) => (
    <select className="inline-select" value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} aria-label={label}>
      <option value="">{label}</option>
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  )

  const shift = (dir: number) => {
    if (view === 'month') {
      const d = parseISO(anchor); d.setDate(1); d.setMonth(d.getMonth() + dir)
      setAnchor(toISO(d))
    } else setAnchor(addDays(anchor, dir * 7))
  }

  const monthLabel = parseISO(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const wkStart = weekStart(anchor)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Master calendar</h1>
          <p className="page-sub">Every event across every program, in one place.</p>
        </div>
        <Seg options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'agenda', label: 'Agenda' }]} value={view} onChange={setView} />
      </div>

      <div className="toolbar">
        <button className="iconbtn" onClick={() => shift(-1)} aria-label="Previous"><I.left /></button>
        <button className="iconbtn" onClick={() => shift(1)} aria-label="Next"><I.right /></button>
        <button className="btn sm" onClick={() => setAnchor(state.demoToday)}>Today</button>
        <strong style={{ fontSize: '1rem' }}>{view === 'week' ? `Week of ${fmtDate(wkStart, { month: 'long', day: 'numeric' })}` : monthLabel}</strong>
        <div className="spacer" />
        {sel('sport', 'All sports', sports.map(s => ({ v: s, l: s })))}
        {sel('team', 'All teams', state.teams.map(t => ({ v: t.id, l: t.name })))}
        {sel('type', 'Event type', [{ v: 'special', l: 'Special / tournament' }, { v: 'regular', l: 'Regular' }])}
        {sel('ha', 'Home & away', [{ v: 'home', l: 'Home' }, { v: 'away', l: 'Away' }, { v: 'neutral', l: 'Neutral' }])}
        {sel('venue', 'All venues', venues.map(v => ({ v, l: v })))}
        {sel('staffing', 'Staffing', [{ v: 'gaps', l: 'Has gaps' }, { v: 'covered', l: 'Covered' }])}
        {activeFilterCount > 0 && <button className="btn sm ghost" onClick={() => setFilters(NO_FILTERS)}>Clear ({activeFilterCount})</button>}
      </div>

      {conflicts.size > 0 && !activeFilterCount && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--warn)' }}>
          <span style={{ color: 'var(--warn)' }}><I.warn /></span>
          <span className="small"><strong>{conflicts.size} events</strong> share a venue within 2 hours of another program's event. They're flagged on the calendar below.</span>
        </div>
      )}

      {view === 'month' && <MonthGrid anchor={anchor} events={evs} today={state.demoToday} conflicts={conflicts} />}
      {view === 'week' && <WeekList start={wkStart} events={evs} conflicts={conflicts} />}
      {view === 'agenda' && <Agenda events={evs.filter(e => e.date >= state.demoToday)} conflicts={conflicts} />}
    </>
  )
}

function MonthGrid({ anchor, events, today, conflicts }: { anchor: string; events: SportEvent[]; today: string; conflicts: Map<string, string[]> }) {
  const first = parseISO(anchor); first.setDate(1)
  const start = weekStart(toISO(first))
  const month = first.getMonth()
  const cells: string[] = []
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i))
  const byDate = new Map<string, SportEvent[]>()
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="cal-grid">
        {DOWS.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map(iso => {
          const inMonth = parseISO(iso).getMonth() === month
          const dayEvents = byDate.get(iso) ?? []
          return (
            <div key={iso} className={`cal-cell ${inMonth ? '' : 'other'} ${iso === today ? 'today' : ''}`}>
              <div className="cal-date">
                <span>{parseISO(iso).getDate()}</span>
                {iso === today && <Badge tone="brand">Today</Badge>}
              </div>
              {dayEvents.slice(0, 3).map(e => (
                <Link key={e.id} to={`/events/${e.id}`} className={`cal-ev ${e.homeAway === 'home' ? 'home' : ''} ${conflicts.has(e.id) ? 'conflict' : ''}`}
                  title={`${e.sport} ${e.level} ${e.homeAway === 'home' ? 'vs' : 'at'} ${e.opponent}`}>
                  {e.sport === 'Cross Country' ? 'XC' : e.sport}{e.level !== 'Varsity' ? ` ${e.level === 'Freshman' ? 'Fr' : e.level}` : ''} · {e.opponent}
                </Link>
              ))}
              {dayEvents.length > 3 && <span className="cal-more">+{dayEvents.length - 3} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekList({ start, events, conflicts }: { start: string; events: SportEvent[]; conflicts: Map<string, string[]> }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDate = new Map<string, SportEvent[]>()
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])
  return (
    <div>
      {days.map(iso => {
        const dayEvents = byDate.get(iso) ?? []
        return (
          <div key={iso} className="agenda-day">
            <div className="agenda-date">{fmtDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            {dayEvents.length === 0 && <div className="tiny" style={{ padding: '2px 6px 8px' }}>No events</div>}
            {dayEvents.map(e => <EventRow key={e.id} e={e} conflict={conflicts.has(e.id)} />)}
          </div>
        )
      })}
    </div>
  )
}

function Agenda({ events, conflicts }: { events: SportEvent[]; conflicts: Map<string, string[]> }) {
  if (events.length === 0) return <div className="card"><Empty title="No upcoming events match these filters" hint="Try clearing filters or moving to another week." /></div>
  const byDate = new Map<string, SportEvent[]>()
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])
  return (
    <div>
      {[...byDate.entries()].slice(0, 20).map(([iso, dayEvents]) => (
        <div key={iso} className="agenda-day">
          <div className="agenda-date">{fmtDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          {dayEvents.map(e => <EventRow key={e.id} e={e} conflict={conflicts.has(e.id)} />)}
        </div>
      ))}
    </div>
  )
}
