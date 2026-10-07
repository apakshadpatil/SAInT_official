import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getEvents, getEventTickets, mergeEventWithTickets } from './eventService';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { EventRecord, EventTeam, EventTicket, TeamMemberDetail } from '../types';

export interface UnifiedRegistrationItem {
  id: string; // unique ID
  type: 'solo' | 'team';
  formatLabel?: string; // Display label e.g. 'Solo', 'Squad (4)', 'Duo (2)', 'Team (3)'
  teamSize?: number;
  eventId: string;
  eventName: string;
  eventDate: string;
  ticketId?: string;
  ticketNumber?: string;

  // Primary registrant / Lead details
  name: string;
  email: string;
  phone?: string;
  college?: string;
  department?: string;
  year?: string;

  // Team specific details (if type === 'team')
  teamId?: string;
  teamName?: string;
  tierName?: string;
  memberCount: number; // 1 for solo, 1 + members.length for team
  members?: TeamMemberDetail[];

  // Payment & verification
  paymentStatus: 'verified' | 'pending' | 'rejected';
  transactionId?: string;
  paymentScreenshotUrl?: string;
  paymentScreenshotPath?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;

  // Attendance & check-in
  arrived: boolean;
  arrivedAt?: string;

  // Timestamps
  createdAt: string; // ISO timestamp
  customResponses?: Record<string, string>;

  // Registration source & origin tracking
  registrationType?: 'online' | 'onspot' | string;
  registrationMode?: 'participant' | 'admin' | string;
}

export interface EventRegistrationSummary {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventStatus: string;

  // All-time counts
  soloCount: number;
  teamCount: number;
  teamMembersCount: number;
  totalParticipants: number;
  totalRegistrations: number;

  // Filtered / Period counts (e.g. for Today or selected range)
  periodSoloCount: number;
  periodTeamCount: number;
  periodTeamMembersCount: number;
  periodParticipants: number;
  periodRegistrations: number;
}

export interface RegistrationOverviewStats {
  totalEvents: number;
  totalRegistrations: number;
  soloRegistrations: number;
  teamRegistrations: number;
  totalTeamMembers: number;
  totalParticipants: number;

  // Today's stats
  todayRegistrations: number;
  todaySolo: number;
  todayTeams: number;
  todayParticipants: number;

  // Health & Verification stats
  verifiedPayments: number;
  pendingPayments: number;
  rejectedPayments: number;
  arrivedCount: number;
  missingProofCount: number;
}

export type DateFilterType = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

/**
 * Format Date to YYYY-MM-DD in local application timezone
 */
export function toLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether an ISO timestamp falls into the selected date range
 */
export function isDateInRange(
  dateIso: string | undefined | null,
  filter: DateFilterType,
  customRange?: { start: string; end: string }
): boolean {
  if (filter === 'all') return true;
  if (!dateIso) return false;

  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const itemYMD = toLocalYMD(d);
  const todayYMD = toLocalYMD(now);

  if (filter === 'today') {
    return itemYMD === todayYMD;
  }

  if (filter === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    return itemYMD === toLocalYMD(yest);
  }

  if (filter === 'last7') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return itemYMD >= toLocalYMD(start) && itemYMD <= todayYMD;
  }

  if (filter === 'last30') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return itemYMD >= toLocalYMD(start) && itemYMD <= todayYMD;
  }

  if (filter === 'custom' && customRange?.start && customRange?.end) {
    return itemYMD >= customRange.start && itemYMD <= customRange.end;
  }

  return true;
}

/**
 * Normalizes payment status to 'verified' | 'pending' | 'rejected'
 */
function normalizePaymentStatus(status?: string | null): 'verified' | 'pending' | 'rejected' {
  if (!status) return 'pending';
  const s = status.toLowerCase().trim();
  if (s === 'verified' || s === 'approved' || s === 'success') return 'verified';
  if (s === 'rejected' || s === 'failed') return 'rejected';
  return 'pending';
}

