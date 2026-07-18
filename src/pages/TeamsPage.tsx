import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { teamCompleteness, teamRecord, teams as allTeams } from '../lib/derive'
import { fmtDate, fmtTime } from '../lib/dates'
import { Avatar, Badge, Card, Empty, Progress, StatusBadge } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { I } from '../components/icons'

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
                {(rec.w + rec.l + rec.t) > 0 && <Badge tone={rec.w >= rec.l ? 'ok' : 'danger'}>{rec.w}–{rec.l}</Badge>}
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
  const t = state.teams.find(x => x.id === id)
  if (!t) return <Card><Empty icon="?" title="Team not found" /></Card>

  const events = state.events.filter(e => e.teamId === t.id).sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = events.filter(e => e.date >= state.demoToday).slice(0, 8)
  const results = events.filter(e => e.score).sort((a, b) => b.date.localeCompare(a.date))
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
          <p className="page-sub">{t.sport}{t.gender ? ` · ${t.gender}` : ''} · {t.level} · {t.seasonLabel} · {t.rosterCount} athletes</p>
          <div className="pill-row" style={{ marginTop: 8 }}>
            {(rec.w + rec.l + rec.t) > 0 && <Badge tone={rec.w >= rec.l ? 'ok' : 'danger'}>Record {rec.w}–{rec.l}{rec.t ? `–${rec.t}` : ''}</Badge>}
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
                      <td><Badge tone={e.score!.result === 'W' ? 'ok' : 'danger'}>{e.score!.result} {e.score!.us}–{e.score!.them}</Badge></td>
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
    </>
  )
}
