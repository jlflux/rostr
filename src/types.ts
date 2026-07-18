// ---------- Core domain types for Rostr ----------

export type Role =
  | 'platform_owner'
  | 'school_admin'
  | 'comms_admin'
  | 'finance'
  | 'coach'
  | 'event_staff'
  | 'read_only'

export interface OrgTheme {
  primary: string
  navy: string
  accent: string
}

export interface Organization {
  id: string
  name: string
  shortName: string
  mascot: string
  city: string
  state: string
  theme: OrgTheme
  initials: string
}

export interface User {
  id: string
  orgId: string
  name: string
  email: string
  role: Role
  title: string
  initials: string
  color: string
  teamIds?: string[]
}

export type RosterStatus = 'complete' | 'in_progress' | 'not_started'

export interface ImportantDate {
  label: string
  date: string
}

export interface Team {
  id: string
  orgId: string
  sport: string
  level: 'Varsity' | 'JV' | 'Freshman'
  gender?: 'Boys' | 'Girls' | 'Coed'
  name: string
  season: 'Fall' | 'Winter' | 'Spring'
  seasonLabel: string
  coachIds: string[]
  rosterStatus: RosterStatus
  rosterCount: number
  missingInfo: string[]
  importantDates: ImportantDate[]
}

export type HomeAway = 'home' | 'away' | 'neutral' | 'tbd'
export type EventStatus = 'scheduled' | 'confirmed' | 'completed' | 'postponed' | 'canceled'
export type BroadcastStatus = 'none' | 'planned' | 'confirmed' | 'live' | 'archived'

export type StaffRole =
  | 'Game Administrator'
  | 'Ticket Worker'
  | 'PA Announcer'
  | 'Scoreboard Operator'
  | 'Video-board Operator'
  | 'Broadcast Crew'
  | 'Photographer'
  | 'Social Media Coverage'
  | 'Student Intern'
  | 'Trainer'

export type SlotStatus = 'unfilled' | 'assigned' | 'confirmed' | 'declined'

export interface StaffSlot {
  id: string
  role: StaffRole
  userId: string | null
  status: SlotStatus
}

export interface RunOfShowItem {
  id: string
  time: string
  item: string
  ownerId: string | null
  done: boolean
}

export interface EventScore {
  us: number
  them: number
  result: 'W' | 'L' | 'T'
  recap?: string
}

export interface SportEvent {
  id: string
  orgId: string
  teamId: string
  sport: string
  level: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM 24h
  homeAway: HomeAway
  opponent: string
  venue: string
  status: EventStatus
  designation?: string // e.g. Homecoming, Senior Night, Region Match
  ticketLink?: string
  broadcastLink?: string
  broadcastStatus: BroadcastStatus
  notes?: string
  checkoutTime?: string
  multiDay?: string
  staffSlots: StaffSlot[]
  runOfShow: RunOfShowItem[]
  sponsorIds: string[]
  score?: EventScore
}

export type SponsorTier = 'Red' | 'White' | 'Blue' | 'Patriot Partner' | 'Add-On'

export type FulfillmentStatus = 'complete' | 'pending' | 'blocked' | 'na'

export interface FulfillmentItem {
  id: string
  label: string
  status: FulfillmentStatus
  dueDate?: string
}

export interface SponsorNote {
  id: string
  at: string
  authorId: string
  text: string
}

export interface Sponsor {
  id: string
  orgId: string
  name: string
  tier: SponsorTier
  contactName: string
  email?: string
  phone?: string
  website?: string
  logoStatus: 'received' | 'missing' | 'needs_update'
  renewalDate: string
  notes: SponsorNote[]
  benefitSummary: string
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export interface Payment {
  id: string
  date: string
  amount: number
  method: string
}

export interface Agreement {
  id: string
  orgId: string
  sponsorId: string
  season: string
  amount: number
  paymentStatus: PaymentStatus
  payments: Payment[]
  fulfillment: FulfillmentItem[]
  signedDate?: string
}

export type RequestType =
  | 'Schedule Correction'
  | 'Roster Update'
  | 'Website Update'
  | 'Social Reminder'
  | 'Athlete Spotlight'
  | 'Signing Announcement'
  | 'Broadcast Request'
  | 'Photography Request'
  | 'Graphic Request'
  | 'General Communications'

export type RequestStatus = 'submitted' | 'reviewed' | 'in_progress' | 'completed'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export interface InternalNote {
  id: string
  at: string
  authorId: string
  text: string
}

export interface CoachRequest {
  id: string
  orgId: string
  coachId: string
  teamId: string
  type: RequestType
  title: string
  description: string
  neededBy: string
  priority: Priority
  attachments: string[]
  status: RequestStatus
  internalNotes: InternalNote[]
  createdAt: string
  assigneeId: string | null
}

export type AssetType =
  | 'School Branding'
  | 'Team Logo'
  | 'Opponent Logo'
  | 'Sponsor Logo'
  | 'Athlete Headshot'
  | 'Team Photo'
  | 'Social Template'
  | 'Video-board Ad'
  | 'Broadcast Commercial'
  | 'Document'
  | 'Audio'
  | 'Video'

export type ApprovalStatus = 'approved' | 'pending' | 'rejected'

export interface Asset {
  id: string
  orgId: string
  name: string
  type: AssetType
  fileType: string
  sizeKB: number
  sport?: string
  teamId?: string
  sponsorId?: string
  season: string
  approvalStatus: ApprovalStatus
  uploadedById: string
  uploadedAt: string
  tint: string
}

export type TaskStatus = 'open' | 'in_progress' | 'done'
export type TaskKind = 'task' | 'content'

export type ContentKind =
  | 'Gameday Post'
  | 'Final Score'
  | 'Ticket Link Promo'
  | 'Broadcast Link'
  | 'Sponsor Recognition'
  | 'Results Post'
  | 'Photo Gallery'

export interface Task {
  id: string
  orgId: string
  title: string
  kind: TaskKind
  contentKind?: ContentKind
  eventId?: string
  sponsorId?: string
  teamId?: string
  requestId?: string
  assigneeId: string | null
  dueDate: string
  status: TaskStatus
  priority: Priority
}

export interface Activity {
  id: string
  orgId: string
  at: string
  userId: string
  text: string
  link?: string
}

export interface AppState {
  version: number
  orgs: Organization[]
  currentOrgId: string
  currentUserId: string
  demoToday: string
  users: User[]
  teams: Team[]
  events: SportEvent[]
  sponsors: Sponsor[]
  agreements: Agreement[]
  requests: CoachRequest[]
  assets: Asset[]
  tasks: Task[]
  activity: Activity[]
}

export type Collection =
  | 'users'
  | 'teams'
  | 'events'
  | 'sponsors'
  | 'agreements'
  | 'requests'
  | 'assets'
  | 'tasks'
  | 'activity'