/**
 * Helper to determine participation format (Solo vs Squad vs Duo vs Team),
 * display label, and member count from registration attributes.
 *
 * Concepts:
 * - Team of 1 -> Solo
 * - Team of 4 -> Squad (4)
 * - Team of 2 -> Duo (2)
 * - Team of 3 -> Trio (3)
 * - Multi-member team -> Team (N)
 *
 * NOTE: Participant In-Game Names (IGNs) stored in teamName for solo tickets
 * do NOT make a 1-person registration a team.
 */
export interface RegistrationFormatInfo {
  type: 'solo' | 'team';
  label: string; // e.g. 'Solo', 'Squad (4)', 'Duo (2)', 'Team (3)'
  memberCount: number;
}

export function getRegistrationFormatInfo(input: {
  teamSize?: number;
  teamMembers?: Array<any>;
  tierName?: string;
  memberCount?: number;
}): RegistrationFormatInfo {
  const explicitMembers = Array.isArray(input.teamMembers) ? input.teamMembers.length : 0;
  const specifiedSize = typeof input.teamSize === 'number' && input.teamSize > 0 ? input.teamSize : undefined;
  const tier = (input.tierName || '').trim();
  const tierLower = tier.toLowerCase();

  // If explicit additional members are attached, it is definitely a team/group
  if (explicitMembers > 0) {
    const totalCount = Math.max(explicitMembers + 1, specifiedSize || 1);
    let label = tier || `Team (${totalCount})`;
    if (totalCount === 4 || /squad/i.test(tierLower)) {
      label = 'Squad (4)';
    } else if (totalCount === 2 || /duo/i.test(tierLower)) {
      label = 'Duo (2)';
    } else if (totalCount === 3 || /trio/i.test(tierLower)) {
      label = 'Trio (3)';
    }
    return {
      type: 'team',
      label,
      memberCount: totalCount,
    };
  }

  // Check if explicitly configured as Team of 1 or Solo tier
  const isSoloTier = tierLower.includes('solo') || tierLower === 'individual';
  const isTeamTier = tierLower.includes('squad') || tierLower.includes('duo') || tierLower.includes('trio') || tierLower.includes('team');

  if (specifiedSize === 1 || isSoloTier) {
    return {
      type: 'solo',
      label: 'Solo',
      memberCount: 1,
    };
  }

  // If teamSize > 1 was specified (e.g. Squad / Team of 4) even if members array hasn't been filled
  if (specifiedSize && specifiedSize > 1) {
    let label = tier || (specifiedSize === 4 ? 'Squad (4)' : `Team (${specifiedSize})`);
    if (specifiedSize === 4 || /squad/i.test(tierLower)) {
      label = 'Squad (4)';
    } else if (specifiedSize === 2 || /duo/i.test(tierLower)) {
      label = 'Duo (2)';
    } else if (specifiedSize === 3 || /trio/i.test(tierLower)) {
      label = 'Trio (3)';
    }
    return {
      type: 'team',
      label,
      memberCount: specifiedSize,
    };
  }

  // If tier name indicates a team/squad format
  if (isTeamTier) {
    const count = specifiedSize || 4;
    return {
      type: 'team',
      label: tier || (count === 4 ? 'Squad (4)' : `Team (${count})`),
      memberCount: count,
    };
  }

  // Default: individual / solo registration
  return {
    type: 'solo',
    label: 'Solo',
    memberCount: 1,
  };
}

/**
 * Pure builder function: transforms events and tickets into unified registration items.
 * Preserves team hierarchy, member counts, individual tickets, and direct event participants.
 *
 * CRITICAL: A participant can legitimately register in multiple formats (e.g. Solo and Squad).
 * Deduplication is strictly by unique ticket/team record ID, NEVER by participant email alone.
 */
