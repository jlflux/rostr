import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import {
  PIPELINE_STAGES, agreementPaid, allocationLabel, can, eventTitle, fulfillmentProgress,
  sponsorAgreements, sponsorAllocations, sponsorPaid, sponsorPaymentStatus, sponsorTotal, teams as allTeams, visibleStatus,
} from '../lib/derive'
import { fmtDate, fmtDateTime, fmtMoney, fmtTime } from '../lib/dates'
import { Avatar, Badge, Card, Check, Empty, Field, Modal, Progress, StatusBadge } from '../components/ui'
import { StageBadge, TierBadge } from './SponsorsPage'
import { I } from '../components/icons'
import type { Agreement, Allocation, FulfillmentItem, FulfillmentStatus, Payment, PipelineStage, Sponsor, SponsorTier, User } from '../types'

const TIERS: SponsorTier[] = ['Red', 'White', 'Blue', 'Add-On', 'Patriot Partner']

export default function SponsorDetail() {
  const { id } = useParams()
  const { state, update, add, remove, logActivity, toast } = useStore()
  const [editingSponsor, setEditingSponsor] = useState(false)
  const [buyModal, setBuyModal] = useState<Agreement | 'new' | null>(null)
  const [payingBuy, setPayingBuy] = useState<Agreement | null>(null)
  const me = state.users.find(u => u.id === state.currentUserId)!
  const s = state.sponsors.find(x => x.id === id)
  if (!s) return <Card><Empty icon="?" title="Sponsor not found" /></Card>

  const editable = can(me.role, 'edit')
  const financeOk = can(me.role, 'finance')
  const ags = sponsorAgreements(state, s.id)
  const total = sponsorTotal(state, s.id)
  const paid = sponsorPaid(state, s.id)
  const payStatus = sponsorPaymentStatus(state, s.id)
  const allocations = sponsorAllocations(state, s.id)
  const allItems = ags.flatMap(a => a.fulfillment.map(f => ({ item: f, agId: a.id })))
  const prog = allItems.reduce((acc, { item }) => ({ done: acc.done + (item.status === 'complete' ? 1 : 0), total: acc.total + (item.status === 'na' ? 0 : 1) }), { done: 0, total: 0 })
  const linkedEvents = state.events.filter(e => e.sponsorActivations.some(x => x.sponsorId === s.id)).sort((x, y) => x.date.localeCompare(y.date))
  const sponsorAssets = state.assets.filter(x => x.sponsorId === s.id)
  const sponsorTasks = state.tasks.filter(t => t.sponsorId === s.id && t.status !== 'done')
  const primaryAg = ags[0]

  const patchItem = (agId: string, itemId: string, patch: Partial<FulfillmentItem>) => {
    const ag = ags.find(a => a.id === agId)!
    update('agreements', agId, { fulfillment: ag.fulfillment.map(f => (f.id === itemId ? { ...f, ...patch } : f)) } as Partial<Agreement>)
  }
  const removeItem = (agId: string, itemId: string) => {
    const ag = ags.find(a => a.id === agId)!
    update('agreements', agId, { fulfillment: ag.fulfillment.filter(f => f.id !== itemId) } as Partial<Agreement>)
    toast('Fulfillment item removed')
  }
  const toggleItem = (agId: string, item: FulfillmentItem) => {
    if (!editable || item.status === 'na') return
    const status = item.status === 'complete' ? 'pending' : 'complete'
    patchItem(agId, item.id, { status })
    if (status === 'complete') {
      logActivity(`completed “${item.label}” for ${s.name}`, `/sponsors/${s.id}`)
      if (item.label === 'Logo received') update('sponsors', s.id, { logoStatus: 'received' } as Partial<Sponsor>)
    }
  }
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
            {total > 0 && <StatusBadge status={payStatus} />}
            <StatusBadge status={s.logoStatus} />
            {ags.length > 1 && <Badge tone="info">{ags.length} buys</Badge>}
            <Badge tone="outline">Renews {fmtDate(s.renewalDate, { month: 'short', day: 'numeric', year: 'numeric' })}</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {editable && (
            <select className="inline-select" value={s.stage} aria-label="Pipeline stage" onChange={e => {
              const stage = e.target.value as PipelineStage
              update('sponsors', s.id, { stage } as Partial<Sponsor>)
              toast(`${s.name} → ${PIPELINE_STAGES.find(p => p.value === stage)?.label}`)
            }}>
              {PIPELINE_STAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          )}
          {editable && <button className="btn" onClick={() => setEditingSponsor(true)}>Edit sponsor</button>}
          {financeOk && <button className="btn primary" onClick={() => setBuyModal('new')}><I.plus /> Add buy</button>}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat-card"><span className="label">Total value</span><span className="value">{fmtMoney(total)}</span><span className="hint">{ags.length} buy{ags.length === 1 ? '' : 's'}</span></div>
        <div className="card stat-card ok"><span className="label">Collected</span><span className="value">{fmtMoney(paid)}</span></div>
        <div className={`card stat-card ${paid < total ? 'alert' : 'ok'}`}><span className="label">Outstanding</span><span className="value">{fmtMoney(Math.max(total - paid, 0))}</span></div>
        <div className="card stat-card"><span className="label">Fulfillment</span><span className="value">{prog.done}/{prog.total}</span><div style={{ marginTop: 6 }}><Progress value={prog.done} max={prog.total} /></div></div>
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Buys & contributions" pad={false} action={financeOk && <button className="btn sm" onClick={() => setBuyModal('new')}><I.plus /> Add buy</button>}>
            {ags.length === 0 && <Empty icon="$" title="No buys yet" hint={financeOk ? 'Add the first agreement with “Add buy”.' : 'No agreements recorded.'} />}
            {ags.map(a => {
              const ap = agreementPaid(a)
              return (
                <div key={a.id} className="notif-item" style={{ alignItems: 'flex-start' }}>
                  <span style={{ flex: 1 }}>
                    <strong>{a.label ?? 'Sponsorship'}</strong> — {fmtMoney(a.amount)}
                    <div className="tiny">{a.season} · {fmtMoney(ap)} collected{a.allocations && a.allocations.length ? ` · ${a.allocations.map(al => `${allocationLabel(state, al.target)} ${fmtMoney(al.amount)}`).join(', ')}` : ''}</div>
                    {(a.allocations ?? []).filter(al => al.note?.trim()).map(al => (
                      <div key={al.id} className="tiny" style={{ color: 'var(--text-2)' }}>↳ {allocationLabel(state, al.target)}: {al.note}</div>
                    ))}
                  </span>
                  <StatusBadge status={a.paymentStatus} />
                  {financeOk && (
                    <span style={{ display: 'flex', gap: 2 }}>
                      {a.paymentStatus !== 'paid' && <button className="btn sm ghost" title="Record payment" aria-label="Record payment" onClick={() => setPayingBuy(a)}>Pay</button>}
                      <button className="btn sm ghost" aria-label="Edit buy" title="Edit buy" onClick={() => setBuyModal(a)}><I.edit /></button>
                      <button className="btn sm ghost" aria-label="Delete buy" title="Delete buy" onClick={() => {
                        if (ags.length === 1) { toast('A sponsor keeps at least one buy — edit it instead', 'error'); return }
                        remove('agreements', a.id); toast('Buy removed')
                      }}><I.x /></button>
                    </span>
                  )}
                </div>
              )
            })}
            {allocations.length > 0 && (
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
                <div className="tiny" style={{ marginBottom: 4 }}>Earmarked across all buys</div>
                <div className="pill-row">
                  {allocations.map(al => <Badge key={al.target} tone="outline">{allocationLabel(state, al.target)}: {fmtMoney(al.amount)}</Badge>)}
                </div>
              </div>
            )}
          </Card>

          <Card title="Benefit inventory & fulfillment" pad={false} action={<span className="tiny">{s.benefitSummary}</span>}>
            {allItems.length === 0 && <Empty title="No fulfillment items" hint={editable ? 'Add items below.' : undefined} />}
            {allItems.map(({ item, agId }) => (
              <FulfillmentRow key={item.id} item={item} editable={editable} today={state.demoToday}
                buys={ags.map(a => ({ id: a.id, label: a.label ?? 'Sponsorship' }))}
                onToggle={() => toggleItem(agId, item)}
                onSave={patch => patchItem(agId, item.id, patch)}
                onRemove={() => removeItem(agId, item.id)}
              />
            ))}
            {primaryAg && editable && (
              <AddFulfillment onAdd={(label, dueDate) => {
                update('agreements', primaryAg.id, { fulfillment: [...primaryAg.fulfillment, { id: `ff-${Date.now()}`, label, status: 'pending', dueDate }] } as Partial<Agreement>)
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
                  <div className="tiny">{fmtDate(e.date)} · {fmtTime(e.time)} · {e.venue}</div>
                </span>
                <StatusBadge status={visibleStatus(state, e)} />
              </Link>
            ))}
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
        <EditSponsorModal sponsor={s} onClose={() => setEditingSponsor(false)}
          onSave={patch => { update('sponsors', s.id, patch); logActivity(`edited sponsor ${patch.name ?? s.name}`, `/sponsors/${s.id}`); toast('Sponsor updated'); setEditingSponsor(false) }} />
      )}
      {buyModal && (
        <BuyModal sponsorId={s.id} existing={buyModal === 'new' ? undefined : buyModal} onClose={() => setBuyModal(null)}
          onSave={ag => {
            if (buyModal === 'new') { add('agreements', ag); logActivity(`added a ${fmtMoney(ag.amount)} buy for ${s.name}`, `/sponsors/${s.id}`); toast('Buy added') }
            else { update('agreements', ag.id, ag); toast('Buy updated') }
            setBuyModal(null)
          }} />
      )}
      {payingBuy && (
        <PaymentModal outstanding={payingBuy.amount - agreementPaid(payingBuy)} onClose={() => setPayingBuy(null)} onSave={(amount, method, date) => {
          const payments: Payment[] = [...payingBuy.payments, { id: `pay-${Date.now()}`, date, amount, method }]
          const t = payments.reduce((n, p) => n + p.amount, 0)
          update('agreements', payingBuy.id, { payments, paymentStatus: t >= payingBuy.amount ? 'paid' : t > 0 ? 'partial' : 'unpaid' } as Partial<Agreement>)
          logActivity(`recorded ${fmtMoney(amount)} payment from ${s.name}`, `/sponsors/${s.id}`)
          toast(`Payment of ${fmtMoney(amount)} recorded`)
          setPayingBuy(null)
        }} />
      )}
    </>
  )
}

