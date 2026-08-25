export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'working' | 'under_review' | 'resolved' | 'closed';

export type TicketCategory =
  | 'General Inquiry'
  | 'Event Management'
  | 'Financial & Reimbursement'
  | 'Access & Permissions'
  | 'Bug / Technical'
  | 'Feature Request'
  | 'Attendance & Tickets'
  | 'Team & Position'
  | 'Other';

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorPhoto?: string;
  message: string;
  isInternal?: boolean;
  createdAt: string;
}

export interface TicketActivityLog {
  id: string;
  action: string;
  performedBy: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  name: string;
  phone: string;
  email: string;
  userId: string;
  userRole: 'member' | 'core' | 'superadmin';
  userPhotoURL?: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  assignedToUid?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  investigationNotes?: string;
  resolutionSummary?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  comments?: TicketComment[];
  activityLog?: TicketActivityLog[];
}
