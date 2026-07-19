import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { PIPELINE_STAGES, agreementPaid, can, eventTitle, fulfillmentProgress, visibleStatus } from '../lib/derive'
import { fmtDate, fmtDateTime, fmtMoney, fmtTime } from '../lib/dates'
import { Avatar, Badge, Card, Check, Empty, Field, Modal, Progress, StatusBadge } from '../components/ui'
import { StageBadge, TierBadge } from './SponsorsPage'
import { I } from '../components/icons'
import type { Agreement, FulfillmentItem, FulfillmentStatus, Payment, PipelineStage, Sponsor, SponsorTier, User } from '../types'

const TIERS: SponsorTier[] = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']

export default function SponsorDetail() {
  const { id } = useParams()
  const { state, update, logActivity, toast } = useStore()
  const [paying, setPaying] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState(false)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const s = state.sponsors.find(x => x.id === id)
  const a = state.agreements.find(x => x.sponsorId === id)

  if (!s) return <Card><Empty icon="?" title="Sponsor not found" /></Card>

  const editable = can(me.role, 'edit')
  const financeOk = can(me.role, 'finance')
  const paid = a ? agreementPaid(a) : 0
  const prog = a ? fulfillmentProgress(a) : { done: 0, total: 0 }
  const linkedEvents = state.events.filter(e => e.sponsorActivations.some(x => x.sponsorId === s.id)).sort((x, y) => x.date.localeCompare(y.date))
  const sponsorAssets = state.assets.filter(x => x.sponsorId === s.id)
  const sponsorTasks = state.tasks.filter(t => t.sponsorId === s.id && t.status !== 'done')

  const toggleItem = (item: FulfillmentItem) => {
    if (!a || !editable) return
    const status = item.status === 'complete' ? 'pending' : 'complete'
    update('agreements', a.id, {
      fulfillment: a.fulfillment.map(f => (f.id === item.id ? { ...f, status } : f)),
    } as Partial<Agreement>)
    if (status === 'complete') {
      logActivity(`completed “${item.label}” for ${s.name}`, `/sponsors/${s.id}`)
      if (item.label === 'Logo received') update('sponsors', s.id, { logoStatus: 'received' } as Partial<Sponsor>)
    }
  }

  const setFulfillment = (items: FulfillmentItem[]) => update('agreements', a!.id, { fulfillment: items } as Partial<Agreement>)
  const setNotes = (notes: Sponsor['notes']) => update('sponsors', s.id, { notes } as Partial<Sponsor>)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 6 }}><Link to="/sponsors" className="tiny link">← Sponsors</Link></div>
          <h1 className="page-title">{s.name}</h1>
          <p className="page-sub">{s.contactName}{s.email ? ` · ${s.email}` : ''}{s.phone ? ` · ${s.phone}` : ''}{s.website ? ` · ${s.website.replace(/^https?:\/\//, '')}` : ''}</p>
          <div className="pill-row" style={{ marginTop: 8 }}>
            <TierBadge tier={s.tier} />
            <StageBadge stage={s.stage} />
            {a && <StatusBadge status={a.paymentStatus} />}
            <StatusBadge status={s.logoStatus} />
            <Badge tone="outline">Renews {fmtDate(s.renewalDate, { month: 'short', day: 'numeric', year: 'numeric' })}</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {editable && (
            <select className="inline-select" value={s.stage} aria-label="Pipeline stage" onChange={e => {
              const stage = e.target.value as PipelineStage
              update('sponsors', s.id, { stage } as Partial<Sponsor>)
              logActivity(`moved ${s.name} to ${PIPELINE_STAGES.find(p => p.value === stage)?.label} in the sponsor pipeline`, `/sponsors/${s.id}`)
              toast(`${s.name} → ${PIPELINE_STAGES.find(p => p.value === stage)?.label}`)
            }}>
              {PIPELINE_STAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          )}
          {editable && <button className="btn" onClick={() => setEditingSponsor(true)}>Edit sponsor</button>}
          {financeOk && a && a.paymentStatus !== 'paid' && (
            <button className="btn primary" onClick={() => setPaying(true)}>Record payment</button>
          )}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat-card"><span className="label">Agreement</span><span className="value">{a ? fmtMoney(a.amount) : '—'}</span><span className="hint">{a?.season}</span></div>
        <div className="card stat-card ok"><span className="label">Collected</span><span className="value">{fmtMoney(paid)}</span></div>
        <div className={`card stat-card ${a && paid < a.amount ? 'alert' : 'ok'}`}><span className="label">Outstanding</span><span className="value">{a ? fmtMoney(Math.max(a.amount - paid, 0)) : '—'}</span></div>
        <div className="card stat-card"><span className="label">Fulfillment</span><span className="value">{prog.done}/{prog.total}</span><div style={{ marginTop: 6 }}><Progress value={prog.done} max={prog.total} /></div></div>
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Benefit inventory & fulfillment" pad={false} action={<span className="tiny">{s.benefitSummary}</span>}>
            {!a && <Empty title="No agreement on file" />}
            {a?.fulfillment.map(f => (
              <FulfillmentRow key={f.id} item={f} editable={editable} today={state.demoToday}
                onToggle={() => toggleItem(f)}
                onSave={patch => setFulfillment(a.fulfillment.map(x => (x.id === f.id ? { ...x, ...patch } : x)))}
                onRemove={() => { setFulfillment(a.fulfillment.filter(x => x.id !== f.id)); toast('Fulfillment item removed') }}
              />
            ))}
            {a && editable && (
              <AddFulfillment onAdd={(label, dueDate) => {
                setFulfillment([...a.fulfillment, { id: `ff-${Date.now()}`, label, status: 'pending', dueDate }])
                toast('Fulfillment item added')
              }} />
            )}
          </Card>

          <Card title="Event assignments" pad={false} action={<Link to="/events" className="card-link">Events →</Link>}>
            {linkedEvents.length === 0 && <Empty icon="◈" title="Not assigned to a game yet" hint="Assign this sponsor from any event's Sponsors tab." />}
            {linkedEvents.map(e => (
              <Link key={e.id} to={`/events/${e.id}?tab=sponsors`} className="notif-item">
                <span style={{ flex: 1 }}>
                  <strong>{eventTitle(e, { short: true })}</strong>
                  {' — '}{e.sponsorActivations.filter(x => x.sponsorId === s.id).map(x => x.activation).join(', ')}
                  {e.designation && <> <Badge tone="brand">{e.designation}</Badge></>}
                  <div className="tiny">{fmtDate(e.date)} · {fmtTime(e.time)} · {e.venue}</div>
                </span>
                <StatusBadge status={visibleStatus(state, e)} />
              </Link>
            ))}
          </Card>

          <Card title="Payments" pad={false}>
            {(!a || a.payments.length === 0) && <Empty icon="$" title="No payments recorded" hint={financeOk ? 'Use “Record payment” to log a check or transfer.' : 'Finance users can record payments.'} />}
            {a && a.payments.length > 0 && (
              <table className="tbl">
                <thead><tr><th>Date</th><th>Method</th><th className="num">Amount</th>{financeOk && <th />}</tr></thead>
                <tbody>
                  {a.payments.map(p => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>{p.method}</td>
                      <td className="num">{fmtMoney(p.amount)}</td>
                      {financeOk && <td style={{ width: 36 }}>
                        <button className="btn sm ghost" aria-label="Delete payment" title="Delete payment" onClick={() => {
                          const payments = a.payments.filter(x => x.id !== p.id)
                          const total = payments.reduce((n, x) => n + x.amount, 0)
                          update('agreements', a.id, { payments, paymentStatus: total >= a.amount ? 'paid' : total > 0 ? 'partial' : 'unpaid' } as Partial<Agreement>)
                          toast('Payment removed')
                        }}><I.x /></button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Outstanding action items" pad={false}>
            {sponsorTasks.length === 0 && <Empty icon="✓" title="No open action items" />}
            {sponsorTasks.map(t => (
              <div key={t.id} className="checklist-item" style={{ padding: '9px 18px' }}>
                <Check checked={false} disabled={!editable} onChange={() => { update('tasks', t.id, { status: 'done' }); toast('Action item completed') }} />
                <span className="label">{t.title}<div className="tiny">Due {fmtDate(t.dueDate)}</div></span>
                {t.dueDate < state.demoToday && <Badge tone="danger">Overdue</Badge>}
              </div>
            ))}
          </Card>

          <Card title="Assets" pad={false}>
            {sponsorAssets.length === 0 && <Empty icon="▣" title="No assets on file" hint="Logos, video-board slides and commercials will appear here." />}
            {sponsorAssets.map(x => (
              <div key={x.id} className="notif-item">
                <span className="org-mark" style={{ background: x.tint }}>{x.fileType.slice(0, 3)}</span>
                <span style={{ flex: 1 }}>{x.name}<div className="tiny">{x.type}</div></span>
                <StatusBadge status={x.approvalStatus} />
              </div>
            ))}
          </Card>

          <Card title="Contact notes" pad={false}>
            <div style={{ padding: '4px 18px' }}>
              {s.notes.length === 0 && <p className="small muted">No notes yet.</p>}
              {s.notes.map(n => (
                <NoteRow key={n.id} note={n} editable={editable}
                  authorName={state.users.find(u => u.id === n.authorId)?.name}
                  author={state.users.find(u => u.id === n.authorId)}
                  onSave={text => setNotes(s.notes.map(x => (x.id === n.id ? { ...x, text, edited: true } : x)))}
                  onDelete={() => { setNotes(s.notes.filter(x => x.id !== n.id)); toast('Note deleted') }}
                />
              ))}
            </div>
            {editable && (
              <AddNote onAdd={text => { setNotes([{ id: `n-${Date.now()}`, at: new Date().toISOString(), authorId: me.id, text }, ...s.notes]); toast('Note added') }} />
            )}
          </Card>
        </div>
      </div>

      {editingSponsor && (
        <EditSponsorModal sponsor={s} agreement={a} financeOk={financeOk} onClose={() => setEditingSponsor(false)}
          onSave={(sponsorPatch, agreementPatch) => {
            update('sponsors', s.id, sponsorPatch)
            if (a && agreementPatch) {
              const total = agreementPaid(a)
              update('agreements', a.id, {
                ...agreementPatch,
                paymentStatus: total >= (agreementPatch.amount ?? a.amount) ? 'paid' : total > 0 ? 'partial' : 'unpaid',
              } as Partial<Agreement>)
            }
            logActivity(`edited sponsor ${sponsorPatch.name ?? s.name}`, `/sponsors/${s.id}`)
            toast('Sponsor updated')
            setEditingSponsor(false)
          }} />
      )}

      {paying && a && (
        <PaymentModal outstanding={a.amount - paid} onClose={() => setPaying(false)} onSave={(amount, method, date) => {
          const payments: Payment[] = [...a.payments, { id: `pay-${Date.now()}`, date, amount, method }]
          const total = payments.reduce((n, p) => n + p.amount, 0)
          update('agreements', a.id, { payments, paymentStatus: total >= a.amount ? 'paid' : 'partial' } as Partial<Agreement>)
          logActivity(`recorded ${fmtMoney(amount)} payment from ${s.name}`, `/sponsors/${s.id}`)
          toast(`Payment of ${fmtMoney(amount)} recorded`)
          setPaying(false)
        }} />
      )}
    </>
  )
}

// ---------- Fulfillment ----------

function FulfillmentRow({ item, editable, today, onToggle, onSave, onRemove }: {
  item: FulfillmentItem; editable: boolean; today: string
  onToggle: () => void; onSave: (patch: Partial<FulfillmentItem>) => void; onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [status, setStatus] = useState<FulfillmentStatus>(item.status)

  if (editing) {
    return (
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="Item label" aria-label="Item label" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            Due date
            <input className="input" type="date" style={{ width: 160 }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </label>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            Status
            <select className="inline-select" value={status} onChange={e => setStatus(e.target.value as FulfillmentStatus)}>
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
              <option value="na">Not applicable</option>
            </select>
          </label>
          {dueDate && <button className="btn sm ghost" onClick={() => setDueDate('')}>Clear due date</button>}
          <div style={{ flex: 1 }} />
          <button className="btn sm primary" onClick={() => {
            if (!label.trim()) return
            onSave({ label: label.trim(), dueDate: dueDate || undefined, status })
            setEditing(false)
          }}>Save</button>
          <button className="btn sm ghost" onClick={() => { setLabel(item.label); setDueDate(item.dueDate ?? ''); setStatus(item.status); setEditing(false) }}>Cancel</button>
          <button className="btn sm danger" onClick={onRemove}>Remove</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`checklist-item ${item.status === 'complete' ? 'done' : ''}`} style={{ padding: '9px 18px' }}>
      <Check checked={item.status === 'complete'} disabled={!editable || item.status === 'na'} onChange={onToggle} />
      <span className="label">
        {item.label}
        {item.dueDate && item.status !== 'complete' && <div className="tiny">Due {fmtDate(item.dueDate)}</div>}
      </span>
      {item.status === 'pending' && item.dueDate && item.dueDate < today && <Badge tone="danger">Overdue</Badge>}
      <StatusBadge status={item.status === 'complete' ? 'complete' : item.status === 'na' ? 'archived' : 'pending'}
        label={item.status === 'complete' ? 'Complete' : item.status === 'na' ? 'N/A' : 'Pending'} />
      {editable && <button className="btn sm ghost" aria-label="Edit item" title="Edit item" onClick={() => setEditing(true)}><I.edit /></button>}
    </div>
  )
}

function AddFulfillment({ onAdd }: { onAdd: (label: string, dueDate?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  if (!open) {
    return <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
      <button className="btn sm ghost" onClick={() => setOpen(true)}><I.plus /> Add fulfillment item</button>
    </div>
  }
  return (
    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <input className="input" style={{ flex: 1, minWidth: 180 }} autoFocus placeholder="e.g. Radio mention, program ad…" value={label} onChange={e => setLabel(e.target.value)} />
      <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        Due date (optional)
        <input className="input" type="date" style={{ width: 160 }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
      </label>
      <button className="btn sm primary" onClick={() => {
        if (!label.trim()) return
        onAdd(label.trim(), dueDate || undefined)
        setLabel(''); setDueDate(''); setOpen(false)
      }}>Add</button>
      <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  )
}

// ---------- Notes ----------

function NoteRow({ note, editable, authorName, author, onSave, onDelete }: {
  note: { id: string; at: string; text: string; edited?: boolean }
  editable: boolean; authorName?: string; author?: User; onSave: (text: string) => void; onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  if (editing) {
    return (
      <div className="feed-item" style={{ gap: 8, flexDirection: 'column', alignItems: 'stretch' }}>
        <textarea className="input" rows={2} value={text} onChange={e => setText(e.target.value)} autoFocus />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm primary" onClick={() => { if (text.trim()) { onSave(text.trim()); setEditing(false) } }}>Save</button>
          <button className="btn sm ghost" onClick={() => { setText(note.text); setEditing(false) }}>Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <div className="feed-item">
      <Avatar user={author} size="sm" />
      <span style={{ flex: 1 }}>
        {note.text}
        <div className="when">{authorName} · {fmtDateTime(note.at)}{note.edited ? ' · edited' : ''}</div>
      </span>
      {editable && (
        <span style={{ display: 'flex', gap: 2 }}>
          <button className="btn sm ghost" aria-label="Edit note" title="Edit note" onClick={() => setEditing(true)}><I.edit /></button>
          <button className="btn sm ghost" aria-label="Delete note" title="Delete note" onClick={onDelete}><I.x /></button>
        </span>
      )}
    </div>
  )
}

function AddNote({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const submit = () => { if (text.trim()) { onAdd(text.trim()); setText('') } }
  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
      <input className="input" style={{ flex: 1 }} placeholder="Add a note…" value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()} />
      <button className="btn sm" onClick={submit}><I.plus /></button>
    </div>
  )
}

// ---------- Edit sponsor + agreement ----------

function EditSponsorModal({ sponsor: s, agreement: a, financeOk, onClose, onSave }: {
  sponsor: Sponsor; agreement?: Agreement; financeOk: boolean; onClose: () => void
  onSave: (sponsorPatch: Partial<Sponsor>, agreementPatch?: Partial<Agreement>) => void
}) {
  const [form, setForm] = useState({
    name: s.name, tier: s.tier, contactName: s.contactName, email: s.email ?? '', phone: s.phone ?? '',
    website: s.website ?? '', renewalDate: s.renewalDate, benefitSummary: s.benefitSummary, logoStatus: s.logoStatus,
    amount: a ? String(a.amount) : '', season: a?.season ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Business name is required.'
    if (!form.contactName.trim()) errs.contactName = 'A contact name is required.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (form.website && !/^https?:\/\//.test(form.website)) errs.website = 'Website must start with http(s)://'
    if (financeOk && a) {
      const amt = Number(form.amount)
      if (form.amount === '' || Number.isNaN(amt) || amt < 0) errs.amount = 'Enter a valid amount.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave(
      {
        name: form.name.trim(), tier: form.tier, contactName: form.contactName.trim(),
        email: form.email.trim() || undefined, phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined, renewalDate: form.renewalDate,
        benefitSummary: form.benefitSummary.trim(), logoStatus: form.logoStatus,
      },
      financeOk && a ? { amount: Number(form.amount), season: form.season.trim() || a.season } : undefined,
    )
  }

  return (
    <Modal title={`Edit ${s.name}`} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Save changes</button>
      </>
    }>
      <Field label="Business name" required error={errors.name}>
        <input value={form.name} onChange={e => set({ name: e.target.value })} />
      </Field>
      <div className="form-row">
        <Field label="Tier">
          <select value={form.tier} onChange={e => set({ tier: e.target.value as SponsorTier })}>
            {TIERS.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Logo status">
          <select value={form.logoStatus} onChange={e => set({ logoStatus: e.target.value as Sponsor['logoStatus'] })}>
            <option value="received">Logo received</option>
            <option value="missing">Logo missing</option>
            <option value="needs_update">Logo needs update</option>
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Contact name" required error={errors.contactName}>
          <input value={form.contactName} onChange={e => set({ contactName: e.target.value })} />
        </Field>
        <Field label="Contact email" error={errors.email}>
          <input value={form.email} onChange={e => set({ email: e.target.value })} placeholder="name@business.com" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Phone">
          <input value={form.phone} onChange={e => set({ phone: e.target.value })} />
        </Field>
        <Field label="Website" error={errors.website}>
          <input value={form.website} onChange={e => set({ website: e.target.value })} placeholder="https://…" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Renewal date">
          <input type="date" value={form.renewalDate} onChange={e => set({ renewalDate: e.target.value })} />
        </Field>
        {financeOk && a && (
          <Field label="Agreement amount ($)" error={errors.amount}>
            <input type="number" min={0} value={form.amount} onChange={e => set({ amount: e.target.value })} />
          </Field>
        )}
      </div>
      {financeOk && a && (
        <Field label="Season">
          <input value={form.season} onChange={e => set({ season: e.target.value })} placeholder="e.g. Fall 2026" />
        </Field>
      )}
      <Field label="Benefit summary">
        <textarea rows={2} value={form.benefitSummary} onChange={e => set({ benefitSummary: e.target.value })} />
      </Field>
    </Modal>
  )
}

function PaymentModal({ outstanding, onClose, onSave }: { outstanding: number; onClose: () => void; onSave: (amount: number, method: string, date: string) => void }) {
  const { state } = useStore()
  const [amount, setAmount] = useState(outstanding.toFixed(2))
  const [method, setMethod] = useState('Check')
  const [date, setDate] = useState(state.demoToday)
  const [err, setErr] = useState('')
  return (
    <Modal title="Record payment" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          const n = Number(amount)
          if (Number.isNaN(n) || n <= 0) { setErr('Enter a positive amount.'); return }
          if (!date) { setErr('Select the payment date.'); return }
          onSave(n, method, date)
        }}>Save payment</button>
      </>
    }>
      <p className="small muted" style={{ marginTop: 0 }}>Outstanding balance: <strong>{fmtMoney(outstanding)}</strong></p>
      <div className="form-row">
        <Field label="Amount ($)" required error={err}>
          <input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <Field label="Method">
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option>Check</option><option>ACH transfer</option><option>Card (online)</option><option>Cash</option>
          </select>
        </Field>
      </div>
      <Field label="Date received" required>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </Field>
    </Modal>
  )
}
