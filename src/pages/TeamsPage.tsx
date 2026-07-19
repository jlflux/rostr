import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { can, fmtWLT, hasGames, teamCompleteness, teamRecord, teams as allTeams, visibleScore } from '../lib/derive'
import { fmtDate, fmtTime } from '../lib/dates'
import { Avatar, Badge, Card, Empty, Field, Modal, Progress, SearchBox, StatusBadge } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { splitCsvLine } from './EventsPage'
import { I } from '../components/icons'
import type { Athlete, Team } from '../types'

export default function TeamsPage() {
  const { state } = useStore()
  const teams = allTeams(state)
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-sub">Fall 2026 programs · {teams.length} teams</p>
        </div>
      </div>
      <div className="grid grid-3">
        {teams.map(t => {
          const rec = teamRecord(state, t.id)
          const upcoming = state.events.filter(e => e.teamId === t.id && e.date >= state.demoToday).length
          const openReqs = state.requests.filter(r => r.teamId === t.id && r.status !== 'completed').length
          const complete = teamCompleteness(state, t.id)
          const coach = state.users.find(u => u.id === t.coachIds[0])
          return (
            <Link key={t.id} to={`/teams/${t.id}`} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 750, fontSize: '1.02rem' }}>{t.name}</div>
                  <div className="tiny">{t.sport}{t.gender ? ` · ${t.gender}` : ''} · {t.seasonLabel}</div>
                </div>
                {hasGames(rec.overall) && (
                  <span className="pill-row">
                    <Badge tone={rec.overall.w >= rec.overall.l ? 'ok' : 'danger'}>{fmtWLT(rec.overall)}</Badge>
                    {hasGames(rec.conference) && <Badge tone="navy">{rec.conferenceLabel} {fmtWLT(rec.conference)}</Badge>}
                  </span>
                )}
              </div>
              <div className="pill-row">
                <StatusBadge status={t.rosterStatus} label={`Roster: ${t.rosterStatus === 'complete' ? 'complete' : t.rosterStatus === 'in_progress' ? 'in progress' : 'not started'}`} />
                {openReqs > 0 && <Badge tone="warn">{openReqs} open request{openReqs > 1 ? 's' : ''}</Badge>}
                {t.missingInfo.length > 0 && <Badge tone="danger">{t.missingInfo.length} missing item{t.missingInfo.length > 1 ? 's' : ''}</Badge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><Progress value={complete} /></div>
                <span className="tiny">{complete}% complete</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="tiny">
                <Avatar user={coach} size="sm" /> {coach?.name} · {upcoming} upcoming events
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

export function TeamDetail() {
  const { id } = useParams()
  const { state } = useStore()
  const [tab, setTab] = useState<'overview' | 'roster'>('overview')
  const t = state.teams.find(x => x.id === id)
  if (!t) return <Card><Empty icon="?" title="Team not found" /></Card>

  const events = state.events.filter(e => e.teamId === t.id).sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = events.filter(e => e.date >= state.demoToday).slice(0, 8)
  const results = events.filter(e => visibleScore(state, e)).sort((a, b) => b.date.localeCompare(a.date))
  const broadcasts = events.filter(e => e.broadcastStatus !== 'none' && e.date >= state.demoToday)
  const openReqs = state.requests.filter(r => r.teamId === t.id && r.status !== 'completed')
  const teamAssets = state.assets.filter(a => a.teamId === t.id)
  const rec = teamRecord(state, t.id)
  const coaches = t.coachIds.map(cid => state.users.find(u => u.id === cid)).filter(Boolean)

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
        <Link to="/requests?new=1" className="btn navy">Submit request</Link>
      </div>

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
          <Card title="Upcoming events" pad={false} action={<Link className="card-link" to="/calendar">Calendar →</Link>}>
            <div style={{ padding: '10px 14px' }}>
              {upcoming.length === 0 && <Empty title="No upcoming events" />}
              {upcoming.map(e => <EventRow key={e.id} e={e} showDate />)}
            </div>
          </Card>
          <Card title="Results" pad={false}>
            {results.length === 0 && <Empty title="No results yet" hint="Scores appear here once games are completed." />}
            {results.length > 0 && (
              <table className="tbl">
                <thead><tr><th>Date</th><th>Opponent</th><th>H/A</th><th>Result</th></tr></thead>
                <tbody>
                  {results.map(e => (
                    <tr key={e.id}>
                      <td>{fmtDate(e.date)}</td>
                      <td><Link className="link" to={`/events/${e.id}`}>{e.opponent}</Link></td>
                      <td className="muted small">{e.homeAway === 'home' ? 'Home' : e.homeAway === 'away' ? 'Away' : '—'}</td>
                      <td>
                        <span className="pill-row">
                          <Badge tone={visibleScore(state, e)!.result === 'W' ? 'ok' : 'danger'}>{visibleScore(state, e)!.result} {visibleScore(state, e)!.us}–{visibleScore(state, e)!.them}</Badge>
                          {(e.gameType === 'region' || e.gameType === 'area') && <Badge tone="navy">{e.gameType === 'region' ? 'Region' : 'Area'}</Badge>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Coaching staff" pad={false}>
            {coaches.map(c => (
              <div key={c!.id} className="notif-item" style={{ alignItems: 'center' }}>
                <Avatar user={c} />
                <span style={{ flex: 1 }}><strong>{c!.name}</strong><div className="tiny">{c!.title}</div></span>
              </div>
            ))}
          </Card>
          <Card title="Important dates" pad={false}>
            {t.importantDates.length === 0 && <Empty title="No key dates entered" />}
            {t.importantDates.map((d, i) => (
              <div key={i} className="notif-item">
                <span style={{ flex: 1 }}>{d.label}</span>
                <Badge tone="outline">{fmtDate(d.date)}</Badge>
              </div>
            ))}
          </Card>
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

function RosterTab({ team }: { team: Team }) {
  const { state, update, logActivity, toast } = useStore()
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [draft, setDraft] = useState({ number: '', name: '', grade: '', position: '' })
  const me = state.users.find(u => u.id === state.currentUserId)!
  const editable = can(me.role, 'edit')
  const roster = team.roster ?? []
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
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th style={{ width: 60 }}>#</th><th>Name</th><th>Grade</th><th>Position</th>{editable && <th style={{ width: 50 }} />}</tr></thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5}><div className="empty">
                <h4>{term ? 'No athletes match' : 'No roster on file'}</h4>
                <p>{term ? 'Try a different search.' : 'Add athletes below or import the full roster from a spreadsheet.'}</p>
              </div></td></tr>
            )}
            {shown.map(a => (
              <tr key={a.id}>
                <td className="num" style={{ textAlign: 'left', fontWeight: 700 }}>{a.number ?? '—'}</td>
                <td><span className="primary">{a.name}</span></td>
                <td className="muted small">{a.grade ? `Grade ${a.grade}` : '—'}</td>
                <td className="muted small">{a.position ?? '—'}</td>
                {editable && (
                  <td>
                    <button className="btn sm ghost" aria-label={`Remove ${a.name}`} title="Remove athlete"
                      onClick={() => setRoster(roster.filter(x => x.id !== a.id), `${a.name} removed from roster`)}>✕</button>
                  </td>
                )}
              </tr>
            ))}
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
