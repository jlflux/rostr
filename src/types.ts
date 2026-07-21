// ---------- Core domain types for HeadQtrs ----------

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
  /** Uploaded school logo (data URL in the prototype) */
  logoUrl?: string
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
  /** 'revoked' users keep their history but can't sign in */
  status?: 'active' | 'revoked'
}

export type RosterStatus = 'complete' | 'in_progress' | 'not_started'

export interface Athlete {
  id: string
  number?: string
  name: string
  grade?: string // 9–12
  position?: string
}

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
  socials?: { instagram?: string; x?: string; facebook?: string }
  coachIds: string[]
  rosterStatus: RosterStatus
  rosterCount: number
  missingInfo: string[]
  importantDates: ImportantDate[]
  /** e.g. "Region runner-up", "State quarterfinals" — blank until postseason */
  postseasonFinish?: string
  roster?: Athlete[]
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
  /** True for demo-generated results, hidden when "sample results" is off */
  sample?: boolean
}

export type GameType = 'non' | 'region' | 'area'

export interface Opponent {
  id: string
  orgId: string
  name: string
  logoAssetId?: string
  tint: string
  mascot?: string
  city?: string
  state?: string
  address?: string
  website?: string
  colors?: string
  notes?: string
  /** Set when moved to trash; kept ~30 days before permanent delete */
  deletedAt?: string
}

/** How the event's "opponent" field should be interpreted */
export type EventKind = 'single' | 'multi' | 'tournament' | 'noncomp'

/** A sponsor activated for something specific within one game */
export interface SponsorActivation {
  id: string
  sponsorId: string
  activation: string // e.g. "Presenting sponsor", "Halftime promotion"
  notes?: string
}

/** A special in-game moment that needs planning (recognitions, presentations) */
export interface GameMoment {
  id: string
  title: string
  timing: string // e.g. "Pregame", "Between Q1 & Q2", "Halftime"
  notes?: string
  ownerId?: string | null
}

export type BroadcastCheckStatus = 'pending' | 'ok' | 'na'

export interface BroadcastCheckItem {
  id: string
  label: string
  status: BroadcastCheckStatus
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
  eventKind: EventKind
  opponent: string
  opponentId?: string
  /** For multi-opponent events (tri/quad matches) */
  opponentIds?: string[]
  gameType?: GameType
  venue: string
  /** Set when the event is moved to trash; kept ~30 days */
  deletedAt?: string
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
  sponsorActivations: SponsorActivation[]
  gameMoments: GameMoment[]
  broadcastChecklist?: BroadcastCheckItem[]
  score?: EventScore
}

export type SponsorTier = 'Red' | 'White' | 'Blue' | 'Patriot Partner' | 'Add-On'

export type FulfillmentStatus = 'complete' | 'pending' | 'blocked' | 'na'

export interface FulfillmentItem {
  id: string
  label: string
  status: FulfillmentStatus
  dueDate?: string
  /** Optional link to a specific buy; unset = not tied to any particular buy */
  buyId?: string
  notes?: string
}

export interface SponsorNote {
  id: string
  at: string
  authorId: string
  text: string
  edited?: boolean
}

/** Pre-sale pipeline: idea → outreach → maybe → yes/no */
export type PipelineStage = 'prospect' | 'contacted' | 'maybe' | 'committed' | 'declined'

export interface Sponsor {
  id: string
  orgId: string
  name: string
  stage: PipelineStage
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

/** How one buy's money is earmarked. target = teamId, or 'athletics' for the department. */
export interface Allocation {
  id: string
  target: string
  amount: number
}

export interface Agreement {
  id: string
  orgId: string
  sponsorId: string
  season: string
  /** Short label for this buy, e.g. "White sponsorship" or "Additional donation" */
  label?: string
  amount: number
  paymentStatus: PaymentStatus
  payments: Payment[]
  fulfillment: FulfillmentItem[]
  allocations?: Allocation[]
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
  /** When false, demo-generated scores are hidden (preseason view) */
  showSampleResults: boolean
  users: User[]
  teams: Team[]
  events: SportEvent[]
  opponents: Opponent[]
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
  | 'opponents'
  | 'sponsors'
  | 'agreements'
  | 'requests'
  | 'assets'
  | 'tasks'
  | 'activity'
