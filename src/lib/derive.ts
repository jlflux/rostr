import type { Agreement, AppState, BroadcastCheckItem, CoachRequest, EventStatus, PipelineStage, SportEvent, Task } from '../types'
import { addDays, weekStart } from './dates'

// ---------- Business/derived logic, kept out of display components ----------

export function orgScoped<T extends { orgId: string }>(state: AppState, rows: T[]): T[] {
  return rows.filter(r => r.orgId === state.currentOrgId)
}

export const events = (s: AppState) => orgScoped(s, s.events)
export const sponsors = (s: AppState) => orgScoped(s, s.sponsors)
export const agreements = (s: AppState) => orgScoped(s, s.agreements)
export const requests = (s: AppState) => orgScoped(s, s.requests)
export const tasks = (s: AppState) => orgScoped(s, s.tasks)
export const teams = (s: AppState) => orgScoped(s, s.teams)
export const assets = (s: AppState) => orgScoped(s, s.assets)

export function eventsThisWeek(s: AppState): SportEvent[] {
  const start = weekStart(s.demoToday)
  const end = addDays(start, 7)
  return events(s).filter(e => e.date >= start && e.date < end && e.status !== 'canceled')
    .sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
}

export function upcomingBroadcasts(s: AppState, limit = 6): SportEvent[] {
  return events(s)
    .filter(e => e.date >= s.demoToday && (e.broadcastStatus === 'planned' || e.broadcastStatus === 'confirmed'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

export function unfilledSlots(s: AppState): { event: SportEvent; count: number }[] {
  return events(s)
    .filter(e => e.date >= s.demoToday)
    .map(e => ({ event: e, count: e.staffSlots.filter(sl => sl.status === 'unfilled' || sl.status === 'declined').length }))
    .filter(x => x.count > 0)
    .sort((a, b) => a.event.date.localeCompare(b.event.date))
}

export function agreementPaid(a: Agreement): number {
  return a.payments.reduce((sum, p) => sum + p.amount, 0)
}

export function sponsorshipTotals(s: AppState) {
  const ags = agreements(s)
  const total = ags.reduce((sum, a) => sum + a.amount, 0)
  const collected = ags.reduce((sum, a) => sum + agreementPaid(a), 0)
  return { total, collected, outstanding: total - collected, count: ags.length }
}

export function unpaidAgreements(s: AppState): Agreement[] {
  return agreements(s).filter(a => a.paymentStatus !== 'paid')
    .sort((a, b) => (b.amount - agreementPaid(b)) - (a.amount - agreementPaid(a)))
}

export function missingSponsorAssets(s: AppState) {
  return sponsors(s).filter(sp => sp.stage === 'committed' && sp.logoStatus !== 'received')
}

export function fulfillmentProgress(a: Agreement): { done: number; total: number } {
  const items = a.fulfillment.filter(f => f.status !== 'na')
  return { done: items.filter(f => f.status === 'complete').length, total: items.length }
}

export function obligationsDue(s: AppState) {
  const soon = addDays(s.demoToday, 14)
  const out: { agreement: Agreement; label: string; dueDate: string }[] = []
  for (const a of agreements(s)) {
    for (const f of a.fulfillment) {
      if (f.status === 'pending' && f.dueDate && f.dueDate <= soon) {
        out.push({ agreement: a, label: f.label, dueDate: f.dueDate })
      }
    }
  }
  return out.sort((x, y) => x.dueDate.localeCompare(y.dueDate))
}

export function openRequests(s: AppState): CoachRequest[] {
  return requests(s).filter(r => r.status !== 'completed')
    .sort((a, b) => a.neededBy.localeCompare(b.neededBy))
}

export function overdueTasks(s: AppState): Task[] {
  return tasks(s).filter(t => t.status !== 'done' && t.dueDate < s.demoToday)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function upcomingContent(s: AppState, days = 7): Task[] {
  const end = addDays(s.demoToday, days)
  return tasks(s).filter(t => t.kind === 'content' && t.status !== 'done' && t.dueDate >= s.demoToday && t.dueDate <= end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/**
 * Same-day, same-venue home events within 2h of each other, across different
 * sports. Same-sport back-to-back games (Freshman/JV/Varsity doubleheaders)
 * are intentional and not flagged.
 */
export function venueConflicts(s: AppState): Map<string, string[]> {
  const conflicts = new Map<string, string[]>()
  const byKey = new Map<string, SportEvent[]>()
  for (const e of events(s)) {
    if (e.homeAway !== 'home' || !e.time || e.status === 'canceled') continue
    const key = `${e.date}|${e.venue.toLowerCase()}`
    byKey.set(key, [...(byKey.get(key) ?? []), e])
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    for (const a of group) {
      for (const b of group) {
        if (a.id >= b.id) continue
        const mins = Math.abs(toMins(a.time!) - toMins(b.time!))
        if (mins < 120 && a.sport !== b.sport) {
          conflicts.set(a.id, [...(conflicts.get(a.id) ?? []), b.id])
          conflicts.set(b.id, [...(conflicts.get(b.id) ?? []), a.id])
        }
      }
    }
  }
  return conflicts
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** "Football vs Hoover" / "Cross Country at Coach Wood Invitational" / "Football Fan Day & Media Night" */
export function eventTitle(e: SportEvent, opts?: { short?: boolean }): string {
  const lvl = e.level !== 'Varsity' && !opts?.short ? ` (${e.level})` : ''
  const base = `${e.sport}${lvl}`
  if (e.eventKind === 'noncomp') return `${base} ${e.opponent}`
  if (e.eventKind === 'tournament') return `${base} ${e.homeAway === 'home' ? 'hosts' : 'at'} ${e.opponent}`
  return `${base} ${e.homeAway === 'home' ? 'vs' : e.homeAway === 'away' ? 'at' : '·'} ${e.opponent}`
}

/** Matchup text without the sport word — used next to a sport icon. */
export function matchupLabel(e: SportEvent): string {
  const lvl = e.level !== 'Varsity' ? ` (${e.level})` : ''
  if (e.eventKind === 'noncomp') return `${e.opponent}${lvl}`
  if (e.eventKind === 'tournament') return `${e.homeAway === 'home' ? 'Hosts' : 'at'} ${e.opponent}${lvl}`
  const w = e.homeAway === 'home' ? 'vs ' : e.homeAway === 'away' ? 'at ' : ''
  return `${w}${e.opponent}${lvl}`
}

/** Opponents not in the trash. */
export function activeOpponents(s: AppState) {
  return s.opponents.filter(o => o.orgId === s.currentOrgId && !o.deletedAt)
}

export function trashedOpponents(s: AppState) {
  return s.opponents.filter(o => o.orgId === s.currentOrgId && !!o.deletedAt)
}

export const BROADCAST_CHECK_ITEMS: { id: string; label: string }[] = [
  { id: 'crew', label: 'Broadcast crew assigned' },
  { id: 'location', label: 'Setup location confirmed' },
  { id: 'parking', label: 'Unload / special parking arranged' },
  { id: 'internet', label: 'Internet availability verified' },
  { id: 'power', label: 'Power availability verified' },
  { id: 'link', label: 'Broadcast link published' },
]

export function defaultBroadcastChecklist(): BroadcastCheckItem[] {
  return BROADCAST_CHECK_ITEMS.map(i => ({ id: i.id, label: i.label, status: 'pending' }))
}

export type BroadcastState = 'none' | 'in_progress' | 'confirmed' | 'archived'

/**
 * A broadcast is only "confirmed" once every checklist item is resolved
 * (done or marked not-applicable) — a pasted link alone is just "in progress".
 */
export function broadcastState(e: SportEvent): BroadcastState {
  if (e.broadcastStatus === 'none') return 'none'
  if (e.broadcastStatus === 'archived') return 'archived'
  const list = e.broadcastChecklist ?? defaultBroadcastChecklist()
  return list.every(i => i.status !== 'pending') ? 'confirmed' : 'in_progress'
}

/**
 * The status to display: with sample results hidden, seed-"completed" games
 * revert to Scheduled (nothing has actually been played preseason).
 */
export function visibleStatus(s: AppState, e: SportEvent): EventStatus {
  if (!s.showSampleResults && e.status === 'completed' && (!e.score || e.score.sample)) return 'scheduled'
  return e.status
}

export const PIPELINE_STAGES: { value: PipelineStage; label: string; hint: string }[] = [
  { value: 'prospect', label: 'Prospect', hint: 'Talked about internally' },
  { value: 'contacted', label: 'Reached out', hint: 'Outreach sent, waiting to hear back' },
  { value: 'maybe', label: 'Maybe', hint: 'Interested but not committed' },
  { value: 'committed', label: 'Accepted', hint: 'Said yes — now a sponsor with an agreement' },
  { value: 'declined', label: 'Declined', hint: 'Said no this season' },
]

/** The score to display: hides demo-generated results when sample results are off. */
export function visibleScore(s: AppState, e: SportEvent) {
  if (!e.score) return undefined
  if (e.score.sample && !s.showSampleResults) return undefined
  return e.score
}

export interface WLT { w: number; l: number; t: number }
export interface TeamRecords { overall: WLT; conference: WLT; conferenceLabel: string }

/** "Region" for football, "Area" for volleyball/basketball-style sports. */
export function conferenceLabelFor(sport: string): string {
  return sport === 'Football' ? 'Region' : 'Area'
}

export function teamRecord(s: AppState, teamId: string): TeamRecords {
  const team = teams(s).find(t => t.id === teamId)
  const overall: WLT = { w: 0, l: 0, t: 0 }
  const conference: WLT = { w: 0, l: 0, t: 0 }
  for (const e of events(s)) {
    if (e.teamId !== teamId) continue
    const score = visibleScore(s, e)
    if (!score) continue
    const key = score.result === 'W' ? 'w' : score.result === 'L' ? 'l' : 't'
    overall[key]++
    if (e.gameType === 'region' || e.gameType === 'area') conference[key]++
  }
  return { overall, conference, conferenceLabel: conferenceLabelFor(team?.sport ?? '') }
}

export function fmtWLT(r: WLT): string {
  return `${r.w}–${r.l}${r.t ? `–${r.t}` : ''}`
}

export function hasGames(r: WLT): boolean {
  return r.w + r.l + r.t > 0
}

export function teamCompleteness(s: AppState, teamId: string): number {
  const t = teams(s).find(x => x.id === teamId)
  if (!t) return 0
  let score = 100
  score -= t.missingInfo.length * 15
  if (t.rosterStatus === 'in_progress') score -= 15
  if (t.rosterStatus === 'not_started') score -= 40
  return Math.max(0, score)
}

export const ROLE_LABELS: Record<string, string> = {
  platform_owner: 'Platform Owner',
  school_admin: 'School Administrator',
  comms_admin: 'Communications Admin',
  finance: 'Finance',
  coach: 'Coach',
  event_staff: 'Event Staff',
  read_only: 'Read-only',
}

/** Simple permission model for the prototype. */
export function can(role: string, action: 'edit' | 'finance' | 'admin'): boolean {
  if (role === 'read_only') return false
  if (action === 'finance') return ['platform_owner', 'school_admin', 'finance'].includes(role)
  if (action === 'admin') return ['platform_owner', 'school_admin'].includes(role)
  return ['platform_owner', 'school_admin', 'comms_admin', 'finance', 'coach', 'event_staff'].includes(role)
}

export type Section =
  | 'dashboard' | 'calendar' | 'events' | 'opponents' | 'sponsors'
  | 'teams' | 'requests' | 'assets' | 'reports' | 'settings'

/**
 * What each role is allowed to see. Event staff get only the gameday basics
 * (their events, calendar, assets); coaches add teams/requests/opponents but
 * not sponsor money or reports; admins and above see everything.
 */
export function canView(role: string, section: Section): boolean {
  const ALL: Section[] = ['dashboard', 'calendar', 'events', 'opponents', 'sponsors', 'teams', 'requests', 'assets', 'reports', 'settings']
  const BY_ROLE: Record<string, Section[]> = {
    platform_owner: ALL,
    school_admin: ALL,
    comms_admin: ALL,
    finance: ALL,
    read_only: ALL,
    coach: ['dashboard', 'calendar', 'events', 'opponents', 'teams', 'requests', 'assets', 'settings'],
    event_staff: ['dashboard', 'calendar', 'events', 'assets', 'settings'],
  }
  return (BY_ROLE[role] ?? ['dashboard']).includes(section)
}

// ---------- Sponsor money: a sponsor may have multiple "buys" (agreements) ----------

export function sponsorAgreements(s: AppState, sponsorId: string): Agreement[] {
  return agreements(s).filter(a => a.sponsorId === sponsorId)
}

export function sponsorTotal(s: AppState, sponsorId: string): number {
  return sponsorAgreements(s, sponsorId).reduce((n, a) => n + a.amount, 0)
}

export function sponsorPaid(s: AppState, sponsorId: string): number {
  return sponsorAgreements(s, sponsorId).reduce((n, a) => n + agreementPaid(a), 0)
}

export function sponsorPaymentStatus(s: AppState, sponsorId: string): 'paid' | 'partial' | 'unpaid' {
  const total = sponsorTotal(s, sponsorId)
  const paid = sponsorPaid(s, sponsorId)
  if (total === 0) return 'unpaid'
  if (paid >= total) return 'paid'
  return paid > 0 ? 'partial' : 'unpaid'
}

/** Money earmarked to each team/department across all of a sponsor's buys. */
export function sponsorAllocations(s: AppState, sponsorId: string): { target: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const a of sponsorAgreements(s, sponsorId)) {
    for (const al of a.allocations ?? []) totals.set(al.target, (totals.get(al.target) ?? 0) + al.amount)
  }
  return [...totals.entries()].map(([target, amount]) => ({ target, amount })).sort((a, b) => b.amount - a.amount)
}

export function allocationLabel(s: AppState, target: string): string {
  if (target === 'athletics') return 'Athletic department'
  return teams(s).find(t => t.id === target)?.name ?? target
}
