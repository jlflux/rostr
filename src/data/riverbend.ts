/**
 * Riverbend Academy — the demo school.
 *
 * Exists so the platform can be shown to prospective schools without exposing
 * Homewood's real data. Everything here is invented, and deliberately unlike
 * Homewood: a different state and conference, teal and copper rather than red
 * and blue, sponsorship levels named after the river rather than school colors,
 * and a year-round schedule covering all three seasons instead of one fall.
 */
import type {
  Agreement, Asset, Athlete, BenefitTemplate, CoachRequest, FulfillmentItem, Opponent,
  Organization, Sponsor, SportEvent, StaffRole, StaffSlot, Task, Team, TierSetting, User,
} from '../types'

const ORG = 'org-demo'

/** Stable pseudo-random from a string, so the demo looks the same every time. */
function rnd(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}
const pickOf = <T,>(arr: T[], seed: string): T => arr[Math.floor(rnd(seed) * arr.length) % arr.length]

export const riverbendOrg: Organization = {
  id: ORG,
  name: 'Riverbend Academy Athletics',
  shortName: 'Riverbend',
  mascot: 'Ospreys',
  city: 'Chattanooga',
  state: 'TN',
  initials: 'RA',
  theme: { primary: '#0e7a5f', navy: '#122b3c', accent: '#c46a1f' },
}

// ---------- Staff ----------

export const riverbendUsers: User[] = [
  { id: 'rb-u-ad', orgId: ORG, name: 'Dana Whitfield', email: 'dwhitfield@example-academy.org', role: 'school_admin', title: 'Athletic Director', initials: 'DW', color: '#0e7a5f', status: 'active' },
  { id: 'rb-u-comms', orgId: ORG, name: 'Marcus Idowu', email: 'midowu@example-academy.org', role: 'comms_admin', title: 'Communications Director', initials: 'MI', color: '#c46a1f', status: 'active' },
  { id: 'rb-u-fin', orgId: ORG, name: 'Priya Raman', email: 'praman@example-academy.org', role: 'finance', title: 'Business Manager', initials: 'PR', color: '#0369a1', status: 'active' },
  { id: 'rb-u-fb', orgId: ORG, name: 'Tobias Crane', email: 'tcrane@example-academy.org', role: 'coach', title: 'Head Football Coach', initials: 'TC', color: '#b45309', status: 'active', teamIds: ['rb-t-football-boys-varsity', 'rb-t-football-boys-jv'] },
  { id: 'rb-u-bb', orgId: ORG, name: 'Alicia Monroe', email: 'amonroe@example-academy.org', role: 'coach', title: 'Head Basketball Coach', initials: 'AM', color: '#7c3aed', status: 'active', teamIds: ['rb-t-basketball-girls-varsity', 'rb-t-basketball-boys-varsity'] },
  { id: 'rb-u-soc', orgId: ORG, name: 'Emilio Vasquez', email: 'evasquez@example-academy.org', role: 'coach', title: 'Head Soccer Coach', initials: 'EV', color: '#166534', status: 'active', teamIds: ['rb-t-soccer-boys-varsity', 'rb-t-soccer-girls-varsity'] },
  { id: 'rb-u-vb', orgId: ORG, name: 'Sloane Petrakis', email: 'spetrakis@example-academy.org', role: 'coach', title: 'Head Volleyball Coach', initials: 'SP', color: '#be185d', status: 'active', teamIds: ['rb-t-volleyball-girls-varsity', 'rb-t-volleyball-girls-jv'] },
  { id: 'rb-u-tr', orgId: ORG, name: 'Gwen Abara', email: 'gabara@example-academy.org', role: 'coach', title: 'Head Track & Cross Country Coach', initials: 'GA', color: '#0e7490', status: 'active' },
  { id: 'rb-u-bs', orgId: ORG, name: 'Hollis Tran', email: 'htran@example-academy.org', role: 'coach', title: 'Head Baseball Coach', initials: 'HT', color: '#57534e', status: 'active' },
  { id: 'rb-u-sb', orgId: ORG, name: 'Renata Gil', email: 'rgil@example-academy.org', role: 'coach', title: 'Head Softball Coach', initials: 'RG', color: '#9d174d', status: 'active' },
  { id: 'rb-u-staff1', orgId: ORG, name: 'Owen Delacroix', email: 'odelacroix@example-academy.org', role: 'event_staff', title: 'Event Staff', initials: 'OD', color: '#374151', status: 'active' },
  { id: 'rb-u-staff2', orgId: ORG, name: 'Bea Nakamura', email: 'bnakamura@example-academy.org', role: 'event_staff', title: 'Event Staff', initials: 'BN', color: '#122b3c', status: 'active' },
]

// ---------- Teams ----------

type TeamSeed = {
  sport: string; gender?: Team['gender']; levels: Team['level'][]
  season: Team['season']; coach?: string; counts: number[]
}