export function buildUnifiedRegistrations(
  validEvents: EventRecord[],
  ticketsByEvent: Map<string, EventTicket[]>
): UnifiedRegistrationItem[] {
  const registrations: UnifiedRegistrationItem[] = [];

  // Process each event
  validEvents.forEach((ev) => {
    const rawTickets = ticketsByEvent.get(ev.id) || [];
    const mergedEvent = mergeEventWithTickets(ev, rawTickets);

    const seenTicketIds = new Set<string>();
    const seenTeamIds = new Set<string>();

    // 1. Process all raw tickets for this event (subcollection tickets)
    rawTickets.forEach((ticket) => {
      if (!ticket || !ticket.id) return;
      if (seenTicketIds.has(ticket.id)) return;
      seenTicketIds.add(ticket.id);

      const formatInfo = getRegistrationFormatInfo({
        teamSize: ticket.teamSize,
        teamMembers: ticket.teamMembers,
        tierName: ticket.tierName,
      });

      const isTeam = formatInfo.type === 'team';
      const membersList = Array.isArray(ticket.teamMembers) ? ticket.teamMembers : [];
      const teamId = isTeam ? `team_${ticket.id}` : undefined;
      if (teamId) seenTeamIds.add(teamId);

      // Determine display team name / in-game handle
      const rawTeamName =
        ticket.teamName ||
        ticket.customResponses?.teamName ||
        ticket.customResponses?.['Team Name'] ||
        ticket.customResponses?.['team_name'] ||
        (isTeam ? `Team ${ticket.guestName}` : undefined);

      registrations.push({
        id: ticket.id,
        type: formatInfo.type,
        formatLabel: formatInfo.label,
        teamSize: ticket.teamSize,
        eventId: ev.id,
        eventName: ev.title || 'Untitled Event',
        eventDate: ev.date || '',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        name: ticket.guestName || (isTeam ? 'Unnamed Leader' : 'Unnamed Participant'),
        email: ticket.guestEmail || '',
        phone: ticket.guestPhone,
        college: ticket.college,
        department: ticket.department,
        year: ticket.year,
        teamId,
        teamName: rawTeamName,
        tierName: ticket.tierName,
        memberCount: formatInfo.memberCount,
        members: membersList,
        paymentStatus: normalizePaymentStatus(ticket.paymentStatus),
        transactionId: ticket.transactionId,
        paymentScreenshotUrl: ticket.paymentScreenshotUrl,
        paymentScreenshotPath: ticket.paymentScreenshotPath,
        paymentVerifiedAt: ticket.paymentVerifiedAt,
        paymentVerifiedBy: ticket.paymentVerifiedBy,
        arrived: Boolean(ticket.checkedIn),
        arrivedAt: ticket.checkedInAt,
        createdAt: ticket.createdAt || ev.createdAt || '',
        customResponses: ticket.customResponses,
        registrationType: ticket.registrationType || ((ticket as any).registrationMode ? 'onspot' : 'online'),
        registrationMode: ticket.registrationMode || (ticket.registrationSource === 'manual' ? 'admin' : 'participant'),
      });
    });

    // 2. Process any legacy/doc-only Teams not present in raw tickets
    const docTeams: EventTeam[] = mergedEvent.teams || [];
    docTeams.forEach((t) => {
      if (!t || !t.id) return;
      const teamTicketId = (t as any).ticketId || (t.id.startsWith('team_') ? t.id.slice(5) : undefined);
      if (seenTeamIds.has(t.id) || (teamTicketId && seenTicketIds.has(teamTicketId))) return;
      seenTeamIds.add(t.id);
      if (teamTicketId) seenTicketIds.add(teamTicketId);

      const membersList = Array.isArray(t.members) ? t.members : [];
      const formatInfo = getRegistrationFormatInfo({
        teamSize: t.memberCount || membersList.length + 1,
        teamMembers: membersList,
        tierName: t.tierName,
      });

      registrations.push({
        id: t.id,
        type: 'team',
        formatLabel: formatInfo.label,
        teamSize: t.memberCount,
        eventId: ev.id,
        eventName: ev.title || 'Untitled Event',
        eventDate: ev.date || '',
        name: t.leadName || 'Unnamed Leader',
        email: t.leadEmail || '',
        phone: t.leadPhone,
        college: t.college,
        department: t.department,
        year: t.year,
        teamId: t.id,
        teamName: t.teamName || `Team ${t.leadName}`,
        tierName: t.tierName,
        memberCount: formatInfo.memberCount,
        members: membersList,
        paymentStatus: normalizePaymentStatus(t.paymentStatus),
        transactionId: t.transactionId,
        paymentScreenshotUrl: t.paymentScreenshotUrl,
        paymentScreenshotPath: t.paymentScreenshotPath,
        paymentVerifiedAt: t.paymentVerifiedAt,
        paymentVerifiedBy: t.paymentVerifiedBy,
        arrived: Boolean(t.arrived),
        arrivedAt: t.arrivedAt,
        createdAt: t.registeredAt || (t as any).createdAt || ev.createdAt || '',
        customResponses: t.customResponses,
        registrationType: t.registrationType || ((t as any).registrationMode ? 'onspot' : 'online'),
        registrationMode: t.registrationMode || ((t as any).registrationSource === 'manual' ? 'admin' : 'participant'),
      });
    });

    // 3. Process any legacy/doc-only Participants not present in raw tickets or teams
    if (Array.isArray(mergedEvent.participants)) {
      mergedEvent.participants.forEach((p) => {
        if (!p || !p.id) return;
        const pId = p.ticketId || p.id;
        if (seenTicketIds.has(pId) || seenTeamIds.has(pId) || seenTeamIds.has(`team_${pId}`)) return;
        seenTicketIds.add(pId);

        const formatInfo = getRegistrationFormatInfo({
          teamSize: p.teamSize,
          teamMembers: p.teamMembers,
          tierName: p.tierName,
        });

        registrations.push({
          id: pId,
          type: formatInfo.type,
          formatLabel: formatInfo.label,
          teamSize: p.teamSize,
          eventId: ev.id,
          eventName: ev.title || 'Untitled Event',
          eventDate: ev.date || '',
          ticketId: p.ticketId || p.id,
          name: p.name || 'Unnamed Participant',
          email: p.email || '',
          phone: p.phone,
          college: p.college,
          department: p.department,
          year: p.year,
          teamName: p.teamName,
          tierName: p.tierName,
          memberCount: formatInfo.memberCount,
          members: p.teamMembers || [],
          paymentStatus: normalizePaymentStatus(p.paymentStatus),
          transactionId: p.transactionId,
          paymentScreenshotUrl: p.paymentScreenshotUrl,
          paymentScreenshotPath: p.paymentScreenshotPath,
          paymentVerifiedAt: p.paymentVerifiedAt,
          paymentVerifiedBy: p.paymentVerifiedBy,
          arrived: Boolean(p.arrived),
          arrivedAt: p.arrivedAt,
          createdAt: p.createdAt || ev.createdAt || '',
          customResponses: p.customResponses,
          registrationType: p.registrationType || ((p as any).registrationMode ? 'onspot' : 'online'),
          registrationMode: p.registrationMode || ((p as any).registrationSource === 'manual' ? 'admin' : 'participant'),
        });
      });
    }
  });

  // Sort registrations descending by createdAt
  registrations.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return registrations;
}

