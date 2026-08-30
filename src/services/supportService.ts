import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { SupportTicket, TicketPriority, TicketStatus, TicketCategory, TicketComment, TicketActivityLog } from '../types/supportTicket';

function now() {
  return new Date().toISOString();
}

function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `TKT-${year}-${random}`;
}

export async function createSupportTicket(data: {
  name: string;
  phone: string;
  email: string;
  userId: string;
  userRole: 'member' | 'core' | 'superadmin';
  userPhotoURL?: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
}): Promise<{ id: string; ticketNumber: string }> {
  const ticketNumber = generateTicketNumber();
  const timestamp = now();

  const initialActivity: TicketActivityLog = {
    id: `act_${Date.now()}`,
    action: `Ticket created by ${data.name} (${data.userRole})`,
    performedBy: data.name,
    timestamp,
  };

  const newTicket: Omit<SupportTicket, 'id'> = {
    name: data.name,
    phone: data.phone,
    email: data.email,
    userId: data.userId,
    userRole: data.userRole,
    ...(typeof data.userPhotoURL === 'string' && data.userPhotoURL.trim() !== ''
      ? { userPhotoURL: data.userPhotoURL.trim() }
      : {}),
    title: data.title,
    category: data.category,
    priority: data.priority,
    description: data.description,
    ticketNumber,
    status: 'open',
    createdAt: timestamp,
    updatedAt: timestamp,
    comments: [],
    activityLog: [initialActivity],
  };

  const ref = await addDoc(collection(db, 'support_tickets'), newTicket);
  invalidateCache('support_tickets:');
  trackDBOperation({ operation: 'write', action: 'create_support_ticket', resource: 'support_tickets', documentCount: 1 });

  return { id: ref.id, ticketNumber };
}

export function subscribeSupportTickets(callback: (tickets: SupportTicket[]) => void) {
  const q = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SupportTicket[];
    setCachedData('support_tickets:all', tickets, 30000);
    callback(tickets);
  }, (err) => {
    console.error('Error subscribing to support tickets:', err);
    callback([]);
  });
}

export function subscribeUserSupportTickets(userId: string, callback: (tickets: SupportTicket[]) => void) {
  const q = query(
    collection(db, 'support_tickets'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SupportTicket[];
    callback(tickets);
  }, (err) => {
    console.error('Error subscribing to user tickets:', err);
  });
}

