import { Link } from 'react-router-dom'
import type { PublicEvent, PublicSite } from './api'
import { fmtDate, fmtTime, opponentOf, results, teamOf, thisWeek, todayISO, upcoming, visibleNews, visibleScore } from './format'
import { NewsCard } from './News'
import { SocialRow } from './social'
import { Crest } from './ui'

/** The next game, given room: who, when, where, and how to get a ticket. */
function Spotlight({ site, e }: { site: PublicSite; e: PublicEvent }) {
  const opp = opponentOf(site, e)
  const team = teamOf(site, e)
  const home = e.homeAway === 'home'
  const isToday = e.date === todayISO()
  return (
    <div className="spotlight">
      <div className="sp-kicker">{isToday ? 'Today' : 'Next up'}{team ? ` · ${team.name}` : ''}</div>
      <div className="sp-match">
        <Crest src={site.school.logo} initials={site.school.initials} size={64} />
        <span className="sp-vs">{home ? 'vs' : 'at'}</span>
        <Crest src={opp?.logo ?? null} initials={(opp?.name ?? e.opponent).slice(0, 2).toUpperCase()} tint={opp?.tint} size={64} />
      </div>
      <div className="sp-opp">{opp?.name ?? e.opponent}</div>
      <div className="sp-when">
        {fmtDate(e.date, { weekday: 'long', month: 'long' })} · {fmtTime(e.time)}
      </div>
      {e.venue && <div className="sp-where">{e.venue}</div>}
      <div className="sp-actions">
        <Link to={`/game/${e.id}`} className="btn light">Game details</Link>
        {e.ticketLink && <a className="btn ghost-light" href={e.ticketLink} target="_blank" rel="noreferrer">Tickets</a>}
        {e.broadcastLink && <a className="btn ghost-light" href={e.broadcastLink} target="_blank" rel="noreferrer">Watch</a>}
      </div>
    </div>
  )
}

/** The next seven days, a day at a time. */
function ThisWeek({ site }: { site: PublicSite }) {
  const days = thisWeek(site, 7)
  const today = todayISO()
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>This week</h2>
        <Link to="/schedule">Full schedule →</Link>
      </div>
      {days.length === 0
        ? <p className="empty" style={{ padding: '4px 16px 16px' }}>No games in the next seven days.</p>
        : days.map(d => (
            <div key={d.date} className="tw-day">
              <div className="tw-date">
                {d.date === today ? 'Today' : fmtDate(d.date, { weekday: 'long', month: 'short' })}
              </div>
              {d.games.map(e => {
                const team = teamOf(site, e)
                const home = e.homeAway === 'home'
                return (
                  <Link key={e.id} to={`/game/${e.id}`} className="tw-game">
                    <span className="tw-time">{fmtTime(e.time)}</span>
                    <span className="tw-main">
                      <span className="tw-team">{team?.name ?? `${e.level} ${e.sport}`}</span>
                      <span className="tw-opp">{home ? 'vs' : 'at'} {e.opponent}</span>
                    </span>
                    <span className={`ha ${home ? 'home' : ''}`}>{home ? 'HOME' : 'AWAY'}</span>
                  </Link>
                )
              })}
            </div>
          ))}
    </section>
  )
}

/** The latest finals as score tiles. */
function Results({ site }: { site: PublicSite }) {
  const list = results(site, 8)
  if (list.length === 0) return null
  return (
    <section className="home-section">
      <div className="panel-head bare">
        <h2>Latest results</h2>
        <Link to="/schedule?when=past">All results →</Link>
      </div>
      <div className="score-strip">
        {list.map(e => {
          const sc = visibleScore(site, e)!
          const team = teamOf(site, e)
          return (
            <Link key={e.id} to={`/game/${e.id}`} className={`score-tile ${sc.result === 'W' ? 'win' : sc.result === 'L' ? 'loss' : ''}`}>
              <span className="st-team">{team?.name ?? e.sport}</span>
              <span className="st-score"><b>{sc.result}</b> {sc.us}–{sc.them}</span>
              <span className="st-opp">{e.homeAway === 'home' ? 'vs' : 'at'} {e.opponent}</span>
              <span className="st-date">{fmtDate(e.date, { weekday: undefined })}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function Home({ site }: { site: PublicSite }) {
  const next = upcoming(site, 1)[0]
  const news = visibleNews(site, { limit: 4 })
  const [lead, ...rest] = news
  const hasSocial = !!site.school.socials && Object.values(site.school.socials).some(Boolean)

  return (
    <>
      <section className="home-hero">
        <div className="hh-inner">
          <div className="hh-school">
            <Crest src={site.school.logo} initials={site.school.initials} size={104} />
            <div>
              <div className="hh-kicker">Home of the {site.school.mascot}</div>
              <h1>{site.school.name}</h1>
              <p>{site.school.city}, {site.school.state}</p>
              <SocialRow socials={site.school.socials} className="hh-social" label={site.school.shortName} />
            </div>
          </div>
          {next && <Spotlight site={site} e={next} />}
        </div>
      </section>

      <div className="wrap wide">
        <div className={`home-grid ${news.length ? '' : 'no-news'}`}>
          {news.length > 0 && (
            <section className="home-news">
              <div className="panel-head bare">
                <h2>Latest news</h2>
                <Link to="/news">All news →</Link>
              </div>
              <NewsCard site={site} n={lead} featured />
              {rest.length > 0 && (
                <div className="news-list">{rest.map(n => <NewsCard key={n.id} site={site} n={n} />)}</div>
              )}
            </section>
          )}
          <ThisWeek site={site} />
        </div>

        <Results site={site} />

        {hasSocial && (
          <section className="follow-band">
            <div>
              <h2>Follow the {site.school.mascot}</h2>
              <p>Scores, photos and game-day updates as they happen.</p>
            </div>
            <SocialRow socials={site.school.socials} className="follow-social" label={site.school.shortName} />
          </section>
        )}
      </div>
    </>
  )
}
