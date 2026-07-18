import { Link } from 'react-router-dom'
import type { SportEvent } from '../types'
import { fmtTime } from '../lib/dates'
import { Badge, HomeAwayBadge, StatusBadge } from './ui'
import { I } from './icons'

export function EventRow({ e, showDate, conflict }: { e: SportEvent; showDate?: boolean; conflict?: boolean }) {
  const unfilled = e.staffSlots.filter(s => s.status === 'unfilled' || s.status === 'declined').length
  return (
    <Link to={`/events/${e.id}`} className="ev-row">
      <div className="ev-time">
        {showDate && <div className="tiny">{e.date.slice(5).replace('-', '/')}</div>}
        {fmtTime(e.time)}
      </div>
      <div className="ev-main">
        <div className="ev-title">
          {e.sport} {e.level !== 'Varsity' ? `(${e.level})` : ''} {e.homeAway === 'home' ? 'vs' : e.homeAway === 'away' ? 'at' : '·'} {e.opponent}
        </div>
        <div className="ev-meta">
          <span>{e.venue}</span>
          {e.designation && <Badge tone="brand">{e.designation}</Badge>}
          {e.multiDay && <Badge tone="outline">{e.multiDay}</Badge>}
          {conflict && <Badge tone="warn"><I.warn /> Venue conflict</Badge>}
        </div>
      </div>
      <div className="ev-badges">
        {e.score && (
          <Badge tone={e.score.result === 'W' ? 'ok' : 'danger'}>{e.score.result} {e.score.us}–{e.score.them}</Badge>
        )}
        {!e.score && unfilled > 0 && <Badge tone="danger">{unfilled} unfilled</Badge>}
        {!e.score && e.broadcastStatus !== 'none' && e.broadcastStatus !== 'archived' && <Badge tone="info"><I.broadcast /> Broadcast</Badge>}
        <HomeAwayBadge ha={e.homeAway} />
        {!e.score && <StatusBadge status={e.status} />}
      </div>
    </Link>
  )
}
