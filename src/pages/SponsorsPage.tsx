import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { PIPELINE_STAGES, can, currentUser, fulfillmentForTier, fulfillmentProgress, newBuyDefaults, sponsorAgreements, sponsorCash, sponsorPaid, sponsorPaymentStatus, sponsorProgramTotals, sponsorTrade, sponsors as allSponsors, teamEarmarks, tierSetting } from '../lib/derive'
import { fmtMoney, todayISO } from '../lib/dates'
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
  const [view, setView] = useState<'committed' | 'pipeline' | 'earmarks'>('committed')
  const me = currentUser(state)
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
        total: sponsorCash(state, s.id),   // cash = what counts toward revenue
        trade: sponsorTrade(state, s.id),
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
        <StatCard label="Total sponsorship" value={fmtMoney(totals.total)} hint={`${totals.committedCount} accepted · cash only${totals.trade > 0 ? ` · +${fmtMoney(totals.trade)} trade` : ''}`} />
        <StatCard label="Amount collected" value={fmtMoney(totals.collected)} tone="ok"
          hint={`${fmtMoney(totals.outstanding)} outstanding / owed`} />
        <StatCard label="Total potential" value={fmtMoney(totals.potential)}
          hint={totals.pipelineCount > 0 ? `incl. ${fmtMoney(totals.pipelineValue)} from ${totals.pipelineCount} in pipeline` : 'no active pipeline'} />
        <StatCard label="Missing assets" value={totals.missingAssets} tone={totals.missingAssets > 0 ? 'warn' : 'ok'} hint="Sponsors without a full fulfillment bar" />
      </div>

      <div className="toolbar">
        <Seg options={[{ value: 'committed', label: `Sponsors (${allSponsors(state).filter(s => s.stage === 'committed').length})` }, { value: 'pipeline', label: `Sales pipeline (${pipeline.length})` }, { value: 'earmarks', label: `Sport earmarks (${teamEarmarks(state).length})` }]} value={view} onChange={setView} />
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

      {view === 'earmarks' && <EarmarksView />}

      {view === 'committed' && (

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <SortTh label="Sponsor" k="name" sort={sort} onSort={onSort} />
              <SortTh label="Tier" k="tier" sort={sort} onSort={onSort} />
              <SortTh label="Cash value" k="total" sort={sort} onSort={onSort} className="num" />
              <SortTh label="Outstanding" k="outstanding" sort={sort} onSort={onSort} className="num" />
              <SortTh label="Payment" k="payment" sort={sort} onSort={onSort} />
              <SortTh label="Logo" k="logo" sort={sort} onSort={onSort} />
              <SortTh label="Fulfillment" k="fulfillment" sort={sort} onSort={onSort} style={{ minWidth: 140 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={7}><div className="empty"><h4>No sponsors match</h4><p>Adjust the search or filters.</p></div></td></tr>}
            {sorted.map(({ sponsor: s, total, trade, paid, pay, buys, prog }) => {
              return (
                <tr key={s.id} className="clickable" onClick={() => navigate(`/sponsors/${s.id}`)}>
                  <td><span className="primary">{s.name}</span><div className="tiny">{s.contactName}{buys > 1 ? ` · ${buys} buys` : ''}</div></td>
                  <td><TierBadge tier={s.tier} /></td>
                  <td className="num">{total ? fmtMoney(total) : '—'}{trade > 0 && <div className="tiny">+{fmtMoney(trade)} trade</div>}</td>
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
          const defaults = newBuyDefaults(state, tier, amount, todayISO())
          add('agreements', {
            id: `ag-${sp.id.slice(3)}-${Date.now()}`, orgId: state.currentOrgId, sponsorId: sp.id, season: 'Fall 2026',
            label: `${tier} sponsorship`, amount, paymentStatus: defaults.paymentStatus, payments: defaults.payments,
            fulfillment: fulfillmentForTier(state, tier),
            allocations: defaults.allocations.length ? defaults.allocations : undefined,
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

function EarmarksView() {
  const { state } = useStore()
  const earmarks = teamEarmarks(state)
  const total = earmarks.reduce((n, e) => n + e.amount, 0)
  // Subtotals per sport, largest first.
  const bySport = [...earmarks.reduce((m, e) => m.set(e.label, (m.get(e.label) ?? 0) + e.amount), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])

  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>
        Cash earmarked to specific sports across all sponsors (everything else goes to the athletic department).
        {' '}Use the note to record who gets credit for the money.
      </p>
      {earmarks.length === 0 ? (
        <div className="card"><Empty icon="◎" title="No sport earmarks yet" hint="On a sponsor's buy, earmark cash to a sport to see it here." /></div>
      ) : (
        <>
          <div className="pill-row" style={{ marginBottom: 12 }}>
            <Badge tone="brand">{fmtMoney(total)} earmarked to sports</Badge>
            {bySport.map(([sport, amt]) => <Badge key={sport} tone="outline">{sport}: {fmtMoney(amt)}</Badge>)}
          </div>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Sport</th><th>Sponsor</th><th className="num">Amount</th><th>Note / credit</th></tr></thead>
              <tbody>
                {earmarks.map(e => (
                  <tr key={e.id}>
                    <td className="primary">{e.label}</td>
                    <td><Link className="link" to={`/sponsors/${e.sponsorId}`}>{e.sponsorName}</Link></td>
                    <td className="num">{fmtMoney(e.amount)}</td>
                    <td className="small muted">{e.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function AcceptModal({ sponsor, onClose, onAccept }: { sponsor: Sponsor; onClose: () => void; onAccept: (amount: number, tier: SponsorTier) => void }) {
  const { state } = useStore()
  const tierDefault = (t: SponsorTier) => tierSetting(state, t)?.defaultAmount
  const [tier, setTier] = useState<SponsorTier>(sponsor.tier)
  const [amount, setAmount] = useState(String(sponsor.estValue ?? tierDefault(sponsor.tier) ?? 3000))
  const [err, setErr] = useState('')
  const pickTier = (t: SponsorTier) => { setTier(t); const d = tierDefault(t); if (d != null) setAmount(String(d)) }
  const ts = tierSetting(state, tier)
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
          <select value={tier} onChange={e => pickTier(e.target.value as SponsorTier)}>
            {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Agreement amount ($)" required error={err}>
          <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>
      {(ts?.autoPaid || ts?.earmarkSport) && (
        <p className="tiny" style={{ marginBottom: 0 }}>
          {ts?.autoPaid && <span style={{ color: 'var(--ok)' }}>Recorded as paid (prepaid tier). </span>}
          {ts?.earmarkSport && <>Earmarked to {ts.earmarkSport} by default.</>}
        </p>
      )}
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
  const initialTier: SponsorTier = 'Blue'
  const [form, setForm] = useState<{ name: string; tier: SponsorTier; contactName: string; email: string; phone: string; renewalDate: string; amount: string; trade: string }>({
    name: '', tier: initialTier, contactName: '', email: '', phone: '', renewalDate: '2027-06-01',
    amount: tierSetting(state, initialTier)?.defaultAmount != null ? String(tierSetting(state, initialTier)!.defaultAmount) : '',
    trade: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Switching tier prefills the agreement amount from that tier's default (still editable).
  const pickTier = (t: SponsorTier) => setForm(f => {
    const def = tierSetting(state, t)?.defaultAmount
    return { ...f, tier: t, amount: def != null ? String(def) : f.amount }
  })

  const amtNum = Number(form.amount)
  const tradeNum = Number(form.trade) || 0
  const cash = (Number.isNaN(amtNum) ? 0 : amtNum) - tradeNum
  const ts = tierSetting(state, form.tier)

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Business name is required.'
    if (!form.contactName.trim()) errs.contactName = 'A contact name is required.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (Number.isNaN(amtNum) || amtNum <= 0) errs.amount = 'Enter a positive dollar amount.'
    if (tradeNum > amtNum) errs.trade = 'Trade can’t exceed the buy amount.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const id = `sp-new-${Date.now()}`
    const defaults = newBuyDefaults(state, form.tier, cash, todayISO())
    onSave(
      {
        id, orgId: state.currentOrgId, name: form.name.trim(), stage: 'committed', tier: form.tier, contactName: form.contactName.trim(),
        email: form.email || undefined, phone: form.phone || undefined, logoStatus: 'missing',
        renewalDate: form.renewalDate, notes: [], benefitSummary: `${form.tier} tier package`,
      },
      {
        id: `ag-new-${Date.now()}`, orgId: state.currentOrgId, sponsorId: id, season: 'Fall 2026', amount: amtNum,
        tradeValue: tradeNum > 0 ? tradeNum : undefined,
        paymentStatus: defaults.paymentStatus, payments: defaults.payments,
        fulfillment: fulfillmentForTier(state, form.tier),
        allocations: defaults.allocations.length ? defaults.allocations : undefined,
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
          <select value={form.tier} onChange={e => pickTier(e.target.value as SponsorTier)}>
            {TIER_ORDER.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Agreement amount ($)" required error={errors.amount}>
          <input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Of that, paid in trade ($)" error={errors.trade}>
          <input type="number" min={0} value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} placeholder="0 — leave blank if all cash" />
        </Field>
        <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <span className="small muted">
            {tradeNum > 0 ? <><strong>{fmtMoney(cash)}</strong> cash counts toward revenue</> : 'All cash'}
            {ts?.autoPaid && <><br /><span style={{ color: 'var(--ok)' }}>Recorded as paid (prepaid tier)</span></>}
            {ts?.earmarkSport && <><br />Earmarked to {ts.earmarkSport}</>}
          </span>
        </div>
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
