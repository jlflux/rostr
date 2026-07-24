import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { PIPELINE_STAGES, can, fulfillmentForTier, fulfillmentProgress, sponsorAgreements, sponsorPaid, sponsorPaymentStatus, sponsorProgramTotals, sponsorTotal, sponsors as allSponsors } from '../lib/derive'
import { fmtMoney } from '../lib/dates'
import { Badge, Empty, Field, Modal, Progress, SearchBox, Seg, SortTh, StatCard, StatusBadge, sortRows, useSort } from '../components/ui'
import { I } from '../components/icons'
import type { Agreement, PipelineStage, Sponsor, SponsorTier } from '../types'

const TIER_ORDER: SponsorTier[] = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']

export function TierBadge({ tier }: { tier: SponsorTier }) {
  const tone = tier === 'Red' ? 'brand' : tier === 'Blue' ? 'info' : tier === 'White' ? 'outline' : tier === 'Add-On' ? 'warn' : 'neutral'
  return <Badge tone={tone as any}>{tier}</Badge>
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const cfg = PIPELINE_STAGES.find(p => p.value === stage)!
  const tone = stage === 'committed' ? 'ok' : stage === 'declined' ? 'danger' : stage === 'maybe' ? 'warn' : stage === 'contacted' ? 'info' : 'outline'
  return <Badge tone={tone as any}>{cfg.label}</Badge>
}

