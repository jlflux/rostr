import React, { Fragment, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { ROLE_LABELS, broadcastState, can, currentUser, fmtWLT, hasGames, sortedByLastName, teamRecord, teams as allTeams, visibleScore, visibleStatus } from '../lib/derive'
import { fmtDate, fmtTime, todayISO } from '../lib/dates'
import { Avatar, Badge, Card, Empty, Field, HomeAwayBadge, Modal, SearchBox, StatusBadge } from '../components/ui'
import { splitCsvLine } from './EventsPage'
import { I } from '../components/icons'
import type { Athlete, Guardian, Team } from '../types'

// Offered sports, alphabetical. Used by the add-team picker.
export const SPORTS = [
  'Baseball', 'Basketball', 'Bowling', 'Cheerleading', 'Cross Country', 'Esports', 'Flag Football', 'Football',
  'Golf', 'Gymnastics', 'Indoor Track & Field', 'Lacrosse', 'Outdoor Track & Field', 'Soccer', 'Softball',
  'Swimming & Diving', 'Tennis', 'Volleyball', 'Wrestling',
]
export const TEAM_LEVELS: Team['level'][] = ['Varsity', 'JV', 'Freshman', '8th Grade', '7th Grade']
export const TEAM_GENDERS: { value: NonNullable<Team['gender']>; label: string }[] = [
  { value: 'Boys', label: 'Boys' }, { value: 'Girls', label: 'Girls' }, { value: 'Coed', label: 'Co-ed' },
]
const LEVEL_ORDER: Record<string, number> = { Varsity: 0, JV: 1, Freshman: 2, '8th Grade': 3, '7th Grade': 4 }
// Boys before girls before co-ed; anything without a gender set sorts last so it
// stands out as needing attention.
const GENDER_ORDER: Record<string, number> = { Boys: 0, Girls: 1, Coed: 2 }

/** The team name this sport/gender/level combination produces, e.g. "Varsity Girls Basketball". */
export function derivedTeamName(sport: string, gender: Team['gender'], level: Team['level']) {
  if (!sport) return ''
  const label = TEAM_GENDERS.find(g => g.value === gender)?.label ?? gender ?? ''
  return `${level} ${gender && gender !== 'Coed' ? label + ' ' : ''}${sport}`.replace(/\s+/g, ' ').trim()
}
const SPORT_SEASON: Record<string, Team['season']> = {
  Football: 'Fall', 'Flag Football': 'Fall', Volleyball: 'Fall', 'Cross Country': 'Fall', Cheerleading: 'Fall',
  Basketball: 'Winter', Bowling: 'Winter', 'Indoor Track & Field': 'Winter', Wrestling: 'Winter', 'Swimming & Diving': 'Winter', Esports: 'Winter', Gymnastics: 'Winter',
  Baseball: 'Spring', Golf: 'Spring', 'Outdoor Track & Field': 'Spring', Soccer: 'Spring', Softball: 'Spring', Tennis: 'Spring', Lacrosse: 'Spring',
}

export default function TeamsPage() {
  const { state } = useStore()
  const teams = allTeams(state)
  const me = currentUser(state)
  const editable = can(me.role, 'edit')
  const [adding, setAdding] = useState(false)
  // Grouped by sport AND gender, so boys' and girls' basketball are separate
  // programs rather than one merged list labelled with whichever came first.
  const groups = useMemo(() => {
    const byKey = new Map<string, Team[]>()
    for (const t of teams) {
      const key = `${t.sport}::${t.gender ?? ''}`
      const list = byKey.get(key)
      if (list) list.push(t)
      else byKey.set(key, [t])
    }
    return [...byKey.entries()]
      .map(([key, list]) => ({
        key,
        sport: list[0].sport,
        gender: list[0].gender,
        teams: [...list].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]),
      }))
      .sort((a, b) =>
        a.sport.localeCompare(b.sport) ||
        (GENDER_ORDER[a.gender ?? ''] ?? 9) - (GENDER_ORDER[b.gender ?? ''] ?? 9))
  }, [teams])
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-sub">{teams.length} teams · {groups.length} programs · {new Set(teams.map(t => t.sport)).size} sports</p>
        </div>
        {editable && <button className="btn primary" onClick={() => setAdding(true)}><I.plus /> Add team</button>}
      </div>
      {adding && <AddTeamModal onClose={() => setAdding(false)} />}
      {groups.map(g => {
        return (
          <div key={g.key} className="sport-group">
            <h2>
              {g.sport}{' '}
              <span className="tiny">
                {g.gender === 'Coed' ? 'Co-ed' : g.gender ?? 'Gender not set'}
              </span>
            </h2>
            {g.teams.map(t => {
              const rec = teamRecord(state, t.id)
              const upcoming = state.events.filter(e => e.teamId === t.id && e.date >= todayISO()).length
              const openReqs = state.requests.filter(r => r.teamId === t.id && r.status !== 'completed').length
              const coach = state.users.find(u => u.id === t.coachIds[0])
              return (
                <Link key={t.id} to={`/teams/${t.id}`} className="team-bar">
                  <span className="lvl">{t.level}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 170 }} className="small">
                    <Avatar user={coach} size="sm" /> {coach?.name}
                  </span>
                  <span className="pill-row" style={{ flex: 1 }}>
                    {hasGames(rec.overall) && <Badge tone={rec.overall.w >= rec.overall.l ? 'ok' : 'danger'}>{fmtWLT(rec.overall)}</Badge>}
                    {hasGames(rec.conference) && <Badge tone="navy">{rec.conferenceLabel} {fmtWLT(rec.conference)}</Badge>}
                    {t.missingInfo.length > 0 && <Badge tone="danger">{t.missingInfo.length} missing</Badge>}
                    {openReqs > 0 && <Badge tone="warn">{openReqs} request{openReqs > 1 ? 's' : ''}</Badge>}
                    {(t.roster ?? []).length === 0 && <Badge tone="danger">No roster</Badge>}
                  </span>
                  <span className="tiny" style={{ whiteSpace: 'nowrap' }}>{(t.roster ?? []).length} athletes · {upcoming} upcoming</span>
                  <I.right />
                </Link>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

export function TeamDetail() {
  const { id } = useParams()
  const { state } = useStore()
  const [tab, setTab] = useState<'overview' | 'roster'>('overview')
  const [editing, setEditing] = useState(false)
  const canEdit = can(currentUser(state).role, 'edit')
  const t = state.teams.find(x => x.id === id)
  if (!t) return <Card><Empty icon="?" title="Team not found" /></Card>

  const events = state.events.filter(e => e.teamId === t.id).sort((a, b) => a.date.localeCompare(b.date))
  const broadcasts = events.filter(e => e.broadcastStatus !== 'none' && e.date >= todayISO())
  const openReqs = state.requests.filter(r => r.teamId === t.id && r.status !== 'completed')
  const teamAssets = state.assets.filter(a => a.teamId === t.id)
  const rec = teamRecord(state, t.id)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 6 }}><Link to="/teams" className="tiny link">← Teams</Link></div>
          <h1 className="page-title">{t.name}</h1>
          <p className="page-sub">{t.sport}{t.gender ? ` · ${t.gender}` : ''} · {t.level} · {t.seasonLabel} · {(t.roster ?? []).length} athletes</p>
          <div className="pill-row" style={{ marginTop: 8 }}>
            {hasGames(rec.overall) && <Badge tone={rec.overall.w >= rec.overall.l ? 'ok' : 'danger'}>Overall {fmtWLT(rec.overall)}</Badge>}
            {hasGames(rec.conference) && <Badge tone="navy">{rec.conferenceLabel} {fmtWLT(rec.conference)}</Badge>}
            <Badge tone="outline">Postseason: {t.postseasonFinish ?? 'TBD'}</Badge>
            <StatusBadge status={t.rosterStatus} label={`Roster ${t.rosterStatus.replace('_', ' ')}`} />
          </div>
        </div>
        <div className="pill-row">
          {canEdit && <button className="btn" onClick={() => setEditing(true)}>Edit team</button>}
          <Link to="/requests?new=1" className="btn navy">Submit request</Link>
        </div>
      </div>
      {editing && <EditTeamModal team={t} onClose={() => setEditing(false)} />}

      {t.missingInfo.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: 'var(--warn)', display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--warn)' }}><I.warn /></span>
          <span className="small"><strong>Missing information:</strong> {t.missingInfo.join(' · ')}</span>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} role="tab" aria-selected={tab === 'overview'}>Overview</button>
        <button className={tab === 'roster' ? 'active' : ''} onClick={() => setTab('roster')} role="tab" aria-selected={tab === 'roster'}>
          Roster <span className="tab-count">{(t.roster ?? []).length}</span>
        </button>
      </div>

      {tab === 'roster' && <RosterTab team={t} />}

      {tab === 'overview' && (
      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Season schedule" pad={false} action={<Link className="card-link" to="/calendar">Calendar →</Link>}>
            {events.length === 0 && <Empty title="No events scheduled" />}
            {events.map(e => {
              const score = visibleScore(state, e)
              const unfilledCount = e.staffSlots.filter(sl => sl.status === 'unfilled' || sl.status === 'declined').length
              const bcast = broadcastState(e)
              const subBits: React.ReactNode[] = []
              subBits.push(<span key="ha">{e.homeAway === 'home' ? 'Home' : e.homeAway === 'away' ? 'Away' : e.homeAway === 'neutral' ? 'Neutral' : 'Site TBD'}</span>)
              subBits.push(<span key="venue" style={e.homeAway === 'home' ? { fontWeight: 700, color: 'var(--text)' } : undefined}>{e.venue}</span>)
              if (e.gameType === 'region' || e.gameType === 'area') subBits.push(<span key="gt">{e.gameType === 'region' ? 'Region' : 'Area'}</span>)
              if (e.designation) subBits.push(<span key="des" className="flag">{e.designation}</span>)
              return (
                <Link key={e.id} to={`/events/${e.id}`} className={`tsched-row sched-row ${score ? (score.result === 'W' ? 'win' : score.result === 'L' ? 'loss' : '') : ''}`}>
                  <div className="tsched-date">
                    <div className="dow">{fmtDate(e.date, { weekday: 'short' })}</div>
                    <div className="day">{fmtDate(e.date, { month: 'short', day: 'numeric' })}</div>
                    <div className="time">{fmtTime(e.time)}</div>
                  </div>
                  <div className="tsched-main">
                    <div className="tsched-name">{e.eventKind === 'single' && e.homeAway !== 'tbd' ? `${e.homeAway === 'home' ? 'vs' : 'at'} ${e.opponent}` : e.opponent}</div>
                    <div className="tsched-sub">
                      {subBits.map((bit, i) => <span key={i}>{i > 0 && <span className="sep">·</span>}{bit}</span>)}
                    </div>
                  </div>
                  <div className="tsched-right">
                    {score ? (
                      <>
                        <div className={`tsched-result ${score.result === 'W' ? 'win' : score.result === 'L' ? 'loss' : ''}`}>
                          {score.result} {score.us}–{score.them}
                        </div>
                        <div className="tsched-status">Final</div>
                      </>
                    ) : (
                      <div className="tsched-status">
                        {visibleStatus(state, e) === 'scheduled' ? 'Scheduled' : visibleStatus(state, e)[0].toUpperCase() + visibleStatus(state, e).slice(1)}
                        {bcast === 'confirmed' && <> · Broadcast</>}
                        {bcast === 'in_progress' && <> · <span className="alert">Broadcast setup</span></>}
                        {unfilledCount > 0 && <> · <span className="alert">{unfilledCount} staff needed</span></>}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CoachingStaffCard team={t} />
          <Card title="Social media" pad={false}>
            {!t.socials || Object.values(t.socials).every(v => !v) ? (
              <Empty title="No accounts linked" hint="Add the team's social links so gameday coverage tags the right accounts." />
            ) : (
              <>
                {t.socials.instagram && <a className="notif-item" href={t.socials.instagram} target="_blank" rel="noreferrer"><span style={{ flex: 1 }}>Instagram<div className="tiny">{t.socials.instagram.replace('https://', '')}</div></span><I.external /></a>}
                {t.socials.x && <a className="notif-item" href={t.socials.x} target="_blank" rel="noreferrer"><span style={{ flex: 1 }}>X (Twitter)<div className="tiny">{t.socials.x.replace('https://', '')}</div></span><I.external /></a>}
                {t.socials.facebook && <a className="notif-item" href={t.socials.facebook} target="_blank" rel="noreferrer"><span style={{ flex: 1 }}>Facebook<div className="tiny">{t.socials.facebook.replace('https://', '')}</div></span><I.external /></a>}
              </>
            )}
            <SocialsEditor team={t} />
          </Card>
          <ImportantDatesCard team={t} />
          <Card title="Broadcasts" pad={false}>
            {broadcasts.length === 0 && <Empty title="No upcoming broadcasts" />}
            {broadcasts.slice(0, 5).map(e => (
              <Link key={e.id} to={`/events/${e.id}`} className="notif-item">
                <span style={{ color: 'var(--info)' }}><I.broadcast /></span>
                <span style={{ flex: 1 }}>vs {e.opponent}<div className="tiny">{fmtDate(e.date)} · {fmtTime(e.time)}</div></span>
                <StatusBadge status={e.broadcastStatus} />
              </Link>
            ))}
          </Card>
          <Card title="Open requests" pad={false}>
            {openReqs.length === 0 && <Empty icon="✓" title="No open requests" />}
            {openReqs.map(r => (
              <Link key={r.id} to={`/requests/${r.id}`} className="notif-item">
                <span style={{ flex: 1 }}>{r.title}<div className="tiny">{r.type} · needed by {fmtDate(r.neededBy)}</div></span>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </Card>
          <Card title="Team assets" pad={false}>
            {teamAssets.length === 0 && <Empty icon="▣" title="No team assets" />}
            {teamAssets.map(a => (
              <Link key={a.id} to="/assets" className="notif-item">
                <span className="org-mark" style={{ background: a.tint }}>{a.fileType.slice(0, 3)}</span>
                <span style={{ flex: 1 }}>{a.name}<div className="tiny">{a.type}</div></span>
              </Link>
            ))}
          </Card>
        </div>
      </div>
      )}
    </>
  )
}

/**
 * Correct an existing team's sport, gender or level. Needed because a team
 * created before gender was set — or set wrongly — otherwise had no way to be
 * fixed, which left boys' and girls' teams stuck in the same program group.
 */
function EditTeamModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const { state, update, logActivity, toast } = useStore()
  const [sport, setSport] = useState(team.sport)
  const [gender, setGender] = useState<NonNullable<Team['gender']>>(team.gender ?? 'Boys')
  const [level, setLevel] = useState<Team['level']>(team.level)
  const [name, setName] = useState(team.name)
  // Follow the pickers only while the name still matches what they produce, so a
  // hand-written name ("Lady Patriots Basketball") is never silently replaced.
  const [nameTouched, setNameTouched] = useState(
    team.name !== derivedTeamName(team.sport, team.gender, team.level))

  const retitle = (s: string, g: NonNullable<Team['gender']>, l: Team['level']) => {
    if (!nameTouched) setName(derivedTeamName(s, g, l))
  }

  const save = () => {
    const dup = state.teams.find(t =>
      t.id !== team.id && t.orgId === team.orgId &&
      t.sport === sport && t.level === level && t.gender === gender)
    if (dup) { toast(`That would duplicate ${dup.name}`, 'error'); return }
    const season = SPORT_SEASON[sport] ?? team.season
    const patch: Partial<Team> = {
      sport, gender, level,
      name: name.trim() || derivedTeamName(sport, gender, level),
      // Season follows the sport; keep the year part of the existing label.
      season,
      seasonLabel: team.seasonLabel.replace(/^\S+/, season),
    }
    update('teams', team.id, patch)
    logActivity(`updated the ${patch.name} team`, `/teams/${team.id}`)
    toast('Team updated')
    onClose()
  }

  return (
    <Modal title="Edit team" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save changes</button>
      </>
    }>
      <Field label="Sport" required>
        <select value={sport} aria-label="Sport"
          onChange={e => { setSport(e.target.value); retitle(e.target.value, gender, level) }}>
          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
          {/* Keep a sport that isn't on the standard list rather than silently changing it. */}
          {!SPORTS.includes(sport) && <option value={sport}>{sport}</option>}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Gender">
          <select value={gender} aria-label="Gender"
            onChange={e => {
              const g = e.target.value as NonNullable<Team['gender']>
              setGender(g); retitle(sport, g, level)
            }}>
            {TEAM_GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Level">
          <select value={level} aria-label="Level"
            onChange={e => {
              const l = e.target.value as Team['level']
              setLevel(l); retitle(sport, gender, l)
            }}>
            {TEAM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Team name">
        <input value={name} aria-label="Team name"
          onChange={e => { setName(e.target.value); setNameTouched(true) }} />
      </Field>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Games, roster and requests stay attached to this team.
      </p>
    </Modal>
  )
}

function AddTeamModal({ onClose }: { onClose: () => void }) {
  const { state, add, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [sport, setSport] = useState('')
  const [gender, setGender] = useState<NonNullable<Team['gender']>>('Boys')
  const [level, setLevel] = useState<Team['level']>('Varsity')

  // Name mirrors the seed convention (level + sport) but adds the gender word so
  // e.g. boys and girls basketball don't collapse to the same name.
  const name = derivedTeamName(sport, gender, level)
  const season = sport ? (SPORT_SEASON[sport] ?? 'Fall') : 'Fall'

  const save = () => {
    if (!sport) { toast('Pick a sport first', 'error'); return }
    const dup = state.teams.find(t => t.orgId === state.currentOrgId && t.sport === sport && t.level === level && t.gender === gender)
    if (dup) { toast('That team already exists', 'error'); return }
    const id = `t-new-${Date.now()}`
    const team: Team = {
      id, orgId: state.currentOrgId, sport, level, gender, name,
      season, seasonLabel: `${season} 2026`,
      coachIds: [], rosterStatus: 'not_started', rosterCount: 0,
      missingInfo: ['Head coach not assigned', 'Roster not submitted'], importantDates: [], roster: [],
    }
    add('teams', team)
    logActivity(`added the ${name} team`, `/teams/${id}`)
    toast(`${name} created`)
    navigate(`/teams/${id}`)
  }

  return (
    <Modal title="Add a team" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!sport}>Create team</button>
      </>
    }>
      <Field label="Sport" required>
        <select value={sport} onChange={e => setSport(e.target.value)} aria-label="Sport">
          <option value="">Select a sport…</option>
          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Gender">
          <select value={gender} onChange={e => setGender(e.target.value as NonNullable<Team['gender']>)} aria-label="Gender">
            {TEAM_GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Level">
          <select value={level} onChange={e => setLevel(e.target.value as Team['level'])} aria-label="Level">
            {TEAM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      {name && <p className="small muted" style={{ marginBottom: 0 }}>Creates <strong>{name}</strong> · {season} season. You can add coaches and a roster next.</p>}
    </Modal>
  )
}

function RosterTab({ team }: { team: Team }) {
  const { state, update, logActivity, toast } = useStore()
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [draft, setDraft] = useState({ number: '', name: '', grade: '', position: '' })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
  const me = currentUser(state)
  const editable = can(me.role, 'edit')
  const roster = team.roster ?? []
  const toggleExpand = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const term = q.trim().toLowerCase()
  const shown = term ? roster.filter(a => a.name.toLowerCase().includes(term) || a.number === term || a.position?.toLowerCase().includes(term)) : roster

  const setRoster = (next: Athlete[], msg?: string) => {
    update('teams', team.id, {
      roster: next,
      rosterCount: next.length,
      rosterStatus: next.length > 0 ? 'complete' : 'not_started',
    } as Partial<Team>)
    if (msg) toast(msg)
  }

  return (
    <>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search roster…" />
        <div className="spacer" />
        {editable && <button className="btn primary" onClick={() => setImporting(true)}>Import roster</button>}
      </div>
      <p className="tiny" style={{ margin: '0 0 10px' }}>Tap an athlete to see contact and guardian info — handy on the sideline in an emergency.</p>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th style={{ width: 34 }} /><th style={{ width: 50 }}>#</th><th>Name</th><th>Grade</th><th>Position</th><th>Guardians</th>{editable && <th style={{ width: 50 }} />}</tr></thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={7}><div className="empty">
                <h4>{term ? 'No athletes match' : 'No roster on file'}</h4>
                <p>{term ? 'Try a different search.' : 'Add athletes below or import the full roster from a spreadsheet.'}</p>
              </div></td></tr>
            )}
            {shown.map(a => {
              const isOpen = expanded.has(a.id)
              const guardians = a.guardians ?? []
              return (
                <Fragment key={a.id}>
                  <tr className={`clickable athlete-row ${isOpen ? 'open' : ''}`} onClick={() => toggleExpand(a.id)} aria-expanded={isOpen} title="Show contact & guardian info">
                    <td><span className={`chev ${isOpen ? 'open' : ''}`} aria-hidden><I.chevron /></span></td>
                    <td className="num" style={{ textAlign: 'left', fontWeight: 700 }}>{a.number ?? '—'}</td>
                    <td><span className="athlete-name">{a.name}</span></td>
                    <td className="muted small">{a.grade ? `Grade ${a.grade}` : '—'}</td>
                    <td className="muted small">{a.position ?? '—'}</td>
                    <td className="small">{guardians.length ? `${guardians.length} contact${guardians.length > 1 ? 's' : ''}` : <span className="tiny">None</span>}</td>
                    {editable && (
                      <td onClick={ev => ev.stopPropagation()}>
                        <button className="btn sm ghost" aria-label={`Remove ${a.name}`} title="Remove athlete"
                          onClick={() => setRoster(roster.filter(x => x.id !== a.id), `${a.name} removed from roster`)}>✕</button>
                      </td>
                    )}
                  </tr>
                  {isOpen && (
                    <tr className="athlete-detail-row">
                      <td colSpan={editable ? 7 : 6}>
                        <div className="athlete-detail">
                          <div className="grid grid-2" style={{ gap: 16 }}>
                            <div>
                              <div className="section-title" style={{ fontSize: '0.82rem', marginBottom: 6 }}>Athlete</div>
                              <dl className="kv" style={{ gridTemplateColumns: '90px 1fr', fontSize: '0.85rem' }}>
                                <dt>Phone</dt><dd>{a.phone ? <a className="link" href={`tel:${a.phone}`}>{a.phone}</a> : <span className="muted">—</span>}</dd>
                                <dt>Email</dt><dd>{a.email ? <a className="link" href={`mailto:${a.email}`}>{a.email}</a> : <span className="muted">—</span>}</dd>
                                <dt>Medical</dt><dd>{a.medicalNotes || <span className="muted">None on file</span>}</dd>
                              </dl>
                            </div>
                            <div>
                              <div className="section-title" style={{ fontSize: '0.82rem', marginBottom: 6 }}>Guardians / emergency contacts</div>
                              {guardians.length === 0 && <p className="small muted" style={{ margin: 0 }}>No contacts on file.</p>}
                              {guardians.map(g => (
                                <div key={g.id} style={{ marginBottom: 8 }}>
                                  <div style={{ fontWeight: 650, fontSize: '0.88rem' }}>{g.name} {g.relation && <span className="tiny">· {g.relation}</span>}</div>
                                  <div className="small">
                                    {g.phone && <a className="link" href={`tel:${g.phone}`}>{g.phone}</a>}
                                    {g.phone && g.email && ' · '}
                                    {g.email && <a className="link" href={`mailto:${g.email}`}>{g.email}</a>}
                                    {!g.phone && !g.email && <span className="muted">No contact info</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {editable && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setEditingAthlete(a)}><I.edit /> Edit athlete & contacts</button>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {editable && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 64 }} placeholder="#" value={draft.number} onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} aria-label="Jersey number" />
            <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Athlete name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            <input className="input" style={{ width: 90 }} placeholder="Grade" value={draft.grade} onChange={e => setDraft(d => ({ ...d, grade: e.target.value }))} aria-label="Grade" />
            <input className="input" style={{ width: 110 }} placeholder="Position" value={draft.position} onChange={e => setDraft(d => ({ ...d, position: e.target.value }))} aria-label="Position" />
            <button className="btn primary sm" onClick={() => {
              if (!draft.name.trim()) { toast('Athlete name is required', 'error'); return }
              setRoster([...roster, { id: `ath-${Date.now()}`, number: draft.number.trim() || undefined, name: draft.name.trim(), grade: draft.grade.trim() || undefined, position: draft.position.trim() || undefined }], 'Athlete added')
              setDraft({ number: '', name: '', grade: '', position: '' })
            }}><I.plus /> Add athlete</button>
          </div>
        )}
      </div>
      {editingAthlete && (
        <AthleteModal athlete={editingAthlete} onClose={() => setEditingAthlete(null)} onSave={next => {
          setRoster(roster.map(x => x.id === next.id ? next : x), `${next.name} updated`)
          setEditingAthlete(null)
        }} />
      )}
      {importing && (
        <RosterImportModal team={team} onClose={() => setImporting(false)} onImport={(athletes, mode) => {
          const next = mode === 'replace' ? athletes : [...roster, ...athletes]
          setRoster(next)
          logActivity(`imported ${athletes.length} athletes to the ${team.name} roster`, `/teams/${team.id}`)
          toast(`${athletes.length} athletes imported (${mode === 'replace' ? 'roster replaced' : 'added to roster'})`)
          setImporting(false)
        }} />
      )}
    </>
  )
}

function RosterImportModal({ team, onClose, onImport }: {
  team: Team; onClose: () => void; onImport: (athletes: Athlete[], mode: 'replace' | 'append') => void
}) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [preview, setPreview] = useState<{ athletes: Athlete[]; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parse = (input: string) => {
    const lines = input.split(/\r?\n/).filter(l => l.trim())
    if (!lines.length) { setPreview({ athletes: [], errors: ['No rows found.'] }); return }
    const header = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
    const col = (names: string[]) => header.findIndex(h => names.includes(h))
    const ci = { number: col(['number', 'no', 'jersey']), name: col(['name', 'athlete', 'athletename', 'player']), grade: col(['grade', 'gr', 'class', 'year']), position: col(['position', 'pos']) }
    if (ci.name < 0) { setPreview({ athletes: [], errors: ['Header row must include a Name column (Number, Grade, and Position are optional).'] }); return }
    const athletes: Athlete[] = []
    const errors: string[] = []
    lines.slice(1).forEach((line, idx) => {
      const cells = splitCsvLine(line)
      const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')
      const name = get(ci.name)
      if (!name) { errors.push(`Row ${idx + 2}: name is blank — skipped`); return }
      athletes.push({
        id: `ath-imp-${Date.now()}-${idx}`, name,
        number: get(ci.number) || undefined, grade: get(ci.grade) || undefined, position: get(ci.position) || undefined,
      })
    })
    setPreview({ athletes, errors })
  }

  return (
    <Modal title={`Import roster — ${team.name}`} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        {preview === null
          ? <button className="btn primary" onClick={() => parse(text)} disabled={!text.trim()}>Preview import</button>
          : <button className="btn primary" disabled={preview.athletes.length === 0} onClick={() => onImport(preview.athletes, mode)}>
              Import {preview.athletes.length} athlete{preview.athletes.length === 1 ? '' : 's'}
            </button>}
      </>
    }>
      {preview === null ? (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>
            Upload a CSV (Excel/Google Sheets → save as CSV) or paste rows. Expected columns:
            <strong> Number, Name, Grade, Position</strong> — only Name is required, order doesn't matter.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => fileRef.current?.click()}>Choose CSV file…</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              const reader = new FileReader()
              reader.onload = () => { setText(String(reader.result ?? '')); parse(String(reader.result ?? '')) }
              reader.readAsText(f)
            }} />
            <button className="btn ghost" onClick={() => setText('Number,Name,Grade,Position\n7,Sample Athlete,12,QB\n23,Another Athlete,11,WR')}>Paste sample data</button>
            <select className="inline-select" value={mode} onChange={e => setMode(e.target.value as 'replace' | 'append')} aria-label="Import mode">
              <option value="replace">Replace current roster</option>
              <option value="append">Add to current roster</option>
            </select>
          </div>
          <Field label="Or paste CSV rows (first row = headers)">
            <textarea rows={8} value={text} onChange={e => setText(e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              placeholder={'Number,Name,Grade,Position\n7,Jack Adams,12,QB'} />
          </Field>
        </>
      ) : (
        <>
          <div className="pill-row" style={{ marginBottom: 10 }}>
            <Badge tone="ok">{preview.athletes.length} ready</Badge>
            {preview.errors.length > 0 && <Badge tone="danger">{preview.errors.length} skipped</Badge>}
            <Badge tone="outline">{mode === 'replace' ? 'Will replace current roster' : 'Will add to current roster'}</Badge>
            <button className="btn sm ghost" onClick={() => setPreview(null)}>← Edit data</button>
          </div>
          {preview.errors.map((e, i) => <p key={i} className="small" style={{ color: 'var(--danger)', margin: '2px 0' }}>{e}</p>)}
          <div className="tbl-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Name</th><th>Grade</th><th>Position</th></tr></thead>
              <tbody>
                {preview.athletes.map(a => (
                  <tr key={a.id}><td>{a.number ?? '—'}</td><td>{a.name}</td><td>{a.grade ?? '—'}</td><td>{a.position ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}

function AthleteModal({ athlete, onClose, onSave }: { athlete: Athlete; onClose: () => void; onSave: (a: Athlete) => void }) {
  const { toast } = useStore()
  const [form, setForm] = useState<Athlete>({ ...athlete, guardians: (athlete.guardians ?? []).map(g => ({ ...g })) })
  const set = (patch: Partial<Athlete>) => setForm(f => ({ ...f, ...patch }))
  const guardians = form.guardians ?? []
  const setGuardian = (i: number, patch: Partial<Guardian>) =>
    set({ guardians: guardians.map((g, j) => j === i ? { ...g, ...patch } : g) })

  const save = () => {
    if (!form.name.trim()) { toast('Athlete name is required', 'error'); return }
    for (const g of guardians) {
      if (g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email)) { toast(`Check the email for ${g.name || 'a guardian'}`, 'error'); return }
    }
    onSave({
      ...form,
      name: form.name.trim(),
      number: form.number?.trim() || undefined,
      grade: form.grade?.trim() || undefined,
      position: form.position?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      medicalNotes: form.medicalNotes?.trim() || undefined,
      guardians: guardians
        .filter(g => g.name.trim() || g.phone?.trim() || g.email?.trim())
        .map(g => ({ ...g, name: g.name.trim(), relation: g.relation?.trim() || undefined, phone: g.phone?.trim() || undefined, email: g.email?.trim() || undefined })),
    })
  }

  return (
    <Modal title={`Edit ${athlete.name}`} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save athlete</button>
      </>
    }>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="Jersey #"><input className="input" value={form.number ?? ''} onChange={e => set({ number: e.target.value })} /></Field>
        <Field label="Name"><input className="input" value={form.name} onChange={e => set({ name: e.target.value })} /></Field>
        <Field label="Grade"><input className="input" value={form.grade ?? ''} onChange={e => set({ grade: e.target.value })} placeholder="9–12" /></Field>
        <Field label="Position"><input className="input" value={form.position ?? ''} onChange={e => set({ position: e.target.value })} /></Field>
        <Field label="Athlete phone"><input className="input" value={form.phone ?? ''} onChange={e => set({ phone: e.target.value })} placeholder="(205) 555-0100" /></Field>
        <Field label="Athlete email"><input className="input" value={form.email ?? ''} onChange={e => set({ email: e.target.value })} /></Field>
      </div>
      <Field label="Medical / emergency notes">
        <textarea rows={2} value={form.medicalNotes ?? ''} onChange={e => set({ medicalNotes: e.target.value })} placeholder="Allergies, conditions, medications coaches should know on the field" />
      </Field>
      <div className="section-title" style={{ margin: '14px 0 8px' }}>Guardians / emergency contacts</div>
      {guardians.length === 0 && <p className="small muted" style={{ marginTop: 0 }}>No contacts yet — add a parent or guardian below.</p>}
      {guardians.map((g, i) => (
        <div key={g.id} className="card card-pad" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong className="small">Contact {i + 1}</strong>
            <button className="btn sm ghost" aria-label="Remove contact" onClick={() => set({ guardians: guardians.filter((_, j) => j !== i) })}><I.x /> Remove</button>
          </div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <Field label="Name"><input className="input" value={g.name} onChange={e => setGuardian(i, { name: e.target.value })} /></Field>
            <Field label="Relationship"><input className="input" value={g.relation ?? ''} onChange={e => setGuardian(i, { relation: e.target.value })} placeholder="Mother, Father, Guardian…" /></Field>
            <Field label="Phone"><input className="input" value={g.phone ?? ''} onChange={e => setGuardian(i, { phone: e.target.value })} placeholder="(205) 555-0100" /></Field>
            <Field label="Email"><input className="input" value={g.email ?? ''} onChange={e => setGuardian(i, { email: e.target.value })} /></Field>
          </div>
        </div>
      ))}
      <button className="btn sm" onClick={() => set({ guardians: [...guardians, { id: `grd-${Date.now()}`, name: '', relation: '', phone: '', email: '' }] })}><I.plus /> Add contact</button>
    </Modal>
  )
}

function SocialsEditor({ team }: { team: Team }) {
  const { state, update, toast } = useStore()
  const me = currentUser(state)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ instagram: team.socials?.instagram ?? '', x: team.socials?.x ?? '', facebook: team.socials?.facebook ?? '' })
  if (!can(me.role, 'edit')) return null
  if (!open) {
    return <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}><button className="btn sm ghost" onClick={() => setOpen(true)}>Edit links</button></div>
  }
  return (
    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input className="input" placeholder="Instagram URL" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} aria-label="Instagram URL" />
      <input className="input" placeholder="X (Twitter) URL" value={form.x} onChange={e => setForm(f => ({ ...f, x: e.target.value }))} aria-label="X URL" />
      <input className="input" placeholder="Facebook URL" value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} aria-label="Facebook URL" />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary sm" onClick={() => {
          for (const [k, v] of Object.entries(form)) {
            if (v && !/^https?:\/\//.test(v)) { toast(`${k} link must start with http(s)://`, 'error'); return }
          }
          update('teams', team.id, { socials: { instagram: form.instagram || undefined, x: form.x || undefined, facebook: form.facebook || undefined } } as Partial<Team>)
          toast('Social links updated')
          setOpen(false)
        }}>Save</button>
        <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function CoachingStaffCard({ team }: { team: Team }) {
  const { state, update, toast } = useStore()
  const me = currentUser(state)
  const editable = can(me.role, 'edit')
  const [editing, setEditing] = useState(false)
  const [headId, setHeadId] = useState(team.coachIds[0] ?? '')
  const [assistants, setAssistants] = useState(team.assistantCoaches ?? [])
  const [draft, setDraft] = useState({ name: '', role: '' })
  const orgUsers = sortedByLastName(state.users.filter(u => u.orgId === team.orgId && u.status !== 'revoked'))
  const head = state.users.find(u => u.id === team.coachIds[0])

  const save = () => {
    update('teams', team.id, { coachIds: headId ? [headId] : [], assistantCoaches: assistants } as Partial<Team>)
    toast('Coaching staff updated')
    setEditing(false)
  }

  return (
    <Card title="Coaching staff" pad={false} action={editable && !editing && <button className="btn sm ghost" onClick={() => { setHeadId(team.coachIds[0] ?? ''); setAssistants(team.assistantCoaches ?? []); setEditing(true) }}>Edit</button>}>
      {!editing ? (
        <>
          <div className="notif-item" style={{ alignItems: 'center' }}>
            <Avatar user={head} />
            <span style={{ flex: 1 }}><strong>{head?.name ?? 'No head coach assigned'}</strong><div className="tiny">{head ? `Head coach · ${head.title}` : 'Assign one with Edit'}</div></span>
          </div>
          {(team.assistantCoaches ?? []).map(a => (
            <div key={a.id} className="notif-item" style={{ alignItems: 'center' }}>
              <span className="avatar sm" style={{ background: 'var(--border-strong)', color: 'var(--text-2)' }}>{a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
              <span style={{ flex: 1 }}><strong>{a.name}</strong><div className="tiny">{a.role || 'Assistant coach'}</div></span>
            </div>
          ))}
        </>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            Head coach
            <select className="inline-select" value={headId} onChange={e => setHeadId(e.target.value)}>
              <option value="">— None —</option>
              {orgUsers.map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role]}</option>)}
            </select>
          </label>
          <div>
            <div className="tiny" style={{ marginBottom: 4 }}>Assistant coaches</div>
            {assistants.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ flex: 1 }} value={a.name} onChange={e => setAssistants(assistants.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name" />
                <input className="input" style={{ width: 120 }} value={a.role ?? ''} onChange={e => setAssistants(assistants.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="Role" />
                <button className="btn sm ghost" aria-label="Remove assistant" onClick={() => setAssistants(assistants.filter((_, j) => j !== i))}><I.x /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Add assistant name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
              <input className="input" style={{ width: 120 }} placeholder="Role" value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} />
              <button className="btn sm" onClick={() => { if (!draft.name.trim()) return; setAssistants([...assistants, { id: `asst-${Date.now()}`, name: draft.name.trim(), role: draft.role.trim() || undefined }]); setDraft({ name: '', role: '' }) }}>Add</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary sm" onClick={save}>Save</button>
            <button className="btn sm ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  )
}

function ImportantDatesCard({ team }: { team: Team }) {
  const { state, update, toast } = useStore()
  const me = currentUser(state)
  const editable = can(me.role, 'edit')
  const [editing, setEditing] = useState(false)
  const [dates, setDates] = useState(team.importantDates)
  const [draft, setDraft] = useState({ label: '', date: '' })

  const save = () => {
    update('teams', team.id, { importantDates: [...dates].sort((a, b) => a.date.localeCompare(b.date)) } as Partial<Team>)
    toast('Important dates updated')
    setEditing(false)
  }

  return (
    <Card title="Important dates" pad={false} action={editable && !editing && <button className="btn sm ghost" onClick={() => { setDates(team.importantDates); setEditing(true) }}>Edit</button>}>
      {!editing ? (
        <>
          {team.importantDates.length === 0 && <Empty title="No key dates entered" hint={editable ? 'Add them with Edit.' : undefined} />}
          {team.importantDates.map((d, i) => (
            <div key={i} className="notif-item">
              <span style={{ flex: 1 }}>{d.label}</span>
              <Badge tone="outline">{fmtDate(d.date)}</Badge>
            </div>
          ))}
        </>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dates.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input className="input" style={{ flex: 1 }} value={d.label} onChange={e => setDates(dates.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" />
              <input className="input" type="date" style={{ width: 150 }} value={d.date} onChange={e => setDates(dates.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
              <button className="btn sm ghost" aria-label="Remove date" onClick={() => setDates(dates.filter((_, j) => j !== i))}><I.x /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" style={{ flex: 1 }} placeholder="e.g. Senior Night" value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
            <input className="input" type="date" style={{ width: 150 }} value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
            <button className="btn sm" onClick={() => { if (!draft.label.trim() || !draft.date) { toast('Label and date are both required', 'error'); return } setDates([...dates, { label: draft.label.trim(), date: draft.date }]); setDraft({ label: '', date: '' }) }}>Add</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary sm" onClick={save}>Save</button>
            <button className="btn sm ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  )
}
