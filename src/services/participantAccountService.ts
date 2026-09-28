import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  getParticipantUsers,
  getAllUsers,
  createParticipantAccountAdmin as authCreateParticipant,
  updateParticipantAccount as authUpdateParticipant,
  deleteParticipantAccount as authDeleteParticipant,
} from './authService';
import { getEvents, getEventTickets } from './eventService';
import { logActivity } from './activityService';
import { cachedFetch, invalidateCache } from './dbCache';
import type { UserProfile, EventRecord, EventTicket, ActivityLog } from '../types';

export interface ParticipantTicketItem {
  eventId: string;
  eventTitle: string;
  eventDate?: string;
  ticketId: string;
  ticketNumber: string;
  checkedIn: boolean;
  accessStatus: 'granted' | 'revoked';
  paymentStatus?: 'pending' | 'verified' | 'rejected';
  teamName?: string;
  tierName?: string;
  createdAt?: string;
}

export interface EnhancedParticipantAccount {
  uid: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  participantEmail: string;
  phone?: string;
  role: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
  isOnline: boolean;
  lastSeen?: string;
  lastLoginAt?: string;
  hasLoggedIn: boolean;
  creationSource: 'self_signup' | 'admin_created' | 'event_registration';
  tickets: ParticipantTicketItem[];
  activityCount: number;
  lastActivity?: ActivityLog;
  activities: ActivityLog[];
  profile: UserProfile;
}

export interface ParticipantOverviewMetrics {
  totalParticipants: number;
  loggedInCount: number;
  neverLoggedInCount: number;
  adoptionPercentage: number;
  currentlyOnlineCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalLinkedTickets: number;
  participantsWithTickets: number;
  participantsWithoutTickets: number;
  neverLoggedInWithTicketsCount: number;
  dailyRegistrations: Array<{ date: string; created: number; loggedIn: number }>;
}

/**
 * Fetch and construct comprehensive participant accounts
 */