export default function SponsorsPage() {
  const { state, add, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tier, setTier] = useState('')
  const [payment, setPayment] = useState('')
  const [creating, setCreating] = useState<false | 'sponsor' | 'prospect'>(false)
  const [view, setView] = useState<'committed' | 'pipeline'>('committed')
  const me = state.users.find(u => u.id === state.currentUserId)!
  const totals = sponsorProgramTotals(state)
  const editable = can(me.role, 'edit')
  const pipeline = allSponsors(state).filter(s => s.stage !== 'committed')

  type SortKey = 'name' | 'tier' | 'total' | 'outstanding' | 'payment' | 'logo' | 'fulfillment'
  const { sort, onSort } = useSort<SortKey>('tier')

  const rows = useMemo(() => {
    let sps = allSponsors(state).filter(s => s.stage === 'committed')
    const term = q.trim().toLowerCase()
    if (term) sps = sps.filter(s => s.name.toLowerCase().includes(term) || s.contactName.toLowerCase().includes(term))
    if (tier) sps = sps.filter(s => s.tier === tier)
    let out = sps.map(s => {
      const ags = sponsorAgreements(state, s.id)
      const prog = ags.reduce((acc, a) => { const p = fulfillmentProgress(a); return { done: acc.done + p.done, total: acc.total + p.total } }, { done: 0, total: 0 })
      return {
        sponsor: s,
        total: sponsorTotal(state, s.id),
        paid: sponsorPaid(state, s.id),
        pay: sponsorPaymentStatus(state, s.id),
        buys: ags.length,
        prog,
      }
    })
    if (payment) out = out.filter(r => r.pay === payment)
    // Stable base order (highest value first) so within-tier ties stay sensible.
    return out.sort((a, b) => b.total - a.total)
  }, [state, q, tier, payment])

  const sorted = useMemo(() => sortRows(rows, sort, (r, key): unknown => {
    switch (key) {
      case 'name': return r.sponsor.name
      case 'tier': return TIER_ORDER.indexOf(r.sponsor.tier)
      case 'total': return r.total
      case 'outstanding': return Math.max(r.total - r.paid, 0)
      case 'payment': return r.pay
      case 'logo': return r.sponsor.logoStatus
      case 'fulfillment': return r.prog.total ? r.prog.done / r.prog.total : -1
      default: return ''
    }
  }), [rows, sort])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Sponsors</h1>
          <p className="page-sub">Fall 2026 sponsorship program · {totals.committedCount} accepted sponsors</p>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setCreating('prospect')}><I.plus /> New prospect</button>
            <button className="btn primary" onClick={() => setCreating('sponsor')}><I.plus /> New sponsor</button>
          </div>
        )}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total sponsorship" value={fmtMoney(totals.total)} hint={`${totals.committedCount} accepted sponsor${totals.committedCount === 1 ? '' : 's'}`} />
        <StatCard label="Amount collected" value={fmtMoney(totals.collected)} tone="ok"
          hint={`${fmtMoney(totals.outstanding)} outstanding / owed`} />
        <StatCard label="Total potential" value={fmtMoney(totals.potential)}
          hint={totals.pipelineCount > 0 ? `incl. ${fmtMoney(totals.pipelineValue)} from ${totals.pipelineCount} in pipeline` : 'no active pipeline'} />
        <StatCard label="Missing assets" value={totals.missingAssets} tone={totals.missingAssets > 0 ? 'warn' : 'ok'} hint="Sponsors without a full fulfillment bar" />
      </div>

      <div className="toolbar">
        <Seg options={[{ value: 'committed', label: `Sponsors (${allSponsors(state).filter(s => s.stage === 'committed').length})` }, { value: 'pipeline', label: `Sales pipeline (${pipeline.length})` }]} value={view} onChange={setView} />
        <div className="spacer" />
        {view === 'committed' && (
          <>
            <SearchBox value={q} onChange={setQ} placeholder="Search sponsors…" />
            <select className="inline-select" value={tier} onChange={e => setTier(e.target.value)} aria-label="Tier filter">
              <option value="">All tiers</option>
              {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="inline-select" value={payment} onChange={e => setPayment(e.target.value)} aria-label="Payment filter">
              <option value="">Any payment status</option>
              <option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option>
            </select>
          </>
        )}
      </div>

      {view === 'pipeline' && <PipelineBoard editable={editable} />}

      {view === 'committed' && (

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <SortTh label="Sponsor" k="name" sort={sort} onSort={onSort} />
              <SortTh label="Tier" k="tier" sort={sort} onSort={onSort} />
              <SortTh label="Total value" k="total" sort={sort} onSort={onSort} className="num" />
              <SortTh label="Outstanding" k="outstanding" sort={sort} onSort={onSort} className="num" />
              <SortTh label="Payment" k="payment" sort={sort} onSort={onSort} />
              <SortTh label="Logo" k="logo" sort={sort} onSort={onSort} />
              <SortTh label="Fulfillment" k="fulfillment" sort={sort} onSort={onSort} style={{ minWidth: 140 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={7}><div className="empty"><h4>No sponsors match</h4><p>Adjust the search or filters.</p></div></td></tr>}
            {sorted.map(({ sponsor: s, total, paid, pay, buys, prog }) => {
              return (
                <tr key={s.id} className="clickable" onClick={() => navigate(`/sponsors/${s.id}`)}>
                  <td><span className="primary">{s.name}</span><div className="tiny">{s.contactName}{buys > 1 ? ` · ${buys} buys` : ''}</div></td>
                  <td><TierBadge tier={s.tier} /></td>
                  <td className="num">{total ? fmtMoney(total) : '—'}</td>
                  <td className="num" style={{ color: paid < total ? 'var(--danger)' : undefined }}>
                    {total ? fmtMoney(Math.max(total - paid, 0)) : '—'}
                  </td>
                  <td>{total > 0 && <StatusBadge status={pay} />}</td>
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

      )}

      {creating === 'sponsor' && <SponsorForm onClose={() => setCreating(false)} onSave={(s, a) => {
        add('sponsors', s)
        add('agreements', a)
        logActivity(`added sponsor ${s.name} (${s.tier}, ${fmtMoney(a.amount)})`, `/sponsors/${s.id}`)
        toast('Sponsor created')
        setCreating(false)
        navigate(`/sponsors/${s.id}`)
      }} />}
      {creating === 'prospect' && <ProspectForm onClose={() => setCreating(false)} onSave={sp => {
        add('sponsors', sp)
        logActivity(`added sponsor prospect ${sp.name}`, `/sponsors/${sp.id}`)
        toast('Prospect added to the pipeline')
        setCreating(false)
        setView('pipeline')
      }} />}
    </>
  )
}

function PipelineBoard({ editable }: { editable: boolean }) {
  const { state, update, add, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const [accepting, setAccepting] = useState<Sponsor | null>(null)
  const pipeline = allSponsors(state).filter(s => s.stage !== 'committed')
  type PKey = 'name' | 'contact' | 'tier' | 'value'
  const { sort, onSort } = useSort<PKey>('name')
  const sortStage = (items: Sponsor[]) => sortRows(items, sort, (sp, key): unknown =>
    key === 'contact' ? sp.contactName : key === 'tier' ? TIER_ORDER.indexOf(sp.tier) : key === 'value' ? (sp.estValue ?? 0) : sp.name)

  const changeStage = (sp: Sponsor, stage: PipelineStage) => {
    if (stage === 'committed') { setAccepting(sp); return } // capture the deal first
    update('sponsors', sp.id, { stage })
    logActivity(`moved ${sp.name} to ${PIPELINE_STAGES.find(p => p.value === stage)?.label} in the sponsor pipeline`, `/sponsors/${sp.id}`)
    toast(`${sp.name} → ${PIPELINE_STAGES.find(p => p.value === stage)?.label}`)
  }

  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>
        Track sponsors before the sale: prospects you've talked about, outreach in flight, maybes, and passes.
        Marking one <strong>Accepted</strong> creates their agreement and adds them to the sponsor directory.
      </p>
      {PIPELINE_STAGES.filter(st => st.value !== 'committed').map(st => {
        const items = pipeline.filter(s => s.stage === st.value)
        return (
          <div key={st.value} style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 750, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {st.label} <span className="tiny">{items.length} · {st.hint}</span>
            </h2>
            <div className="card tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  <SortTh label="Business" k="name" sort={sort} onSort={onSort} />
                  <SortTh label="Contact" k="contact" sort={sort} onSort={onSort} />
                  <SortTh label="Target tier" k="tier" sort={sort} onSort={onSort} />
                  <SortTh label="Est. value" k="value" sort={sort} onSort={onSort} className="num" />
                  <th>Latest note</th><th style={{ width: 150 }}>Stage</th>
                </tr></thead>
                <tbody>
                  {items.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ padding: '18px' }}><p style={{ margin: 0 }}>No sponsors in this stage.</p></div></td></tr>}
                  {sortStage(items).map(sp => (
                    <tr key={sp.id} className="clickable" onClick={() => navigate(`/sponsors/${sp.id}`)}>
                      <td><span className="primary">{sp.name}</span></td>
                      <td className="muted small">{sp.contactName}</td>
                      <td><TierBadge tier={sp.tier} /></td>
                      <td className="num">{sp.estValue ? fmtMoney(sp.estValue) : '—'}</td>
                      <td className="muted small" style={{ maxWidth: 380 }}>{sp.notes[0]?.text ?? '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {editable ? (
                          <select className="inline-select" value={sp.stage} onChange={e => changeStage(sp, e.target.value as PipelineStage)} aria-label="Pipeline stage">
                            {PIPELINE_STAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                        ) : <StageBadge stage={sp.stage} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      {accepting && (
        <AcceptModal sponsor={accepting} onClose={() => setAccepting(null)} onAccept={(amount, tier) => {
          const sp = accepting
          update('sponsors', sp.id, { stage: 'committed', tier, benefitSummary: `${tier} tier package` })
          add('agreements', {
            id: `ag-${sp.id.slice(3)}-${Date.now()}`, orgId: state.currentOrgId, sponsorId: sp.id, season: 'Fall 2026',
            label: `${tier} sponsorship`, amount, paymentStatus: 'unpaid', payments: [],
            fulfillment: fulfillmentForTier(state, tier),
            allocations: [{ id: `${sp.id}-alloc-ath`, target: 'athletics', amount }],
          } as Agreement)
          logActivity(`accepted ${sp.name} as a ${tier} sponsor (${fmtMoney(amount)})`, `/sponsors/${sp.id}`)
          toast(`${sp.name} accepted — now in the sponsor directory`)
          setAccepting(null)
          navigate(`/sponsors/${sp.id}`)
        }} />
      )}
    </>
  )
}

function AcceptModal({ sponsor, onClose, onAccept }: { sponsor: Sponsor; onClose: () => void; onAccept: (amount: number, tier: SponsorTier) => void }) {
  const [amount, setAmount] = useState(sponsor.estValue ? String(sponsor.estValue) : '3000')
  const [tier, setTier] = useState<SponsorTier>(sponsor.tier)
  const [err, setErr] = useState('')
  return (
    <Modal title={`Accept ${sponsor.name}`} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          const amt = Number(amount)
          if (Number.isNaN(amt) || amt <= 0) { setErr('Enter the agreement amount.'); return }
          onAccept(amt, tier)
        }}>Accept & create sponsor</button>
      </>
    }>
      <p className="small muted" style={{ marginTop: 0 }}>This creates {sponsor.name}'s first agreement and moves them into the sponsor directory. You can add more buys or edit anything afterward.</p>
      <div className="form-row">
        <Field label="Tier">
          <select value={tier} onChange={e => setTier(e.target.value as SponsorTier)}>
            {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Agreement amount ($)" required error={err}>
          <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ProspectForm({ onClose, onSave }: { onClose: () => void; onSave: (s: Sponsor) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState({ name: '', contactName: '', tier: 'Blue' as SponsorTier, stage: 'prospect' as PipelineStage, estValue: '', note: '' })
  const [err, setErr] = useState('')
  return (
    <Modal title="New pipeline prospect" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          if (!form.name.trim()) { setErr('Business name is required.'); return }
          const id = `sp-pro-${Date.now()}`
          onSave({
            id, orgId: state.currentOrgId, name: form.name.trim(), stage: form.stage, tier: form.tier,
            contactName: form.contactName.trim() || 'TBD', logoStatus: 'missing', renewalDate: '2027-06-01',
            benefitSummary: `${form.tier} tier (proposed)`,
            estValue: Number(form.estValue) > 0 ? Number(form.estValue) : undefined,
            notes: form.note.trim() ? [{ id: `${id}-n1`, at: new Date().toISOString(), authorId: state.currentUserId, text: form.note.trim() }] : [],
          })
        }}>Add to pipeline</button>
      </>
    }>
      <Field label="Business name" required error={err}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Steel City Pops" />
      </Field>
      <div className="form-row">
        <Field label="Stage">
          <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as PipelineStage }))}>
            {PIPELINE_STAGES.filter(p => p.value !== 'committed').map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Target tier">
          <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value as SponsorTier }))}>
            {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Estimated value ($)">
        <input type="number" min={0} value={form.estValue} onChange={e => setForm(f => ({ ...f, estValue: e.target.value }))} placeholder="e.g. 3000 — counts toward Total potential" />
      </Field>
      <Field label="Contact">
        <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Who are we talking to?" />
      </Field>
      <Field label="Note">
        <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Context — who suggested them, what was said…" />
      </Field>
    </Modal>
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
        id, orgId: state.currentOrgId, name: form.name.trim(), stage: 'committed', tier: form.tier, contactName: form.contactName.trim(),
        email: form.email || undefined, phone: form.phone || undefined, logoStatus: 'missing',
        renewalDate: form.renewalDate, notes: [], benefitSummary: `${form.tier} tier package`,
      },
      {
        id: `ag-new-${Date.now()}`, orgId: state.currentOrgId, sponsorId: id, season: 'Fall 2026', amount: amt,
        paymentStatus: 'unpaid', payments: [],
        fulfillment: fulfillmentForTier(state, form.tier),
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
