import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { PIPELINE_STAGES, agreementPaid, agreements as allAgreements, can, fulfillmentProgress, sponsors as allSponsors, sponsorshipTotals } from '../lib/derive'
import { fmtMoney } from '../lib/dates'
import { Badge, Empty, Field, Modal, Progress, SearchBox, Seg, StatCard, StatusBadge } from '../components/ui'
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
  const totals = sponsorshipTotals(state)
  const editable = can(me.role, 'edit')
  const pipeline = allSponsors(state).filter(s => s.stage !== 'committed')

  const rows = useMemo(() => {
    let sps = allSponsors(state).filter(s => s.stage === 'committed')
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
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setCreating('prospect')}><I.plus /> New prospect</button>
            <button className="btn primary" onClick={() => setCreating('sponsor')}><I.plus /> New sponsor</button>
          </div>
        )}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total sponsorship" value={fmtMoney(totals.total)} hint={`${totals.count} agreements`} />
        <StatCard label="Collected" value={fmtMoney(totals.collected)} tone="ok" hint={`${Math.round((totals.collected / Math.max(totals.total, 1)) * 100)}% of committed`} />
        <StatCard label="Outstanding" value={fmtMoney(totals.outstanding)} tone={totals.outstanding > 0 ? 'alert' : 'ok'} />
        <StatCard label="Missing logos" value={allSponsors(state).filter(s => s.stage === 'committed' && s.logoStatus !== 'received').length} tone="warn" hint="Blocking video-board & web placement" />
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
  const { state, update, logActivity, toast } = useStore()
  const navigate = useNavigate()
  const pipeline = allSponsors(state).filter(s => s.stage !== 'committed')
  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>
        Track sponsors before the sale: prospects you've talked about, outreach in flight, maybes, and passes.
        Moving one to <strong>Committed</strong> promotes it to the sponsor directory.
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
                <thead><tr><th>Business</th><th>Contact</th><th>Target tier</th><th>Latest note</th><th style={{ width: 150 }}>Stage</th></tr></thead>
                <tbody>
                  {items.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: '18px' }}><p style={{ margin: 0 }}>No sponsors in this stage.</p></div></td></tr>}
                  {items.map(sp => (
                    <tr key={sp.id} className="clickable" onClick={() => navigate(`/sponsors/${sp.id}`)}>
                      <td><span className="primary">{sp.name}</span></td>
                      <td className="muted small">{sp.contactName}</td>
                      <td><TierBadge tier={sp.tier} /></td>
                      <td className="muted small" style={{ maxWidth: 380 }}>{sp.notes[0]?.text ?? '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {editable ? (
                          <select className="inline-select" value={sp.stage} onChange={e => {
                            const stage = e.target.value as PipelineStage
                            update('sponsors', sp.id, { stage })
                            logActivity(`moved ${sp.name} to ${PIPELINE_STAGES.find(p => p.value === stage)?.label} in the sponsor pipeline`, `/sponsors/${sp.id}`)
                            toast(stage === 'committed' ? `${sp.name} committed — now in the sponsor directory` : `${sp.name} → ${PIPELINE_STAGES.find(p => p.value === stage)?.label}`)
                          }} aria-label="Pipeline stage">
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
    </>
  )
}

function ProspectForm({ onClose, onSave }: { onClose: () => void; onSave: (s: Sponsor) => void }) {
  const { state } = useStore()
  const [form, setForm] = useState({ name: '', contactName: '', tier: 'Blue' as SponsorTier, stage: 'prospect' as PipelineStage, note: '' })
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
