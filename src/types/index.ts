export type UserRole = 'pending' | 'member' | 'core' | 'superadmin';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type ApplySection = string;

export interface SidebarPermissions {
  dashboard: boolean;
  events: boolean;
  calendar: boolean;
  agenda: boolean;
  tasks: boolean;
  explore: boolean;
  qrScanner: boolean;
  profile: boolean;
  analytics: boolean;
  teams: boolean;
  files: boolean;
  documentation: boolean;
  finance: boolean;
  financialAnalytics: boolean;
  controlCentre: boolean;
  positions: boolean;
  userApprovals: boolean;
  accessControl: boolean;
  monitorActivity: boolean;
  manageApplications: boolean;
  interviewPanels: boolean;
  gdPanels: boolean;
  homeImages: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photoURL?: string | null;
  phone?: string;
  description?: string;
  batchYear?: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  positionId?: string;
  positionTitle?: string;
  teamIds: string[];
  teamNames: string[];
  hasFinanceAccess: boolean;
  permissions: SidebarPermissions;
  taskScore: number;
  completedTaskCount: number;
  following: string[];
  followers: string[];
  isOnline?: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  coreTeamName?: string;
  coreTeamDescription?: string;
}

export interface ClubApplication {
  id: string;
  rbtNumber: string;
  firstName: string;
  lastName: string;
  department: string;
  sections: ApplySection[];
  sectionSkills: Record<ApplySection, string>;
  reason: string;
  phone: string;
  email: string;
  status: 'submitted' | 'reviewed' | 'interview_scheduled' | 'selected' | 'not_selected';
  createdAt: string;
  academicYear?: string;
  panelId?: string;
  panelIds?: string[];
  panelName?: string;
  panelNames?: string[];
  gdPanelId?: string;
  gdPanelName?: string;
  gdStatus?: 'pending' | 'evaluated' | 'selected' | 'rejected';
  gdScore?: number;
  gdMaxScore?: number;
  archivedAt?: string;
  archivedBy?: string;
}

export interface SiteMember {
  id: string;
  name: string;
  role: string;
  photoURL?: string;
  order: number;
}

export interface FacultyCoordinator {
  name: string;
  designation: string;
  email?: string;
  photoURL?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  imageURL?: string;
  order: number;
}

export interface PublicEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  imageURL?: string;
  featured: boolean;
}

export type TicketSize = 'standard' | 'badge' | 'compact' | 'wide' | 'custom';

export interface TicketSizeConfig {
  type: TicketSize;
  width: number;
  height: number;
  label: string;
}

export interface TicketTier {
  id: string;
  name: string; // e.g. "Solo (1 Member)", "Duo (2 Members)", "Squad (4 Members)"
  teamSize: number; // number of team members (1, 2, 3, 4, etc.)
  price?: number; // e.g. 150
  paymentQRUrl?: string; // specific QR for this team size/tier
  description?: string;
  customFields?: CustomFormField[]; // tier-specific form fields
}

export interface CertificateConfig {
  templateUrl?: string;
  presetStyle?: 'navy_gold' | 'cyber_green' | 'royal_crimson' | 'clean_white';
  fontFamily?: string;
  primaryColor?: string;
  accentColor?: string;
  nameFontSize?: number;
  nameOffsetY?: number; // relative vertical offset % or px
  eventFontSize?: number;
  eventOffsetY?: number;
  bodyText?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  organizationName?: string;
  showDate?: boolean;
  showCertificateId?: boolean;
}

export interface CustomFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
  tierId?: string; // optional: assign field to a specific ticket tier
}

export interface ParticipantBatch {
  id: string;
  name: string;
  capacity?: number;
  color?: string;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  venue: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  participantIds: string[];
  budget?: number;
  createdBy: string;
  createdByName: string;
  imageURL?: string;
  createdAt: string;
  updatedAt: string;
  // Ticketing fields
  ticketingEnabled?: boolean;
  paymentQRUrl?: string;
  ticketDesignImageUrl?: string;
  ticketSize?: TicketSize;
  customTicketWidth?: number;
  customTicketHeight?: number;
  enableTieredTicketing?: boolean;
  ticketTiers?: TicketTier[];
  // Certificate Studio fields
  certificateConfig?: CertificateConfig;
  // Custom registration form builder fields
  customFields?: CustomFormField[];
  // Domain and allocation fields
  enableDomainSelection?: boolean;
  autoAllocateByDomain?: boolean;
  participantDomains?: EventDomain[];
  spaces?: EventSpace[];
  spaceAllocations?: Record<string, SpaceAllocation[]>;
  winners?: EventWinner[];
  // Participant tracking
  participants?: EventParticipant[];
  participantBatches?: ParticipantBatch[];
}

