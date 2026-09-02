import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { loadSite, logoUrl, slugFromLocation, type PublicEvent, type PublicSite } from './api'
import { fmtDate, fmtTime, opponentOf, presentedBy, results, teamOf, todayISO, upcoming } from './format'

const env = import.meta.env as Record<string, string | undefined>

// ---------- shared bits ----------

function Crest({ src, initials, tint, size = 44 }: {
  src: string | null; initials: string; tint?: string; size?: number
}) {
  // A school may have no logo yet, and a logo may not have been copied into the
  // public bucket. Either way fall back to initials rather than an empty hole.
  const [failed, setFailed] = useState(false)
  const url = failed ? null : logoUrl(src)
  useEffect(() => setFailed(false), [src])
  return (
    <span className="crest" style={{ width: size, height: size, background: url ? 'transparent' : (tint ?? 'var(--fs-navy)') }}>
      {url
        ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <span style={{ fontSize: size * 0.36 }}>{initials}</span>}
    </span>
  )
}

/** One game, as it appears in any list. */
function GameCard({ site, e }: { site: PublicSite; e: PublicEvent }) {
  const opp = opponentOf(site, e)
  const team = teamOf(site, e)
  const home = e.homeAway === 'home'
  return (
    <Link to={`/game/${e.id}`} className="game-card">
      <span className="gc-date">
        <strong>{fmtDate(e.date)}</strong>
        <span>{fmtTime(e.time)}</span>
      </span>
      <Crest src={opp?.logo ?? null} initials={(opp?.name ?? e.opponent).slice(0, 2).toUpperCase()} tint={opp?.tint} size={36} />
      <span className="gc-main">
        <span className="gc-match">{home ? 'vs' : 'at'} {e.opponent}</span>
        <span className="gc-sub">{team?.name ?? `${e.level} ${e.sport}`}{e.venue ? ` · ${e.venue}` : ''}</span>
      </span>
      <span className="gc-right">
        {e.score
          ? <span className={`gc-score ${e.score.result === 'W' ? 'win' : e.score.result === 'L' ? 'loss' : ''}`}>
              {e.score.result} {e.score.us}–{e.score.them}
            </span>
          : <>
              {e.designation && <span className="tag">{e.designation}</span>}
              <span className={`ha ${home ? 'home' : ''}`}>{home ? 'HOME' : 'AWAY'}</span>
            </>}
      </span>
    </Link>
  )
}

// ---------- pages ----------

function Home({ site }: { site: PublicSite }) {
  const next = upcoming(site, 6)
  const recent = results(site, 6)
  return (
    <>
      <section className="hero">
        <Crest src={site.school.logo} initials={site.school.initials} size={72} />
        <div>
          <h1>{site.school.name}</h1>
          <p>{site.school.mascot} · {site.school.city}, {site.school.state}</p>
        </div>
      </section>

      <h2 className="section-title">Next up</h2>
      {next.length === 0
        ? <p className="empty">No upcoming games on the schedule.</p>
        : <div className="list">{next.map(e => <GameCard key={e.id} site={site} e={e} />)}</div>}
      <p className="more"><Link to="/schedule">Full schedule →</Link></p>

      {recent.length > 0 && (
        <>
          <h2 className="section-title">Recent results</h2>
          <div className="list">{recent.map(e => <GameCard key={e.id} site={site} e={e} />)}</div>
        </>
      )}
    </>
  )
}