export async function getEnhancedParticipantAccounts(
  forceRefresh = false
): Promise<EnhancedParticipantAccount[]> {
  return cachedFetch<EnhancedParticipantAccount[]>(
    'participants:enhanced',
    async () => {
      // 1. Fetch participants, all events, and recent activity logs in parallel
      const [participantUsers, allUsers, events, activitySnap] = await Promise.all([
        getParticipantUsers(forceRefresh).catch(() => [] as UserProfile[]),
        getAllUsers(forceRefresh).catch(() => [] as UserProfile[]),
        getEvents(forceRefresh).catch(() => [] as EventRecord[]),
        getDocs(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'))).catch(
          () => ({ docs: [] })
        ),
      ]);

      // Deduplicate participants from getParticipantUsers and any user with role 'participant'
      const userMap = new Map<string, UserProfile>();
      participantUsers.forEach((u) => {
        if (u?.uid) userMap.set(u.uid, u);
      });
      allUsers.forEach((u) => {
        if (u?.uid && (u.role === 'participant' || Boolean(u.participantUsername))) {
          userMap.set(u.uid, u);
        }
      });

      const uniqueParticipants = Array.from(userMap.values());

      // 2. Fetch tickets across all events
      const eventTicketsMap = new Map<string, { event: EventRecord; tickets: EventTicket[] }>();
      await Promise.all(
        events.map(async (ev) => {
          try {
            const tickets = await getEventTickets(ev.id, forceRefresh);
            eventTicketsMap.set(ev.id, { event: ev, tickets });
          } catch {
            eventTicketsMap.set(ev.id, { event: ev, tickets: [] });
          }
        })
      );

      // 3. Process activity logs by userId and email
      const activitiesByUser = new Map<string, ActivityLog[]>();
      const activitiesByEmail = new Map<string, ActivityLog[]>();

      activitySnap.docs.forEach((d) => {
        const log = { id: d.id, ...d.data() } as ActivityLog;
        if (log.userId) {
          const list = activitiesByUser.get(log.userId) || [];
          list.push(log);
          activitiesByUser.set(log.userId, list);
        }
        if (log.userEmail) {
          const emailKey = log.userEmail.toLowerCase().trim();
          const list = activitiesByEmail.get(emailKey) || [];
          list.push(log);
          activitiesByEmail.set(emailKey, list);
        }
      });

      // 4. Enrich each participant
      const enhanced: EnhancedParticipantAccount[] = uniqueParticipants.map((u) => {
        const authEmail = (u.email || '').toLowerCase().trim();
        const contactEmail = (u.participantEmail || u.email || '').toLowerCase().trim();
        const username =
          u.participantUsername ||
          (u.email && u.email.includes('participant.')
            ? u.email.split('@')[0].replace('participant.', '')
            : u.email?.split('@')[0] || u.uid);

        // Gather linked tickets
        const linkedTickets: ParticipantTicketItem[] = [];
        eventTicketsMap.forEach(({ event, tickets }) => {
          tickets.forEach((t) => {
            const tGuestEmail = (t.guestEmail || '').toLowerCase().trim();
            const isMatch =
              (t.participantUid && t.participantUid === u.uid) ||
              (tGuestEmail && (tGuestEmail === contactEmail || tGuestEmail === authEmail));

            if (isMatch) {
              linkedTickets.push({
                eventId: event.id,
                eventTitle: event.title,
                eventDate: event.date,
                ticketId: t.id,
                ticketNumber: t.ticketNumber || t.id,
                checkedIn: Boolean(t.checkedIn),
                accessStatus: t.accessStatus === 'revoked' ? 'revoked' : 'granted',
                paymentStatus: t.paymentStatus,
                teamName: t.teamName,
                tierName: t.tierName,
                createdAt: t.createdAt,
              });
            }
          });
        });

        // Gather activities
        const userLogs = activitiesByUser.get(u.uid) || [];
        const emailLogs = contactEmail ? activitiesByEmail.get(contactEmail) || [] : [];
        const authEmailLogs = authEmail ? activitiesByEmail.get(authEmail) || [] : [];

        // Deduplicate logs by ID
        const logMap = new Map<string, ActivityLog>();
        [...userLogs, ...emailLogs, ...authEmailLogs].forEach((l) => {
          logMap.set(l.id, l);
        });
        const allUserActivities = Array.from(logMap.values()).sort((a, b) =>
          (b.timestamp || '').localeCompare(a.timestamp || '')
        );

        // Determine if participant has logged in into the participant space
        // A user has logged in if:
        // 1. There is an activity log with action === 'login'
        // 2. OR user is currently online (isOnline === true)
        // 3. OR lastSeen exists and is significantly after createdAt (> 30s)
        const loginLogs = allUserActivities.filter(
          (l) => l.action === 'login' || l.action === 'participant_login'
        );
        const lastLoginLog = loginLogs[0];

        let hasLoggedIn = false;
        let lastLoginAt: string | undefined = undefined;

        if (loginLogs.length > 0) {
          hasLoggedIn = true;
          lastLoginAt = lastLoginLog.timestamp;
        } else if (u.isOnline) {
          hasLoggedIn = true;
          lastLoginAt = u.lastSeen || new Date().toISOString();
        } else if (u.lastSeen && u.createdAt) {
          const createdMs = new Date(u.createdAt).getTime();
          const lastSeenMs = new Date(u.lastSeen).getTime();
          if (!isNaN(createdMs) && !isNaN(lastSeenMs) && lastSeenMs - createdMs > 30000) {
            hasLoggedIn = true;
            lastLoginAt = u.lastSeen;
          }
        }

        // Determine creation source
        let creationSource: EnhancedParticipantAccount['creationSource'] = 'self_signup';
        if (u.uid.startsWith('part_') || u.uid.startsWith('admin_')) {
          creationSource = 'admin_created';
        } else if (linkedTickets.length > 0 && !u.participantUsername) {
          creationSource = 'event_registration';
        }

        return {
          uid: u.uid,
          username,
          displayName: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || username,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email,
          participantEmail: contactEmail || u.email,
          phone: u.phone,
          role: u.role || 'participant',
          status: u.status || 'approved',
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || u.createdAt || new Date().toISOString(),
          isOnline: Boolean(u.isOnline),
          lastSeen: u.lastSeen,
          lastLoginAt,
          hasLoggedIn,
          creationSource,
          tickets: linkedTickets,
          activityCount: allUserActivities.length,
          lastActivity: allUserActivities[0],
          activities: allUserActivities,
          profile: u,
        };
      });

      // Sort by newest accounts first
      return enhanced.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    {
      ttlMs: 20 * 1000,
      resource: 'participants',
      action: 'get_enhanced_accounts',
      forceRefresh,
    }
  );
}

/**
 * Compute high-level overview metrics
 */
export function computeParticipantMetrics(
  accounts: EnhancedParticipantAccount[]
): ParticipantOverviewMetrics {
  const totalParticipants = accounts.length;
  const loggedInCount = accounts.filter((a) => a.hasLoggedIn).length;
  const neverLoggedInCount = totalParticipants - loggedInCount;
  const adoptionPercentage =
    totalParticipants > 0 ? Math.round((loggedInCount / totalParticipants) * 1000) / 10 : 0;
  const currentlyOnlineCount = accounts.filter((a) => a.isOnline).length;
  const approvedCount = accounts.filter((a) => a.status === 'approved').length;
  const pendingCount = accounts.filter((a) => a.status === 'pending').length;
  const rejectedCount = accounts.filter((a) => a.status === 'rejected').length;

  const totalLinkedTickets = accounts.reduce((acc, a) => acc + a.tickets.length, 0);
  const participantsWithTickets = accounts.filter((a) => a.tickets.length > 0).length;
  const participantsWithoutTickets = totalParticipants - participantsWithTickets;
  const neverLoggedInWithTicketsCount = accounts.filter(
    (a) => !a.hasLoggedIn && a.tickets.length > 0
  ).length;

  // Daily registrations & logins (last 7 days)
  const days = Array.from({ length: 7 })
    .map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    })
    .reverse();

  const dailyRegistrations = days.map((dateStr) => {
    const created = accounts.filter((a) => a.createdAt && a.createdAt.startsWith(dateStr)).length;
    const loggedIn = accounts.filter(
      (a) => a.lastLoginAt && a.lastLoginAt.startsWith(dateStr)
    ).length;
    return {
      date: new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      created,
      loggedIn,
    };
  });

  return {
    totalParticipants,
    loggedInCount,
    neverLoggedInCount,
    adoptionPercentage,
    currentlyOnlineCount,
    approvedCount,
    pendingCount,
    rejectedCount,
    totalLinkedTickets,
    participantsWithTickets,
    participantsWithoutTickets,
    neverLoggedInWithTicketsCount,
    dailyRegistrations,
  };
}