const TEAM_SEEDS: TeamSeed[] = [
  // Fall
  { sport: 'Football', gender: 'Boys', levels: ['Varsity', 'JV'], season: 'Fall', coach: 'rb-u-fb', counts: [62, 38] },
  { sport: 'Volleyball', gender: 'Girls', levels: ['Varsity', 'JV'], season: 'Fall', coach: 'rb-u-vb', counts: [15, 13] },
  { sport: 'Cross Country', gender: 'Boys', levels: ['Varsity'], season: 'Fall', coach: 'rb-u-tr', counts: [26] },
  { sport: 'Cross Country', gender: 'Girls', levels: ['Varsity'], season: 'Fall', coach: 'rb-u-tr', counts: [24] },
  { sport: 'Golf', gender: 'Coed', levels: ['Varsity'], season: 'Fall', counts: [11] },
  { sport: 'Cheerleading', gender: 'Coed', levels: ['Varsity'], season: 'Fall', counts: [20] },
  // Winter
  { sport: 'Basketball', gender: 'Boys', levels: ['Varsity', 'JV', 'Freshman'], season: 'Winter', coach: 'rb-u-bb', counts: [14, 13, 12] },
  { sport: 'Basketball', gender: 'Girls', levels: ['Varsity', 'JV'], season: 'Winter', coach: 'rb-u-bb', counts: [13, 12] },
  { sport: 'Wrestling', gender: 'Boys', levels: ['Varsity'], season: 'Winter', counts: [28] },
  { sport: 'Swimming & Diving', gender: 'Coed', levels: ['Varsity'], season: 'Winter', counts: [34] },
  { sport: 'Bowling', gender: 'Coed', levels: ['Varsity'], season: 'Winter', counts: [12] },
  // Spring
  { sport: 'Baseball', gender: 'Boys', levels: ['Varsity', 'JV'], season: 'Spring', coach: 'rb-u-bs', counts: [20, 17] },
  { sport: 'Softball', gender: 'Girls', levels: ['Varsity', 'JV'], season: 'Spring', coach: 'rb-u-sb', counts: [18, 15] },
  { sport: 'Soccer', gender: 'Boys', levels: ['Varsity', 'JV'], season: 'Spring', coach: 'rb-u-soc', counts: [24, 20] },
  { sport: 'Soccer', gender: 'Girls', levels: ['Varsity', 'JV'], season: 'Spring', coach: 'rb-u-soc', counts: [22, 19] },
  { sport: 'Outdoor Track & Field', gender: 'Boys', levels: ['Varsity'], season: 'Spring', coach: 'rb-u-tr', counts: [41] },
  { sport: 'Outdoor Track & Field', gender: 'Girls', levels: ['Varsity'], season: 'Spring', coach: 'rb-u-tr', counts: [38] },
  { sport: 'Tennis', gender: 'Coed', levels: ['Varsity'], season: 'Spring', counts: [16] },
  { sport: 'Lacrosse', gender: 'Boys', levels: ['Varsity'], season: 'Spring', counts: [25] },
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const riverbendTeamId = (sport: string, gender: string | undefined, level: string) =>
  `rb-t-${slug(sport)}-${slug(gender ?? 'coed')}-${slug(level)}`

const SEASON_YEAR: Record<Team['season'], string> = {
  Fall: 'Fall 2026', Winter: 'Winter 2026–27', Spring: 'Spring 2027',
}

export const riverbendTeams: Team[] = TEAM_SEEDS.flatMap(seed =>
  seed.levels.map((level, i) => {
    const id = riverbendTeamId(seed.sport, seed.gender, level)
    const genderWord = seed.gender && seed.gender !== 'Coed' ? `${seed.gender} ` : ''
    return {
      id, orgId: ORG, sport: seed.sport, level, gender: seed.gender,
      name: `${level} ${genderWord}${seed.sport}`.replace(/\s+/g, ' ').trim(),
      season: seed.season, seasonLabel: SEASON_YEAR[seed.season],
      coachIds: seed.coach ? [seed.coach] : [],
      rosterStatus: i === 0 ? 'complete' : 'in_progress',
      rosterCount: seed.counts[i] ?? 15,
      missingInfo: i === 0 ? [] : ['Roster not yet published to website'],
      importantDates: [],
    } as Team
  }),
)

// ---------- Opponents ----------

type OppSeed = { name: string; mascot: string; city: string; colors: string; tint: string }

const OPPONENT_SEEDS: OppSeed[] = [
  { name: 'Lantern Valley', mascot: 'Yellow Jackets', city: 'Chattanooga', colors: 'Gold & Black', tint: '#ca8a04' },
  { name: 'Beacon Mountain', mascot: 'Eagles', city: 'Beacon Mountain', colors: 'Navy & Silver', tint: '#1d4ed8' },
  { name: 'Redstone Bank', mascot: 'Lions', city: 'Redstone', colors: 'Crimson & White', tint: '#b91c1c' },
  { name: 'Sodderly', mascot: 'Trojans', city: 'Sodderly', colors: 'Purple & Gold', tint: '#7c3aed' },
  { name: 'Sequoia Ridge', mascot: 'Chiefs', city: 'Sodderly', colors: 'Maroon & Gray', tint: '#9d174d' },
  { name: 'Walden Valley', mascot: 'Mustangs', city: 'Cleveland', colors: 'Royal & White', tint: '#0369a1' },
  { name: 'Ottersley', mascot: 'Owls', city: 'Ottersley', colors: 'Green & Gold', tint: '#166534' },
  { name: 'East Hollis', mascot: 'Hurricanes', city: 'Ottersley', colors: 'Teal & Black', tint: '#0e7490' },
  { name: 'Hixon Creek', mascot: 'Wildcats', city: 'Hixon Creek', colors: 'Blue & Gold', tint: '#1e40af' },
  { name: 'Tyrell Academy', mascot: 'Rams', city: 'Chattanooga', colors: 'Orange & Black', tint: '#ea580c' },
  { name: 'Braemar', mascot: 'Panthers', city: 'Chattanooga', colors: 'Red & Gray', tint: '#dc2626' },
  { name: 'Central', mascot: 'Purple Pounders', city: 'Harrison', colors: 'Purple & Gold', tint: '#6d28d9' },
  { name: 'Marlow County', mascot: 'Warriors', city: 'Jasper', colors: 'Navy & Orange', tint: '#c2410c' },
  { name: 'Granby County', mascot: 'Yellow Jackets', city: 'Coalmont', colors: 'Black & Gold', tint: '#57534e' },
  { name: 'Bledsworth County', mascot: 'Warriors', city: 'Pikeville', colors: 'Red & Black', tint: '#991b1b' },
  { name: 'Sweetbriar', mascot: 'Wildcats', city: 'Sweetwater', colors: 'Blue & White', tint: '#2563eb' },
  { name: 'Mercer County', mascot: 'Tigers', city: 'Decatur', colors: 'Orange & Black', tint: '#f97316' },
  { name: 'Pollard County', mascot: 'Wildcats', city: 'Benton', colors: 'Maroon & Gold', tint: '#86198f' },
  { name: 'Trinity Prep', mascot: 'Fighting Irish', city: 'Chattanooga', colors: 'Navy & Gold', tint: '#1e3a8a' },
  { name: 'Boyden-Clark', mascot: 'Buccaneers', city: 'Chattanooga', colors: 'Green & White', tint: '#15803d' },
]

export const riverbendOpponents: Opponent[] = OPPONENT_SEEDS.map(o => ({
  id: `rb-opp-${slug(o.name)}`,
  orgId: ORG,
  name: o.name,
  mascot: o.mascot,
  city: o.city,
  state: 'TN',
  colors: o.colors,
  tint: o.tint,
  website: `https://www.${slug(o.name)}.example.org`,
}))

// ---------- Sponsorship ----------
//
// Deliberately structured unlike Homewood's Red/White/Blue, to show that a
// school names its own levels: three headline tiers named for the river, a
// per-game "Osprey Circle" sold to families through an online form, and an
// add-on level for one-off broadcast and in-game buys.

const RB_TIERS = ['Headwaters', 'Rapids', 'Riverstone', 'Gameday Add-On', 'Osprey Circle'] as const

export const riverbendTierSettings: TierSetting[] = [
  { id: 'rb-tier-headwaters', orgId: ORG, tier: 'Headwaters', defaultAmount: 15000, autoPaid: false },
  { id: 'rb-tier-rapids', orgId: ORG, tier: 'Rapids', defaultAmount: 7500, autoPaid: false },
  { id: 'rb-tier-riverstone', orgId: ORG, tier: 'Riverstone', defaultAmount: 3500, autoPaid: false },
  { id: 'rb-tier-addon', orgId: ORG, tier: 'Gameday Add-On', defaultAmount: undefined, autoPaid: false },
  { id: 'rb-tier-circle', orgId: ORG, tier: 'Osprey Circle', defaultAmount: 350, autoPaid: true, earmarkSport: 'Cross Country' },
]

const RB_CHECKLIST: { id: string; label: string; tiers: string[] }[] = [
  { id: 'logo', label: 'Logo received', tiers: [...RB_TIERS] },
  { id: 'web', label: 'Website placement complete', tiers: [...RB_TIERS] },
  { id: 'banner', label: 'Field banner printed & hung', tiers: ['Headwaters', 'Rapids', 'Riverstone'] },
  { id: 'pa', label: 'PA copy approved', tiers: ['Headwaters', 'Rapids', 'Riverstone', 'Gameday Add-On'] },
  { id: 'stream', label: 'Stream overlay built', tiers: ['Headwaters', 'Rapids', 'Gameday Add-On'] },
  { id: 'social', label: 'Social feature posted', tiers: ['Headwaters', 'Rapids'] },
  { id: 'tickets', label: 'Season passes sent', tiers: ['Headwaters', 'Rapids', 'Riverstone'] },
  { id: 'night', label: 'Sponsor night assigned', tiers: ['Headwaters', 'Rapids'] },
  { id: 'thanks', label: 'Thank-you letter mailed', tiers: [...RB_TIERS] },
]

export const riverbendBenefitTemplates: BenefitTemplate[] = RB_CHECKLIST.map(c => ({
  id: `rb-bt-${c.id}`, orgId: ORG, label: c.label, tiers: c.tiers,
}))

type RbSponsorSeed = {
  id: string; name: string; tier: string; contact: string; email?: string; phone?: string
  amount: number; paid: number; paidDate?: string; logo: Sponsor['logoStatus']
  done?: string[]; note?: string; benefit: string; trade?: number; website?: string
}

const RB_SPONSORS: RbSponsorSeed[] = [
  // Headwaters
  { id: 'rb-sp-tvfcu', name: 'Valley Ridge Credit Union', tier: 'Headwaters', contact: 'Marla Sheffield', email: 'msheffield@valley-credit.example', amount: 20000, paid: 20000, paidDate: '2026-06-12', logo: 'received', done: ['logo', 'web', 'banner', 'pa', 'stream', 'social', 'tickets', 'night'], benefit: 'Title sponsor — stadium naming, stream pre-roll, all-sport banners, 10 season passes', website: 'https://valley-credit.example' },
  { id: 'rb-sp-erlanger', name: 'Riverside Orthopaedics', tier: 'Headwaters', contact: 'Dr. Neil Kapoor', amount: 15000, paid: 7500, paidDate: '2026-07-02', logo: 'received', done: ['logo', 'web', 'banner', 'stream'], note: 'Second installment due at the start of basketball season.', benefit: 'Official sports medicine partner — trainer tent, stream overlay, 8 season passes' },
  { id: 'rb-sp-volkswagen', name: 'Scenic City Motors', tier: 'Headwaters', contact: 'Duane Ferris', amount: 15000, paid: 0, logo: 'needs_update', note: 'New dealership logo promised before the football opener.', benefit: 'Gameday presenting sponsor (football), stream overlay, 8 season passes' },
  // Rapids
  { id: 'rb-sp-chattbrew', name: 'Riverbend Brewing Co.', tier: 'Rapids', contact: 'Iris Dunleavy', amount: 8000, paid: 8000, paidDate: '2026-06-30', logo: 'received', done: ['logo', 'web', 'banner', 'pa', 'tickets'], benefit: 'Field banner, PA reads, tailgate activation, 6 season passes' },
  { id: 'rb-sp-hamiltondental', name: 'Hamilton Family Dental', tier: 'Rapids', contact: 'Dr. Shauna Reyes', amount: 7500, paid: 3750, paidDate: '2026-07-18', logo: 'received', done: ['logo', 'web'], note: 'Paying in two halves; second due 1 December.', benefit: 'Field banner, PA reads, 6 season passes' },
  { id: 'rb-sp-lookoutins', name: 'Lookout Mutual Insurance', tier: 'Rapids', contact: 'Garrett Poole', amount: 7500, paid: 0, logo: 'missing', note: 'Signed agreement returned; logo and payment still outstanding.', benefit: 'Field banner, stream overlay, 6 season passes' },
  { id: 'rb-sp-ridgeline', name: 'Ridgeline Outfitters', tier: 'Rapids', contact: 'Callie Beaumont', amount: 6000, paid: 6000, paidDate: '2026-08-04', logo: 'received', done: ['logo', 'web', 'banner', 'pa', 'social', 'tickets', 'night'], benefit: 'Cross country title sponsor, field banner, 6 season passes' },
  { id: 'rb-sp-tremontpt', name: 'Tremont Physical Therapy', tier: 'Rapids', contact: 'Andre Maksoud', amount: 7500, paid: 0, logo: 'missing', benefit: 'Field banner, PA reads, 6 season passes' },
  // Riverstone
  { id: 'rb-sp-cravens', name: 'Cravens Hardware', tier: 'Riverstone', contact: 'Bo Cravens', amount: 3500, paid: 3500, paidDate: '2026-06-22', logo: 'received', done: ['logo', 'web', 'banner', 'tickets', 'thanks'], benefit: 'Field banner, website placement, 2 season passes' },
  { id: 'rb-sp-maplestreet', name: 'Mill Street Biscuit Co.', tier: 'Riverstone', contact: 'Store manager', amount: 3500, paid: 0, logo: 'missing', note: 'Interested in adding a post-game meal deal — waiting on corporate.', benefit: 'Field banner, website placement, 2 season passes' },
  { id: 'rb-sp-bluffview', name: 'Clifftop Arts Quarter', tier: 'Riverstone', contact: 'Teresa Mangione', amount: 3500, paid: 1750, paidDate: '2026-07-25', logo: 'received', done: ['logo', 'web'], benefit: 'Field banner, website placement, 2 season passes' },
  { id: 'rb-sp-hixsonauto', name: 'Hixson Auto Care', tier: 'Riverstone', contact: 'Wendell Pike', amount: 4000, paid: 4000, paidDate: '2026-07-09', logo: 'received', done: ['logo', 'web', 'banner', 'pa', 'tickets', 'thanks'], benefit: 'Field banner, PA reads, 2 season passes' },
  { id: 'rb-sp-riverpark', name: 'Riverpark Dentistry', tier: 'Riverstone', contact: 'Dr. Yvonne Lasseter', amount: 3500, paid: 0, logo: 'missing', note: 'Emailed twice — try the office manager next.', benefit: 'Field banner, website placement, 2 season passes' },
  // Gameday add-ons
  { id: 'rb-sp-signalcoffee', name: 'Signal Coffee Roasters', tier: 'Gameday Add-On', contact: 'Nate Alcorn', amount: 1200, paid: 1200, paidDate: '2026-08-14', logo: 'received', done: ['logo', 'web', 'pa'], benefit: 'Coldest-night-of-the-year hot chocolate giveaway + PA reads' },
  { id: 'rb-sp-rivercitykia', name: 'River City Auto', tier: 'Gameday Add-On', contact: 'Sales desk', amount: 2500, paid: 0, logo: 'missing', note: 'Halftime car giveaway — needs a signed liability rider.', benefit: 'Halftime shot-for-a-car promotion' },
  { id: 'rb-sp-mooncakes', name: 'Moon Cakes Bakery', tier: 'Gameday Add-On', contact: 'Su-Jin Park', amount: 900, paid: 900, paidDate: '2026-09-01', logo: 'received', done: ['logo', 'web', 'stream'], benefit: 'Senior night dessert table + stream mention', trade: 400 },
  // Osprey Circle — per-family level sold through the online form
  { id: 'rb-sp-hollandfam', name: 'The Holland Family', tier: 'Osprey Circle', contact: 'Beth Holland', amount: 350, paid: 350, paidDate: '2026-07-03', logo: 'received', done: ['logo', 'web', 'thanks'], benefit: 'Osprey Circle — website placement and program listing' },
  { id: 'rb-sp-okaforfam', name: 'The Okafor Family', tier: 'Osprey Circle', contact: 'Chidi Okafor', amount: 350, paid: 350, paidDate: '2026-07-05', logo: 'received', done: ['logo', 'web', 'thanks'], benefit: 'Osprey Circle — website placement and program listing' },
  { id: 'rb-sp-linfam', name: 'The Lin Family', tier: 'Osprey Circle', contact: 'Wei Lin', amount: 350, paid: 350, paidDate: '2026-07-19', logo: 'received', done: ['logo', 'web'], benefit: 'Osprey Circle — website placement and program listing' },
  { id: 'rb-sp-abernathyfam', name: 'The Abernathy Family', tier: 'Osprey Circle', contact: 'Rhonda Abernathy', amount: 350, paid: 350, paidDate: '2026-08-08', logo: 'received', done: ['logo', 'web', 'thanks'], benefit: 'Osprey Circle — website placement and program listing' },
  { id: 'rb-sp-dossfam', name: 'The Doss Family', tier: 'Osprey Circle', contact: 'Terrence Doss', amount: 350, paid: 0, logo: 'needs_update', note: 'Form submitted; card declined, invoice re-sent.', benefit: 'Osprey Circle — website placement and program listing' },
]

const RB_PROSPECTS: { id: string; name: string; stage: Sponsor['stage']; contact: string; tier: string; est?: number; note?: string }[] = [
  { id: 'rb-sp-pro-unum', name: 'Unity Mutual', stage: 'maybe', contact: 'Community giving office', tier: 'Headwaters', est: 15000, note: 'Wants stream viewership numbers from last season before deciding.' },
  { id: 'rb-sp-pro-mckee', name: 'Mackery Foods', stage: 'contacted', contact: 'Regional marketing', tier: 'Rapids', est: 7500, note: 'Introductory meeting set for October.' },
  { id: 'rb-sp-pro-clumber', name: 'Clumber Creek Landscaping', stage: 'contacted', contact: 'Owner', tier: 'Riverstone', est: 3500, note: 'Parent-owned business; warm introduction from the booster board.' },
  { id: 'rb-sp-pro-southside', name: 'Southside Smokehouse', stage: 'prospect', contact: 'TBD', tier: 'Gameday Add-On', est: 1500, note: 'Would suit a pregame tailgate night — no outreach yet.' },
  { id: 'rb-sp-pro-orchard', name: 'Orchard Knob Credit Union', stage: 'declined', contact: 'Marketing director', tier: 'Rapids', note: 'Budget already committed this year; asked to be contacted next spring.' },
]

export const riverbendSponsors: Sponsor[] = [
  ...RB_SPONSORS.map<Sponsor>(s => ({
    id: s.id, orgId: ORG, name: s.name, stage: 'committed', tier: s.tier,
    contactName: s.contact, email: s.email, phone: s.phone, website: s.website,
    logoStatus: s.logo, renewalDate: '2027-06-01', benefitSummary: s.benefit,
    notes: s.note ? [{ id: `${s.id}-n1`, at: '2026-07-14T09:30:00', authorId: 'rb-u-fin', text: s.note }] : [],
  })),
  ...RB_PROSPECTS.map<Sponsor>(p => ({
    id: p.id, orgId: ORG, name: p.name, stage: p.stage, tier: p.tier, contactName: p.contact,
    logoStatus: 'missing', renewalDate: '2027-06-01',
    benefitSummary: `${p.tier} level (proposed)`, estValue: p.est,
    notes: p.note ? [{ id: `${p.id}-n1`, at: '2026-09-02T10:00:00', authorId: 'rb-u-ad', text: p.note }] : [],
  })),
]

export const riverbendAgreements: Agreement[] = RB_SPONSORS.map(s => {
  const done = new Set(s.done ?? [])
  const fulfillment: FulfillmentItem[] = RB_CHECKLIST
    .filter(c => c.tiers.includes(s.tier))
    .map(c => ({
      id: `${s.id}-${c.id}`, label: c.label,
      status: done.has(c.id) ? 'complete' : 'pending',
      dueDate: c.id === 'banner' ? '2026-08-21' : c.id === 'logo' ? '2026-08-07' : undefined,
    }))
  return {
    id: `rb-ag-${s.id.replace('rb-sp-', '')}`, orgId: ORG, sponsorId: s.id,
    season: '2026–27', label: `${s.tier} sponsorship`,
    amount: s.amount, tradeValue: s.trade,
    paymentStatus: s.paid >= s.amount ? 'paid' : s.paid > 0 ? 'partial' : 'unpaid',
    payments: s.paid > 0 ? [{ id: `${s.id}-p1`, date: s.paidDate ?? '2026-07-01', amount: s.paid, method: 'Check' }] : [],
    fulfillment,
    allocations: [],
    signedDate: s.paidDate,
  }
})

// One business with a second buy on top of its sponsorship, earmarked by sport —
// the same pattern Homewood's data shows, so the demo exercises it too.
riverbendAgreements.push({
  id: 'rb-ag-tvfcu-2', orgId: ORG, sponsorId: 'rb-sp-tvfcu', season: '2026–27',
  label: 'Weight room renovation gift',
  amount: 25000, paymentStatus: 'paid',
  payments: [{ id: 'rb-tvfcu-2-p1', date: '2026-08-19', amount: 25000, method: 'ACH transfer' }],
  fulfillment: [],
  allocations: [
    { id: 'rb-tvfcu-2-a1', target: 'Football', amount: 12000 },
    { id: 'rb-tvfcu-2-a2', target: 'Basketball', amount: 8000, note: 'Requested by the donor after the girls’ state run.' },
  ],
  signedDate: '2026-08-19',
})

// ---------- Schedule ----------
//
// A full year, not one season: football and volleyball in the autumn, basketball
// and wrestling through the winter, baseball, softball, soccer and track in the
// spring. Dates are generated from a weekly pattern per sport so the calendar
// looks like a real season rather than a handful of sample rows.

const VENUES: Record<string, string> = {
  Football: 'Osprey Field',
  Volleyball: 'Riverbend Arena',
  Basketball: 'Riverbend Arena',
  Wrestling: 'Riverbend Arena',
  Baseball: 'Riverbend Diamond',
  Softball: 'Kestrel Field',
  Soccer: 'Osprey Field',
  'Cross Country': 'Riverwalk Course',
  'Outdoor Track & Field': 'Osprey Field',
  Tennis: 'Academy Courts',
  Lacrosse: 'Osprey Field',
  'Swimming & Diving': 'Riverbend Natatorium',
  Golf: 'Brow Ridge Golf Club',
  Bowling: 'Signal Lanes',
  Cheerleading: 'Riverbend Arena',
}

type SeasonPlan = {
  sport: string; gender?: Team['gender']; levels: Team['level'][]
  start: string           // first game date (YYYY-MM-DD)
  weeks: number           // how many weeks the season runs
  perWeek: number         // games per week
  dayOffsets: number[]    // days after the week's Monday
  times: string[]         // one per level, earliest level first
  broadcast?: boolean
}

const SEASON_PLANS: SeasonPlan[] = [
  { sport: 'Football', gender: 'Boys', levels: ['Varsity', 'JV'], start: '2026-08-21', weeks: 10, perWeek: 1, dayOffsets: [4], times: ['19:00', '17:30'], broadcast: true },
  { sport: 'Volleyball', gender: 'Girls', levels: ['Varsity', 'JV'], start: '2026-08-18', weeks: 9, perWeek: 2, dayOffsets: [1, 3], times: ['18:00', '16:30'], broadcast: true },
  { sport: 'Cross Country', gender: 'Boys', levels: ['Varsity'], start: '2026-08-29', weeks: 8, perWeek: 1, dayOffsets: [5], times: ['08:30'] },
  { sport: 'Cross Country', gender: 'Girls', levels: ['Varsity'], start: '2026-08-29', weeks: 8, perWeek: 1, dayOffsets: [5], times: ['09:15'] },
  { sport: 'Golf', gender: 'Coed', levels: ['Varsity'], start: '2026-08-25', weeks: 6, perWeek: 1, dayOffsets: [1], times: ['15:00'] },
  { sport: 'Basketball', gender: 'Girls', levels: ['Varsity', 'JV'], start: '2026-11-20', weeks: 13, perWeek: 2, dayOffsets: [1, 4], times: ['18:00', '16:30'], broadcast: true },
  { sport: 'Basketball', gender: 'Boys', levels: ['Varsity', 'JV', 'Freshman'], start: '2026-11-20', weeks: 13, perWeek: 2, dayOffsets: [1, 4], times: ['19:30', '18:00', '16:30'], broadcast: true },
  { sport: 'Wrestling', gender: 'Boys', levels: ['Varsity'], start: '2026-11-28', weeks: 10, perWeek: 1, dayOffsets: [5], times: ['10:00'] },
  { sport: 'Swimming & Diving', gender: 'Coed', levels: ['Varsity'], start: '2026-12-05', weeks: 8, perWeek: 1, dayOffsets: [5], times: ['13:00'] },
  { sport: 'Bowling', gender: 'Coed', levels: ['Varsity'], start: '2026-11-24', weeks: 7, perWeek: 1, dayOffsets: [2], times: ['16:00'] },
  { sport: 'Baseball', gender: 'Boys', levels: ['Varsity', 'JV'], start: '2027-03-02', weeks: 11, perWeek: 2, dayOffsets: [1, 4], times: ['17:00', '15:00'] },
  { sport: 'Softball', gender: 'Girls', levels: ['Varsity', 'JV'], start: '2027-03-02', weeks: 11, perWeek: 2, dayOffsets: [1, 4], times: ['17:30', '15:30'] },
  { sport: 'Soccer', gender: 'Boys', levels: ['Varsity', 'JV'], start: '2027-03-09', weeks: 9, perWeek: 2, dayOffsets: [2, 4], times: ['19:00', '17:15'], broadcast: true },
  { sport: 'Soccer', gender: 'Girls', levels: ['Varsity', 'JV'], start: '2027-03-09', weeks: 9, perWeek: 2, dayOffsets: [1, 3], times: ['19:00', '17:15'], broadcast: true },
  { sport: 'Outdoor Track & Field', gender: 'Boys', levels: ['Varsity'], start: '2027-03-13', weeks: 8, perWeek: 1, dayOffsets: [5], times: ['09:00'] },
  { sport: 'Outdoor Track & Field', gender: 'Girls', levels: ['Varsity'], start: '2027-03-13', weeks: 8, perWeek: 1, dayOffsets: [5], times: ['09:00'] },
  { sport: 'Tennis', gender: 'Coed', levels: ['Varsity'], start: '2027-03-10', weeks: 8, perWeek: 1, dayOffsets: [2], times: ['16:00'] },
  { sport: 'Lacrosse', gender: 'Boys', levels: ['Varsity'], start: '2027-03-16', weeks: 8, perWeek: 1, dayOffsets: [2], times: ['18:30'] },
]

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const FOOTBALL_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'Ticket Worker', 'PA Announcer', 'Scoreboard Operator', 'Video-board Operator', 'Broadcast Crew', 'Photographer', 'Social Media Coverage']
const ARENA_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'PA Announcer', 'Scoreboard Operator', 'Social Media Coverage']
const FIELD_ROLES: StaffRole[] = ['Game Administrator', 'Ticket Worker', 'Trainer']