export interface EventWinner {
  id: string;
  eventId: string;
  participantId?: string;
  participantName: string;
  participantEmail?: string;
  position: string;
  rank: number;
  prize?: string;
  domainId?: string;
  domainName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberDetail {
  name: string;
  email?: string;
  phone?: string;
  college?: string;
  department?: string;
}

export interface EventTicket {
  id: string;
  eventId: string;
  ticketNumber: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  college?: string;
  department?: string;
  tierId?: string;
  tierName?: string;
  teamSize?: number;
  teamMembers?: TeamMemberDetail[];
  transactionId?: string;
  customResponses?: Record<string, string>;
  qrPayload: string;
  registrationSource: 'public' | 'manual';
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  createdAt: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  department?: string;
  domain?: string;
  domainId?: string;
  tierId?: string;
  tierName?: string;
  teamSize?: number;
  teamMembers?: TeamMemberDetail[];
  transactionId?: string;
  customResponses?: Record<string, string>;
  arrived: boolean;
  arrivedAt?: string;
  allocatedLab?: string;
  allocatedClassroom?: string;
  ticketId?: string;
  batchId?: string;
  batchName?: string;
  certificateUrl?: string;
  certificateSent?: boolean;
  createdAt: string;
}

export interface EventDomain {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSpace {
  id: string;
  name: string;
  capacity: number;
  domainId?: string;
  domainName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceAllocation {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  lab?: string;
  classroom?: string;
  department?: string;
  domain?: string;
  domainId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assignedBy: string;
  assignedByName: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  points: number;
  proofDataUrl?: string;
  proofFileName?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  order: number;
}

export interface MeetingRecord {
  id: string;
  title: string;
  date: string;
  time: string;
  link: string;
  agenda: AgendaItem[];
  createdBy: string;
  createdByName: string;
  isPast: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdByName: string;
  memberIds: string[];
  pastMemberIds: string[];
  createdAt: string;
}

export interface PositionRecord {
  id: string;
  title: string;
  description: string;
  holderIds: string[];
  order: number;
  createdAt: string;
}

export interface FinanceTransaction {
  id: string;
  shopName: string;
  purpose: string;
  amount: number;
  transactionId: string;
  eventId?: string;
  eventTitle?: string;
  billDataUrl?: string;
  billFileName?: string;
  isSponsorship: boolean;
  enteredBy: string;
  enteredByName: string;
  createdAt: string;
}

export interface DocumentFile {
  id: string;
  title: string;
  description?: string;
  fileDataUrl?: string; // legacy or fallback base64 Data URL
  fileUrl?: string;     // Supabase Storage Public URL
  supabasePath?: string; // Supabase Storage Object Path
  fileName: string;
  fileType: string;
  fileSize?: number;
  academicYear?: string; // e.g., '2025-2026', '2024-2025'
  category?: string;     // e.g., 'Guidebook', 'Report', 'Template', 'Circular', 'Minutes', 'Other'
  eventId?: string;      // optional associated event ID
  eventName?: string;    // optional associated event name
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface SiteSettings {
  applicationsOpen: boolean;
  clubDescription: string;
  aboutText: string;
  whatsappGroupLink?: string;
  doomsdayMode?: boolean;
}

export const APPLY_SECTIONS: { value: ApplySection; label: string }[] = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'management', label: 'Management' },
  { value: 'media', label: 'Media' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'documentation', label: 'Documentation' },
];

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface InterviewSection {
  id: string;
  value: string;
  label: string;
  createdAt: string;
}

export interface InterviewPanel {
  id: string;
  name: string;
  sections: string[];
  interviewerIds: string[];
  interviewerNames: string[];
  createdAt: string;
}

export interface GDPanel {
  id: string;
  name: string;
  venue?: string;
  timeSlot?: string;
  interviewerIds: string[];
  interviewerNames: string[];
  createdAt: string;
}

export interface GDRubric {
  id: string;
  title: string;
  description?: string;
  maxMarks: number;
  category: 'gd' | 'interview' | 'general';
  createdAt: string;
}

export interface RubricScoreItem {
  rubricId: string;
  rubricTitle: string;
  score: number;
  maxMarks: number;
}

export interface StudentRubricEvaluation {
  id: string;
  applicationId: string;
  panelId?: string;
  gdPanelId?: string;
  evaluatorId: string;
  evaluatorName: string;
  rubricScores: Record<string, number>; // rubricId -> score
  scoresList?: RubricScoreItem[];
  comment?: string;
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  updatedAt: string;
}

export interface PanelRating {
  panellistId: string;
  panellistName: string;
  rating: number;
  comment?: string;
  rubricScores?: Record<string, number>;
  timestamp: string;
}

export interface ApplicationRating {
  id: string;
  applicationId: string;
  panelId: string;
  panelName: string;
  ratings: PanelRating[];
  averageRating: number;
  totalRaters: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_MEMBER_PERMISSIONS: SidebarPermissions = {
  dashboard: true,
  events: true,
  calendar: true,
  agenda: true,
  tasks: true,
  explore: true,
  qrScanner: true,
  profile: true,
  analytics: false,
  teams: false,
  files: false,
  documentation: false,
  finance: false,
  financialAnalytics: false,
  controlCentre: false,
  positions: false,
  userApprovals: false,
  accessControl: false,
  monitorActivity: false,
  manageApplications: false,
  interviewPanels: false,
  gdPanels: false,
  homeImages: false,
};

export const DEFAULT_CORE_PERMISSIONS: SidebarPermissions = {
  ...DEFAULT_MEMBER_PERMISSIONS,
  analytics: true,
  teams: true,
  files: true,
  documentation: true,
  manageApplications: true,
  interviewPanels: true,
  gdPanels: true,
};

export const DEFAULT_SUPERADMIN_PERMISSIONS: SidebarPermissions = {
  dashboard: true,
  events: true,
  calendar: true,
  agenda: true,
  tasks: true,
  explore: true,
  qrScanner: true,
  profile: true,
  analytics: true,
  teams: true,
  files: true,
  documentation: true,
  finance: true,
  financialAnalytics: true,
  controlCentre: true,
  positions: true,
  userApprovals: true,
  accessControl: true,
  monitorActivity: true,
  manageApplications: true,
  interviewPanels: true,
  gdPanels: true,
  homeImages: true,
};