/**
 * Superadmin action to create a participant account
 */
export async function createParticipantAccountSuperadmin(
  adminProfile: UserProfile,
  data: {
    username: string;
    name: string;
    registrationEmail: string;
    status?: 'approved' | 'pending' | 'rejected';
  }
) {
  const profile = await authCreateParticipant(data);
  invalidateCache('participants:enhanced');
  invalidateCache('users:');
  invalidateCache('users:participants');

  await logActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.email,
    adminProfile.email,
    'admin_create_participant',
    `Created participant account @${data.username} for ${data.name} (${data.registrationEmail})`,
    {
      role: 'superadmin',
      targetType: 'account',
      targetId: profile.uid,
      targetName: data.username,
    }
  );

  return profile;
}

/**
 * Superadmin action to update participant account details
 */
export async function updateParticipantAccountSuperadmin(
  adminProfile: UserProfile,
  uid: string,
  updates: Partial<UserProfile>
) {
  await authUpdateParticipant(uid, updates);
  invalidateCache('participants:enhanced');
  invalidateCache('users:');
  invalidateCache('users:participants');

  await logActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.email,
    adminProfile.email,
    'admin_update_participant',
    `Updated participant account details for UID ${uid}`,
    {
      role: 'superadmin',
      targetType: 'account',
      targetId: uid,
      metadata: updates,
    }
  );
}

/**
 * Superadmin action to delete a participant account
 */
export async function deleteParticipantAccountSuperadmin(
  adminProfile: UserProfile,
  participant: EnhancedParticipantAccount
) {
  await authDeleteParticipant(participant.uid);
  invalidateCache('participants:enhanced');
  invalidateCache('users:');
  invalidateCache('users:participants');

  await logActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.email,
    adminProfile.email,
    'admin_delete_participant',
    `Permanently deleted participant account @${participant.username} (${participant.participantEmail})`,
    {
      role: 'superadmin',
      targetType: 'account',
      targetId: participant.uid,
      targetName: participant.username,
    }
  );
}

/**
 * Superadmin action to toggle access status (approved, rejected, pending)
 */
export async function setParticipantStatusSuperadmin(
  adminProfile: UserProfile,
  participant: EnhancedParticipantAccount,
  newStatus: 'approved' | 'rejected' | 'pending'
) {
  await authUpdateParticipant(participant.uid, { status: newStatus });
  invalidateCache('participants:enhanced');
  invalidateCache('users:');
  invalidateCache('users:participants');

  await logActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.email,
    adminProfile.email,
    'admin_change_participant_status',
    `Changed participant @${participant.username} status from ${participant.status} to ${newStatus}`,
    {
      role: 'superadmin',
      targetType: 'account',
      targetId: participant.uid,
      targetName: participant.username,
      metadata: { previousStatus: participant.status, nextStatus: newStatus },
    }
  );
}

/**
 * Generate formatted text template to send to participants with login credentials and portal URL
 */
export function generateParticipantLoginInstructions(
  participant: EnhancedParticipantAccount,
  portalOrigin = window.location.origin
): string {
  const portalUrl = `${portalOrigin}/participant-auth`;
  return `Hello ${participant.displayName},\n\nYour SAInT Participant Space account is ready!\n\nAccess Portal: ${portalUrl}\nUsername: ${participant.username}\nRegistered Email: ${participant.participantEmail}\n\nLog in anytime to view your digital QR passes, update your team rosters, and download participation certificates.\n\nBest regards,\nSAInT Team`;
}

/**
 * Export participant list to CSV
 */
export function exportParticipantsToCSV(accounts: EnhancedParticipantAccount[]) {
  const headers = [
    'UID',
    'Username',
    'Display Name',
    'Email (Auth)',
    'Contact Email',
    'Role',
    'Status',
    'Created At',
    'Has Logged In',
    'Last Login At',
    'Online Now',
    'Creation Source',
    'Linked Tickets Count',
    'Total Activities',
  ];

  const rows = accounts.map((a) => [
    `"${a.uid}"`,
    `"${a.username}"`,
    `"${a.displayName.replace(/"/g, '""')}"`,
    `"${a.email}"`,
    `"${a.participantEmail}"`,
    `"${a.role}"`,
    `"${a.status}"`,
    `"${a.createdAt}"`,
    `"${a.hasLoggedIn ? 'YES' : 'NO'}"`,
    `"${a.lastLoginAt || 'Never'}"`,
    `"${a.isOnline ? 'Online' : 'Offline'}"`,
    `"${a.creationSource}"`,
    a.tickets.length,
    a.activityCount,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `saint_participants_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
