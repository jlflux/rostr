import { useStore } from '../store/store'
import { agreementPaid, agreements as allAgreements, fulfillmentProgress, requests as allRequests, revenueByDepartment, sponsors as allSponsors, sponsorshipTotals, tasks as allTasks, teamCompleteness, teamEarmarks, teams as allTeams, events as allEvents } from '../lib/derive'
import { fmtDate, fmtMoney } from '../lib/dates'
import { Badge, Card, Empty, StatCard, StatusBadge } from '../components/ui'
import { Link } from 'react-router-dom'

function Bar({ label, value, max, display, brand }: { label: string; value: number; max: number; display?: string; brand?: boolean }) {
  return (
    <div className="rep-bar-row">
      <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div className={`rep-bar ${brand ? 'brand' : ''}`}><div style={{ width: `${max ? Math.min((value / max) * 100, 100) : 0}%` }} /></div>
      <span className="small num" style={{ textAlign: 'right' }}>{display ?? value}</span>
    </div>
  )
}

export default function ReportsPage() {
  const { state } = useStore()
  const totals = sponsorshipTotals(state)
  const ags = allAgreements(state)
  const sps = allSponsors(state)
  const evs = allEvents(state)
  const reqs = allRequests(state)
  const tks = allTasks(state)
  const tms = allTeams(state)

  // Revenue by tier
  const tiers = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']
  const byTier = tiers.map(t => {
    const tierAgs = ags.filter(a => sps.find(s => s.id === a.sponsorId)?.tier === t)
    return { tier: t, total: tierAgs.reduce((n, a) => n + a.amount, 0), collected: tierAgs.reduce((n, a) => n + agreementPaid(a), 0), count: tierAgs.length }
  }).filter(x => x.count > 0)
  const maxTier = Math.max(...byTier.map(x => x.total))

  // Events hosted by sport
  const sports = [...new Set(evs.map(e => e.sport))]
  const hosted = sports.map(s => ({ sport: s, count: evs.filter(e => e.sport === s && e.homeAway === 'home').length })).sort((a, b) => b.count - a.count)

  const played = evs.filter(e => e.date < state.demoToday)
  const broadcastsDone = played.filter(e => e.broadcastStatus === 'archived').length
  const allSlots = evs.flatMap(e => e.staffSlots)
  const filledSlots = allSlots.filter(s => s.userId).length

  const reqByType = [...new Set(reqs.map(r => r.type))].map(t => ({
    type: t, total: reqs.filter(r => r.type === t).length, done: reqs.filter(r => r.type === t && r.status === 'completed').length,
  })).sort((a, b) => b.total - a.total)

  const content = tks.filter(t => t.kind === 'content')
  const contentDue = content.filter(t => t.dueDate <= state.demoToday)
  const contentDone = contentDue.filter(t => t.status === 'done')

  const renewals = sps.map(s => ({ s, a: ags.find(a => a.sponsorId === s.id) }))
    .sort((x, y) => x.s.renewalDate.localeCompare(y.s.renewalDate)).slice(0, 8)

  // Revenue split by department: athletic dept keeps whatever isn't earmarked to a team
  const byDept = revenueByDepartment(state)
  const maxDept = Math.max(1, ...byDept.map(d => d.total))
  const earmarks = teamEarmarks(state)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Operational reporting for the Fall 2026 season (through {fmtDate(state.demoToday, { month: 'long', day: 'numeric' })}).</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Sponsorship revenue" value={fmtMoney(totals.total)} hint={`${totals.count} agreements`} />
        <StatCard label="Collected vs outstanding" value={`${Math.round((totals.collected / Math.max(totals.total, 1)) * 100)}%`} tone={totals.outstanding > totals.collected ? 'alert' : 'ok'} hint={`${fmtMoney(totals.collected)} in · ${fmtMoney(totals.outstanding)} due`} />
        <StatCard label="Events hosted to date" value={played.filter(e => e.homeAway === 'home').length} hint={`${broadcastsDone} broadcasts completed`} />
        <StatCard label="Staffing fill rate" value={`${allSlots.length ? Math.round((filledSlots / allSlots.length) * 100) : 0}%`} hint={`${filledSlots}/${allSlots.length} roles filled`} />
      </div>

      <div className="grid grid-2">
        <Card title="Revenue by department" action={<span className="tiny">Unearmarked money stays with athletics</span>}>
          {byDept.length === 0 && <Empty title="No revenue recorded" />}
          {byDept.map(d => (
            <Bar key={d.target} label={d.label} value={d.total} max={maxDept} display={fmtMoney(d.total)} brand={d.target === 'athletics'} />
          ))}
          {byDept.length > 0 && (
            <>
              <div className="divider" />
              <p className="small muted" style={{ margin: 0 }}>
                {fmtMoney(byDept.find(d => d.target === 'athletics')?.total ?? 0)} to the athletic department ·{' '}
                {fmtMoney(byDept.filter(d => d.target !== 'athletics').reduce((n, d) => n + d.total, 0))} earmarked to teams
              </p>
            </>
          )}
        </Card>

        <Card title="Team earmarks & credit notes" pad={false}>
          {earmarks.length === 0 && <div style={{ padding: 16 }}><Empty title="No team earmarks" hint="Split a buy toward a team on the sponsor page to earmark money." /></div>}
          {earmarks.length > 0 && (
            <table className="tbl">
              <thead><tr><th>Team</th><th>Sponsor</th><th className="num">Amount</th><th>Note</th></tr></thead>
              <tbody>
                {earmarks.map(e => (
                  <tr key={e.id}>
                    <td>{e.label}</td>
                    <td><Link className="link" to={`/sponsors/${e.sponsorId}`}>{e.sponsorName}</Link></td>
                    <td className="num">{fmtMoney(e.amount)}</td>
                    <td className="small muted">{e.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Sponsorship revenue by tier">
          {byTier.map(x => <Bar key={x.tier} label={`${x.tier} (${x.count})`} value={x.total} max={maxTier} display={fmtMoney(x.total)} brand />)}
          <div className="divider" />
          {byTier.map(x => <Bar key={x.tier} label={`${x.tier} collected`} value={x.collected} max={maxTier} display={fmtMoney(x.collected)} />)}
        </Card>

        <Card title="Sponsor fulfillment" pad={false}>
          <table className="tbl">
            <thead><tr><th>Sponsor</th><th>Payment</th><th style={{ width: 130 }}>Fulfillment</th></tr></thead>
            <tbody>
              {ags.filter(a => a.amount >= 3000).map(a => {
                const s = sps.find(x => x.id === a.sponsorId)!
                const p = fulfillmentProgress(a)
                return (
                  <tr key={a.id}>
                    <td><Link className="link" to={`/sponsors/${s.id}`}>{s.name}</Link></td>
                    <td><StatusBadge status={a.paymentStatus} /></td>
                    <td><span className="small num">{p.done}/{p.total} complete</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Upcoming renewals" pad={false}>
          <table className="tbl">
            <thead><tr><th>Sponsor</th><th>Renewal date</th><th className="num">Current value</th></tr></thead>
            <tbody>
              {renewals.map(({ s, a }) => (
                <tr key={s.id}>
                  <td><Link className="link" to={`/sponsors/${s.id}`}>{s.name}</Link></td>
                  <td>{fmtDate(s.renewalDate, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="num">{a ? fmtMoney(a.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Events hosted by sport (home)">
          {hosted.map(h => <Bar key={h.sport} label={h.sport} value={h.count} max={Math.max(...hosted.map(x => x.count))} />)}
        </Card>

        <Card title="Coach request volume & completion">
          {reqByType.map(r => <Bar key={r.type} label={r.type} value={r.total} max={Math.max(...reqByType.map(x => x.total))} display={`${r.done}/${r.total} done`} />)}
          <div className="divider" />
          <p className="small muted" style={{ margin: 0 }}>
            {reqs.filter(r => r.status === 'completed').length} of {reqs.length} requests completed ·{' '}
            {reqs.filter(r => r.status === 'submitted').length} awaiting review
          </p>
        </Card>

        <Card title="Content reminders & team completeness">
          <Bar label="Content due to date" value={contentDone.length} max={Math.max(contentDue.length, 1)} display={`${contentDone.length}/${contentDue.length} posted`} brand />
          <div className="divider" />
          {tms.map(t => <Bar key={t.id} label={t.name} value={teamCompleteness(state, t.id)} max={100} display={`${teamCompleteness(state, t.id)}%`} />)}
        </Card>
      </div>
    </>
  )
}