/**
 * Fetches all events and tickets across all events, and merges them into unified registration records.
 */
export async function getUnifiedRegistrations(forceRefresh = false): Promise<{
  events: EventRecord[];
  registrations: UnifiedRegistrationItem[];
}> {
  return cachedFetch<{
    events: EventRecord[];
    registrations: UnifiedRegistrationItem[];
  }>(
    'registrations:unified_all',
    async () => {
      // 1. Fetch all events
      const allEvents = await getEvents(forceRefresh);
      const validEvents = allEvents || [];

      // 2. Fetch all tickets for all events in parallel
      const ticketResults = await Promise.allSettled(
        validEvents.map(async (ev) => {
          const tickets = await getEventTickets(ev.id, forceRefresh);
          return { eventId: ev.id, tickets };
        })
      );

      const ticketsByEvent = new Map<string, EventTicket[]>();
      ticketResults.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          ticketsByEvent.set(res.value.eventId, res.value.tickets || []);
        }
      });

      const registrations = buildUnifiedRegistrations(validEvents, ticketsByEvent);

      return {
        events: validEvents,
        registrations,
      };
    },
    {
      ttlMs: 45 * 1000,
      resource: 'registrations',
      action: 'get_unified_registrations',
      forceRefresh,
    }
  );
}

/**
 * Real-time subscription to all registrations and events across SAInT.
 * Sets up Firestore real-time onSnapshot listeners on:
 * 1. The events collection (for events, dates, statuses, and embedded participants/teams)
 * 2. Each event's tickets subcollection (for newly registered participants and teams)
 *
 * Automatically detects:
 * - New participant registrations (solo & team)
 * - Updated registrations (payment status, arrival/check-in, team member changes)
 * - Deleted or cancelled registrations
 * - Added, updated, or removed events
 *
 * Returns an unsubscribe cleanup function.
 */