function Schedule({ site }: { site: PublicSite }) {
  const [params, setParams] = useSearchParams()
  const sport = params.get('sport') ?? ''
  const when = params.get('when') ?? 'upcoming'
  const sports = useMemo(
    () => [...new Set(site.events.map(e => e.sport))].sort(), [site])

  const list = useMemo(() => {
    const t = todayISO()
    let evs = [...site.events]
    if (when === 'upcoming') evs = evs.filter(e => e.date >= t)
    if (when === 'past') evs = evs.filter(e => e.date < t)
    if (sport) evs = evs.filter(e => e.sport === sport)
    return evs.sort((a, b) => when === 'past'
      ? b.date.localeCompare(a.date)
      : (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
  }, [site, sport, when])

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <>
      <h1 className="page-h1">Schedule</h1>
      <div className="filters">
        <div className="seg">
          {['upcoming', 'past', 'all'].map(v => (
            <button key={v} className={when === v ? 'on' : ''} onClick={() => set('when', v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <select value={sport} onChange={e => set('sport', e.target.value)} aria-label="Sport">
          <option value="">All sports</option>
          {sports.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {list.length === 0
        ? <p className="empty">Nothing matches those filters.</p>
        : <div className="list">{list.map(e => <GameCard key={e.id} site={site} e={e} />)}</div>}
    </>
  )
}

/** The game page — the reason this site exists rather than a schedule table. */
function Game({ site }: { site: PublicSite }) {
  const { id } = useParams()
  const e = site.events.find(x => x.id === id)
  if (!e) return <p className="empty">That game isn't on the schedule.</p>

  const opp = opponentOf(site, e)
  const team = teamOf(site, e)
  const home = e.homeAway === 'home'
  const sponsor = presentedBy(site, e)
  const sponsorLogo = logoUrl(sponsor?.logo ?? null)

  return (
    <>
      <p className="crumb"><Link to="/schedule">← Schedule</Link></p>

      {sponsor && (
        <div className="presented">
          <span>Presented by</span>
          {sponsorLogo
            ? <a href={sponsor.website ?? undefined} target="_blank" rel="noreferrer">
                <img src={sponsorLogo} alt={sponsor.name} />
              </a>
            : <strong>{sponsor.name}</strong>}
        </div>
      )}

      <section className="matchup">
        <div className="side">
          <Crest src={site.school.logo} initials={site.school.initials} size={84} />
          <strong>{site.school.shortName}</strong>
        </div>
        <div className="vs">
          <span>{home ? 'vs' : 'at'}</span>
          {e.score && <span className={`final ${e.score.result === 'W' ? 'win' : 'loss'}`}>{e.score.us}–{e.score.them}</span>}
        </div>
        <div className="side">
          <Crest src={opp?.logo ?? null} initials={(opp?.name ?? e.opponent).slice(0, 2).toUpperCase()} tint={opp?.tint} size={84} />
          <strong>{opp?.name ?? e.opponent}</strong>
        </div>
      </section>

      <div className="tags">
        {e.designation && <span className="tag big">{e.designation}</span>}
        {e.gameType === 'region' && <span className="tag big alt">Region game</span>}
        {e.gameType === 'area' && <span className="tag big alt">Area game</span>}
        {e.status === 'canceled' && <span className="tag big warn">Canceled</span>}
        {e.status === 'postponed' && <span className="tag big warn">Postponed</span>}
      </div>

      <dl className="facts">
        <dt>Date</dt><dd>{fmtDate(e.date, { weekday: 'long', year: 'numeric' })}</dd>
        <dt>Time</dt><dd>{fmtTime(e.time)}</dd>
        <dt>Where</dt><dd>{e.venue}{home ? '' : ' (away)'}</dd>
        <dt>Team</dt><dd>{team?.name ?? `${e.level} ${e.sport}`}</dd>
      </dl>

      {e.moments.length > 0 && (
        <section className="card">
          <h2>Happening at this game</h2>
          <ul className="moments">
            {e.moments.map((m, i) => (
              <li key={i}><strong>{m.title}</strong>{m.timing ? <span> · {m.timing}</span> : null}</li>
            ))}
          </ul>
        </section>
      )}

      {(e.ticketLink || e.broadcastLink) && (
        <div className="actions">
          {e.ticketLink && <a className="btn" href={e.ticketLink} target="_blank" rel="noreferrer">Buy tickets</a>}
          {e.broadcastLink && <a className="btn ghost" href={e.broadcastLink} target="_blank" rel="noreferrer">Watch live</a>}
        </div>
      )}

      {e.score?.recap && <section className="card"><h2>Recap</h2><p>{e.score.recap}</p></section>}
    </>
  )
}

function Teams({ site }: { site: PublicSite }) {
  // Grouped the way a school talks about its programs: sport, then boys/girls,
  // then varsity down. Two basketball teams are two programs, not one list.
  const groups = useMemo(() => {
    const order: Record<string, number> = { Varsity: 0, JV: 1, Freshman: 2, '8th Grade': 3, '7th Grade': 4 }
    const gorder: Record<string, number> = { Boys: 0, Girls: 1, Coed: 2 }
    const by = new Map<string, { sport: string; gender?: string; teams: typeof site.teams }>()
    for (const t of site.teams) {
      const key = `${t.sport}::${t.gender ?? ''}`
      const g = by.get(key)
      if (g) g.teams.push(t)
      else by.set(key, { sport: t.sport, gender: t.gender, teams: [t] })
    }
    return [...by.values()]
      .map(g => ({ ...g, teams: [...g.teams].sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9)) }))
      .sort((a, b) => a.sport.localeCompare(b.sport) ||
        (gorder[a.gender ?? ''] ?? 9) - (gorder[b.gender ?? ''] ?? 9))
  }, [site])

  return (
    <>
      <h1 className="page-h1">Teams</h1>
      {groups.map(g => (
        <div key={`${g.sport}${g.gender ?? ''}`} className="team-group">
          <h2>{g.sport}{g.gender && g.gender !== 'Coed' ? ` · ${g.gender}` : ''}</h2>
          <div className="list">
            {g.teams.map(t => (
              <Link key={t.id} to={`/team/${t.id}`} className="team-row">
                <span className="lvl">{t.level}</span>
                <span className="tr-main">{t.name}</span>
                <span className="tr-sub">{t.roster.length > 0 ? `${t.roster.length} athletes` : ''}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function TeamPage({ site }: { site: PublicSite }) {
  const { id } = useParams()
  const [tab, setTab] = useState<'schedule' | 'roster'>('schedule')
  const team = site.teams.find(t => t.id === id)
  if (!team) return <p className="empty">That team isn't listed.</p>

  const games = site.events
    .filter(e => e.teamId === team.id)
    .sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
  // Jersey numbers are text but read as numbers; blanks go last.
  const roster = [...team.roster].sort((a, b) => {
    const n = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : Infinity)
    return n(a.number) - n(b.number) || a.name.localeCompare(b.name)
  })

  return (
    <>
      <p className="crumb"><Link to="/teams">← Teams</Link></p>
      <h1 className="page-h1">{team.name}</h1>
      <p className="team-meta">
        {team.seasonLabel}
        {team.postseasonFinish ? ` · ${team.postseasonFinish}` : ''}
      </p>

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'schedule' ? 'on' : ''} onClick={() => setTab('schedule')}>
          Schedule
        </button>
        <button className={tab === 'roster' ? 'on' : ''} onClick={() => setTab('roster')}>
          Roster{roster.length ? ` (${roster.length})` : ''}
        </button>
      </div>

      {tab === 'schedule' && (games.length === 0
        ? <p className="empty">No games on the schedule yet.</p>
        : <div className="list">{games.map(e => <GameCard key={e.id} site={site} e={e} />)}</div>)}

      {tab === 'roster' && (roster.length === 0
        ? <p className="empty">The roster hasn't been posted yet.</p>
        : <div className="roster">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Grade</th><th>Position</th></tr></thead>
              <tbody>
                {roster.map(a => (
                  <tr key={a.id}>
                    <td className="num">{a.number || ''}</td>
                    <td className="nm">{a.name}</td>
                    <td>{a.grade || ''}</td>
                    <td>{a.position || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)}
    </>
  )
}

// ---------- shell ----------

export default function App() {
  const [site, setSite] = useState<PublicSite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slug = slugFromLocation() ?? env.VITE_PUBLIC_DEFAULT_SLUG ?? null

  useEffect(() => {
    if (!slug) { setError('nosite'); return }
    loadSite(slug).then(setSite).catch((err: Error) => setError(err.message))
  }, [slug])

  useEffect(() => {
    if (!site) return
    const r = document.documentElement.style
    r.setProperty('--fs-primary', site.school.theme.primary)
    r.setProperty('--fs-navy', site.school.theme.navy)
    r.setProperty('--fs-accent', site.school.theme.accent)
    document.title = `${site.school.shortName} Athletics`
  }, [site])

  if (error) {
    return (
      <main className="wrap center">
        <h1>{error === 'notfound' || error === 'nosite' ? 'Site not found' : 'Something went wrong'}</h1>
        <p className="empty">
          {error === 'notfound' || error === 'nosite'
            ? "This school doesn't have a public site yet."
            : error}
        </p>
      </main>
    )
  }
  if (!site) return <main className="wrap center"><p className="empty">Loading…</p></main>

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <Crest src={site.school.logo} initials={site.school.initials} size={34} />
          <span>{site.school.shortName} Athletics</span>
        </Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/schedule">Schedule</Link>
          <Link to="/teams">Teams</Link>
        </nav>
      </header>
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Home site={site} />} />
          <Route path="/schedule" element={<Schedule site={site} />} />
          <Route path="/teams" element={<Teams site={site} />} />
          <Route path="/team/:id" element={<TeamPage site={site} />} />
          <Route path="/game/:id" element={<Game site={site} />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
      </main>
      <footer className="foot">
        <span>{site.school.name}</span>
        <span>Powered by Flux Athletics</span>
      </footer>
    </>
  )
}