const RB_STAFF = ['rb-u-staff1', 'rb-u-staff2', 'rb-u-comms', 'rb-u-ad']

function staffFor(sport: string, seed: string, home: boolean): StaffSlot[] {
  if (!home) return []
  const roles = sport === 'Football' ? FOOTBALL_ROLES
    : VENUES[sport] === 'Riverbend Arena' ? ARENA_ROLES
    : FIELD_ROLES
  return roles.map((role, i) => {
    const r = rnd(`${seed}-${role}-${i}`)
    const status = r > 0.78 ? 'unfilled' : r > 0.68 ? 'confirmed' : 'assigned'
    return {
      id: `${seed}-s${i}`, role,
      userId: status === 'unfilled' ? null : pickOf(RB_STAFF, `${seed}${role}${i}`),
      status,
    } as StaffSlot
  })
}

export function buildRiverbendEvents(today: string): SportEvent[] {
  const out: SportEvent[] = []
  const oppNames = OPPONENT_SEEDS.map(o => o.name)

  for (const plan of SEASON_PLANS) {
    for (let w = 0; w < plan.weeks; w++) {
      for (let g = 0; g < plan.perWeek; g++) {
        const offset = plan.dayOffsets[g % plan.dayOffsets.length]
        const date = addDays(plan.start, w * 7 + offset)
        const key = `${plan.sport}${plan.gender}${w}${g}`
        const opponent = oppNames[Math.floor(rnd(key + 'opp') * oppNames.length) % oppNames.length]
        const home = rnd(key + 'ha') > 0.45

        plan.levels.forEach((level, li) => {
          const id = `rb-ev-${slug(plan.sport)}-${slug(plan.gender ?? 'coed')}-${slug(level)}-${w}-${g}`
          const played = date < today
          const win = rnd(id + 'res') > 0.38
          const us = Math.round(rnd(id + 'us') * 30) + (plan.sport === 'Football' ? 7 : 1)
          const them = win ? Math.max(0, us - Math.round(rnd(id + 'm') * 14) - 1)
                           : us + Math.round(rnd(id + 'm') * 12) + 1
          const isVarsity = level === 'Varsity'

          out.push({
            id, orgId: ORG,
            teamId: riverbendTeamId(plan.sport, plan.gender, level),
            sport: plan.sport, level, date, time: plan.times[li] ?? plan.times[0],
            homeAway: home ? 'home' : 'away',
            eventKind: 'single',
            opponent,
            opponentId: `rb-opp-${slug(opponent)}`,
            gameType: rnd(id + 'gt') > 0.55 ? 'region' : 'non',
            venue: home ? VENUES[plan.sport] ?? 'Riverbend Academy' : `${opponent} High School`,
            status: played ? 'completed' : rnd(id + 'st') > 0.75 ? 'confirmed' : 'scheduled',
            broadcastStatus: plan.broadcast && isVarsity && home
              ? (played ? 'archived' : 'planned') : 'none',
            staffSlots: staffFor(plan.sport, id, home),
            runOfShow: [],
            sponsorActivations: [],
            gameMoments: [],
            score: played && isVarsity
              ? { us, them, result: win ? 'W' : 'L', sample: true }
              : undefined,
          })
        })
      }
    }
  }
  return out.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
}