export function subscribeUnifiedRegistrations(
  onData: (data: { events: EventRecord[]; registrations: UnifiedRegistrationItem[] }) => void,
  onError?: (err: Error) => void
): () => void {
  trackDBOperation({ operation: 'listener', action: 'subscribe_unified_registrations', resource: 'registrations' });

  let isUnsubscribed = false;
  let currentEvents: EventRecord[] = [];
  const ticketsByEvent = new Map<string, EventTicket[]>();
  const ticketListeners = new Map<string, () => void>();
  const initialEventsPending = new Set<string>();
  let hasInitialNotified = false;

  const recomputeAndNotify = () => {
    if (isUnsubscribed) return;
    const registrations = buildUnifiedRegistrations(currentEvents, ticketsByEvent);

    // Keep cache fresh so any concurrent reads get instantaneous data
    setCachedData('registrations:unified_all', {
      events: currentEvents,
      registrations,
    });

    onData({
      events: currentEvents,
      registrations,
    });
  };

  const checkInitialAndNotify = () => {
    if (!hasInitialNotified) {
      if (initialEventsPending.size === 0) {
        hasInitialNotified = true;
        recomputeAndNotify();
      }
    } else {
      recomputeAndNotify();
    }
  };

  // Safety timer for initial load: ensures initial view renders within 1200ms
  // even if an event ticket listener takes slightly longer to emit
  const safetyTimer = setTimeout(() => {
    if (!hasInitialNotified && !isUnsubscribed) {
      hasInitialNotified = true;
      recomputeAndNotify();
    }
  }, 1200);

  // Subscribe to all events
  const unsubEvents = onSnapshot(
    query(collection(db, 'events'), orderBy('date', 'desc')),
    (eventsSnap) => {
      if (isUnsubscribed) return;

      currentEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRecord));
      const activeEventIds = new Set(currentEvents.map((e) => e.id));

      // Clean up ticket listeners for deleted events
      for (const [eventId, unsub] of ticketListeners.entries()) {
        if (!activeEventIds.has(eventId)) {
          try {
            unsub();
          } catch {}
          ticketListeners.delete(eventId);
          ticketsByEvent.delete(eventId);
        }
      }

      // Track pending initial ticket loads if initial notification hasn't fired yet
      if (!hasInitialNotified) {
        currentEvents.forEach((ev) => {
          if (!ticketsByEvent.has(ev.id)) {
            initialEventsPending.add(ev.id);
          }
        });
      }

      // If database has 0 events, finish initial load immediately
      if (currentEvents.length === 0) {
        hasInitialNotified = true;
        recomputeAndNotify();
        return;
      }

      // Attach or reconcile real-time listeners for each event's tickets subcollection
      currentEvents.forEach((ev) => {
        if (ticketListeners.has(ev.id)) return;

        const unsubTickets = onSnapshot(
          collection(db, 'events', ev.id, 'tickets'),
          (ticketSnap) => {
            if (isUnsubscribed) return;
            const tickets = ticketSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EventTicket));
            ticketsByEvent.set(ev.id, tickets);

            if (!hasInitialNotified) {
              initialEventsPending.delete(ev.id);
              checkInitialAndNotify();
            } else {
              recomputeAndNotify();
            }
          },
          (ticketErr) => {
            console.warn(`[subscribeUnifiedRegistrations] Error listening to tickets for event ${ev.id}:`, ticketErr);
            if (!hasInitialNotified) {
              initialEventsPending.delete(ev.id);
              checkInitialAndNotify();
            }
          }
        );

        ticketListeners.set(ev.id, unsubTickets);
      });

      if (!hasInitialNotified) {
        checkInitialAndNotify();
      } else {
        recomputeAndNotify();
      }
    },
    (eventsErr) => {
      console.error('[subscribeUnifiedRegistrations] Error listening to events:', eventsErr);
      if (onError && !isUnsubscribed) {
        onError(eventsErr instanceof Error ? eventsErr : new Error(String(eventsErr)));
      }
    }
  );

  return () => {
    isUnsubscribed = true;
    clearTimeout(safetyTimer);
    try {
      unsubEvents();
    } catch {}
    for (const unsub of ticketListeners.values()) {
      try {
        unsub();
      } catch {}
    }
    ticketListeners.clear();
  };
}

