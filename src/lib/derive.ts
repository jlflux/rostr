import type { Agreement, AppState, BroadcastCheckItem, CoachRequest, EventStatus, FulfillmentItem, Payment, PaymentStatus, PipelineStage, SponsorTier, SportEvent, Task } from '../types'
import { addDays, weekStart } from './dates'

// ---------- Business/derived logic, kept out of display components ----------

export function orgScoped<T extends { orgId: string }>(state: AppState, rows: T[]): T[] {
  return rows.filter(r => r.orgId === state.currentOrgId)
}

export const events = (s: AppState) => orgScoped(s, s.events).filter(e => !e.deletedAt)
export const trashedEvents = (s: AppState) => orgScoped(s, s.events).filter(e => !!e.deletedAt)
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

/** Cash portion of a buy (what counts toward revenue). Trade value is excluded. */
export function agreementCash(a: Agreement): number {
  return a.amount - (a.tradeValue ?? 0)
}

/** Agreements belonging to sponsors that are actually "accepted" (committed). */
export function committedAgreements(s: AppState): Agreement[] {
  const committed = new Set(sponsors(s).filter(sp => sp.stage === 'committed').map(sp => sp.id))
  return agreements(s).filter(a => committed.has(a.sponsorId))
}

export function sponsorshipTotals(s: AppState) {
  const ags = committedAgreements(s)
  const total = ags.reduce((sum, a) => sum + agreementCash(a), 0)
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

export const EVENT_KIND_LABELS: Record<string, string> = {
  single: 'Single opponent',
  multi: 'Multi-opponent (tri/quad match)',
  tournament: 'Tournament',
  noncomp: 'Non-competition event',
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
  | 'platform'

/** Sections a school can be given; 'platform' is the operator console, not a
 *  school feature, and 'dashboard'/'settings' are structural so can't be hidden. */
export const SCHOOL_SECTIONS: Section[] = [
  'dashboard', 'calendar', 'events', 'opponents', 'sponsors',
  'teams', 'requests', 'assets', 'reports', 'settings',
]
export const CONFIGURABLE_SECTIONS: Section[] = SCHOOL_SECTIONS.filter(
  s => s !== 'dashboard' && s !== 'settings',
)

/** Default display names, used when a school hasn't renamed a section. */
export const SECTION_LABELS: Record<Section, string> = {
  dashboard: 'Dashboard', calendar: 'Calendar', events: 'Events', opponents: 'Opponents',
  sponsors: 'Sponsors', teams: 'Teams', requests: 'Requests', assets: 'Assets',
  reports: 'Reports', settings: 'Settings', platform: 'Platform',
}

/**
 * Whether this person may move between schools. Platform owners always can;
 * anyone else needs it granted explicitly, so school staff stay pinned to their
 * own school.
 */
export function canSwitchOrgs(user: { role: string; canSwitchOrgs?: boolean }): boolean {
  return user.role === 'platform_owner' || user.canSwitchOrgs === true
}

/** What this school calls a section (falls back to the default name). */
export function sectionLabel(state: AppState, section: Section): string {
  const org = state.orgs.find(o => o.id === state.currentOrgId)
  const custom = org?.config?.sectionLabels?.[section]?.trim()
  return custom || SECTION_LABELS[section]
}

/** Whether this school has the section switched on at all. */
export function sectionEnabled(state: AppState, section: Section): boolean {
  if (section === 'dashboard' || section === 'settings' || section === 'platform') return true
  const org = state.orgs.find(o => o.id === state.currentOrgId)
  return !(org?.config?.hiddenSections ?? []).includes(section)
}

/**
 * The single check the whole app should use: the role must allow it AND the
 * school must have it switched on. Keeping both in one place means the nav,
 * the route guards, and global search can't drift apart.
 */
export function canSee(state: AppState, role: string, section: Section): boolean {
  return canView(role, section) && sectionEnabled(state, section)
}

/**
 * What each role is allowed to see. Event staff get only the gameday basics
 * (their events, calendar, assets); coaches add teams/requests/opponents but
 * not sponsor money or reports; admins and above see everything.
 */
export function canView(role: string, section: Section): boolean {
  const ALL: Section[] = SCHOOL_SECTIONS
  const BY_ROLE: Record<string, Section[]> = {
    // Only the platform owner sees the operator console.
    platform_owner: [...ALL, 'platform'],
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

/** Gross deal size across a sponsor's buys (cash + trade). */
export function sponsorTotal(s: AppState, sponsorId: string): number {
  return sponsorAgreements(s, sponsorId).reduce((n, a) => n + a.amount, 0)
}

/** Cash value across a sponsor's buys — the part that counts toward revenue. */
export function sponsorCash(s: AppState, sponsorId: string): number {
  return sponsorAgreements(s, sponsorId).reduce((n, a) => n + agreementCash(a), 0)
}

/** Trade (non-cash) value across a sponsor's buys. */
export function sponsorTrade(s: AppState, sponsorId: string): number {
  return sponsorAgreements(s, sponsorId).reduce((n, a) => n + (a.tradeValue ?? 0), 0)
}

export function sponsorPaid(s: AppState, sponsorId: string): number {
  return sponsorAgreements(s, sponsorId).reduce((n, a) => n + agreementPaid(a), 0)
}

export function sponsorPaymentStatus(s: AppState, sponsorId: string): 'paid' | 'partial' | 'unpaid' {
  const cash = sponsorCash(s, sponsorId)
  const paid = sponsorPaid(s, sponsorId)
  if (cash <= 0) return paid > 0 ? 'paid' : 'unpaid'
  if (paid >= cash) return 'paid'
  return paid > 0 ? 'partial' : 'unpaid'
}

/**
 * Headline numbers for the Sponsors page. "Accepted" = committed sponsors only, so
 * declining/removing a sponsor immediately drops their money from the totals.
 * Potential adds the amount entered for each sponsor still in the pipeline
 * (sp.estValue); prospects with no amount entered contribute nothing.
 */
export function sponsorProgramTotals(s: AppState) {
  const sps = sponsors(s)
  const committed = sps.filter(sp => sp.stage === 'committed')
  const committedIds = new Set(committed.map(sp => sp.id))
  const committedAgs = agreements(s).filter(a => committedIds.has(a.sponsorId))

  const total = committedAgs.reduce((n, a) => n + agreementCash(a), 0)
  const collected = committedAgs.reduce((n, a) => n + agreementPaid(a), 0)
  const trade = committedAgs.reduce((n, a) => n + (a.tradeValue ?? 0), 0)

  const pipeline = sps.filter(sp => sp.stage !== 'committed' && sp.stage !== 'declined')
  const pipelineValue = pipeline.reduce((n, sp) => n + (sp.estValue ?? 0), 0)

  // "Missing assets" = committed sponsors whose fulfillment bar isn't full.
  const missingAssets = committed.filter(sp => {
    const prog = committedAgs.filter(a => a.sponsorId === sp.id)
      .reduce((acc, a) => { const p = fulfillmentProgress(a); return { done: acc.done + p.done, total: acc.total + p.total } }, { done: 0, total: 0 })
    return prog.total > 0 && prog.done < prog.total
  }).length

  return {
    total, collected, outstanding: total - collected, trade,
    committedCount: committed.length,
    potential: total + pipelineValue, pipelineValue, pipelineCount: pipeline.length,
    missingAssets,
  }
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
  // Legacy earmarks pointed at a specific team; new ones use the sport name directly.
  return teams(s).find(t => t.id === target)?.name ?? target
}

// ---------- Sponsor tier settings ----------

export const tierSettings = (s: AppState) => orgScoped(s, s.tierSettings)
export function tierSetting(s: AppState, tier: SponsorTier) {
  return tierSettings(s).find(t => t.tier === tier)
}

/**
 * Payment + earmark defaults for a brand-new buy of `tier`, honoring the tier
 * settings: auto-paid tiers get a full cash payment recorded; a default earmark
 * sport puts the cash toward that sport (otherwise it falls to athletics).
 */
export function newBuyDefaults(s: AppState, tier: SponsorTier, cash: number, when: string) {
  const ts = tierSetting(s, tier)
  const stamp = Date.now()
  const payments: Payment[] = ts?.autoPaid && cash > 0
    ? [{ id: `pay-${stamp}`, date: when, amount: cash, method: 'Card (online)' }]
    : []
  const allocations = ts?.earmarkSport && cash > 0
    ? [{ id: `alloc-${stamp}`, target: ts.earmarkSport, amount: cash }]
    : []
  return { payments, paymentStatus: (payments.length ? 'paid' : 'unpaid') as PaymentStatus, allocations }
}

// ---------- Sponsor benefit templates ----------

export const benefitTemplates = (s: AppState) => orgScoped(s, s.benefitTemplates)

/** Fulfillment items a new sponsor of `tier` should start with, from the templates. */
export function fulfillmentForTier(s: AppState, tier: SponsorTier): FulfillmentItem[] {
  const stamp = Date.now()
  return benefitTemplates(s)
    .filter(t => t.tiers.includes(tier))
    .map((t, i) => ({ id: `ff-${t.id}-${stamp}-${i}`, label: t.label, status: 'pending' as const }))
}

/**
 * Total sponsorship revenue split by where the money is earmarked. Any part of a
 * buy that isn't earmarked to a specific team falls to the athletic department, so
 * a $5,000 buy with $500 earmarked to cheer shows $4,500 to athletics + $500 to cheer.
 */
export function revenueByDepartment(s: AppState): { target: string; label: string; total: number; collected: number }[] {
  const totals = new Map<string, { total: number; collected: number }>()
  const bump = (target: string, total: number, collected: number) => {
    const cur = totals.get(target) ?? { total: 0, collected: 0 }
    cur.total += total; cur.collected += collected
    totals.set(target, cur)
  }
  for (const a of committedAgreements(s)) {
    const cash = agreementCash(a)
    const paidRatio = cash > 0 ? agreementPaid(a) / cash : 0
    const allocs = a.allocations ?? []
    let allocated = 0
    for (const al of allocs) { bump(al.target, al.amount, al.amount * paidRatio); allocated += al.amount }
    const remainder = cash - allocated
    if (remainder > 0) bump('athletics', remainder, remainder * paidRatio)
  }
  return [...totals.entries()]
    .map(([target, v]) => ({ target, label: allocationLabel(s, target), total: v.total, collected: v.collected }))
    .sort((a, b) => b.total - a.total)
}

/** Every team earmark (excludes the athletic-department default), newest-largest first, with its note. */
export function teamEarmarks(s: AppState): { id: string; sponsorId: string; sponsorName: string; label: string; amount: number; note?: string }[] {
  const out: { id: string; sponsorId: string; sponsorName: string; label: string; amount: number; note?: string }[] = []
  for (const a of committedAgreements(s)) {
    const sp = sponsors(s).find(x => x.id === a.sponsorId)
    for (const al of a.allocations ?? []) {
      if (al.target === 'athletics') continue
      out.push({ id: al.id, sponsorId: a.sponsorId, sponsorName: sp?.name ?? '—', label: allocationLabel(s, al.target), amount: al.amount, note: al.note })
    }
  }
  return out.sort((a, b) => b.amount - a.amount)
}