// ---------- Rosters ----------

// Split by pool so a boys team doesn't come out with a girls roster. Names that
// read either way sit in BOTH and are drawn by every team.
const FIRST_B = ['Beckett', 'Dashiell', 'Finn', 'Hugo', 'Jonah', 'Luca', 'Otis', 'Quentin', 'Silas',
  'Uriel', 'Xavier', 'Zane', 'Bruno', 'Desmond', 'Mateo', 'Rafael', 'Theo', 'Emeka', 'Nikolai', 'Arjun']
const FIRST_G = ['Amara', 'Cora', 'Elena', 'Greta', 'Kiara', 'Maeve', 'Priya', 'Rosa', 'Tessa',
  'Vivian', 'Yara', 'Adaeze', 'Clementine', 'Ingrid', 'Leila', 'Marisol', 'Saoirse', 'Zola', 'Anouk', 'Delphine']
const FIRST_N = ['Imani', 'Noor', 'Wren', 'Rowan', 'Avery', 'Sasha']
const firstNames = (gender?: Team['gender']) =>
  gender === 'Boys' ? [...FIRST_B, ...FIRST_N]
  : gender === 'Girls' ? [...FIRST_G, ...FIRST_N]
  : [...FIRST_B, ...FIRST_G, ...FIRST_N]