// ---------- Fulfillment ----------

function FulfillmentRow({ item, editable, today, buys, onToggle, onSave, onRemove }: {
  item: FulfillmentItem; editable: boolean; today: string; buys: { id: string; label: string }[]
  onToggle: () => void; onSave: (patch: Partial<FulfillmentItem>) => void; onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [status, setStatus] = useState<FulfillmentStatus>(item.status)
  const [buyId, setBuyId] = useState(item.buyId ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const buyLabel = item.buyId ? buys.find(b => b.id === item.buyId)?.label : undefined

  if (editing) {
    return (
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="Item label" aria-label="Item label" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            Due date
            <input className="input" type="date" style={{ width: 150 }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </label>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            Status
            <select className="inline-select" value={status} onChange={e => setStatus(e.target.value as FulfillmentStatus)}>
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
              <option value="na">Not applicable</option>
            </select>
          </label>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            Assign to buy (optional)
            <select className="inline-select" value={buyId} onChange={e => setBuyId(e.target.value)}>
              <option value="">Not assigned</option>
              {buys.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
          {dueDate && <button className="btn sm ghost" onClick={() => setDueDate('')}>Clear due date</button>}
        </div>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm primary" onClick={() => { if (!label.trim()) return; onSave({ label: label.trim(), dueDate: dueDate || undefined, status, buyId: buyId || undefined, notes: notes.trim() || undefined }); setEditing(false) }}>Save</button>
          <button className="btn sm ghost" onClick={() => { setLabel(item.label); setDueDate(item.dueDate ?? ''); setStatus(item.status); setBuyId(item.buyId ?? ''); setNotes(item.notes ?? ''); setEditing(false) }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button className="btn sm danger" onClick={onRemove}>Remove</button>
        </div>
      </div>
    )
  }

  const showSub = (item.dueDate && item.status !== 'complete') || buyLabel || item.notes
  return (
    <div className={`checklist-item ${item.status === 'complete' ? 'done' : ''}`} style={{ padding: '9px 18px' }}>
      <Check checked={item.status === 'complete'} disabled={!editable || item.status === 'na'} onChange={onToggle} />
      <span className="label">
        {item.label}
        {showSub && (
          <div className="tiny">
            {[
              item.dueDate && item.status !== 'complete' ? `Due ${fmtDate(item.dueDate)}` : '',
              buyLabel ? `Buy: ${buyLabel}` : '',
              item.notes ?? '',
            ].filter(Boolean).join(' · ')}
          </div>
        )}
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
      <button className="btn sm primary" onClick={() => { if (!label.trim()) return; onAdd(label.trim(), dueDate || undefined); setLabel(''); setDueDate(''); setOpen(false) }}>Add</button>
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

// ---------- Add / edit a buy (agreement) with allocations ----------

function BuyModal({ sponsorId, existing, onClose, onSave }: {
  sponsorId: string; existing?: Agreement; onClose: () => void; onSave: (a: Agreement) => void
}) {
  const { state } = useStore()
  const teams = allTeams(state)
  const [label, setLabel] = useState(existing?.label ?? 'Additional donation')
  const [season, setSeason] = useState(existing?.season ?? 'Fall 2026')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [allocs, setAllocs] = useState<Allocation[]>(existing?.allocations ?? [])
  const [err, setErr] = useState('')

  const amt = Number(amount)
  const allocated = allocs.reduce((n, a) => n + a.amount, 0)
  const unallocated = (Number.isNaN(amt) ? 0 : amt) - allocated

  const submit = () => {
    if (Number.isNaN(amt) || amt <= 0) { setErr('Enter the buy amount.'); return }
    if (allocated > amt) { setErr('Earmarked amounts exceed the buy total.'); return }
    // Any unallocated remainder goes to the athletic department
    let finalAllocs = allocs.filter(a => a.amount > 0)
    if (unallocated > 0) {
      const ath = finalAllocs.find(a => a.target === 'athletics')
      if (ath) ath.amount += unallocated
      else finalAllocs = [...finalAllocs, { id: `alloc-${Date.now()}`, target: 'athletics', amount: unallocated }]
    }
    onSave({
      id: existing?.id ?? `ag-${sponsorId.slice(3)}-${Date.now()}`,
      orgId: state.currentOrgId, sponsorId, season: season.trim() || 'Fall 2026', label: label.trim() || 'Sponsorship',
      amount: amt, paymentStatus: existing?.paymentStatus ?? 'unpaid', payments: existing?.payments ?? [],
      fulfillment: existing?.fulfillment ?? [], allocations: finalAllocs, signedDate: existing?.signedDate,
    })
  }

  const targets = [{ id: 'athletics', name: 'Athletic department' }, ...teams.map(t => ({ id: t.id, name: t.name }))]

  return (
    <Modal title={existing ? 'Edit buy' : 'Add a buy'} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>{existing ? 'Save buy' : 'Add buy'}</button>
      </>
    }>
      <p className="small muted" style={{ marginTop: 0 }}>A buy is one contribution under this business. A sponsor can have several — e.g. a department sponsorship plus a donation earmarked for specific sports.</p>
      <div className="form-row">
        <Field label="Label" required>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. White sponsorship, Additional donation" />
        </Field>
        <Field label="Amount ($)" required error={err}>
          <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>
      <Field label="Season">
        <input value={season} onChange={e => setSeason(e.target.value)} placeholder="e.g. Fall 2026" />
      </Field>

      <div className="divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong className="small">Earmark this money (optional)</strong>
        <span className="tiny">{unallocated >= 0 ? `${fmtMoney(unallocated)} to athletic dept` : <span style={{ color: 'var(--danger)' }}>Over by {fmtMoney(-unallocated)}</span>}</span>
      </div>
      {allocs.map((al, i) => (
        <div key={al.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="inline-select" style={{ flex: 1 }} value={al.target} onChange={e => setAllocs(allocs.map((x, j) => j === i ? { ...x, target: e.target.value } : x))}>
              {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input className="input" type="number" min={0} style={{ width: 130 }} value={al.amount} onChange={e => setAllocs(allocs.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
            <button className="btn sm ghost" aria-label="Remove earmark" onClick={() => setAllocs(allocs.filter((_, j) => j !== i))}><I.x /></button>
          </div>
          <input className="input" style={{ marginTop: 6 }} value={al.note ?? ''} onChange={e => setAllocs(allocs.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
            placeholder="Note (optional) — e.g. which athlete gets credit" aria-label="Earmark note" />
        </div>
      ))}
      <button className="btn sm ghost" onClick={() => setAllocs([...allocs, { id: `alloc-${Date.now()}`, target: teams[0]?.id ?? 'athletics', amount: 0 }])}><I.plus /> Earmark for a team</button>
    </Modal>
  )
}

// ---------- Edit sponsor profile ----------

function EditSponsorModal({ sponsor: s, onClose, onSave }: { sponsor: Sponsor; onClose: () => void; onSave: (patch: Partial<Sponsor>) => void }) {
  const [form, setForm] = useState({
    name: s.name, tier: s.tier, contactName: s.contactName, email: s.email ?? '', phone: s.phone ?? '',
    website: s.website ?? '', renewalDate: s.renewalDate, benefitSummary: s.benefitSummary, logoStatus: s.logoStatus,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Business name is required.'
    if (!form.contactName.trim()) errs.contactName = 'A contact name is required.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (form.website && !/^https?:\/\//.test(form.website)) errs.website = 'Website must start with http(s)://'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({
      name: form.name.trim(), tier: form.tier, contactName: form.contactName.trim(),
      email: form.email.trim() || undefined, phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined, renewalDate: form.renewalDate,
      benefitSummary: form.benefitSummary.trim(), logoStatus: form.logoStatus,
    })
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
      <Field label="Renewal date">
        <input type="date" value={form.renewalDate} onChange={e => set({ renewalDate: e.target.value })} />
      </Field>
      <Field label="Benefit summary">
        <textarea rows={2} value={form.benefitSummary} onChange={e => set({ benefitSummary: e.target.value })} />
      </Field>
    </Modal>
  )
}

function PaymentModal({ outstanding, onClose, onSave }: { outstanding: number; onClose: () => void; onSave: (amount: number, method: string, date: string) => void }) {
  const { state } = useStore()
  const [amount, setAmount] = useState(Math.max(outstanding, 0).toFixed(2))
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
      <p className="small muted" style={{ marginTop: 0 }}>Outstanding on this buy: <strong>{fmtMoney(outstanding)}</strong></p>
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
