import rawSchedule from './scheduleEvents.json'
import type {
  Activity, Agreement, AppState, Asset, Athlete, CoachRequest, FulfillmentItem, Opponent, Organization,
  SportEvent, Sponsor, StaffRole, StaffSlot, Task, Team, User,
} from '../types'

// The prototype runs on a frozen "demo clock" so the fall 2026 season data
// reads as an in-progress season. Changeable in Settings.
export const DEFAULT_DEMO_TODAY = '2026-09-25'

// Deterministic pseudo-random from a string, so seeded data is stable.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}
const pick = <T,>(arr: T[], key: string): T => arr[Math.floor(hash(key) * arr.length) % arr.length]

export const orgs: Organization[] = [
  {
    id: 'org-hhs', name: 'Homewood High School Athletics', shortName: 'Homewood',
    mascot: 'Patriots', city: 'Homewood', state: 'AL', initials: 'HW',
    theme: { primary: '#d60000', navy: '#12223c', accent: '#b8933f' },
  },
  {
    id: 'org-demo', name: 'Riverbend Academy Athletics', shortName: 'Riverbend',
    mascot: 'Ospreys', city: 'Chattanooga', state: 'TN', initials: 'RA',
    theme: { primary: '#0e7a5f', navy: '#122b3c', accent: '#c46a1f' },
  },
]

export const users: User[] = [
  { id: 'u-owner', orgId: 'org-hhs', name: 'Alex Rivera', email: 'alex@headqtrs.app', role: 'platform_owner', title: 'HeadQtrs Platform Owner', initials: 'AR', color: '#6d28d9' },
  { id: 'u-ad', orgId: 'org-hhs', name: 'Marcus Cole', email: 'mcole@homewood.k12.al.us', role: 'school_admin', title: 'Athletic Director', initials: 'MC', color: '#d60000' },
  { id: 'u-comms', orgId: 'org-hhs', name: 'Katie Bramlett', email: 'kbramlett@homewood.k12.al.us', role: 'comms_admin', title: 'Athletics Communications Director', initials: 'KB', color: '#0e7490' },
  { id: 'u-fin', orgId: 'org-hhs', name: 'Sandra Ellis', email: 'sellis@homewood.k12.al.us', role: 'finance', title: 'Athletics Bookkeeper', initials: 'SE', color: '#15803d' },
  { id: 'u-fb', orgId: 'org-hhs', name: 'Ben Ward', email: 'bward@homewood.k12.al.us', role: 'coach', title: 'Head Football Coach', initials: 'BW', color: '#b45309', teamIds: ['t-fb-v', 't-fb-jv', 't-fb-fr'] },
  { id: 'u-vb', orgId: 'org-hhs', name: 'Lauren Tate', email: 'ltate@homewood.k12.al.us', role: 'coach', title: 'Head Volleyball Coach', initials: 'LT', color: '#be185d', teamIds: ['t-vb-v', 't-vb-jv', 't-vb-fr'] },
  { id: 'u-ffb', orgId: 'org-hhs', name: 'Dana Brooks', email: 'dbrooks@homewood.k12.al.us', role: 'coach', title: 'Head Flag Football Coach', initials: 'DB', color: '#7c3aed', teamIds: ['t-ffb-v', 't-ffb-jv'] },
  { id: 'u-xc', orgId: 'org-hhs', name: 'Chris Nolan', email: 'cnolan@homewood.k12.al.us', role: 'coach', title: 'Head Cross Country Coach', initials: 'CN', color: '#0369a1', teamIds: ['t-xc-v', 't-xc-jv'] },
  { id: 'u-cheer', orgId: 'org-hhs', name: 'Emily Ross', email: 'eross@homewood.k12.al.us', role: 'coach', title: 'Cheerleading Sponsor', initials: 'ER', color: '#c2410c', teamIds: ['t-cheer-v'] },
  { id: 'u-pa', orgId: 'org-hhs', name: 'Ray Simmons', email: 'ray.simmons@gmail.com', role: 'event_staff', title: 'PA Announcer', initials: 'RS', color: '#374151' },
  { id: 'u-tix', orgId: 'org-hhs', name: 'Gloria Chen', email: 'gloria.chen@gmail.com', role: 'event_staff', title: 'Gate & Ticketing', initials: 'GC', color: '#4d7c0f' },
  { id: 'u-vboard', orgId: 'org-hhs', name: 'Jamal Foster', email: 'jamal.foster@gmail.com', role: 'event_staff', title: 'Video-board Operator', initials: 'JF', color: '#1d4ed8' },
  { id: 'u-photo', orgId: 'org-hhs', name: 'Priya Nair', email: 'priya@nairphoto.com', role: 'event_staff', title: 'Photographer', initials: 'PN', color: '#9d174d' },
  { id: 'u-admin2', orgId: 'org-hhs', name: 'Hank Odom', email: 'hodom@homewood.k12.al.us', role: 'event_staff', title: 'Assistant AD / Game Admin', initials: 'HO', color: '#12223c' },
  { id: 'u-intern', orgId: 'org-hhs', name: 'Will Hastings', email: 'whastings27@homewood.k12.al.us', role: 'event_staff', title: 'Student Intern', initials: 'WH', color: '#a16207' },
  { id: 'u-read', orgId: 'org-hhs', name: 'Pat Doyle', email: 'pdoyle@homewoodboosters.org', role: 'read_only', title: 'Booster Club Liaison', initials: 'PD', color: '#57534e' },
]

