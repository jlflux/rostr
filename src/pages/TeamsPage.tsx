import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { broadcastState, can, fmtWLT, hasGames, teamRecord, teams as allTeams, visibleScore, visibleStatus } from '../lib/derive'
import { fmtDate, fmtTime } from '../lib/dates'
import { Avatar, Badge, Card, Empty, Field, HomeAwayBadge, Modal, SearchBox, StatusBadge } from '../components/ui'
import { splitCsvLine } from './EventsPage'
import { I } from '../components/icons'
import type { Athlete, Team } from '../types'

export default function TeamsPage() {
  const { state } = useStore()
  const teams = allTeams(state)
  const LEVEL_ORDER: Record<string, number> = { Varsity: 0, JV: 1, Freshman: 2 }
  const sports = [...new Set(teams.map(t => t.sport))]
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-sub">Fall 2026 programs · {teams.length} teams</p>
        </div>
      </div>
      {sports.map(sport => {
        const group = teams.filter(t => t.sport === sport).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
        return (
          <div key={sport} className="sport-group">
            <h2>{sport} <span className="tiny">{group[0].gender && group[0].gender !== 'Coed' ? group[0].gender : ''}</span></h2>
            {group.map(t => {
              const rec = teamRecord(state, t.id)
              const upcoming = state.events.filter(e => e.teamId === t.id && e.date >= state.demoToday).length
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
  const t = state.teams.find(x => x.id === id)
  if (!t) return <Card><Empty icon="?" title="Team not found" /></Card>

  const events = state.events.filter(e => e.teamId === t.id).sort((a, b) => a.date.localeCompare(b.date))
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
          <Card title="Season schedule" pad={false} action={<Link className="card-link" to="/calendar">Calendar →</Link>}>
            {events.length === 0 && <Empty title="No events scheduled" />}
            {events.length > 0 && (
              <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Event</th><th>H/A</th><th>Venue</th><th>Result / status</th></tr></thead>
                <tbody>
                  {events.map(e => {
                    const score = visibleScore(state, e)
                    const rowCls = score ? (score.result === 'W' ? 'sched-row win' : score.result === 'L' ? 'sched-row loss' : 'sched-row') : 'sched-row'
                    const unfilledCount = e.staffSlots.filter(sl => sl.status === 'unfilled' || sl.status === 'declined').length
                    return (
                      <tr key={e.id} className={rowCls}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 750 }}>{fmtDate(e.date)}</div>
                          <div className="tiny">{fmtTime(e.time)}</div>
                        </td>
                        <td>
                          <Link className="link" to={`/events/${e.id}`}>{e.opponent}</Link>
                          {(e.gameType === 'region' || e.gameType === 'area') && <> <Badge tone="navy">{e.gameType === 'region' ? 'Region' : 'Area'}</Badge></>}
                          {e.designation && <> <Badge tone="brand">{e.designation}</Badge></>}
                        </td>
                        <td><HomeAwayBadge ha={e.homeAway} /></td>
                        <td className={e.homeAway === 'home' ? '' : 'muted'} style={e.homeAway === 'home' ? { fontWeight: 700 } : undefined}>{e.venue}</td>
                        <td>
                          {score ? (
                            <Badge tone={score.result === 'W' ? 'ok' : 'danger'}>{score.result} {score.us}–{score.them}</Badge>
                          ) : (
                            <span className="pill-row">
                              <StatusBadge status={visibleStatus(state, e)} />
                              {broadcastState(e) === 'in_progress' && <Badge tone="warn"><I.broadcast /></Badge>}
                              {broadcastState(e) === 'confirmed' && <Badge tone="info"><I.broadcast /></Badge>}
                              {unfilledCount > 0 && <Badge tone="danger">{unfilledCount} unfilled</Badge>}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
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

function SocialsEditor({ team }: { team: Team }) {
  const { state, update, toast } = useStore()
  const me = state.users.find(u => u.id === state.currentUserId)!
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
