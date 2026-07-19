import { Link } from 'react-router-dom'
import type { Opponent, SportEvent } from '../types'
import { fmtTime } from '../lib/dates'
import { visibleScore } from '../lib/derive'
import { useStore } from '../store/store'
import { Badge, HomeAwayBadge, StatusBadge } from './ui'
import { I } from './icons'

/** Circular opponent logo (mock: tinted circle stand-in until real art is uploaded). */
export function OpponentMark({ opponent, size = 26 }: { opponent?: Opponent; size?: number }) {
  if (!opponent) return null
  const hasLogo = !!opponent.logoAssetId
  return (
    <span
      className="opp-mark"
      title={`${opponent.name}${hasLogo ? '' : ' (no logo on file)'}`}
      style={{
        width: size, height: size,
        background: hasLogo ? opponent.tint : 'transparent',
        border: hasLogo ? 'none' : '1.5px dashed var(--border-strong)',
        color: hasLogo ? '#fff' : 'var(--text-3)',
        fontSize: size * 0.42,
      }}
    >
      {opponent.name.charAt(0)}
    </span>
  )
}

export function EventRow({ e, showDate, conflict }: { e: SportEvent; showDate?: boolean; conflict?: boolean }) {
  const { state } = useStore()
  const score = visibleScore(state, e)
  const opp = state.opponents.find(o => o.id === e.opponentId)
  const unfilled = e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length
  return (
    <Link to={`/events/${e.id}`} className="ev-row">
      <div className="ev-time">
        {showDate && <div className="tiny">{e.date.slice(5).replace('-', '/')}</div>}
        {fmtTime(e.time)}
      </div>
      <OpponentMark opponent={opp} />
      <div className="ev-main">
        <div className="ev-title">
          {e.sport} {e.level !== 'Varsity' ? `(${e.level})` : ''} {e.homeAway === 'home' ? 'vs' : e.homeAway === 'away' ? 'at' : '·'} {e.opponent}
        </div>
        <div className="ev-meta">
          <span>{e.venue}</span>
          {(e.gameType === 'region' || e.gameType === 'area') && <Badge tone="navy">{e.gameType === 'region' ? 'Region' : 'Area'}</Badge>}
          {e.designation && <Badge tone="brand">{e.designation}</Badge>}
          {e.multiDay && <Badge tone="outline">{e.multiDay}</Badge>}
          {conflict && <Badge tone="warn"><I.warn /> Venue conflict</Badge>}
        </div>
      </div>
      <div className="ev-badges">
        {score && (
          <Badge tone={score.result === 'W' ? 'ok' : 'danger'}>{score.result} {score.us}–{score.them}</Badge>
        )}
        {!score && unfilled > 0 && <Badge tone="danger">{unfilled} unfilled</Badge>}
        {!score && e.broadcastStatus !== 'none' && e.broadcastStatus !== 'archived' && <Badge tone="info"><I.broadcast /> Broadcast</Badge>}
        <HomeAwayBadge ha={e.homeAway} />
        {!score && <StatusBadge status={e.status} />}
      </div>
    </Link>
  )
}