/**
 * Invalidate the unified registrations cache
 */
export function invalidateRegistrationsCache() {
  invalidateCache('registrations:unified_all');
}

/**
 * Determines whether an event is upcoming or ongoing based on its date, startTime, and endTime.
 * - Upcoming: event date is strictly in the future, or today before ending.
 * - Ongoing: event date is today and current time is before endTime (or ongoing today if no endTime specified).
 * - Ended / Past: event date is in the past, or event was today and endTime has passed, or status is completed/cancelled.
 */
export function isEventUpcomingOrOngoing(
  event: Partial<EventRecord> | null | undefined,
  now = new Date()
): boolean {
  if (!event) return false;
  if (event.status === 'completed' || event.status === 'cancelled') {
    return false;
  }
  if (!event.date) return false;

  // Extract YYYY-MM-DD from event.date
  let datePart = '';
  if (event.date.includes('T')) {
    datePart = event.date.split('T')[0];
  } else {
    datePart = event.date.trim().slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const parsedDate = new Date(event.date);
    if (!isNaN(parsedDate.getTime())) {
      datePart = toLocalYMD(parsedDate);
    } else {
      return false;
    }
  }

  const todayPart = toLocalYMD(now);

  // Future date -> Upcoming
  if (datePart > todayPart) {
    return true;
  }

  // Past date -> Ended
  if (datePart < todayPart) {
    return false;
  }

  // Today -> Check end time
  if (!event.endTime) {
    // If no endTime is specified, the event is considered ongoing throughout today
    return true;
  }

  const timeStr = event.endTime.trim();
  const timeRegex = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?$/i;
  const match = timeStr.match(timeRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();

    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }

    const [y, m, d] = datePart.split('-').map(Number);
    const endDateTime = new Date(y, m - 1, d, hours, minutes, 59, 999);

    return now.getTime() <= endDateTime.getTime();
  }

  const parsedEnd = new Date(`${datePart} ${timeStr}`);
  if (!isNaN(parsedEnd.getTime())) {
    return now.getTime() <= parsedEnd.getTime();
  }

  return true;
}

/**
 * Computes event-wise summaries based on registrations and active date filter.
 * Defaults to filtering ONLY upcoming & ongoing events per requirement.
 */
