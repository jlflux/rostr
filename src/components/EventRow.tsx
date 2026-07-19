import { Link } from 'react-router-dom'
import type { Opponent, SportEvent } from '../types'
import { fmtDate, fmtTime } from '../lib/dates'
import { broadcastState, matchupLabel, visibleScore, visibleStatus } from '../lib/derive'
import { useStore } from '../store/store'
import { Badge, HomeAwayBadge, StatusBadge } from './ui'
import { I, SportIcon } from './icons'

export function EventRow({ e, showDate, conflict }: { e: SportEvent; showDate?: boolean; conflict?: boolean }) {
  const { state } = useStore()
  const score = visibleScore(state, e)
  const unfilled = e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length
  const bcast = broadcastState(e)
  return (
    <Link to={`/events/${e.id}`} className="ev-row">
      <div className="ev-time">
        {showDate && <div className="ev-date">{fmtDate(e.date, { month: 'short', day: 'numeric' })}</div>}
        <div className={showDate ? 'tiny' : 'ev-date'}>{fmtTime(e.time)}</div>
      </div>
      <SportIcon sport={e.sport} />
      <div className="ev-main">
        <div className="ev-title">{matchupLabel(e)}</div>
        <div className="ev-meta">
          <HomeAwayBadge ha={e.homeAway} />
          <span style={e.homeAway === 'home' ? { fontWeight: 700, color: 'var(--text)' } : undefined}>{e.venue}</span>
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
        {!score && (bcast === 'confirmed' || bcast === 'in_progress') && (
          <Badge tone={bcast === 'confirmed' ? 'info' : 'warn'}><I.broadcast /> {bcast === 'confirmed' ? 'Broadcast' : 'Broadcast setup'}</Badge>
        )}
        {!score && <StatusBadge status={visibleStatus(state, e)} />}
      </div>
    </Link>
  )
}
