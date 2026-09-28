import { getEvents, getEventTickets, mergeEventWithTickets } from './eventService';
import { cachedFetch, invalidateCache } from './dbCache';
import type { EventRecord, EventTeam, EventTicket, TeamMemberDetail } from '../types';

export interface UnifiedRegistrationItem {
  id: string; // unique ID
  type: 'solo' | 'team';
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

      const registrations: UnifiedRegistrationItem[] = [];

      // 3. Process each event
      validEvents.forEach((ev) => {
        const rawTickets = ticketsByEvent.get(ev.id) || [];
        const mergedEvent = mergeEventWithTickets(ev, rawTickets);

        const seenEmails = new Set<string>();
        const seenTicketIds = new Set<string>();
        const seenTeamIds = new Set<string>();

        // Process Teams
        const teams: EventTeam[] = mergedEvent.teams || [];
        teams.forEach((t) => {
          if (!t) return;
          const leadEmail = (t.leadEmail || '').trim().toLowerCase();
          const teamId = t.id || `team_${t.leadEmail}`;
          if (seenTeamIds.has(teamId)) return;
          seenTeamIds.add(teamId);

          if (leadEmail) seenEmails.add(leadEmail);

          // Calculate team members
          const membersList = Array.isArray(t.members) ? t.members : [];
          const totalMembers = Math.max(membersList.length + 1, t.memberCount || 1);

          registrations.push({
            id: teamId,
            type: 'team',
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
            memberCount: totalMembers,
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
          });
        });

        // Also check raw tickets for any team tickets not yet captured
        rawTickets.forEach((ticket) => {
          if (!ticket) return;
          const hasMembers = (ticket.teamMembers && ticket.teamMembers.length > 0);
          const hasTeamSize = (ticket.teamSize && ticket.teamSize > 1);
          const hasTeamName = Boolean(ticket.teamName);

          if (hasMembers || hasTeamSize || hasTeamName) {
            const teamId = `team_${ticket.id}`;
            const leadEmail = (ticket.guestEmail || '').trim().toLowerCase();
            if (seenTeamIds.has(teamId) || (leadEmail && seenEmails.has(leadEmail))) {
              seenTicketIds.add(ticket.id);
              return;
            }

            seenTeamIds.add(teamId);
            if (leadEmail) seenEmails.add(leadEmail);
            seenTicketIds.add(ticket.id);

            const membersList = ticket.teamMembers || [];
            const totalMembers = Math.max(membersList.length + 1, ticket.teamSize || 1);

            registrations.push({
              id: teamId,
              type: 'team',
              eventId: ev.id,
              eventName: ev.title || 'Untitled Event',
              eventDate: ev.date || '',
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              name: ticket.guestName || 'Unnamed Leader',
              email: ticket.guestEmail || '',
              phone: ticket.guestPhone,
              college: ticket.college,
              department: ticket.department,
              year: ticket.year,
              teamId,
              teamName: ticket.teamName || ticket.customResponses?.teamName || `Team ${ticket.guestName}`,
              tierName: ticket.tierName,
              memberCount: totalMembers,
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
            });
          }
        });

        // Process Solo Registrations from raw tickets
        rawTickets.forEach((ticket) => {
          if (!ticket) return;
          if (seenTicketIds.has(ticket.id)) return;

          const email = (ticket.guestEmail || '').trim().toLowerCase();
          const hasMembers = (ticket.teamMembers && ticket.teamMembers.length > 0);
          const hasTeamSize = (ticket.teamSize && ticket.teamSize > 1);
          const hasTeamName = Boolean(ticket.teamName);

          if (hasMembers || hasTeamSize || hasTeamName) return;
          if (email && seenEmails.has(email)) return;

          seenTicketIds.add(ticket.id);
          if (email) seenEmails.add(email);

          registrations.push({
            id: ticket.id,
            type: 'solo',
            eventId: ev.id,
            eventName: ev.title || 'Untitled Event',
            eventDate: ev.date || '',
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            name: ticket.guestName || 'Unnamed Participant',
            email: ticket.guestEmail || '',
            phone: ticket.guestPhone,
            college: ticket.college,
            department: ticket.department,
            year: ticket.year,
            memberCount: 1,
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
          });
        });

        // Also check mergedEvent.participants for any records created directly on event doc
        if (Array.isArray(mergedEvent.participants)) {
          mergedEvent.participants.forEach((p) => {
            if (!p) return;
            const pId = p.ticketId || p.id;
            const email = (p.email || '').trim().toLowerCase();
            if (pId && seenTicketIds.has(pId)) return;
            if (email && seenEmails.has(email)) return;

            const hasMembers = (p.teamMembers && p.teamMembers.length > 0);
            const hasTeamSize = (p.teamSize && p.teamSize > 1);
            const hasTeamName = Boolean(p.teamName);

            if (hasMembers || hasTeamSize || hasTeamName) return;

            if (pId) seenTicketIds.add(pId);
            if (email) seenEmails.add(email);

            registrations.push({
              id: pId || `part_${p.name}_${Math.random()}`,
              type: 'solo',
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
              memberCount: 1,
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
            });
          });
        }
      });

      // Sort registrations descending by createdAt
      registrations.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

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
    'Registration Type',
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
      r.type === 'team' ? 'Team' : 'Solo',
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
