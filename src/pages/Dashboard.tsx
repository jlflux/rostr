import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import {
  eventsThisWeek, missingSponsorAssets, obligationsDue, openRequests, overdueTasks,
  sponsorshipTotals, unfilledSlots, unpaidAgreements, upcomingBroadcasts, upcomingContent, agreementPaid,
} from '../lib/derive'
import { Avatar, Badge, Card, Empty, PriorityBadge, StatCard, StatusBadge } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { fmtDate, fmtDateLong, fmtDateTime, fmtMoney, fmtTime, relDue } from '../lib/dates'
import { I } from '../components/icons'

export default function Dashboard() {
  const { state, update, toast } = useStore()
  const week = eventsThisWeek(state)
  const home = week.filter(e => e.homeAway === 'home')
  const broadcasts = upcomingBroadcasts(state)
  const gaps = unfilledSlots(state).slice(0, 5)
  const unpaid = unpaidAgreements(state)
  const missingAssets = missingSponsorAssets(state)
  const obligations = obligationsDue(state)
  const reqs = openRequests(state)
  const overdue = overdueTasks(state)
  const content = upcomingContent(state)
  const totals = sponsorshipTotals(state)
  const user = state.users.find(u => u.id === state.currentUserId)
  const sponsorById = (id: string) => state.sponsors.find(s => s.id === id)

  if (state.currentOrgId !== 'org-hhs') {
    return (
      <>
        <div className="page-head">
          <div><h1 className="page-title">Dashboard</h1><p className="page-sub">{fmtDateLong(state.demoToday)}</p></div>
        </div>
        <Card><Empty icon="◎" title="This organization hasn't been set up yet"
          hint="Riverbend Academy is an empty tenant that shows Rostr is multi-school ready. Switch back to Homewood in the organization selector to explore the full demo." /></Card>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Good morning{user ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="page-sub">{fmtDateLong(state.demoToday)} · Here's what needs attention.</p>
        </div>
        <Link to="/calendar" className="btn navy">View calendar</Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Events this week" value={week.length} hint={`${home.length} at home`} />
        <StatCard label="Unfilled staff roles" value={gaps.reduce((n, g) => n + g.count, 0)} tone={gaps.length ? 'alert' : 'ok'} hint={gaps.length ? `across ${unfilledSlots(state).length} upcoming events` : 'All events covered'} />
        <StatCard label="Outstanding sponsorship" value={fmtMoney(totals.outstanding)} tone={totals.outstanding > 0 ? 'warn' : 'ok'} hint={`${unpaid.length} agreements not fully paid`} />
        <StatCard label="Open coach requests" value={reqs.length} tone={reqs.some(r => r.status === 'submitted') ? 'warn' : undefined} hint={`${reqs.filter(r => r.status === 'submitted').length} awaiting review`} />
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Events this week" action={<Link className="card-link" to="/events">All events →</Link>} pad={false}>
            <div style={{ padding: '10px 14px' }}>
              {week.length === 0 && <Empty title="No events this week" hint="Check the calendar for upcoming games." />}
              {week.slice(0, 8).map(e => <EventRow key={e.id} e={e} showDate />)}
              {week.length > 8 && <div style={{ textAlign: 'center', padding: 6 }}><Link className="link small" to="/calendar">+ {week.length - 8} more this week</Link></div>}
            </div>
          </Card>

          <Card title="Overdue tasks" action={<Badge tone={overdue.length ? 'danger' : 'ok'}>{overdue.length}</Badge>} pad={false}>
            {overdue.length === 0 && <Empty icon="✓" title="Nothing overdue" hint="All tasks are on schedule." />}
            {overdue.slice(0, 6).map(t => {
              const assignee = state.users.find(u => u.id === t.assigneeId)
              return (
                <div key={t.id} className="checklist-item" style={{ padding: '9px 18px' }}>
                  <button className="checkbox" onClick={() => { update('tasks', t.id, { status: 'done' }); toast('Task completed') }} aria-label="Complete task" />
                  <span className="label">
                    {t.title}
                    <div className="tiny">{relDue(t.dueDate, state.demoToday).label} · due {fmtDate(t.dueDate)}</div>
                  </span>
                  <PriorityBadge p={t.priority} />
                  <Avatar user={assignee} size="sm" />
                </div>
              )
            })}
          </Card>

          <Card title="Upcoming content reminders" action={<Link className="card-link" to="/events">Events →</Link>} pad={false}>
            {content.length === 0 && <Empty title="No content due in the next 7 days" />}
            {content.slice(0, 6).map(t => {
              const assignee = state.users.find(u => u.id === t.assigneeId)
              return (
                <div key={t.id} className="checklist-item" style={{ padding: '9px 18px' }}>
                  <button className="checkbox" onClick={() => { update('tasks', t.id, { status: 'done' }); toast('Reminder marked complete') }} aria-label="Complete reminder" />
                  <span className="label">
                    {t.title}
                    <div className="tiny">{t.contentKind} · {relDue(t.dueDate, state.demoToday).label}</div>
                  </span>
                  {t.eventId && <Link className="link small" to={`/events/${t.eventId}`}>Event</Link>}
                  <Avatar user={assignee} size="sm" />
                </div>
              )
            })}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Unfilled staff assignments" pad={false}>
            {gaps.length === 0 && <Empty icon="✓" title="Fully staffed" />}
            {gaps.map(g => (
              <Link key={g.event.id} to={`/events/${g.event.id}?tab=staffing`} className="notif-item">
                <span style={{ color: 'var(--danger)' }}><I.warn /></span>
                <span style={{ flex: 1 }}>
                  <strong>{g.event.sport} vs {g.event.opponent}</strong>
                  <div className="tiny">{fmtDate(g.event.date)} · {fmtTime(g.event.time)}</div>
                </span>
                <Badge tone="danger">{g.count} open</Badge>
              </Link>
            ))}
          </Card>

          <Card title="Upcoming broadcasts" pad={false}>
            {broadcasts.length === 0 && <Empty title="No broadcasts scheduled" />}
            {broadcasts.map(e => (
              <Link key={e.id} to={`/events/${e.id}`} className="notif-item">
                <span style={{ color: 'var(--info)' }}><I.broadcast /></span>
                <span style={{ flex: 1 }}>
                  {e.sport} {e.homeAway === 'home' ? 'vs' : 'at'} {e.opponent}
                  <div className="tiny">{fmtDate(e.date)} · {fmtTime(e.time)}</div>
                </span>
                <StatusBadge status={e.broadcastStatus} label={e.broadcastStatus === 'confirmed' ? 'Confirmed' : 'Planned'} />
              </Link>
            ))}
          </Card>

          <Card title="Unpaid agreements" action={<Link className="card-link" to="/reports">Report →</Link>} pad={false}>
            {unpaid.slice(0, 5).map(a => {
              const sp = sponsorById(a.sponsorId)
              return (
                <Link key={a.id} to={`/sponsors/${a.sponsorId}`} className="notif-item">
                  <span style={{ flex: 1 }}>
                    <strong>{sp?.name}</strong>
                    <div className="tiny">{sp?.tier} · {fmtMoney(a.amount)} agreement</div>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmtMoney(a.amount - agreementPaid(a))}</div>
                    <StatusBadge status={a.paymentStatus} />
                  </span>
                </Link>
              )
            })}
            {unpaid.length > 5 && <div style={{ padding: '8px 14px' }}><Link className="link small" to="/sponsors">+ {unpaid.length - 5} more</Link></div>}
          </Card>

          <Card title="Missing sponsor assets" pad={false}>
            {missingAssets.length === 0 && <Empty icon="✓" title="All sponsor assets in" />}
            {missingAssets.slice(0, 5).map(s => (
              <Link key={s.id} to={`/sponsors/${s.id}`} className="notif-item">
                <span style={{ flex: 1 }}><strong>{s.name}</strong><div className="tiny">{s.tier}</div></span>
                <StatusBadge status={s.logoStatus} />
              </Link>
            ))}
            {missingAssets.length > 5 && <div style={{ padding: '8px 14px' }}><Link className="link small" to="/sponsors">+ {missingAssets.length - 5} more</Link></div>}
          </Card>

          <Card title="Sponsor obligations due (14 days)" pad={false}>
            {obligations.length === 0 && <Empty icon="✓" title="No obligations due soon" />}
            {obligations.slice(0, 5).map((o, i) => (
              <Link key={i} to={`/sponsors/${o.agreement.sponsorId}`} className="notif-item">
                <span style={{ flex: 1 }}>
                  {o.label}
                  <div className="tiny">{sponsorById(o.agreement.sponsorId)?.name}</div>
                </span>
                <Badge tone={o.dueDate < state.demoToday ? 'danger' : 'warn'}>{fmtDate(o.dueDate)}</Badge>
              </Link>
            ))}
          </Card>

          <Card title="Recent activity" pad={false}>
            <div style={{ padding: '4px 18px' }}>
              {state.activity.slice(0, 7).map(a => {
                const u = state.users.find(x => x.id === a.userId)
                return (
                  <div key={a.id} className="feed-item">
                    <Avatar user={u} size="sm" />
                    <span>
                      <strong>{u?.name.split(' ')[0]}</strong> {a.text}
                      {a.link && <> · <Link className="link" to={a.link}>view</Link></>}
                      <div className="when">{fmtDateTime(a.at)}</div>
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