export function computeEventSummaries(
  events: EventRecord[],
  registrations: UnifiedRegistrationItem[],
  dateFilter: DateFilterType,
  customRange?: { start: string; end: string },
  onlyUpcomingOrOngoing = true
): EventRegistrationSummary[] {
  const targetEvents = onlyUpcomingOrOngoing
    ? events.filter((ev) => isEventUpcomingOrOngoing(ev))
    : events;

  return targetEvents.map((ev) => {
    const eventRegs = registrations.filter((r) => r.eventId === ev.id);

    // All-time counts for this event
    const soloRegs = eventRegs.filter((r) => r.type === 'solo');
    const teamRegs = eventRegs.filter((r) => r.type === 'team');
    const soloCount = soloRegs.length;
    const teamCount = teamRegs.length;
    const teamMembersCount = teamRegs.reduce((sum, t) => sum + t.memberCount, 0);
    const totalParticipants = soloCount + teamMembersCount;
    const totalRegistrations = soloCount + teamCount;

    // Period-filtered counts
    const periodRegs = eventRegs.filter((r) => isDateInRange(r.createdAt, dateFilter, customRange));
    const periodSolo = periodRegs.filter((r) => r.type === 'solo');
    const periodTeams = periodRegs.filter((r) => r.type === 'team');
    const periodSoloCount = periodSolo.length;
    const periodTeamCount = periodTeams.length;
    const periodTeamMembersCount = periodTeams.reduce((sum, t) => sum + t.memberCount, 0);
    const periodParticipants = periodSoloCount + periodTeamMembersCount;
    const periodRegistrations = periodSoloCount + periodTeamCount;

    return {
      eventId: ev.id,
      eventName: ev.title || 'Untitled Event',
      eventDate: ev.date || '',
      eventStatus: ev.status || 'published',
      soloCount,
      teamCount,
      teamMembersCount,
      totalParticipants,
      totalRegistrations,
      periodSoloCount,
      periodTeamCount,
      periodTeamMembersCount,
      periodParticipants,
      periodRegistrations,
    };
  });
}

/**
 * Calculates top-level overview metrics across all registrations
 */
export function computeOverviewStats(
  events: EventRecord[],
  registrations: UnifiedRegistrationItem[],
  dateFilter: DateFilterType,
  customRange?: { start: string; end: string }
): RegistrationOverviewStats {
  const totalEvents = events.length;

  // Filtered registrations according to current date selection
  const filteredRegs = registrations.filter((r) => isDateInRange(r.createdAt, dateFilter, customRange));
  const soloRegs = filteredRegs.filter((r) => r.type === 'solo');
  const teamRegs = filteredRegs.filter((r) => r.type === 'team');

  const soloRegistrations = soloRegs.length;
  const teamRegistrations = teamRegs.length;
  const totalTeamMembers = teamRegs.reduce((sum, t) => sum + t.memberCount, 0);
  const totalParticipants = soloRegistrations + totalTeamMembers;
  const totalRegistrations = soloRegistrations + teamRegistrations;

  // Today's counts (always calculated specifically for today)
  const todayRegs = registrations.filter((r) => isDateInRange(r.createdAt, 'today'));
  const todaySolo = todayRegs.filter((r) => r.type === 'solo').length;
  const todayTeams = todayRegs.filter((r) => r.type === 'team').length;
  const todayTeamMembers = todayRegs
    .filter((r) => r.type === 'team')
    .reduce((sum, t) => sum + t.memberCount, 0);
  const todayParticipants = todaySolo + todayTeamMembers;
  const todayRegistrations = todaySolo + todayTeams;

  // Health metrics from the filtered set
  let verifiedPayments = 0;
  let pendingPayments = 0;
  let rejectedPayments = 0;
  let arrivedCount = 0;
  let missingProofCount = 0;

  filteredRegs.forEach((r) => {
    if (r.paymentStatus === 'verified') verifiedPayments++;
    else if (r.paymentStatus === 'rejected') rejectedPayments++;
    else {
      pendingPayments++;
      if (!r.paymentScreenshotUrl) missingProofCount++;
    }

    if (r.arrived) arrivedCount++;
  });

  return {
    totalEvents,
    totalRegistrations,
    soloRegistrations,
    teamRegistrations,
    totalTeamMembers,
    totalParticipants,
    todayRegistrations,
    todaySolo,
    todayTeams,
    todayParticipants,
    verifiedPayments,
    pendingPayments,
    rejectedPayments,
    arrivedCount,
    missingProofCount,
  };
}

