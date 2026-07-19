import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { PIPELINE_STAGES, agreementPaid, can, eventTitle, fulfillmentProgress, visibleStatus } from '../lib/derive'
import { fmtDate, fmtDateTime, fmtMoney, fmtTime } from '../lib/dates'
import { Avatar, Badge, Card, Check, Empty, Field, Modal, Progress, StatusBadge } from '../components/ui'
import { StageBadge, TierBadge } from './SponsorsPage'
import { I } from '../components/icons'
import type { Agreement, FulfillmentItem, Payment, PipelineStage, Sponsor } from '../types'

export default function SponsorDetail() {
  const { id } = useParams()
  const { state, update, logActivity, toast } = useStore()
  const [paying, setPaying] = useState(false)
  const [noteText, setNoteText] = useState('')
  const me = state.users.find(u => u.id === state.currentUserId)!
  const s = state.sponsors.find(x => x.id === id)
  const a = state.agreements.find(x => x.sponsorId === id)

  if (!s) return <Card><Empty icon="?" title="Sponsor not found" /></Card>

  const editable = can(me.role, 'edit')
  const financeOk = can(me.role, 'finance')
  const paid = a ? agreementPaid(a) : 0
  const prog = a ? fulfillmentProgress(a) : { done: 0, total: 0 }
  const linkedEvents = state.events.filter(e => e.sponsorActivations.some(a => a.sponsorId === s.id)).sort((x, y) => x.date.localeCompare(y.date))
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
      // Keep the sponsor's logo status in sync with the checklist
      if (item.label === 'Logo received') update('sponsors', s.id, { logoStatus: 'received' } as Partial<Sponsor>)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 6 }}><Link to="/sponsors" className="tiny link">← Sponsors</Link></div>
          <h1 className="page-title">{s.name}</h1>
          <p className="page-sub">{s.contactName}{s.email ? ` · ${s.email}` : ''}{s.phone ? ` · ${s.phone}` : ''}</p>
          <div className="pill-row" style={{ marginTop: 8 }}>
            <TierBadge tier={s.tier} />
            <StageBadge stage={s.stage} />
            {a && <StatusBadge status={a.paymentStatus} />}
            <StatusBadge status={s.logoStatus} />
            <Badge tone="outline">Renews {fmtDate(s.renewalDate, { month: 'short', day: 'numeric', year: 'numeric' })}</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
              <div key={f.id} className={`checklist-item ${f.status === 'complete' ? 'done' : ''}`} style={{ padding: '9px 18px' }}>
                <Check checked={f.status === 'complete'} disabled={!editable} onChange={() => toggleItem(f)} />
                <span className="label">
                  {f.label}
                  {f.dueDate && f.status !== 'complete' && <div className="tiny">Due {fmtDate(f.dueDate)}</div>}
                </span>
                {f.status === 'pending' && f.dueDate && f.dueDate < state.demoToday && <Badge tone="danger">Overdue</Badge>}
                <StatusBadge status={f.status === 'complete' ? 'complete' : 'pending'} label={f.status === 'complete' ? 'Complete' : 'Pending'} />
              </div>
            ))}
          </Card>

          <Card title="Event assignments" pad={false} action={<Link to="/events" className="card-link">Events →</Link>}>
            {linkedEvents.length === 0 && <Empty icon="◈" title="Not assigned to a game yet" hint="Assign this sponsor from any event's Sponsors tab." />}
            {linkedEvents.map(e => (
              <Link key={e.id} to={`/events/${e.id}?tab=sponsors`} className="notif-item">
                <span style={{ flex: 1 }}>
                  <strong>{eventTitle(e, { short: true })}</strong>
                  {' — '}{e.sponsorActivations.filter(a => a.sponsorId === s.id).map(a => a.activation).join(', ')}
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
                <thead><tr><th>Date</th><th>Method</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {a.payments.map(p => (
                    <tr key={p.id}><td>{fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{p.method}</td><td className="num">{fmtMoney(p.amount)}</td></tr>
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
              {s.notes.map(n => {
                const author = state.users.find(u => u.id === n.authorId)
                return (
                  <div key={n.id} className="feed-item">
                    <Avatar user={author} size="sm" />
                    <span>{n.text}<div className="when">{author?.name} · {fmtDateTime(n.at)}</div></span>
                  </div>
                )
              })}
            </div>
            {editable && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
                <input className="input" style={{ flex: 1 }} placeholder="Add a note…" value={noteText} onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()} />
                <button className="btn sm" onClick={addNote}><I.plus /></button>
              </div>
            )}
          </Card>
        </div>
      </div>

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

  function addNote() {
    if (!noteText.trim()) return
    update('sponsors', s!.id, {
      notes: [{ id: `n-${Date.now()}`, at: new Date().toISOString(), authorId: me.id, text: noteText.trim() }, ...s!.notes],
    } as Partial<Sponsor>)
    setNoteText('')
    toast('Note added')
  }
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