export const teams: Team[] = [
  { id: 't-fb-v', orgId: 'org-hhs', sport: 'Football', level: 'Varsity', name: 'Varsity Football', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-fb'], rosterStatus: 'complete', rosterCount: 68, missingInfo: [], importantDates: [{ label: 'Region play begins', date: '2026-09-04' }, { label: 'Homecoming vs Chelsea', date: '2026-10-08' }, { label: 'Senior Night vs Oak Mountain', date: '2026-10-30' }] },
  { id: 't-fb-jv', orgId: 'org-hhs', sport: 'Football', level: 'JV', name: 'JV Football', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-fb'], rosterStatus: 'in_progress', rosterCount: 41, missingInfo: ['4 athletes missing physicals on file'], importantDates: [] },
  { id: 't-fb-fr', orgId: 'org-hhs', sport: 'Football', level: 'Freshman', name: 'Freshman Football', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-fb'], rosterStatus: 'in_progress', rosterCount: 37, missingInfo: ['Roster not yet published to website'], importantDates: [] },
  { id: 't-vb-v', orgId: 'org-hhs', sport: 'Volleyball', level: 'Varsity', gender: 'Girls', name: 'Varsity Volleyball', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-vb'], rosterStatus: 'complete', rosterCount: 14, missingInfo: [], importantDates: [{ label: 'Area tournament', date: '2026-10-21' }, { label: 'Senior Night vs Mountain Brook', date: '2026-10-13' }] },
  { id: 't-vb-jv', orgId: 'org-hhs', sport: 'Volleyball', level: 'JV', gender: 'Girls', name: 'JV Volleyball', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-vb'], rosterStatus: 'complete', rosterCount: 12, missingInfo: [], importantDates: [] },
  { id: 't-vb-fr', orgId: 'org-hhs', sport: 'Volleyball', level: 'Freshman', gender: 'Girls', name: 'Freshman Volleyball', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-vb'], rosterStatus: 'in_progress', rosterCount: 11, missingInfo: ['2 headshots missing'], importantDates: [] },
  { id: 't-ffb-v', orgId: 'org-hhs', sport: 'Flag Football', level: 'Varsity', gender: 'Girls', name: 'Varsity Flag Football', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-ffb'], rosterStatus: 'complete', rosterCount: 22, missingInfo: [], importantDates: [{ label: 'State qualifier window', date: '2026-10-27' }] },
  { id: 't-ffb-jv', orgId: 'org-hhs', sport: 'Flag Football', level: 'JV', gender: 'Girls', name: 'JV Flag Football', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-ffb'], rosterStatus: 'not_started', rosterCount: 0, missingInfo: ['Roster not submitted', 'Team photo not scheduled'], importantDates: [] },
  { id: 't-xc-v', orgId: 'org-hhs', sport: 'Cross Country', level: 'Varsity', gender: 'Coed', name: 'Varsity Cross Country', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-xc'], rosterStatus: 'complete', rosterCount: 54, missingInfo: [], importantDates: [{ label: 'Section meet', date: '2026-11-05' }, { label: 'State meet — Oakville', date: '2026-11-14' }] },
  { id: 't-xc-jv', orgId: 'org-hhs', sport: 'Cross Country', level: 'JV', gender: 'Coed', name: 'JV Cross Country', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-xc'], rosterStatus: 'complete', rosterCount: 38, missingInfo: [], importantDates: [] },
  { id: 't-cheer-v', orgId: 'org-hhs', sport: 'Cheerleading', level: 'Varsity', gender: 'Coed', name: 'Varsity Cheerleading', season: 'Fall', seasonLabel: 'Fall 2026', coachIds: ['u-cheer'], rosterStatus: 'complete', rosterCount: 24, missingInfo: ['Competition schedule not entered'], importantDates: [{ label: 'Regional competition', date: '2026-11-21' }] },
]

const teamBySportLevel = new Map(teams.map(t => [`${t.sport}|${t.level}`, t.id]))
function teamFor(sport: string, level: string): string {
  return teamBySportLevel.get(`${sport}|${level}`) ?? teamBySportLevel.get(`${sport}|Varsity`) ?? 't-fb-v'
}

// ---------- Sponsors & agreements (from Fall 2026 sponsorship workbook) ----------

type SponsorSeed = {
  id: string; name: string; tier: Sponsor['tier']; contact: string; email?: string; phone?: string
  amount: number; paid: number; paidDate?: string; logo: Sponsor['logoStatus']
  done?: string[] // fulfillment item ids marked complete
  note?: string; benefit: string
}

const CHECKLIST: { id: string; label: string }[] = [
  { id: 'logo', label: 'Logo received' },
  { id: 'vboard', label: 'Video-board upload complete' },
  { id: 'commercial', label: 'Commercial received' },
  { id: 'pa', label: 'PA copy approved' },
  { id: 'web', label: 'Website placement complete' },
  { id: 'tickets', label: 'Season tickets sent' },
  { id: 'parking', label: 'Parking passes sent' },
  { id: 'sign', label: 'Static signage installed' },
  { id: 'game', label: 'Assigned to sponsor game' },
  { id: 'haf', label: 'HAF notified' },
]

const sponsorSeeds: SponsorSeed[] = [
  // Red tier
  { id: 'sp-oncology', name: 'Alabama Oncology', tier: 'Red', contact: 'Ben Jones', amount: 17000, paid: 17000, paidDate: '2026-06-16', logo: 'received', done: ['logo', 'web', 'haf'], benefit: 'Presenting sponsor — video board, PA reads, signage, 8 season tickets' },
  { id: 'sp-waverly', name: 'Waverly', tier: 'Red', contact: 'Justin Russell', amount: 12000, paid: 0, logo: 'missing', benefit: 'Video board + broadcast commercial, PA reads, 6 season tickets' },
  { id: 'sp-dazzio', name: 'Dazzio & Freidman', tier: 'Red', contact: 'Lee Patterson', amount: 10000, paid: 0, logo: 'missing', benefit: 'Video board, PA reads, static signage, 6 season tickets' },
  { id: 'sp-towncountry', name: 'Town and Country Ford', tier: 'Red', contact: 'Kyle Sain', amount: 10000, paid: 0, logo: 'needs_update', note: 'Wants updated dealership logo before video-board upload.', benefit: 'Video board, gameday activation, 6 season tickets' },
  { id: 'sp-cotton', name: 'Cotton Construction', tier: 'Red', contact: 'Trey Cotton', amount: 15000, paid: 0, logo: 'received', done: ['logo'], note: 'Waiting on check per Trey — invoice re-sent.', benefit: 'Video board + field-level signage, 8 season tickets' },
  { id: 'sp-soho', name: 'SoHo Social / Taco Mama', tier: 'Red', contact: 'Bridgett Alday', email: 'bridgett@sohostandard.bar', amount: 10000, paid: 5000, paidDate: '2026-07-30', logo: 'received', done: ['logo', 'vboard'], benefit: 'NFHS broadcast corner logo, video board, 4 season tickets' },
  // White tier
  { id: 'sp-bryant', name: 'Bryant Bank', tier: 'White', contact: 'Claire Motes', amount: 6000, paid: 1000, logo: 'received', done: ['logo', 'web'], note: 'Split pledge: $1k received, two $2.5k installments pending (Athletics / FB / Cheer).', benefit: 'Video board rotation, website, 4 season tickets' },
  { id: 'sp-lakeshore', name: 'Lakeshore Alliance', tier: 'White', contact: 'Abe Smith', amount: 5000, paid: 0, logo: 'missing', benefit: 'Video board rotation, PA reads, 4 season tickets' },
  { id: 'sp-paramount', name: 'Paramount / El Barrio', tier: 'White', contact: 'Front office', amount: 5000, paid: 0, logo: 'missing', note: 'Contact email still pending from restaurant group.', benefit: 'Video board rotation, 4 season tickets' },
  { id: 'sp-piggly', name: 'Piggly Wiggly', tier: 'White', contact: 'Andy Virciglio', amount: 5000, paid: 5000, paidDate: '2026-07-12', logo: 'received', done: ['logo', 'vboard', 'web', 'tickets'], benefit: 'Video board rotation, gameday promo night, 4 season tickets' },
  { id: 'sp-robins', name: 'Robins & Morton', tier: 'White', contact: 'Marketing office', amount: 6000, paid: 6000, paidDate: '2026-06-28', logo: 'received', done: ['logo', 'vboard', 'web', 'haf'], note: 'Paid $1,200 athletics + $4,800 football allocation.', benefit: 'Video board rotation, football program page, 4 season tickets' },
  { id: 'sp-edge', name: 'The Edge', tier: 'White', contact: 'JJ Thomas', amount: 5000, paid: 0, logo: 'missing', benefit: 'Video board rotation, 4 season tickets' },
  { id: 'sp-twin', name: 'Twin Construction', tier: 'White', contact: 'William Seigel', amount: 5000, paid: 0, logo: 'received', done: ['logo'], note: 'Logo in, agreement signature still out.', benefit: 'Video board rotation, 4 season tickets' },
  { id: 'sp-aphix', name: 'Aphix', tier: 'White', contact: 'Fletcher Smith', amount: 5000, paid: 0, logo: 'missing', benefit: 'Video board rotation, 4 season tickets' },
  // Blue tier
  { id: 'sp-eskridge', name: 'Eskridge & White', tier: 'Blue', contact: 'Jon Delk / Ethan White', amount: 3000, paid: 0, logo: 'missing', benefit: 'Video board rotation, 2 season tickets' },
  { id: 'sp-mcelheny', name: 'McElheny Law', tier: 'Blue', contact: 'John McElheny', amount: 3000, paid: 3000, paidDate: '2026-06-20', logo: 'received', done: ['logo', 'vboard', 'web'], benefit: 'Video board rotation, 2 season tickets' },
  { id: 'sp-amfirst', name: 'AM First Bank', tier: 'Blue', contact: 'Daniel Homer', amount: 3500, paid: 3500, paidDate: '2026-06-25', logo: 'received', done: ['logo', 'vboard'], benefit: 'Video board rotation, 2 season tickets' },
  { id: 'sp-milos', name: "Milo's", tier: 'Blue', contact: 'Corporate marketing', amount: 3000, paid: 0, logo: 'missing', note: 'Emailed 6/10 — no response yet.', benefit: 'Video board rotation, 2 season tickets' },
  { id: 'sp-cspire', name: 'C Spire', tier: 'Blue', contact: 'Regional sponsorships', amount: 3000, paid: 0, logo: 'missing', note: 'Emailed 6/10 — following up.', benefit: 'Video board rotation, 2 season tickets' },
  { id: 'sp-focal', name: 'Focal Point Cabinetry', tier: 'Blue', contact: 'Front office', amount: 3000, paid: 0, logo: 'missing', note: 'Emailed 6/9.', benefit: 'Video board rotation, 2 season tickets' },
  { id: 'sp-byrom', name: 'Byrom Building', tier: 'Blue', contact: 'Scott Byrom', amount: 3000, paid: 1500, paidDate: '2026-07-07', logo: 'received', done: ['logo'], note: 'Waiting on second 50% check (Athletics/Cheer split).', benefit: 'Video board rotation, 2 season tickets' },
  // Broadcast / videoboard add-ons
  { id: 'sp-firstus', name: 'First US Bank', tier: 'Add-On', contact: 'Warren Giardina', amount: 2500, paid: 0, logo: 'missing', note: 'First Down sponsor — email and voicemail 6/10.', benefit: 'First Down sponsor — PA + video-board hit each first down' },
  { id: 'sp-arc', name: 'ARC Realty — Wade Team', tier: 'Add-On', contact: 'Cindy Wade', amount: 500, paid: 500, paidDate: '2026-07-01', logo: 'received', done: ['logo'], benefit: 'PAT / Field Goal sponsor' },
  { id: 'sp-samford', name: 'Samford University', tier: 'Add-On', contact: 'Madison Barker', amount: 5000, paid: 0, logo: 'missing', note: 'Broadcast commercial — emailed 6/10.', benefit: 'Broadcast commercial (5 spots)' },
  { id: 'sp-alabama', name: 'University of Alabama', tier: 'Add-On', contact: 'Bradie Neighbors', amount: 5000, paid: 0, logo: 'missing', note: 'Will respond near July 1 per Bradie.', benefit: 'Broadcast commercial (5 spots)' },
  // Patriot Partners (per-family level from online form)
  { id: 'sp-firstbank', name: 'FirstBank', tier: 'Patriot Partner', contact: 'Candice Willis', email: 'candice.willis@firstbankonline.com', phone: '205-421-7452', amount: 475.5, paid: 475.5, paidDate: '2026-06-23', logo: 'received', done: ['logo', 'vboard'], benefit: 'Cheerleading Patriot Partner — video board rotation' },
  { id: 'sp-oliver', name: 'Oliver Trucking LLC', tier: 'Patriot Partner', contact: 'David Oly', phone: '205-965-6183', amount: 475.5, paid: 475.5, paidDate: '2026-06-23', logo: 'received', done: ['logo'], benefit: 'Cheerleading Patriot Partner — video board rotation' },
  { id: 'sp-lawortho', name: 'Law Orthodontics', tier: 'Patriot Partner', contact: 'Maggie Law', phone: '205-855-5111', amount: 475.5, paid: 475.5, paidDate: '2026-06-24', logo: 'received', done: ['logo', 'vboard'], benefit: 'Cheerleading Patriot Partner — video board rotation' },
  { id: 'sp-lorberbaum', name: 'Lorberbaum McNair & Associates', tier: 'Patriot Partner', contact: 'David Lorberbaum', phone: '205-834-4711', amount: 475.5, paid: 475.5, paidDate: '2026-06-26', logo: 'received', done: ['logo', 'vboard'], benefit: 'Cross Country Patriot Partner — video board rotation' },
  { id: 'sp-skinwellness', name: 'Skin Wellness Dermatology', tier: 'Patriot Partner', contact: 'Meredith Elder', phone: '205-871-7332', amount: 475.5, paid: 475.5, paidDate: '2026-07-13', logo: 'received', done: ['logo'], benefit: 'Cheerleading Patriot Partner — video board rotation' },
  { id: 'sp-jbr', name: 'JBR Design', tier: 'Patriot Partner', contact: 'Jennifer Routson', phone: '404-271-4403', amount: 475.5, paid: 475.5, paidDate: '2026-07-10', logo: 'received', done: ['logo', 'vboard'], benefit: 'Football Patriot Partner — video board rotation' },
  { id: 'sp-servis', name: 'ServisFirst Bank', tier: 'Patriot Partner', contact: 'David Lee', amount: 475.5, paid: 0, logo: 'needs_update', note: 'Use last year’s logo per David Lee.', benefit: 'Cheer & Football Patriot Partner — video board rotation' },
]

// Pre-sale pipeline prospects — no agreement yet
const prospectSeeds: Array<{ id: string; name: string; stage: Sponsor['stage']; contact: string; tier: Sponsor['tier']; note?: string }> = [
  { id: 'sp-pro-regions', name: 'Regions Bank', stage: 'maybe', contact: 'Community sponsorships', tier: 'Red', note: 'Interested in Red tier; wants impression numbers from last season before committing.' },
  { id: 'sp-pro-steelcity', name: 'Steel City Pops', stage: 'contacted', contact: 'Owner — Edgewood location', tier: 'Blue', note: 'Emailed 9/12, following up at fall festival.' },
  { id: 'sp-pro-dentistry', name: 'Homewood Family Dentistry', stage: 'contacted', contact: 'Office manager', tier: 'Blue', note: 'Left voicemail 9/18.' },
  { id: 'sp-pro-vulcan', name: 'Vulcan Termite & Pest', stage: 'prospect', contact: 'TBD', tier: 'White', note: 'Suggested by booster board — no outreach yet.' },
  { id: 'sp-pro-bagels', name: 'Big Blue Bagels', stage: 'prospect', contact: 'TBD', tier: 'Patriot Partner', note: 'Coach Tate has a parent connection.' },
  { id: 'sp-pro-medical', name: 'Brookwood Urgent Care', stage: 'declined', contact: 'Regional marketing', tier: 'White', note: 'Passed for this year — budget spent; revisit in spring for 2027–28.' },
]

export const sponsors: Sponsor[] = sponsorSeeds.map<Sponsor>(s => ({
  id: s.id, orgId: 'org-hhs', name: s.name, stage: 'committed', tier: s.tier, contactName: s.contact,
  email: s.email, phone: s.phone, logoStatus: s.logo, renewalDate: '2027-06-01',
  benefitSummary: s.benefit,
  notes: s.note ? [{ id: `${s.id}-n1`, at: '2026-07-10T09:00:00', authorId: 'u-fin', text: s.note }] : [],
})).concat(prospectSeeds.map<Sponsor>(p => ({
  id: p.id, orgId: 'org-hhs', name: p.name, stage: p.stage, tier: p.tier, contactName: p.contact,
  email: undefined, phone: undefined, logoStatus: 'missing', renewalDate: '2027-06-01',
  benefitSummary: `${p.tier} tier (proposed)`,
  notes: p.note ? [{ id: `${p.id}-n1`, at: '2026-09-15T10:00:00', authorId: 'u-ad', text: p.note }] : [],
})))

export const agreements: Agreement[] = sponsorSeeds.map(s => {
  const done = new Set(s.done ?? [])
  const fulfillment: FulfillmentItem[] = CHECKLIST
    .filter(c => !(s.tier === 'Patriot Partner' && ['commercial', 'pa', 'tickets', 'parking', 'sign', 'game', 'haf'].includes(c.id)))
    .map(c => ({
      id: `${s.id}-${c.id}`, label: c.label,
      status: done.has(c.id) ? 'complete' : 'pending',
      dueDate: c.id === 'vboard' ? '2026-08-28' : c.id === 'logo' ? '2026-08-14' : undefined,
    }))
  return {
    id: `ag-${s.id.slice(3)}`, orgId: 'org-hhs', sponsorId: s.id, season: 'Fall 2026',
    amount: s.amount,
    paymentStatus: s.paid >= s.amount ? 'paid' : s.paid > 0 ? 'partial' : 'unpaid',
    payments: s.paid > 0 ? [{ id: `${s.id}-p1`, date: s.paidDate ?? '2026-07-01', amount: s.paid, method: 'Check' }] : [],
    fulfillment,
    signedDate: s.paidDate ?? undefined,
  }
})

// ---------- Events: enrich the imported fall composite schedule ----------

interface RawEvent {
  id: string; date: string; time: string | null; sport: string; level: string
  homeAway: string; opponent: string; venue: string; notes?: string; checkoutTime?: string; multiDay?: string
}

const FOOTBALL_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'Ticket Worker', 'PA Announcer', 'Scoreboard Operator', 'Video-board Operator', 'Broadcast Crew', 'Photographer', 'Social Media Coverage', 'Student Intern']
const INDOOR_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'PA Announcer', 'Scoreboard Operator', 'Social Media Coverage']
const FIELD_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'Trainer', 'Social Media Coverage']

const staffPool: Record<string, string[]> = {
  'Game Administrator': ['u-admin2', 'u-ad'],
  'Ticket Worker': ['u-tix', 'u-intern'],
  'PA Announcer': ['u-pa'],
  'Scoreboard Operator': ['u-vboard', 'u-intern'],
  'Video-board Operator': ['u-vboard'],
  'Broadcast Crew': ['u-intern'],
  'Photographer': ['u-photo'],
  'Social Media Coverage': ['u-comms', 'u-intern'],
  'Student Intern': ['u-intern'],
  'Trainer': ['u-admin2'],
}

const DESIGNATIONS: Record<string, string> = {
  'ev-032': 'Region Opener',
  'ev-092': 'Homecoming',
  'ev-109': 'Senior Night',
  'ev-084': 'Rivalry Game',
}

// Region (football) and area (volleyball) opponents for record-keeping
const FB_REGION = ['Mountain Brook', 'Pelham', 'Helena', 'Chelsea', 'Calera', 'Briarwood', 'Oak Mountain']
const VB_AREA = ['Chelsea', 'Briarwood', 'Helena']

// Home varsity football sponsor-of-the-game rotation
const GAME_SPONSORS: Record<string, string[]> = {
  'ev-032': ['sp-oncology', 'sp-firstus'],
  'ev-079': ['sp-robins', 'sp-arc'],
  'ev-092': ['sp-soho', 'sp-piggly'],
  'ev-104': ['sp-cotton'],
  'ev-109': ['sp-bryant'],
}

function buildEvents(demoToday: string): SportEvent[] {
  const raw = rawSchedule as RawEvent[]
  const events: SportEvent[] = raw.map(r => {
    const teamId = teamFor(r.sport, r.level)
    const isHome = r.homeAway === 'home'
    const isVarsityFB = r.sport === 'Football' && r.level === 'Varsity'
    const isPast = r.date < demoToday
    const roles = !isHome ? [] : isVarsityFB ? FOOTBALL_ROLES : r.sport === 'Volleyball' ? INDOOR_ROLES : FIELD_ROLES
    const staffSlots: StaffSlot[] = roles.map((role, i) => {
      const slotKey = `${r.id}-${role}-${i}`
      // Past events are fully staffed; upcoming events have deliberate gaps.
      const filled = isPast || hash(slotKey) > (isVarsityFB ? 0.22 : 0.35)
      const userId = filled ? pick(staffPool[role], slotKey) : null
      return {
        id: `slot-${slotKey}`, role, userId,
        status: !filled ? 'unfilled' : hash(slotKey + 'c') > 0.4 || isPast ? 'confirmed' : 'assigned',
      }
    })
    const broadcast = isVarsityFB || (r.sport === 'Volleyball' && r.level === 'Varsity' && isHome)
    const score = isPast && r.homeAway !== 'tbd' && !['Cross Country'].includes(r.sport) && r.opponent !== 'TBD'
      ? (() => {
          const win = hash(r.id + 'w') > 0.4
          const base = r.sport === 'Football' ? [28, 17] : r.sport === 'Volleyball' ? [3, 1] : [26, 13]
          const us = win ? base[0] + Math.floor(hash(r.id + 'a') * 8) : base[1] - Math.floor(hash(r.id + 'b') * 6)
          const them = win ? base[1] + Math.floor(hash(r.id + 'c') * 6) : base[0] + Math.floor(hash(r.id + 'd') * 7)
          if (r.sport === 'Volleyball') return { us: win ? 3 : Math.floor(hash(r.id) * 2), them: win ? Math.floor(hash(r.id) * 2) : 3, result: (win ? 'W' : 'L') as 'W' | 'L', sample: true }
          return { us: Math.max(us, 0), them: Math.max(them, 0), result: (win ? 'W' : 'L') as 'W' | 'L', sample: true }
        })()
      : undefined
    const ev: SportEvent = {
      id: r.id, orgId: 'org-hhs', teamId, sport: r.sport, level: r.level,
      date: r.date, time: r.time, homeAway: r.homeAway as SportEvent['homeAway'],
      opponent: r.opponent, venue: r.venue,
      gameType: r.sport === 'Football' && FB_REGION.includes(r.opponent) ? 'region'
        : r.sport === 'Volleyball' && VB_AREA.includes(r.opponent) ? 'area' : 'non',
      status: isPast ? 'completed' : r.date <= addDaysISO(demoToday, 10) ? 'confirmed' : 'scheduled',
      designation: DESIGNATIONS[r.id],
      ticketLink: isHome && (isVarsityFB || r.sport === 'Volleyball') ? 'https://gofan.co/app/school/AL14042' : undefined,
      broadcastLink: broadcast ? 'https://www.nfhsnetwork.com/schools/homewood-high-school' : undefined,
      broadcastStatus: broadcast ? (isPast ? 'archived' : isVarsityFB ? 'confirmed' : 'planned') : 'none',
      notes: r.notes, checkoutTime: r.checkoutTime, multiDay: r.multiDay,
      staffSlots, runOfShow: [], sponsorIds: GAME_SPONSORS[r.id] ?? [],
      score,
    }
    return ev
  })

  // Run of show for the next home varsity football game
  const nextHomeFB = events.find(e => e.sport === 'Football' && e.level === 'Varsity' && e.homeAway === 'home' && e.date >= demoToday)
  if (nextHomeFB) {
    nextHomeFB.runOfShow = [
      { id: 'ros-1', time: '17:30', item: 'Gates open — ticket scanners live', ownerId: 'u-tix', done: false },
      { id: 'ros-2', time: '17:45', item: 'Video board loop: sponsor rotation + hype video', ownerId: 'u-vboard', done: false },
      { id: 'ros-3', time: '18:20', item: 'Band pregame + Patriot Walk', ownerId: 'u-admin2', done: false },
      { id: 'ros-4', time: '18:40', item: 'Starting lineups + sponsor PA reads (Alabama Oncology presenting)', ownerId: 'u-pa', done: false },
      { id: 'ros-5', time: '18:55', item: 'National anthem — HHS choir', ownerId: 'u-admin2', done: false },
      { id: 'ros-6', time: '19:00', item: 'Kickoff — First Down sponsor graphics armed', ownerId: 'u-vboard', done: false },
      { id: 'ros-7', time: '20:00', item: 'Halftime: Homecoming court presentation', ownerId: 'u-comms', done: false },
      { id: 'ros-8', time: '21:30', item: 'Final score post + photo gallery upload', ownerId: 'u-comms', done: false },
    ]
  }

  // A few preseason / non-game operational events so the calendar shows breadth
  events.push(
    {
      id: 'ev-pre-01', orgId: 'org-hhs', teamId: 't-fb-v', sport: 'Football', level: 'Varsity',
      date: '2026-08-14', time: '18:00', homeAway: 'home', opponent: 'Fan Day & Media Night', venue: 'Waldrop Stadium',
      status: 'completed', broadcastStatus: 'none', staffSlots: [], runOfShow: [], sponsorIds: ['sp-oncology'],
      notes: 'Team photos, headshots, sponsor booths on concourse.',
    },
    {
      id: 'ev-pre-02', orgId: 'org-hhs', teamId: 't-cheer-v', sport: 'Cheerleading', level: 'Varsity',
      date: '2026-11-21', time: '09:00', homeAway: 'away', opponent: 'AHSAA Regional Competition', venue: 'Birmingham CrossPlex',
      status: 'scheduled', broadcastStatus: 'none', staffSlots: [], runOfShow: [], sponsorIds: [],
    },
  )
  return events
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------- Coach requests ----------

const requests: CoachRequest[] = [
  {
    id: 'req-001', orgId: 'org-hhs', coachId: 'u-vb', teamId: 't-vb-v', type: 'Schedule Correction',
    title: 'JV/V times flipped for Oct 1 tri-match', neededBy: '2026-09-28', priority: 'high',
    description: 'The website shows JV at 6:00 and Varsity at 5:00 for the tri-match — should be reversed. Bus and officials already confirmed for the corrected times.',
    attachments: [], status: 'submitted', internalNotes: [], createdAt: '2026-09-23T08:41:00', assigneeId: null,
  },
  {
    id: 'req-002', orgId: 'org-hhs', coachId: 'u-fb', teamId: 't-fb-v', type: 'Athlete Spotlight',
    title: 'Senior spotlight — #7 QB before Homecoming', neededBy: '2026-10-06', priority: 'normal',
    description: 'Would love a graphic + post featuring our senior QB before the Homecoming game vs Chelsea. Stats attached; family has approved photo use.',
    attachments: ['qb7_stats.pdf', 'qb7_action.jpg'], status: 'reviewed', internalNotes: [
      { id: 'rn-002-1', at: '2026-09-22T13:05:00', authorId: 'u-comms', text: 'Approved — scheduling for Tuesday of Homecoming week.' },
    ], createdAt: '2026-09-20T15:12:00', assigneeId: 'u-comms',
  },
  {
    id: 'req-003', orgId: 'org-hhs', coachId: 'u-xc', teamId: 't-xc-v', type: 'Broadcast Request',
    title: 'Live timing link for HOKA Night Classic', neededBy: '2026-10-01', priority: 'normal',
    description: 'Can we publish the live timing/results link for the Oct 3 HOKA Frank Horton Night Classic on the website and socials? Link comes from the timing company Thursday.',
    attachments: [], status: 'in_progress', internalNotes: [
      { id: 'rn-003-1', at: '2026-09-24T09:30:00', authorId: 'u-comms', text: 'Website slot ready; waiting on timing link.' },
    ], createdAt: '2026-09-21T11:02:00', assigneeId: 'u-comms',
  },
  {
    id: 'req-004', orgId: 'org-hhs', coachId: 'u-ffb', teamId: 't-ffb-jv', type: 'Roster Update',
    title: 'JV flag football roster upload', neededBy: '2026-09-26', priority: 'urgent',
    description: 'Final JV roster attached — 18 athletes. Needs to be on the website before Friday’s jamboree. Two athletes still pending physicals; hold those names.',
    attachments: ['jv_flag_roster.xlsx'], status: 'in_progress', internalNotes: [
      { id: 'rn-004-1', at: '2026-09-24T16:20:00', authorId: 'u-comms', text: 'Holding two names pending physicals per coach.' },
    ], createdAt: '2026-09-22T07:55:00', assigneeId: 'u-comms',
  },
  {
    id: 'req-005', orgId: 'org-hhs', coachId: 'u-vb', teamId: 't-vb-v', type: 'Photography Request',
    title: 'Senior Night photographer — Oct 13', neededBy: '2026-10-09', priority: 'high',
    description: 'Requesting Priya for Senior Night vs Mountain Brook (Oct 13). Need family presentation shots plus match coverage for the end-of-season banquet slideshow.',
    attachments: [], status: 'submitted', internalNotes: [], createdAt: '2026-09-24T18:44:00', assigneeId: null,
  },
  {
    id: 'req-006', orgId: 'org-hhs', coachId: 'u-fb', teamId: 't-fb-v', type: 'Graphic Request',
    title: 'Homecoming week countdown graphics', neededBy: '2026-10-04', priority: 'normal',
    description: '5-day countdown graphic set for Homecoming week (Oct 5–9) in school branding, one per day, sized for Instagram.',
    attachments: [], status: 'reviewed', internalNotes: [], createdAt: '2026-09-23T14:10:00', assigneeId: 'u-comms',
  },
  {
    id: 'req-007', orgId: 'org-hhs', coachId: 'u-cheer', teamId: 't-cheer-v', type: 'Website Update',
    title: 'Add competition schedule to cheer page', neededBy: '2026-10-15', priority: 'low',
    description: 'Regional and state competition dates need to be added to the cheerleading page. Dates attached.',
    attachments: ['cheer_comp_dates.docx'], status: 'submitted', internalNotes: [], createdAt: '2026-09-25T09:05:00', assigneeId: null,
  },
  {
    id: 'req-008', orgId: 'org-hhs', coachId: 'u-xc', teamId: 't-xc-v', type: 'Social Reminder',
    title: 'Post Jesse Owens Classic results', neededBy: '2026-09-20', priority: 'normal',
    description: 'Both teams placed top-5 at Jesse Owens (Moulton). Results link attached — please post recap with the podium photo.',
    attachments: ['jesse_owens_results.pdf'], status: 'completed', internalNotes: [
      { id: 'rn-008-1', at: '2026-09-20T10:15:00', authorId: 'u-comms', text: 'Posted to Instagram + X, added to website results page.' },
    ], createdAt: '2026-09-19T08:20:00', assigneeId: 'u-comms',
  },
  {
    id: 'req-009', orgId: 'org-hhs', coachId: 'u-vb', teamId: 't-vb-fr', type: 'Roster Update',
    title: 'Freshman VB headshots — 2 missing', neededBy: '2026-09-18', priority: 'normal',
    description: 'Two freshman athletes missed picture day. Can we schedule makeup headshots before region play?',
    attachments: [], status: 'completed', internalNotes: [
      { id: 'rn-009-1', at: '2026-09-17T12:00:00', authorId: 'u-comms', text: 'Makeup shoot completed 9/17; uploading to asset library.' },
    ], createdAt: '2026-09-12T13:30:00', assigneeId: 'u-photo',
  },
  {
    id: 'req-010', orgId: 'org-hhs', coachId: 'u-fb', teamId: 't-fb-v', type: 'Signing Announcement',
    title: 'Early commit announcement — OL to Samford', neededBy: '2026-10-20', priority: 'normal',
    description: 'Our senior left tackle is committing to Samford. Family wants a signing-style graphic and post once paperwork is confirmed. Hold until I give the green light.',
    attachments: [], status: 'reviewed', internalNotes: [
      { id: 'rn-010-1', at: '2026-09-24T10:00:00', authorId: 'u-comms', text: 'Template drafted; on hold for coach confirmation.' },
    ], createdAt: '2026-09-18T16:40:00', assigneeId: 'u-comms',
  },
]

// ---------- Assets ----------

const assetSeeds: Array<Partial<Asset> & { id: string; name: string; type: Asset['type']; fileType: string; sizeKB: number; tint: string }> = [
  { id: 'as-001', name: 'Homewood Athletics primary logo', type: 'School Branding', fileType: 'SVG', sizeKB: 84, tint: '#d60000', approvalStatus: 'approved' },
  { id: 'as-002', name: 'Patriots wordmark — white', type: 'School Branding', fileType: 'PNG', sizeKB: 312, tint: '#12223c', approvalStatus: 'approved' },
  { id: 'as-003', name: 'Brand guidelines 2026–27', type: 'Document', fileType: 'PDF', sizeKB: 4820, tint: '#57534e', approvalStatus: 'approved' },
  { id: 'as-025', name: 'Patriots football helmet mark', type: 'Team Logo', fileType: 'SVG', sizeKB: 96, sport: 'Football', teamId: 't-fb-v', tint: '#d60000', approvalStatus: 'approved' },
  { id: 'as-026', name: 'Volleyball program crest', type: 'Team Logo', fileType: 'PNG', sizeKB: 210, sport: 'Volleyball', teamId: 't-vb-v', tint: '#12223c', approvalStatus: 'approved' },
  { id: 'as-004', name: 'Varsity football team photo', type: 'Team Photo', fileType: 'JPG', sizeKB: 8214, sport: 'Football', teamId: 't-fb-v', tint: '#b45309', approvalStatus: 'approved' },
  { id: 'as-005', name: 'Volleyball gameday template', type: 'Social Template', fileType: 'PSD', sizeKB: 24880, sport: 'Volleyball', teamId: 't-vb-v', tint: '#be185d', approvalStatus: 'approved' },
  { id: 'as-006', name: 'Football gameday template', type: 'Social Template', fileType: 'PSD', sizeKB: 26340, sport: 'Football', teamId: 't-fb-v', tint: '#d60000', approvalStatus: 'approved' },
  { id: 'as-007', name: 'Final score template — all sports', type: 'Social Template', fileType: 'PSD', sizeKB: 19752, tint: '#0e7490', approvalStatus: 'approved' },
  { id: 'as-008', name: 'Alabama Oncology logo pack', type: 'Sponsor Logo', fileType: 'ZIP', sizeKB: 2140, sponsorId: 'sp-oncology', tint: '#15803d', approvalStatus: 'approved' },
  { id: 'as-009', name: 'Piggly Wiggly video-board slide', type: 'Video-board Ad', fileType: 'MP4', sizeKB: 48210, sponsorId: 'sp-piggly', tint: '#4d7c0f', approvalStatus: 'approved' },
  { id: 'as-010', name: 'SoHo Social broadcast commercial', type: 'Broadcast Commercial', fileType: 'MP4', sizeKB: 152400, sponsorId: 'sp-soho', tint: '#7c3aed', approvalStatus: 'pending' },
  { id: 'as-011', name: 'McElheny Law video-board slide', type: 'Video-board Ad', fileType: 'PNG', sizeKB: 1980, sponsorId: 'sp-mcelheny', tint: '#1d4ed8', approvalStatus: 'approved' },
  { id: 'as-012', name: 'Robins & Morton logo', type: 'Sponsor Logo', fileType: 'EPS', sizeKB: 890, sponsorId: 'sp-robins', tint: '#374151', approvalStatus: 'approved' },
  { id: 'as-013', name: 'Bryant Bank logo — needs review', type: 'Sponsor Logo', fileType: 'JPG', sizeKB: 240, sponsorId: 'sp-bryant', tint: '#a16207', approvalStatus: 'pending' },
  { id: 'as-014', name: 'Hoover Buccaneers logo', type: 'Opponent Logo', fileType: 'PNG', sizeKB: 156, tint: '#ea580c', approvalStatus: 'approved' },
  { id: 'as-015', name: 'Mountain Brook Spartans logo', type: 'Opponent Logo', fileType: 'PNG', sizeKB: 148, tint: '#166534', approvalStatus: 'approved' },
  { id: 'as-016', name: 'Chelsea Hornets logo', type: 'Opponent Logo', fileType: 'PNG', sizeKB: 132, tint: '#ca8a04', approvalStatus: 'approved' },
  { id: 'as-017', name: 'Varsity VB headshots (14)', type: 'Athlete Headshot', fileType: 'ZIP', sizeKB: 68200, sport: 'Volleyball', teamId: 't-vb-v', tint: '#be185d', approvalStatus: 'approved' },
  { id: 'as-018', name: 'Freshman VB makeup headshots (2)', type: 'Athlete Headshot', fileType: 'ZIP', sizeKB: 9400, sport: 'Volleyball', teamId: 't-vb-fr', tint: '#9d174d', approvalStatus: 'pending' },
  { id: 'as-019', name: 'Stadium PA sponsor scripts — Fall 26', type: 'Document', fileType: 'DOCX', sizeKB: 84, tint: '#0369a1', approvalStatus: 'pending' },
  { id: 'as-020', name: 'Patriot fight song — stadium mix', type: 'Audio', fileType: 'WAV', sizeKB: 38200, tint: '#6d28d9', approvalStatus: 'approved' },
  { id: 'as-021', name: 'Hype video — 2026 season intro', type: 'Video', fileType: 'MP4', sizeKB: 412000, tint: '#d60000', approvalStatus: 'approved' },
  { id: 'as-022', name: 'XC Jesse Owens podium gallery', type: 'Team Photo', fileType: 'ZIP', sizeKB: 92400, sport: 'Cross Country', teamId: 't-xc-v', tint: '#0369a1', approvalStatus: 'approved' },
  { id: 'as-023', name: 'ARC Wade Team PAT graphic', type: 'Video-board Ad', fileType: 'PNG', sizeKB: 2210, sponsorId: 'sp-arc', tint: '#15803d', approvalStatus: 'approved' },
  { id: 'as-024', name: 'Homecoming court script (draft)', type: 'Document', fileType: 'DOCX', sizeKB: 46, tint: '#c2410c', approvalStatus: 'rejected' },
]

const assets: Asset[] = assetSeeds.map((a, i) => ({
  orgId: 'org-hhs', season: 'Fall 2026', approvalStatus: 'approved',
  uploadedById: i % 3 === 0 ? 'u-comms' : i % 3 === 1 ? 'u-photo' : 'u-intern',
  uploadedAt: addDaysISO('2026-08-01', i * 2),
  sport: undefined, teamId: undefined, sponsorId: undefined,
  ...a,
} as Asset))

// ---------- Tasks & content reminders ----------

function buildTasks(events: SportEvent[], demoToday: string): Task[] {
  const tasks: Task[] = []
  let n = 0
  const add = (t: Omit<Task, 'id' | 'orgId'>) => {
    n += 1
    tasks.push({ id: `task-${String(n).padStart(3, '0')}`, orgId: 'org-hhs', ...t })
  }

  // Content reminders for home varsity football + volleyball senior night window
  const contentTargets = events.filter(e =>
    e.homeAway === 'home' && e.level === 'Varsity' && (e.sport === 'Football' || (e.sport === 'Volleyball' && !!e.designation)) && e.opponent !== 'TBD' && !e.multiDay,
  )
  for (const e of contentTargets) {
    const past = e.date < demoToday
    add({ title: `Gameday post — ${e.sport} vs ${e.opponent}`, kind: 'content', contentKind: 'Gameday Post', eventId: e.id, teamId: e.teamId, assigneeId: 'u-comms', dueDate: e.date, status: past ? 'done' : 'open', priority: 'normal' })
    add({ title: `Final score — ${e.sport} vs ${e.opponent}`, kind: 'content', contentKind: 'Final Score', eventId: e.id, teamId: e.teamId, assigneeId: 'u-comms', dueDate: e.date, status: past ? 'done' : 'open', priority: 'normal' })
    if (e.ticketLink) add({ title: `Promote ticket link — vs ${e.opponent}`, kind: 'content', contentKind: 'Ticket Link Promo', eventId: e.id, teamId: e.teamId, assigneeId: 'u-intern', dueDate: addDaysISO(e.date, -2), status: past ? 'done' : 'open', priority: 'normal' })
    if (e.sponsorIds.length) add({ title: `Recognize game sponsor — vs ${e.opponent}`, kind: 'content', contentKind: 'Sponsor Recognition', eventId: e.id, sponsorId: e.sponsorIds[0], assigneeId: 'u-comms', dueDate: addDaysISO(e.date, -1), status: past ? 'done' : 'open', priority: 'normal' })
    if (e.sport === 'Football') add({ title: `Photo gallery — vs ${e.opponent}`, kind: 'content', contentKind: 'Photo Gallery', eventId: e.id, assigneeId: 'u-photo', dueDate: addDaysISO(e.date, 1), status: past ? (hash(e.id) > 0.3 ? 'done' : 'open') : 'open', priority: 'low' })
  }

  // Operational + sponsorship tasks (mix of overdue and upcoming vs demo clock)
  add({ title: 'Collect Waverly payment — invoice 45 days out', kind: 'task', sponsorId: 'sp-waverly', assigneeId: 'u-fin', dueDate: '2026-09-15', status: 'open', priority: 'high' })
  add({ title: 'Chase Dazzio & Freidman logo files', kind: 'task', sponsorId: 'sp-dazzio', assigneeId: 'u-comms', dueDate: '2026-09-18', status: 'open', priority: 'high' })
  add({ title: 'Town & Country updated logo → video board', kind: 'task', sponsorId: 'sp-towncountry', assigneeId: 'u-vboard', dueDate: '2026-09-22', status: 'in_progress', priority: 'normal' })
  add({ title: 'Upload SoHo Social commercial to NFHS', kind: 'task', sponsorId: 'sp-soho', assigneeId: 'u-comms', dueDate: '2026-09-26', status: 'open', priority: 'normal' })
  add({ title: 'Send Q2 sponsorship statement to HAF board', kind: 'task', assigneeId: 'u-fin', dueDate: '2026-09-30', status: 'open', priority: 'normal' })
  add({ title: 'Confirm officials crew — Homecoming vs Chelsea', kind: 'task', eventId: 'ev-092', assigneeId: 'u-ad', dueDate: '2026-10-01', status: 'open', priority: 'high' })
  add({ title: 'Order Senior Night flowers & banners (VB)', kind: 'task', teamId: 't-vb-v', assigneeId: 'u-admin2', dueDate: '2026-10-06', status: 'open', priority: 'normal' })
  add({ title: 'Renewal outreach list for spring sponsors', kind: 'task', assigneeId: 'u-fin', dueDate: '2026-10-15', status: 'open', priority: 'low' })
  add({ title: 'Follow up: First US Bank First-Down package', kind: 'task', sponsorId: 'sp-firstus', assigneeId: 'u-ad', dueDate: '2026-09-12', status: 'open', priority: 'high' })
  add({ title: 'Approve PA sponsor scripts for October', kind: 'task', assigneeId: 'u-ad', dueDate: '2026-09-24', status: 'in_progress', priority: 'normal' })
  add({ title: 'Broadcast crew training — new scoreboard overlay', kind: 'task', assigneeId: 'u-vboard', dueDate: '2026-09-29', status: 'open', priority: 'normal' })
  add({ title: 'Reconcile gate deposits — weeks 3–4', kind: 'task', assigneeId: 'u-fin', dueDate: '2026-09-23', status: 'done', priority: 'normal' })
  return tasks
}

// ---------- Activity feed ----------

const activity: Activity[] = [
  { id: 'act-01', orgId: 'org-hhs', at: '2026-09-25T09:05:00', userId: 'u-cheer', text: 'submitted request “Add competition schedule to cheer page”', link: '/requests/req-007' },
  { id: 'act-02', orgId: 'org-hhs', at: '2026-09-24T18:44:00', userId: 'u-vb', text: 'submitted request “Senior Night photographer — Oct 13”', link: '/requests/req-005' },
  { id: 'act-03', orgId: 'org-hhs', at: '2026-09-24T16:20:00', userId: 'u-comms', text: 'updated JV flag roster request — holding two names pending physicals', link: '/requests/req-004' },
  { id: 'act-04', orgId: 'org-hhs', at: '2026-09-24T11:10:00', userId: 'u-fin', text: 'logged partial payment of $1,500 from Byrom Building', link: '/sponsors/sp-byrom' },
  { id: 'act-05', orgId: 'org-hhs', at: '2026-09-23T15:32:00', userId: 'u-vboard', text: 'marked Town & Country video-board slide in progress' },
  { id: 'act-06', orgId: 'org-hhs', at: '2026-09-23T08:41:00', userId: 'u-vb', text: 'submitted request “JV/V times flipped for Oct 1 tri-match”', link: '/requests/req-001' },
  { id: 'act-07', orgId: 'org-hhs', at: '2026-09-22T13:05:00', userId: 'u-comms', text: 'approved senior spotlight request for #7 QB', link: '/requests/req-002' },
  { id: 'act-08', orgId: 'org-hhs', at: '2026-09-21T10:00:00', userId: 'u-ad', text: 'confirmed staffing for Friday vs Calera', link: '/events/ev-079' },
]

// ---------- Roster generation (deterministic sample athletes) ----------

const FIRST_NAMES = ['Jack', 'Will', 'Sam', 'Eli', 'Mason', 'Carter', 'Owen', 'Luke', 'Henry', 'Miles', 'Ava', 'Ella', 'Mary', 'Anna', 'Kate', 'Lily', 'Nora', 'Ruby', 'Sadie', 'Tess', 'Jordan', 'Riley', 'Avery', 'Quinn', 'Reese']
const LAST_NAMES = ['Adams', 'Baker', 'Cooper', 'Davis', 'Ellis', 'Foster', 'Grant', 'Hayes', 'Ingram', 'Jones', 'Kelly', 'Lawson', 'Mitchell', 'Norris', 'Owens', 'Parker', 'Reed', 'Sanders', 'Turner', 'Vance', 'Walker', 'Young']
const POSITIONS: Record<string, string[]> = {
  Football: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'],
  Volleyball: ['S', 'OH', 'MB', 'RS', 'L', 'DS'],
  'Flag Football': ['QB', 'WR', 'C', 'RSH', 'DB', 'S'],
  'Cross Country': ['Distance'],
  Cheerleading: ['Base', 'Flyer', 'Back spot', 'Tumbler'],
}

function buildRoster(t: Team): Athlete[] {
  const count = Math.min(t.rosterCount, 60)
  const boys = t.gender !== 'Girls'
  const girls = t.gender === 'Girls' || t.gender === 'Coed'
  const firsts = FIRST_NAMES.filter((_, i) => (boys && i < 10) || (girls && i >= 10))
  const grades = t.level === 'Freshman' ? ['9'] : t.level === 'JV' ? ['9', '10', '10'] : ['10', '11', '11', '12', '12']
  const positions = POSITIONS[t.sport] ?? ['—']
  const out: Athlete[] = []
  for (let i = 0; i < count; i++) {
    const key = `${t.id}-${i}`
    out.push({
      id: `ath-${key}`,
      number: t.sport === 'Cross Country' || t.sport === 'Cheerleading' ? undefined : String(1 + Math.floor(hash(key + 'n') * 98)),
      name: `${pick(firsts, key + 'f')} ${pick(LAST_NAMES, key + 'l')}`,
      grade: pick(grades, key + 'g'),
      position: pick(positions, key + 'p'),
    })
  }
  return out.sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name))
}

const OPPONENT_LOGOS: Record<string, string> = {
  'Hoover': 'as-014',
  'Mountain Brook': 'as-015',
  'Chelsea': 'as-016',
}

const TINTS = ['#b45309', '#166534', '#1d4ed8', '#7c3aed', '#be185d', '#0e7490', '#ca8a04', '#4d7c0f', '#9d174d', '#ea580c', '#0369a1', '#57534e']

function buildOpponents(events: SportEvent[]): Opponent[] {
  const names = [...new Set(events.map(e => e.opponent))].filter(n => n && n !== 'TBD').sort()
  return names.map(name => ({
    id: 'opp-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    orgId: 'org-hhs', name,
    logoAssetId: OPPONENT_LOGOS[name],
    tint: TINTS[Math.floor(hash('opp' + name) * TINTS.length) % TINTS.length],
  }))
}

export function buildSeedState(): AppState {
  const demoToday = DEFAULT_DEMO_TODAY
  const events = buildEvents(demoToday)
  const opponents = buildOpponents(events)
  const byName = new Map(opponents.map(o => [o.name, o.id]))
  for (const e of events) e.opponentId = byName.get(e.opponent)
  return {
    version: 6,
    orgs,
    currentOrgId: 'org-hhs',
    currentUserId: 'u-ad',
    demoToday,
    showSampleResults: true,
    users,
    teams: teams.map(t => ({ ...t, roster: t.id === 't-ffb-jv' ? [] : buildRoster(t) })),
    events,
    opponents,
    sponsors,
    agreements,
    requests,
    assets,
    tasks: buildTasks(events, demoToday),
    activity,
  }
}
