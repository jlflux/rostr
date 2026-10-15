import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logoUrl, type PublicEvent, type PublicSite } from './api'
import { fmtDate, fmtTime, opponentOf, teamOf, todayISO, visibleScore } from './format'

// Varsity down, the way a program is listed everywhere else.
export const LEVEL_ORDER: Record<string, number> = { Varsity: 0, JV: 1, Freshman: 2, '8th Grade': 3, '7th Grade': 4 }

// ---------- shared bits ----------

export function Crest({ src, initials, tint, size = 44 }: {
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
export function GameCard({ site, e }: { site: PublicSite; e: PublicEvent }) {
  const opp = opponentOf(site, e)
  const team = teamOf(site, e)
  const home = e.homeAway === 'home'
  const score = visibleScore(site, e)
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
        {score
          ? <span className={`gc-score ${score.result === 'W' ? 'win' : score.result === 'L' ? 'loss' : ''}`}>
              {score.result} {score.us}–{score.them}
            </span>
          : <>
              {e.designation && <span className="tag">{e.designation}</span>}
              {/* Home/away is about going to the game, so it drops off once the
                  game has been played and no score has been posted. */}
              {e.date >= todayISO() &&
                <span className={`ha ${home ? 'home' : ''}`}>{home ? 'HOME' : 'AWAY'}</span>}
            </>}
      </span>
    </Link>
  )
}

