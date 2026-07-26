import { useStore } from '../store/store'
import { agreementCash, agreementPaid, committedAgreements, requests as allRequests, revenueByDepartment, sponsors as allSponsors, sponsorshipTotals, tasks as allTasks, teamCompleteness, teams as allTeams, events as allEvents } from '../lib/derive'
import { fmtDate, fmtMoney, todayISO } from '../lib/dates'
import { Card, Empty, StatCard } from '../components/ui'
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

// A "nice" round axis maximum a step above the data, so even the biggest bar
// isn't full — it reads as a value on a scale, not as 100% of everything.
function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * mag
}

/** Clustered horizontal bars: Total (brand) and Collected (navy) per row, on a shared money scale. */
function GroupedBars({ rows }: { rows: { key: string; label: string; total: number; collected: number }[] }) {
  const max = niceMax(Math.max(1, ...rows.map(r => r.total)))
  return (
    <div className="gchart">
      <div className="gchart-legend">
        <span><span className="sw" style={{ background: 'var(--brand)' }} />Total</span>
        <span><span className="sw" style={{ background: 'var(--brand-navy)' }} />Collected</span>
        <span className="tiny" style={{ marginLeft: 'auto' }}>scale 0 – {fmtMoney(max)}</span>
      </div>
      {rows.map(r => (
        <div key={r.key} className="gchart-row">
          <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="gchart-bars">
            <div className="gchart-bar"><div className="gchart-track"><div className="total" style={{ width: `${(r.total / max) * 100}%` }} /></div><span className="gchart-val">{fmtMoney(r.total)}</span></div>
            <div className="gchart-bar"><div className="gchart-track"><div className="collected" style={{ width: `${(r.collected / max) * 100}%` }} /></div><span className="gchart-val">{fmtMoney(r.collected)}</span></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const { state } = useStore()
  const totals = sponsorshipTotals(state)
  const ags = committedAgreements(state)
  const sps = allSponsors(state).filter(s => s.stage === 'committed')
  const evs = allEvents(state)
  const reqs = allRequests(state)
  const tks = allTasks(state)
  const tms = allTeams(state)

  // Revenue by tier
  const tiers = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']
  const byTier = tiers.map(t => {
    const tierAgs = ags.filter(a => sps.find(s => s.id === a.sponsorId)?.tier === t)
    return { tier: t, total: tierAgs.reduce((n, a) => n + agreementCash(a), 0), collected: tierAgs.reduce((n, a) => n + agreementPaid(a), 0), count: tierAgs.length }
  }).filter(x => x.count > 0)

  // Events hosted by sport
  const sports = [...new Set(evs.map(e => e.sport))]
  const hosted = sports.map(s => ({ sport: s, count: evs.filter(e => e.sport === s && e.homeAway === 'home').length })).sort((a, b) => b.count - a.count)

  const played = evs.filter(e => e.date < todayISO())
  const broadcastsDone = played.filter(e => e.broadcastStatus === 'archived').length
  const allSlots = evs.flatMap(e => e.staffSlots)
  const filledSlots = allSlots.filter(s => s.userId).length

  const reqByType = [...new Set(reqs.map(r => r.type))].map(t => ({
    type: t, total: reqs.filter(r => r.type === t).length, done: reqs.filter(r => r.type === t && r.status === 'completed').length,
  })).sort((a, b) => b.total - a.total)

  const content = tks.filter(t => t.kind === 'content')
  const contentDue = content.filter(t => t.dueDate <= todayISO())
  const contentDone = contentDue.filter(t => t.status === 'done')

  const renewals = sps.map(s => ({ s, a: ags.find(a => a.sponsorId === s.id) }))
    .sort((x, y) => x.s.renewalDate.localeCompare(y.s.renewalDate)).slice(0, 8)

  // Revenue split by department: athletic dept keeps whatever isn't earmarked to a team
  const byDept = revenueByDepartment(state)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Operational reporting for the Fall 2026 season (through {fmtDate(todayISO(), { month: 'long', day: 'numeric' })}).</p>
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
          {byDept.length > 0 && (
            <>
              <GroupedBars rows={byDept.map(d => ({ key: d.target, label: d.label, total: d.total, collected: d.collected }))} />
              <div className="divider" />
              <p className="small muted" style={{ margin: 0 }}>
                {fmtMoney(byDept.find(d => d.target === 'athletics')?.total ?? 0)} to the athletic department ·{' '}
                {fmtMoney(byDept.filter(d => d.target !== 'athletics').reduce((n, d) => n + d.total, 0))} earmarked to sports
              </p>
            </>
          )}
        </Card>

        <Card title="Sponsorship revenue by tier">
          {byTier.length === 0 && <Empty title="No revenue recorded" />}
          {byTier.length > 0 && <GroupedBars rows={byTier.map(x => ({ key: x.tier, label: `${x.tier} (${x.count})`, total: x.total, collected: x.collected }))} />}
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
