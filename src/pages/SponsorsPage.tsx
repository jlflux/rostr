import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { agreementPaid, agreements as allAgreements, can, fulfillmentProgress, sponsors as allSponsors, sponsorshipTotals } from '../lib/derive'
import { fmtMoney } from '../lib/dates'
import { Badge, Field, Modal, Progress, SearchBox, StatCard, StatusBadge } from '../components/ui'
import { I } from '../components/icons'
import type { Agreement, Sponsor, SponsorTier } from '../types'

const TIER_ORDER: SponsorTier[] = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']

export function TierBadge({ tier }: { tier: SponsorTier }) {
  const tone = tier === 'Red' ? 'brand' : tier === 'Blue' ? 'info' : tier === 'White' ? 'outline' : tier === 'Add-On' ? 'warn' : 'neutral'
  return <Badge tone={tone as any}>{tier}</Badge>
}

export default function SponsorsPage() {
  const { state, add, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tier, setTier] = useState('')
  const [payment, setPayment] = useState('')
  const [creating, setCreating] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const totals = sponsorshipTotals(state)

  const rows = useMemo(() => {
    let sps = allSponsors(state)
    const term = q.trim().toLowerCase()
    if (term) sps = sps.filter(s => s.name.toLowerCase().includes(term) || s.contactName.toLowerCase().includes(term))
    if (tier) sps = sps.filter(s => s.tier === tier)
    let out = sps.map(s => ({ sponsor: s, agreement: allAgreements(state).find(a => a.sponsorId === s.id) }))
    if (payment) out = out.filter(r => r.agreement?.paymentStatus === payment)
    return out.sort((a, b) => TIER_ORDER.indexOf(a.sponsor.tier) - TIER_ORDER.indexOf(b.sponsor.tier) || (b.agreement?.amount ?? 0) - (a.agreement?.amount ?? 0))
  }, [state, q, tier, payment])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Sponsors</h1>
          <p className="page-sub">Fall 2026 sponsorship program · {totals.count} agreements</p>
        </div>
        {can(me.role, 'edit') && <button className="btn primary" onClick={() => setCreating(true)}><I.plus /> New sponsor</button>}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total sponsorship" value={fmtMoney(totals.total)} hint={`${totals.count} agreements`} />
        <StatCard label="Collected" value={fmtMoney(totals.collected)} tone="ok" hint={`${Math.round((totals.collected / Math.max(totals.total, 1)) * 100)}% of committed`} />
        <StatCard label="Outstanding" value={fmtMoney(totals.outstanding)} tone={totals.outstanding > 0 ? 'alert' : 'ok'} />
        <StatCard label="Missing logos" value={allSponsors(state).filter(s => s.logoStatus !== 'received').length} tone="warn" hint="Blocking video-board & web placement" />
      </div>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search sponsors…" />
        <select className="inline-select" value={tier} onChange={e => setTier(e.target.value)} aria-label="Tier filter">
          <option value="">All tiers</option>
          {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="inline-select" value={payment} onChange={e => setPayment(e.target.value)} aria-label="Payment filter">
          <option value="">Any payment status</option>
          <option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option>
        </select>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Sponsor</th><th>Tier</th><th className="num">Agreement</th><th className="num">Outstanding</th><th>Payment</th><th>Logo</th><th style={{ minWidth: 140 }}>Fulfillment</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7}><div className="empty"><h4>No sponsors match</h4><p>Adjust the search or filters.</p></div></td></tr>}
            {rows.map(({ sponsor: s, agreement: a }) => {
              const prog = a ? fulfillmentProgress(a) : { done: 0, total: 0 }
              return (
                <tr key={s.id} className="clickable" onClick={() => navigate(`/sponsors/${s.id}`)}>
                  <td><span className="primary">{s.name}</span><div className="tiny">{s.contactName}</div></td>
                  <td><TierBadge tier={s.tier} /></td>
                  <td className="num">{a ? fmtMoney(a.amount) : '—'}</td>
                  <td className="num" style={{ color: a && agreementPaid(a) < a.amount ? 'var(--danger)' : undefined }}>
                    {a ? fmtMoney(Math.max(a.amount - agreementPaid(a), 0)) : '—'}
                  </td>
                  <td>{a && <StatusBadge status={a.paymentStatus} />}</td>
                  <td><StatusBadge status={s.logoStatus} label={s.logoStatus === 'received' ? 'Received' : s.logoStatus === 'missing' ? 'Missing' : 'Needs update'} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1 }}><Progress value={prog.done} max={prog.total} /></div>
                      <span className="tiny">{prog.done}/{prog.total}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && <SponsorForm onClose={() => setCreating(false)} onSave={(s, a) => {
        add('sponsors', s)
        add('agreements', a)
        logActivity(`added sponsor ${s.name} (${s.tier}, ${fmtMoney(a.amount)})`, `/sponsors/${s.id}`)
        toast('Sponsor created')
        setCreating(false)
        navigate(`/sponsors/${s.id}`)
      }} />}
    </>
  )
}

function SponsorForm({ onClose, onSave }: { onClose: () => void; onSave: (s: Sponsor, a: Agreement) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState({ name: '', tier: 'Blue' as SponsorTier, contactName: '', email: '', phone: '', amount: '3000', renewalDate: '2027-06-01' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Business name is required.'
    if (!form.contactName.trim()) errs.contactName = 'A contact name is required.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    const amt = Number(form.amount)
    if (Number.isNaN(amt) || amt <= 0) errs.amount = 'Enter a positive dollar amount.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const id = `sp-new-${Date.now()}`
    onSave(
      {
        id, orgId: state.currentOrgId, name: form.name.trim(), tier: form.tier, contactName: form.contactName.trim(),
        email: form.email || undefined, phone: form.phone || undefined, logoStatus: 'missing',
        renewalDate: form.renewalDate, notes: [], benefitSummary: `${form.tier} tier package`,
      },
      {
        id: `ag-new-${Date.now()}`, orgId: state.currentOrgId, sponsorId: id, season: 'Fall 2026', amount: amt,
        paymentStatus: 'unpaid', payments: [],
        fulfillment: [
          { id: `${id}-logo`, label: 'Logo received', status: 'pending', dueDate: undefined },
          { id: `${id}-vboard`, label: 'Video-board upload complete', status: 'pending' },
          { id: `${id}-web`, label: 'Website placement complete', status: 'pending' },
          { id: `${id}-pa`, label: 'PA copy approved', status: 'pending' },
        ],
      },
    )
  }

  return (
    <Modal title="New sponsor" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Create sponsor</button>
      </>
    }>
      <Field label="Business name" required error={errors.name}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Valley Bank" />
      </Field>
      <div className="form-row">
        <Field label="Tier" required>
          <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value as SponsorTier }))}>
            {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Agreement amount ($)" required error={errors.amount}>
          <input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Contact name" required error={errors.contactName}>
          <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
        </Field>
        <Field label="Contact email" error={errors.email}>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@business.com" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Phone">
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="Renewal date">
          <input type="date" value={form.renewalDate} onChange={e => setForm(f => ({ ...f, renewalDate: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  )
}