const LAST = ['Alvarado', 'Brennan', 'Castellanos', 'Doyle', 'Eberhardt', 'Fontaine', 'Gallagher', 'Haverford',
  'Ibarra', 'Jankowski', 'Kowalczyk', 'Lindqvist', 'Mbeki', 'Nakashima', 'Ortega', 'Pemberton',
  'Quintero', 'Rasmussen', 'Sandoval', 'Thibodeaux', 'Underwood', 'Vandermeer', 'Whitlock', 'Yoshida', 'Zamora']

const POSITIONS: Record<string, string[]> = {
  Football: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K'],
  Basketball: ['G', 'G', 'F', 'F', 'C'],
  Volleyball: ['OH', 'MB', 'S', 'L', 'RS'],
  Baseball: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
  Softball: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
  Soccer: ['GK', 'D', 'M', 'F'],
  Lacrosse: ['A', 'M', 'D', 'G'],
}

/** A roster for one team. Contact details are left blank on purpose — those live
 *  in the state eligibility system, and the demo has no business inventing them. */
function buildRoster(team: Team): Athlete[] {
  const positions = POSITIONS[team.sport]
  const firsts = firstNames(team.gender)
  const size = Math.min(team.rosterCount, 24)
  const used = new Set<string>()
  // Two athletes wearing the same number on one roster reads as a bug, so the
  // draw repeats with a salt until it lands on a free one.
  const usedNumbers = new Set<string>()
  const out: Athlete[] = []
  for (let i = 0; i < size; i++) {
    const seed = `${team.id}-${i}`
    let name = `${pickOf(firsts, seed + 'f')} ${pickOf(LAST, seed + 'l')}`
    let bump = 0
    while (used.has(name)) { bump++; name = `${pickOf(firsts, seed + 'f' + bump)} ${pickOf(LAST, seed + 'l' + bump)}` }
    used.add(name)
    let number = String(Math.floor(rnd(seed + 'n') * 60) + 1)
    for (let salt = 1; usedNumbers.has(number) && salt < 200; salt++) {
      number = String(Math.floor(rnd(seed + 'n' + salt) * 60) + 1)
    }
    usedNumbers.add(number)
    out.push({
      id: `${team.id}-a${i}`,
      number,
      name,
      grade: String(9 + Math.floor(rnd(seed + 'g') * 4)),
      position: positions ? pickOf(positions, seed + 'p') : undefined,
    })
  }
  return out.sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name))
}

