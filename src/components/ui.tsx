import React, { useEffect, useState } from 'react'
import { I } from './icons'
import type { User } from '../types'

// ---------- Badges ----------

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand' | 'navy' | 'outline'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge ${tone === 'neutral' ? '' : tone}`}>{children}</span>
}

const STATUS_TONES: Record<string, { tone: Tone; label: string }> = {
  // events
  scheduled: { tone: 'neutral', label: 'Scheduled' },
  confirmed: { tone: 'info', label: 'Confirmed' },
  completed: { tone: 'ok', label: 'Completed' },
  postponed: { tone: 'warn', label: 'Postponed' },
  canceled: { tone: 'danger', label: 'Canceled' },
  // payments
  paid: { tone: 'ok', label: 'Paid' },
  partial: { tone: 'warn', label: 'Partial' },
  unpaid: { tone: 'danger', label: 'Unpaid' },
  // requests
  submitted: { tone: 'info', label: 'Submitted' },
  reviewed: { tone: 'warn', label: 'Reviewed' },
  in_progress: { tone: 'brand', label: 'In progress' },
  // tasks
  open: { tone: 'neutral', label: 'Open' },
  done: { tone: 'ok', label: 'Done' },
  // slots
  unfilled: { tone: 'danger', label: 'Unfilled' },
  assigned: { tone: 'warn', label: 'Assigned' },
  declined: { tone: 'danger', label: 'Declined' },
  // approval
  approved: { tone: 'ok', label: 'Approved' },
  pending: { tone: 'warn', label: 'Pending' },
  rejected: { tone: 'danger', label: 'Rejected' },
  // sponsors
  received: { tone: 'ok', label: 'Logo received' },
  missing: { tone: 'danger', label: 'Logo missing' },
  needs_update: { tone: 'warn', label: 'Logo needs update' },
  // broadcast
  planned: { tone: 'neutral', label: 'Broadcast planned' },
  live: { tone: 'brand', label: 'Live' },
  archived: { tone: 'neutral', label: 'Archived' },
  // roster
  complete: { tone: 'ok', label: 'Complete' },
  not_started: { tone: 'danger', label: 'Not started' },
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cfg = STATUS_TONES[status] ?? { tone: 'neutral' as Tone, label: status }
  return <Badge tone={cfg.tone}>{label ?? cfg.label}</Badge>
}

export function PriorityBadge({ p }: { p: string }) {
  const tone: Tone = p === 'urgent' ? 'danger' : p === 'high' ? 'warn' : p === 'low' ? 'outline' : 'neutral'
  return <Badge tone={tone}>{p[0].toUpperCase() + p.slice(1)}</Badge>
}

export function HomeAwayBadge({ ha }: { ha: string }) {
  if (ha === 'home') return <Badge tone="brand">Home</Badge>
  if (ha === 'away') return <Badge tone="navy">Away</Badge>
  return <Badge tone="outline">{ha === 'neutral' ? 'Neutral' : 'TBD'}</Badge>
}

// ---------- Avatar ----------

export function Avatar({ user, size }: { user?: User | null; size?: 'sm' | 'lg' }) {
  if (!user) return <div className={`avatar ${size ?? ''}`} style={{ background: 'var(--border-strong)', color: 'var(--text-2)' }}>—</div>
  return <div className={`avatar ${size ?? ''}`} style={{ background: user.color }} title={user.name}>{user.initials}</div>
}

// ---------- Card ----------

export function Card({ title, action, children, pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <div className="card">
      {title != null && (
        <div className="card-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </div>
  )
}

export function StatCard({ label, value, hint, tone, onClick }: { label: string; value: React.ReactNode; hint?: string; tone?: 'alert' | 'warn' | 'ok'; onClick?: () => void }) {
  return (
    <div className={`card stat-card ${tone ?? ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// ---------- Modal ----------

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }: {
  title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
      </>
    }>
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  )
}

// ---------- Forms ----------

export function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>{label} {required && <span className="req">*</span>}</label>
      {children}
      {error && <span className="error-msg">{error}</span>}
    </div>
  )
}

// ---------- Empty state ----------

export function Empty({ icon = '○', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <h4>{title}</h4>
      {hint && <p>{hint}</p>}
    </div>
  )
}

// ---------- Search box ----------

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="searchbox">
      <span className="icon"><I.search /></span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'} aria-label={placeholder ?? 'Search'} />
    </div>
  )
}

// ---------- Segmented control ----------

export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map(o => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

// ---------- Checkbox ----------

export function Check({ checked, onChange, disabled }: { checked: boolean; onChange?: () => void; disabled?: boolean }) {
  return (
    <button className={`checkbox ${checked ? 'checked' : ''}`} onClick={onChange} disabled={disabled} aria-checked={checked} role="checkbox">
      {checked && <I.check />}
    </button>
  )
}

// ---------- Sortable table headers ----------

export type SortDir = 'asc' | 'desc'
export interface SortState<K extends string> { key: K; dir: SortDir }

/** Track a table's sort column + direction. Clicking the same column flips direction. */
export function useSort<K extends string>(key: K, dir: SortDir = 'asc') {
  const [sort, setSort] = useState<SortState<K>>({ key, dir })
  const onSort = (k: K) => setSort(s => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))
  return { sort, onSort }
}

/** Compare two values for `sortRows`: numbers numerically, everything else A→Z (case-insensitive). */
export function cmpValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
}

/** Sort a copy of `rows` by the value `get` returns for the active key, respecting direction. */
export function sortRows<T, K extends string>(rows: T[], sort: SortState<K>, get: (row: T, key: K) => unknown): T[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => sign * cmpValues(get(a, sort.key), get(b, sort.key)))
}

/** A clickable `<th>` that shows the current sort direction. */
export function SortTh<K extends string>({ label, k, sort, onSort, className, style }: {
  label: React.ReactNode; k: K; sort: SortState<K>; onSort: (k: K) => void; className?: string; style?: React.CSSProperties
}) {
  const active = sort.key === k
  return (
    <th
      className={`sortable ${active ? 'sorted' : ''} ${className ?? ''}`}
      style={style}
      onClick={() => onSort(k)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title="Click to sort"
    >
      <span className="sort-th">{label}<span className="sort-caret" aria-hidden>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span></span>
    </th>
  )
}

// ---------- Progress ----------

export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  const cls = pct >= 80 ? '' : pct >= 40 ? 'warn' : 'danger'
  return <div className={`progressbar ${cls}`}><div style={{ width: `${pct}%` }} /></div>
}