export async function getSupportTicketById(id: string): Promise<SupportTicket | null> {
  const snap = await getDoc(doc(db, 'support_tickets', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SupportTicket;
}

export async function getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | null> {
  const normalized = ticketNumber.trim().toUpperCase();
  if (!normalized) return null;

  const q = query(
    collection(db, 'support_tickets'),
    where('ticketNumber', '==', normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as SupportTicket;
}

export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority,
  performedByName: string
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const snap = await getDoc(ticketRef);
  if (!snap.exists()) throw new Error('Ticket not found');

  const ticket = snap.data() as SupportTicket;
  const currentLogs = ticket.activityLog || [];
  const newLog: TicketActivityLog = {
    id: `act_${Date.now()}`,
    action: `Priority elevated/changed from "${ticket.priority.toUpperCase()}" to "${priority.toUpperCase()}"`,
    performedBy: performedByName,
    timestamp: now(),
  };

  await updateDoc(ticketRef, {
    priority,
    updatedAt: now(),
    activityLog: [newLog, ...currentLogs],
  });
  invalidateCache('support_tickets:');
  trackDBOperation({ operation: 'update', action: 'update_priority', resource: 'support_tickets', documentCount: 1 });
}

export async function assignSupportTicket(
  ticketId: string,
  assignee: { uid: string; name: string; email?: string } | null,
  performedByName: string
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const snap = await getDoc(ticketRef);
  if (!snap.exists()) throw new Error('Ticket not found');

  const ticket = snap.data() as SupportTicket;
  const currentLogs = ticket.activityLog || [];
  const newLog: TicketActivityLog = {
    id: `act_${Date.now()}`,
    action: assignee
      ? `Ticket assigned to ${assignee.name}`
      : `Ticket unassigned`,
    performedBy: performedByName,
    timestamp: now(),
  };

  await updateDoc(ticketRef, {
    assignedToUid: assignee ? assignee.uid : null,
    assignedToName: assignee ? assignee.name : null,
    assignedToEmail: assignee?.email || null,
    status: ticket.status === 'open' && assignee ? 'working' : ticket.status,
    updatedAt: now(),
    activityLog: [newLog, ...currentLogs],
  });
  invalidateCache('support_tickets:');
  trackDBOperation({ operation: 'update', action: 'assign_ticket', resource: 'support_tickets', documentCount: 1 });
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  performedByName: string,
  resolutionSummary?: string
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const snap = await getDoc(ticketRef);
  if (!snap.exists()) throw new Error('Ticket not found');

  const ticket = snap.data() as SupportTicket;
  const currentLogs = ticket.activityLog || [];
  const isClosing = status === 'resolved' || status === 'closed';

  const newLog: TicketActivityLog = {
    id: `act_${Date.now()}`,
    action: `Status changed from "${ticket.status.toUpperCase()}" to "${status.toUpperCase()}"${
      resolutionSummary ? ` — Resolution: ${resolutionSummary}` : ''
    }`,
    performedBy: performedByName,
    timestamp: now(),
  };

  const updates: Partial<SupportTicket> = {
    status,
    updatedAt: now(),
    activityLog: [newLog, ...currentLogs],
  };

  if (resolutionSummary !== undefined) {
    updates.resolutionSummary = resolutionSummary;
  }

  if (isClosing) {
    updates.closedAt = now();
    updates.closedBy = performedByName;
  }

  await updateDoc(ticketRef, updates);
  invalidateCache('support_tickets:');
  trackDBOperation({ operation: 'update', action: 'update_status', resource: 'support_tickets', documentCount: 1 });
}

export async function updateTicketInvestigationNotes(
  ticketId: string,
  investigationNotes: string,
  performedByName: string
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const snap = await getDoc(ticketRef);
  if (!snap.exists()) throw new Error('Ticket not found');

  const ticket = snap.data() as SupportTicket;
  const currentLogs = ticket.activityLog || [];
  const newLog: TicketActivityLog = {
    id: `act_${Date.now()}`,
    action: `Investigation notes updated by ${performedByName}`,
    performedBy: performedByName,
    timestamp: now(),
  };

  await updateDoc(ticketRef, {
    investigationNotes,
    updatedAt: now(),
    activityLog: [newLog, ...currentLogs],
  });
  invalidateCache('support_tickets:');
}

export async function addTicketComment(
  ticketId: string,
  comment: {
    authorId: string;
    authorName: string;
    authorRole: string;
    authorPhoto?: string;
    message: string;
    isInternal?: boolean;
  }
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const snap = await getDoc(ticketRef);
  if (!snap.exists()) throw new Error('Ticket not found');

  const ticket = snap.data() as SupportTicket;
  const newComment: TicketComment = {
    id: `cmt_${Date.now()}`,
    authorId: comment.authorId,
    authorName: comment.authorName,
    authorRole: comment.authorRole,
    ...(typeof comment.authorPhoto === 'string' && comment.authorPhoto.trim() !== ''
      ? { authorPhoto: comment.authorPhoto.trim() }
      : {}),
    message: comment.message,
    ...(typeof comment.isInternal === 'boolean' ? { isInternal: comment.isInternal } : {}),
    createdAt: now(),
  };

  const updatedComments = [...(ticket.comments || []), newComment];
  const newLog: TicketActivityLog = {
    id: `act_${Date.now()}`,
    action: `Added ${comment.isInternal ? 'internal note' : 'comment'}: "${comment.message.slice(0, 40)}..."`,
    performedBy: comment.authorName,
    timestamp: now(),
  };

  await updateDoc(ticketRef, {
    comments: updatedComments,
    updatedAt: now(),
    activityLog: [newLog, ...(ticket.activityLog || [])],
  });
  invalidateCache('support_tickets:');
  trackDBOperation({ operation: 'update', action: 'add_comment', resource: 'support_tickets', documentCount: 1 });
}

export async function deleteSupportTicket(ticketId: string): Promise<void> {
  await deleteDoc(doc(db, 'support_tickets', ticketId));
  invalidateCache('support_tickets:');
  trackDBOperation({ operation: 'delete', action: 'delete_support_ticket', resource: 'support_tickets', documentCount: 1 });
}