// ---------- Gameday detail on the marquee games ----------
//
// Only a handful of games carry a run of show, sponsor activations and
// recognitions — the same as real life, and enough to show the game page.

function dressUpEvents(events: SportEvent[], today: string): SportEvent[] {
  const homeVarsity = (sport: string) => events.filter(e =>
    e.sport === sport && e.level === 'Varsity' && e.homeAway === 'home')

  const football = homeVarsity('Football')
  // Four distinct games, so no two patches land on the same event: the next one
  // coming up, then homecoming and senior night later in the season.
  const upcomingIdx = Math.max(0, football.findIndex(e => e.date >= today))
  const idx = (n: number) => Math.min(n, football.length - 1)
  const chosen = [...new Set([upcomingIdx, idx(upcomingIdx + 2), idx(football.length - 1)])]
  const [nextUp, homecoming, seniorNight] = chosen.map(i => football[i])
  const hoops = homeVarsity('Basketball').find(e => e.date >= today) ?? homeVarsity('Basketball')[0]
  const soccer = homeVarsity('Soccer')[0]

  const mark = (e: SportEvent | undefined, patch: Partial<SportEvent>) => {
    if (e) Object.assign(e, patch)
  }

  mark(nextUp, {
    designation: 'Youth Night',
    ticketLink: 'https://gofan.example/riverbend',
    broadcastLink: 'https://stream.example/riverbend',
    sponsorActivations: [
      { id: 'rb-act-1', sponsorId: 'rb-sp-volkswagen', activation: 'Presenting sponsor' },
      { id: 'rb-act-2', sponsorId: 'rb-sp-chattbrew', activation: 'Tailgate zone' },
    ],
    gameMoments: [
      { id: 'rb-gm-1', title: 'Youth football teams run out with the team', timing: 'Pregame', ownerId: 'rb-u-fb' },
      { id: 'rb-gm-2', title: 'Signal Coffee hot chocolate giveaway', timing: 'Halftime', ownerId: 'rb-u-comms' },
    ],
    runOfShow: [
      { id: 'rb-ros-1', time: '17:45', item: 'Gates open', ownerId: 'rb-u-staff1', done: false },
      { id: 'rb-ros-2', time: '18:30', item: 'Youth teams line up at the tunnel', ownerId: 'rb-u-fb', done: false },
      { id: 'rb-ros-3', time: '18:50', item: 'National anthem', ownerId: 'rb-u-comms', done: false },
      { id: 'rb-ros-4', time: '19:00', item: 'Kickoff', ownerId: null, done: false },
    ],
  })

  mark(homecoming, {
    designation: 'Homecoming',
    ticketLink: 'https://gofan.example/riverbend',
    broadcastLink: 'https://stream.example/riverbend',
    sponsorActivations: [
      { id: 'rb-act-3', sponsorId: 'rb-sp-tvfcu', activation: 'Presenting sponsor' },
      { id: 'rb-act-6', sponsorId: 'rb-sp-rivercitykia', activation: 'Shot-for-a-car promotion' },
    ],
    gameMoments: [
      { id: 'rb-gm-3', title: 'Homecoming court presentation', timing: 'Halftime', ownerId: 'rb-u-ad' },
      { id: 'rb-gm-4', title: 'River City Auto shot-for-a-car', timing: 'Between Q3 & Q4', ownerId: 'rb-u-comms' },
    ],
    runOfShow: [
      { id: 'rb-ros-5', time: '17:30', item: 'Alumni tailgate opens', ownerId: 'rb-u-ad', done: false },
      { id: 'rb-ros-6', time: '18:45', item: 'Court lines up behind the end zone', ownerId: 'rb-u-comms', done: false },
      { id: 'rb-ros-7', time: '19:00', item: 'Kickoff', ownerId: null, done: false },
    ],
  })

  mark(seniorNight, {
    designation: 'Senior Night',
    ticketLink: 'https://gofan.example/riverbend',
    sponsorActivations: [{ id: 'rb-act-4', sponsorId: 'rb-sp-mooncakes', activation: 'Senior dessert table' }],
    gameMoments: [
      { id: 'rb-gm-5', title: 'Senior and family recognition', timing: 'Pregame', ownerId: 'rb-u-ad' },
      { id: 'rb-gm-6', title: 'Honoring the girls\u2019 basketball state runners-up', timing: 'Halftime', ownerId: 'rb-u-bb' },
    ],
  })

  mark(hoops, {
    designation: 'Teal Out',
    ticketLink: 'https://gofan.example/riverbend',
    broadcastLink: 'https://stream.example/riverbend',
    sponsorActivations: [{ id: 'rb-act-5', sponsorId: 'rb-sp-tvfcu', activation: 'Presenting sponsor' }],
    gameMoments: [{ id: 'rb-gm-7', title: 'Ridgeline Outfitters student-section giveaway', timing: 'Halftime', ownerId: 'rb-u-comms' }],
  })

  mark(soccer, {
    designation: 'Kick for a Cure',
    sponsorActivations: [{ id: 'rb-act-7', sponsorId: 'rb-sp-erlanger', activation: 'Presenting sponsor' }],
    gameMoments: [{ id: 'rb-gm-8', title: 'Cancer survivor recognition walk', timing: 'Halftime', ownerId: 'rb-u-soc' }],
  })

  return events
}