/**
 * Exports registrations list to a structured CSV file
 */
export function exportRegistrationsToCSV(
  registrations: UnifiedRegistrationItem[],
  filename = 'Registrations_Export.csv'
) {
  if (!registrations || registrations.length === 0) return false;

  const headers = [
    'Registration ID',
    'Participation Format',
    'Registration Channel',
    'Registration Mode',
    'Event Name',
    'Event Date',
    'Participant / Lead Name',
    'Email',
    'Phone',
    'College',
    'Department',
    'Year',
    'Team Name',
    'Total Team Members',
    'Team Members Roster',
    'Payment Status',
    'Transaction ID',
    'Payment Proof URL',
    'Check-in Status',
    'Check-in Time',
    'Registered At',
  ];

  const rows: string[][] = [headers];

  registrations.forEach((r) => {
    let rosterString = '';
    if (r.type === 'team' && r.members && r.members.length > 0) {
      rosterString = r.members
        .map((m, idx) => `[#${idx + 1}] ${m.name} (${m.email || 'No email'}, ${m.phone || 'No phone'}, ${m.college || ''})`)
        .join('; ');
    }

    rows.push([
      r.ticketNumber || r.id,
      r.formatLabel || (r.type === 'team' ? 'Team' : 'Solo'),
      r.registrationType === 'onspot' ? 'On-Spot' : 'Online',
      r.registrationMode === 'admin' ? 'Admin' : 'Participant',
      r.eventName,
      r.eventDate,
      r.name,
      r.email,
      r.phone || '',
      r.college || '',
      r.department || '',
      r.year || '',
      r.teamName || '',
      String(r.memberCount || 1),
      rosterString,
      r.paymentStatus,
      r.transactionId || '',
      r.paymentScreenshotUrl || '',
      r.arrived ? 'Checked In' : 'Pending',
      r.arrivedAt || '',
      r.createdAt || '',
    ]);
  });

  const csvContent = '\uFEFF' + rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Exports event-wise summaries to a CSV file
 */
export function exportEventSummariesToCSV(
  summaries: EventRegistrationSummary[],
  isToday = false,
  filename = 'Event_Registrations_Summary.csv'
) {
  if (!summaries || summaries.length === 0) return false;

  const headers = [
    'Event Name',
    'Event Date',
    'Status',
    isToday ? 'Solo (Today)' : 'Solo Registrations',
    isToday ? 'Teams (Today)' : 'Team Registrations',
    isToday ? 'Team Members (Today)' : 'Team Members',
    isToday ? 'Participants (Today)' : 'Total Participants',
    'All-Time Solo',
    'All-Time Teams',
    'All-Time Participants',
    'All-Time Total Registrations',
  ];

  const rows: string[][] = [headers];

  summaries.forEach((s) => {
    rows.push([
      s.eventName,
      s.eventDate,
      s.eventStatus,
      String(isToday ? s.periodSoloCount : s.soloCount),
      String(isToday ? s.periodTeamCount : s.teamCount),
      String(isToday ? s.periodTeamMembersCount : s.teamMembersCount),
      String(isToday ? s.periodParticipants : s.totalParticipants),
      String(s.soloCount),
      String(s.teamCount),
      String(s.totalParticipants),
      String(s.totalRegistrations),
    ]);
  });

  const csvContent = '\uFEFF' + rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