// ---------- Requests, tasks, activity ----------

const RB_REQUESTS: CoachRequest[] = [
  { id: 'rb-rq-1', orgId: ORG, teamId: 'rb-t-volleyball-girls-varsity', coachId: 'rb-u-vb', type: 'Schedule Correction', title: 'Tuesday match moved to 6:30', description: 'Ooltewah asked to push back an hour — bus timing.', priority: 'normal', attachments: [], internalNotes: [], status: 'submitted', createdAt: '2026-09-08T08:12:00', neededBy: '2026-09-12', assigneeId: null },
  { id: 'rb-rq-2', orgId: ORG, teamId: 'rb-t-football-boys-varsity', coachId: 'rb-u-fb', type: 'Social Reminder', title: 'Post the youth night flyer', description: 'Wednesday would be ideal so families have time to plan.', priority: 'high', attachments: [], internalNotes: [], status: 'in_progress', createdAt: '2026-09-05T15:40:00', neededBy: '2026-09-10', assigneeId: 'rb-u-comms' },
  { id: 'rb-rq-3', orgId: ORG, teamId: 'rb-t-basketball-girls-varsity', coachId: 'rb-u-bb', type: 'Roster Update', title: 'Two transfers cleared', description: 'Both are eligible as of Monday — please add to the website roster.', priority: 'normal', attachments: [], internalNotes: [], status: 'completed', createdAt: '2026-08-28T11:05:00', neededBy: '2026-09-04', assigneeId: 'rb-u-comms' },
  { id: 'rb-rq-4', orgId: ORG, teamId: 'rb-t-soccer-boys-varsity', coachId: 'rb-u-soc', type: 'Athlete Spotlight', title: 'Feature on our keeper', description: 'Committed to play in college — worth a post before the season starts.', priority: 'low', attachments: [], internalNotes: [], status: 'submitted', createdAt: '2026-09-11T09:00:00', neededBy: '2026-09-25', assigneeId: null },
  { id: 'rb-rq-5', orgId: ORG, teamId: 'rb-t-cross-country-girls-varsity', coachId: 'rb-u-tr', type: 'Website Update', title: 'Course map for the home invitational', description: 'Parents keep asking where to park and watch.', priority: 'urgent', attachments: [], internalNotes: [], status: 'reviewed', createdAt: '2026-09-02T13:20:00', neededBy: '2026-09-19', assigneeId: 'rb-u-comms' },
]

function buildRiverbendTasks(events: SportEvent[], today: string): Task[] {
  const upcoming = events.filter(e => e.date >= today && e.homeAway === 'home').slice(0, 6)
  const tasks: Task[] = [
    { id: 'rb-tk-1', orgId: ORG, kind: 'task', title: 'Chase Lookout Mutual for logo and payment', status: 'open', priority: 'high', assigneeId: 'rb-u-fin', dueDate: addDays(today, 3) },
    { id: 'rb-tk-2', orgId: ORG, kind: 'task', title: 'Print field banners for the three new sponsors', status: 'in_progress', priority: 'normal', assigneeId: 'rb-u-comms', dueDate: addDays(today, 6) },
    { id: 'rb-tk-3', orgId: ORG, kind: 'content', title: 'Schedule graphic for basketball opening week', status: 'open', priority: 'normal', assigneeId: 'rb-u-comms', dueDate: addDays(today, 10) },
    { id: 'rb-tk-4', orgId: ORG, kind: 'task', title: 'Confirm officials for the wrestling invitational', status: 'open', priority: 'urgent', assigneeId: 'rb-u-ad', dueDate: addDays(today, -2) },
  ]
  upcoming.forEach((e, i) => {
    tasks.push({
      id: `rb-tk-ev-${i}`, orgId: ORG, kind: 'content',
      title: `Gameday post — ${e.sport} vs ${e.opponent}`,
      status: i === 0 ? 'in_progress' : 'open', priority: 'normal',
      assigneeId: 'rb-u-comms', dueDate: e.date, eventId: e.id,
    })
  })
  return tasks
}

export const riverbendAssets: Asset[] = [
  { id: 'rb-as-logo', orgId: ORG, name: 'Riverbend primary mark', type: 'School Branding', fileType: 'PNG', sizeKB: 240, season: '2026–27', approvalStatus: 'approved', uploadedById: 'rb-u-comms', uploadedAt: '2026-06-02', tint: '#0e7a5f' },
  { id: 'rb-as-wordmark', orgId: ORG, name: 'Riverbend wordmark', type: 'School Branding', fileType: 'SVG', sizeKB: 64, season: '2026–27', approvalStatus: 'approved', uploadedById: 'rb-u-comms', uploadedAt: '2026-06-02', tint: '#122b3c' },
  { id: 'rb-as-fb-photo', orgId: ORG, name: 'Varsity football team photo', type: 'Team Photo', fileType: 'JPG', sizeKB: 4200, teamId: 'rb-t-football-boys-varsity', season: '2026–27', approvalStatus: 'approved', uploadedById: 'rb-u-comms', uploadedAt: '2026-08-06', tint: '#b45309' },
  { id: 'rb-as-tvfcu', orgId: ORG, name: 'TVFCU logo', type: 'Sponsor Logo', fileType: 'PNG', sizeKB: 180, sponsorId: 'rb-sp-tvfcu', season: '2026–27', approvalStatus: 'approved', uploadedById: 'rb-u-fin', uploadedAt: '2026-06-14', tint: '#0369a1' },
  { id: 'rb-as-brew', orgId: ORG, name: 'Riverbend Brewing logo', type: 'Sponsor Logo', fileType: 'PNG', sizeKB: 155, sponsorId: 'rb-sp-chattbrew', season: '2026–27', approvalStatus: 'approved', uploadedById: 'rb-u-fin', uploadedAt: '2026-07-01', tint: '#ca8a04' },
  { id: 'rb-as-ridgeline', orgId: ORG, name: 'Ridgeline Outfitters logo', type: 'Sponsor Logo', fileType: 'SVG', sizeKB: 48, sponsorId: 'rb-sp-ridgeline', season: '2026–27', approvalStatus: 'pending', uploadedById: 'rb-u-fin', uploadedAt: '2026-08-05', tint: '#166534' },
  { id: 'rb-as-social', orgId: ORG, name: 'Gameday post template', type: 'Social Template', fileType: 'PSD', sizeKB: 9800, season: '2026–27', approvalStatus: 'approved', uploadedById: 'rb-u-comms', uploadedAt: '2026-07-22', tint: '#c46a1f' },
]

/** Everything Riverbend, ready to merge into the app state. */
export function buildRiverbend(today: string) {
  const events = dressUpEvents(buildRiverbendEvents(today), today)
  const teams = riverbendTeams.map(t => ({ ...t, roster: buildRoster(t) }))
  return {
    org: riverbendOrg,
    users: riverbendUsers,
    teams,
    events,
    opponents: riverbendOpponents,
    sponsors: riverbendSponsors,
    agreements: riverbendAgreements,
    benefitTemplates: riverbendBenefitTemplates,
    tierSettings: riverbendTierSettings,
    requests: RB_REQUESTS,
    assets: riverbendAssets,
    tasks: buildRiverbendTasks(events, today),
  }
}
