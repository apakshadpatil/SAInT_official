import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  setDoc,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { EventRecord, EventTicket, EventParticipant, EventTeam } from '../types';
import { buildQRPayload, parseQRPayload } from '../utils/qrScan';
import { extractSupabasePathFromPublicUrl, removeFileFromSupabase, uploadFileToSupabase } from '../utils/supabase';
import { uploadFileToStorage } from '../utils/fileUtils';

const FIRESTORE_FIELD_LIMIT = 1048487; // bytes — guard for inline data URLs

/**
 * Deep cleans an object/array so no key has an `undefined` value,
 * which Firestore updateDoc/setDoc forbids and throws error on.
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

async function ensureSafeImageUrl(imageUrl?: string) {
  if (!imageUrl) return imageUrl;
  if (!imageUrl.startsWith('data:')) return imageUrl;
  const parts = imageUrl.split(',');
  const b64 = parts[1] || '';
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = Math.ceil((b64.length * 3) / 4) - padding;
  if (bytes <= FIRESTORE_FIELD_LIMIT) return imageUrl;

  try {
    const mimeMatch = parts[0].match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(b64);
    let n = binary.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = binary.charCodeAt(n);
    const blob = new Blob([u8], { type: mime });
    const ext = (mime.split('/')[1] || 'png').split(';')[0];
    const file = new File([blob], `event_auto_${Date.now()}.${ext}`, { type: mime });
    const dest = `events/${Date.now()}_auto.${ext}`;
    try {
      const url = await uploadFileToSupabase(file, dest);
      return url;
    } catch (e) {
      console.warn('Supabase upload failed, falling back to Firebase Storage', e);
      try {
        const fbUrl = await uploadFileToStorage(file, dest);
        return fbUrl;
      } catch (fbErr) {
        console.warn('Firebase fallback upload failed', fbErr);
        throw new Error('Image too large to store inline and automatic uploads failed. Please choose a smaller image.');
      }
    }
  } catch (e) {
    console.warn('Automatic upload of inline image failed', e);
    throw new Error('Image too large to store inline and automatic upload failed. Please choose a smaller image.');
  }
}

function now() {
  return new Date().toISOString();
}

export async function createEvent(data: Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const safeImage = await ensureSafeImageUrl((data as any).imageURL as string | undefined);
  const payload = removeUndefinedFields({
    ...data,
    imageURL: safeImage || undefined,
    participantIds: data.participantIds || [],
    createdAt: now(),
    updatedAt: now(),
  });

  const ref = await addDoc(collection(db, 'events'), payload);
  invalidateCache('events:');
  trackDBOperation({ operation: 'write', action: 'create_event', resource: 'events', documentCount: 1 });
  return ref.id;
}

export async function updateEvent(id: string, data: Partial<EventRecord>) {
  const imageFields: Array<keyof EventRecord> = ['imageURL', 'ticketDesignImageUrl', 'paymentQRUrl'] as any;
  for (const field of imageFields) {
    const val = (data as any)[field];
    if (val && typeof val === 'string' && val.startsWith('data:')) {
      try {
        (data as any)[field] = await ensureSafeImageUrl(val);
      } catch (e) {
        console.warn(`Failed to auto-upload oversized field ${field}:`, e);
        delete (data as any)[field];
      }
    }
  }

  const cleanData = removeUndefinedFields({ ...data, updatedAt: now() });
  await updateDoc(doc(db, 'events', id), cleanData);
  invalidateCache(`event:${id}`);
  invalidateCache('events:');
  trackDBOperation({ operation: 'update', action: 'update_event', resource: 'events', documentCount: 1 });
}

export async function deleteEvent(id: string) {
  try {
    const snap = await getDoc(doc(db, 'events', id));
    if (snap.exists()) {
      const data = snap.data() as EventRecord;
      const imageURL = (data as any).imageURL as string | undefined;
      if (imageURL) {
        const path = extractSupabasePathFromPublicUrl(imageURL);
        if (path) {
          try {
            await removeFileFromSupabase(path);
          } catch (e) {
            console.warn('Failed to remove Supabase banner for event', id, e);
          }
        }
      }

      // Cleanup certificate template if stored in Supabase
      const certPath = data.certificateConfig?.templatePath || (data.certificateConfig?.templateUrl ? extractSupabasePathFromPublicUrl(data.certificateConfig.templateUrl) : undefined);
      if (certPath) {
        try {
          await removeFileFromSupabase(certPath);
        } catch (e) {
          console.warn('Failed to remove Supabase certificate template for event', id, e);
        }
      }
    }
  } catch (e) {
    console.warn('Error while attempting to cleanup supabase object for event deletion', e);
  }

  await deleteDoc(doc(db, 'events', id));
  invalidateCache(`event:${id}`);
  invalidateCache('events:');
  trackDBOperation({ operation: 'delete', action: 'delete_event', resource: 'events', documentCount: 1 });
}

export async function getEvent(id: string, forceRefresh = false): Promise<EventRecord | null> {
  return cachedFetch<EventRecord | null>(
    `event:${id}`,
    async () => {
      const snap = await getDoc(doc(db, 'events', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as EventRecord;
    },
    {
      ttlMs: 60 * 1000,
      resource: 'events',
      action: 'get_event',
      forceRefresh,
    }
  );
}

export const getEventById = getEvent;

export async function getEvents(forceRefresh = false): Promise<EventRecord[]> {
  return cachedFetch<EventRecord[]>(
    'events:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'events'), orderBy('date', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRecord));
    },
    {
      ttlMs: 45 * 1000,
      resource: 'events',
      action: 'get_events',
      forceRefresh,
    }
  );
}

export function subscribeEventById(eventId: string, callback: (event: EventRecord | null) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_event_by_id', resource: 'events' });
  return onSnapshot(doc(db, 'events', eventId), (snap) => {
    const item = snap.exists() ? ({ id: snap.id, ...snap.data() } as EventRecord) : null;
    if (item) setCachedData(`event:${eventId}`, item);
    callback(item);
  });
}

export function subscribeEvents(callback: (events: EventRecord[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_events', resource: 'events' });
  return onSnapshot(query(collection(db, 'events'), orderBy('date', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRecord));
    setCachedData('events:all', items);
    callback(items);
  });
}

export async function createTicket(
  eventId: string,
  guestName: string,
  guestEmail: string | undefined,
  options: {
    guestPhone?: string;
    registrationSource?: 'public' | 'manual';
    college?: string;
    department?: string;
    domain?: string;
    domainId?: string;
    teamName?: string;
    tierId?: string;
    tierName?: string;
    teamSize?: number;
    teamMembers?: Array<{ name: string; email?: string; phone?: string; college?: string; department?: string }>;
    transactionId?: string;
    customResponses?: Record<string, string>;
  } = {}
): Promise<EventTicket> {
  const event = await getEvent(eventId);
  if (!event) throw new Error('Event not found');
  if (event.status !== 'published') throw new Error('Registration is not open for this event');

  const ticketRef = doc(collection(db, 'events', eventId, 'tickets'));
  const ticketNumber = `ST-${ticketRef.id.slice(0, 8).toUpperCase()}`;
  const qrPayload = buildQRPayload(eventId, ticketRef.id, ticketNumber);
  const createdAt = now();
  const registrationSource = options.registrationSource || 'manual';

  const rawTicket = {
    eventId,
    guestName,
    guestEmail: guestEmail || null,
    guestPhone: options.guestPhone || null,
    college: options.college || null,
    department: options.department || null,
    domain: options.domain || null,
    domainId: options.domainId || null,
    teamName: options.teamName || options.customResponses?.teamName || options.customResponses?.['Team Name'] || null,
    tierId: options.tierId || null,
    tierName: options.tierName || null,
    teamSize: options.teamSize || null,
    teamMembers: options.teamMembers || null,
    transactionId: options.transactionId || null,
    customResponses: options.customResponses || null,
    ticketNumber,
    qrPayload,
    registrationSource,
    checkedIn: false,
    createdAt,
  };

  await setDoc(ticketRef, removeUndefinedFields(rawTicket));

  return {
    id: ticketRef.id,
    eventId,
    ticketNumber,
    guestName,
    guestEmail,
    guestPhone: options.guestPhone,
    college: options.college,
    department: options.department,
    domain: options.domain,
    domainId: options.domainId,
    teamName: options.teamName || options.customResponses?.teamName || options.customResponses?.['Team Name'],
    tierId: options.tierId,
    tierName: options.tierName,
    teamSize: options.teamSize,
    teamMembers: options.teamMembers,
    transactionId: options.transactionId,
    customResponses: options.customResponses,
    qrPayload,
    registrationSource,
    checkedIn: false,
    createdAt,
  };
}

export async function registerParticipantForEvent(
  eventId: string,
  participantData: {
    name: string;
    email?: string;
    phone?: string;
    college?: string;
    department?: string;
    domain?: string;
    domainId?: string;
    tierId?: string;
    tierName?: string;
    teamSize?: number;
    teamMembers?: Array<{ name: string; email?: string; phone?: string; college?: string; department?: string }>;
    transactionId?: string;
    customResponses?: Record<string, string>;
    registrationSource?: 'public' | 'manual';
  }
) {
  const event = await getEvent(eventId);
  if (!event) throw new Error('Event not found');

  const ticket = await createTicket(eventId, participantData.name, participantData.email, {
    guestPhone: participantData.phone,
    registrationSource: participantData.registrationSource || 'public',
    college: participantData.college,
    department: participantData.department,
    domain: participantData.domain,
    domainId: participantData.domainId,
    teamName: participantData.customResponses?.teamName || participantData.customResponses?.['Team Name'],
    tierId: participantData.tierId,
    tierName: participantData.tierName,
    teamSize: participantData.teamSize,
    teamMembers: participantData.teamMembers,
    transactionId: participantData.transactionId,
    customResponses: participantData.customResponses,
  });

  const rawParticipant: EventParticipant = {
    id: ticket.id,
    eventId,
    name: participantData.name,
    email: participantData.email || '',
    phone: participantData.phone || undefined,
    college: participantData.college || undefined,
    department: participantData.department || undefined,
    domain: participantData.domain || undefined,
    domainId: participantData.domainId || undefined,
    tierId: participantData.tierId || undefined,
    tierName: participantData.tierName || undefined,
    teamSize: participantData.teamSize || undefined,
    teamMembers: participantData.teamMembers || undefined,
    transactionId: participantData.transactionId || undefined,
    customResponses: participantData.customResponses || undefined,
    arrived: false,
    ticketId: ticket.id,
    createdAt: ticket.createdAt,
  };

  // Only update the parent event document if the user is authenticated (e.g. admin performing manual registration)
  // For unauthenticated public registrations, the ticket subcollection document is the secure, authoritative persistence.
  if (auth.currentUser) {
    try {
      const existingParticipants = event.participants || [];
      const normalizedEmail = participantData.email?.trim().toLowerCase();
      const existingIndex = existingParticipants.findIndex((participant) => {
        if (participant.ticketId === ticket.id) return true;
        if (!normalizedEmail) return false;
        return participant.email?.trim().toLowerCase() === normalizedEmail;
      });

      const nextParticipants = [...existingParticipants];
      if (existingIndex >= 0) {
        nextParticipants[existingIndex] = rawParticipant;
      } else {
        nextParticipants.push(rawParticipant);
      }

      const participantIds = Array.from(new Set([...(event.participantIds || []), ticket.id]));

      const isTeamRegistration =
        Boolean(event.teamsEnabled) ||
        (participantData.teamMembers && participantData.teamMembers.length > 0) ||
        (participantData.teamSize && participantData.teamSize > 1);

      let nextTeams = event.teams || [];
      if (isTeamRegistration) {
        const rawTeamName =
          participantData.customResponses?.teamName ||
          participantData.customResponses?.['Team Name'] ||
          `Team ${participantData.name}`;

        const newTeam: EventTeam = {
          id: `team_${ticket.id}`,
          eventId,
          teamName: rawTeamName.trim(),
          leadName: participantData.name.trim(),
          leadEmail: (participantData.email || '').trim().toLowerCase(),
          leadPhone: participantData.phone?.trim(),
          college: participantData.college?.trim(),
          department: participantData.department?.trim(),
          memberCount: (participantData.teamMembers?.length || 0) + 1,
          members: participantData.teamMembers || [],
          tierId: participantData.tierId,
          tierName: participantData.tierName,
          transactionId: participantData.transactionId,
          customResponses: participantData.customResponses,
          registeredAt: ticket.createdAt,
          arrived: false,
        };

        const existingTeams = event.teams || [];
        const teamIndex = existingTeams.findIndex((t) => t.id === newTeam.id || t.leadEmail === newTeam.leadEmail);
        if (teamIndex >= 0) {
          nextTeams = [...existingTeams];
          nextTeams[teamIndex] = newTeam;
        } else {
          nextTeams = [newTeam, ...existingTeams];
        }
      }

      await updateEvent(eventId, {
        participants: nextParticipants,
        participantIds,
        ...(isTeamRegistration ? { teams: nextTeams } : {}),
      });
    } catch (err) {
      console.warn('[Register] Non-fatal: could not update parent event document:', err);
    }
  }

  return { ticket, participant: rawParticipant };
}

export function mergeEventWithTickets(event: EventRecord, tickets: EventTicket[]): EventRecord {
  if (!tickets || tickets.length === 0) return event;

  const existingParticipants = [...(event.participants || [])];
  const participantMap = new Map<string, EventParticipant>();

  // First populate with existing participants from event doc
  existingParticipants.forEach((p) => {
    const key = p.ticketId || (p.email ? p.email.toLowerCase() : p.id);
    participantMap.set(key, p);
  });

  // Then merge tickets from subcollection
  tickets.forEach((ticket) => {
    const key = ticket.id;
    const emailKey = ticket.guestEmail ? ticket.guestEmail.toLowerCase() : null;

    const participant: EventParticipant = {
      id: ticket.id,
      eventId: ticket.eventId,
      name: ticket.guestName,
      email: ticket.guestEmail || '',
      phone: ticket.guestPhone,
      college: ticket.college,
      department: ticket.department,
      domain: ticket.domain,
      domainId: ticket.domainId,
      tierId: ticket.tierId,
      tierName: ticket.tierName,
      teamSize: ticket.teamSize,
      teamMembers: ticket.teamMembers,
      teamName: ticket.teamName || ticket.customResponses?.teamName || ticket.customResponses?.['Team Name'],
      transactionId: ticket.transactionId,
      customResponses: ticket.customResponses,
      arrived: Boolean(ticket.checkedIn),
      arrivedAt: ticket.checkedInAt,
      ticketId: ticket.id,
      createdAt: ticket.createdAt,
    };

    // If an existing entry exists by email or ticketId, merge while preserving admin allocations
    if (emailKey && participantMap.has(emailKey)) {
      const existing = participantMap.get(emailKey)!;
      participantMap.set(emailKey, {
        ...participant,
        allocatedLab: existing.allocatedLab,
        allocatedClassroom: existing.allocatedClassroom,
        batchId: existing.batchId,
        batchName: existing.batchName,
        certificateUrl: existing.certificateUrl,
        certificateSent: existing.certificateSent,
      });
    } else if (participantMap.has(key)) {
      const existing = participantMap.get(key)!;
      participantMap.set(key, {
        ...participant,
        allocatedLab: existing.allocatedLab,
        allocatedClassroom: existing.allocatedClassroom,
        batchId: existing.batchId,
        batchName: existing.batchName,
        certificateUrl: existing.certificateUrl,
        certificateSent: existing.certificateSent,
      });
    } else {
      participantMap.set(key, participant);
    }
  });

  const mergedParticipants = Array.from(participantMap.values());
  const mergedParticipantIds = Array.from(new Set([...(event.participantIds || []), ...tickets.map((t) => t.id)]));

  // Construct merged teams
  const existingTeams = [...(event.teams || [])];
  const teamMap = new Map<string, EventTeam>();
  existingTeams.forEach((t) => teamMap.set(t.id || t.leadEmail?.toLowerCase(), t));

  tickets
    .filter((t) => (t.teamMembers && t.teamMembers.length > 0) || (t.teamSize && t.teamSize > 1) || t.teamName)
    .forEach((ticket) => {
      const teamId = `team_${ticket.id}`;
      const leadEmail = (ticket.guestEmail || '').toLowerCase();
      const rawTeamName =
        ticket.teamName ||
        ticket.customResponses?.teamName ||
        ticket.customResponses?.['Team Name'] ||
        `Team ${ticket.guestName}`;

      const newTeam: EventTeam = {
        id: teamId,
        eventId: ticket.eventId,
        teamName: rawTeamName.trim(),
        leadName: ticket.guestName,
        leadEmail,
        leadPhone: ticket.guestPhone,
        college: ticket.college,
        department: ticket.department,
        memberCount: (ticket.teamMembers?.length || 0) + 1,
        members: ticket.teamMembers || [],
        tierId: ticket.tierId,
        tierName: ticket.tierName,
        transactionId: ticket.transactionId,
        customResponses: ticket.customResponses,
        registeredAt: ticket.createdAt,
        arrived: Boolean(ticket.checkedIn),
        arrivedAt: ticket.checkedInAt,
      };

      if (leadEmail && teamMap.has(leadEmail)) {
        const existing = teamMap.get(leadEmail)!;
        teamMap.set(leadEmail, {
          ...newTeam,
          memberCertificateUrls: existing.memberCertificateUrls,
          certificatesSent: existing.certificatesSent,
          batchId: existing.batchId,
          batchName: existing.batchName,
          notes: existing.notes,
        });
      } else {
        teamMap.set(teamId, newTeam);
      }
    });

  const mergedTeams = Array.from(teamMap.values());

  return {
    ...event,
    participants: mergedParticipants,
    participantIds: mergedParticipantIds,
    teams: mergedTeams,
  };
}

export async function addParticipant(eventId: string, userId: string) {
  const event = await getEvent(eventId);
  if (!event) throw new Error('Event not found');

  const participantIds = Array.from(new Set([...(event.participantIds || []), userId]));
  await updateEvent(eventId, { participantIds });
}

export async function removeParticipant(eventId: string, userId: string) {
  const event = await getEvent(eventId);
  if (!event) throw new Error('Event not found');

  const participantIds = (event.participantIds || []).filter((id) => id !== userId);
  await updateEvent(eventId, { participantIds });
}

export async function getEventTickets(eventId: string): Promise<EventTicket[]> {
  const snap = await getDocs(collection(db, 'events', eventId, 'tickets'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventTicket));
}

export function subscribeEventTickets(eventId: string, callback: (tickets: EventTicket[]) => void) {
  return onSnapshot(collection(db, 'events', eventId, 'tickets'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventTicket)));
  });
}

export async function getPublishedUpcomingEvents(forceRefresh = false): Promise<EventRecord[]> {
  return cachedFetch<EventRecord[]>(
    'events:upcoming_published',
    async () => {
      const today = new Date().toISOString().split('T')[0];

      try {
        const snap = await getDocs(
          query(
            collection(db, 'events'),
            where('status', '==', 'published'),
            orderBy('date', 'asc')
          )
        );

        const events = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as EventRecord)
        );

        return getUpcomingEvents(events, today);
      } catch (indexErr) {
        console.warn(
          'Published events query failed, falling back to client filter:',
          indexErr
        );

        try {
          const snap = await getDocs(
            query(
              collection(db, 'events'),
              where('status', '==', 'published')
            )
          );

          const events = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as EventRecord)
          );

          return getUpcomingEvents(events, today);
        } catch (err) {
          console.warn('Published upcoming events query error:', err);
          return [];
        }
      }
    },
    {
      ttlMs: 15 * 1000,
      resource: 'events',
      action: 'get_published_upcoming_events',
      forceRefresh,
    }
  );
}

export async function getPublishedActivities(forceRefresh = false): Promise<EventRecord[]> {
  return cachedFetch<EventRecord[]>(
    'events:published_activities',
    async () => {
      try {
        const snap = await getDocs(collection(db, 'events'));
        const allEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRecord));
        return allEvents
          .filter((e) => e.status !== 'cancelled')
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      } catch (err) {
        console.warn('Failed to fetch public activities:', err);
        return [];
      }
    },
    {
      ttlMs: 15 * 1000,
      resource: 'events',
      action: 'get_published_activities',
      forceRefresh,
    }
  );
}

export function subscribePublishedActivities(callback: (events: EventRecord[]) => void) {
  return onSnapshot(
    collection(db, 'events'),
    (snap) => {
      const allEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRecord));
      const sorted = allEvents
        .filter((e) => e.status !== 'cancelled')
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      callback(sorted);
    },
    (err) => {
      console.warn('Subscription to published activities failed:', err);
    }
  );
}

export function subscribePublishedUpcomingEvents(callback: (events: EventRecord[]) => void) {
  const today = new Date().toISOString().split('T')[0];
  return onSnapshot(
    collection(db, 'events'),
    (snap) => {
      const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRecord));
      callback(getUpcomingEvents(events, today));
    },
    (err) => {
      console.warn('Subscription to published upcoming events failed:', err);
    }
  );
}

export async function checkInEventTicket(eventId: string, rawInput: string, scannerUid: string) {
  const cleanInput = rawInput.trim();
  if (!cleanInput) throw new Error('Invalid ticket QR code or ticket number');
  const parsed = parseQRPayload(cleanInput);

  const searchTicketId = parsed?.ticketId || cleanInput;
  const searchTicketNumber = (parsed?.ticketNumber || cleanInput).toUpperCase();

  // 1. Try direct ticket doc path first if we have a ticketId
  if (searchTicketId) {
    try {
      const ticketRef = doc(db, 'events', eventId, 'tickets', searchTicketId);
      const ticketSnap = await getDoc(ticketRef);
      if (ticketSnap.exists()) {
        return await checkInTicket(ticketRef, scannerUid);
      }
    } catch {
      // Continue to search below
    }
  }

  // 2. Search tickets in this event's ticket subcollection
  const eventTicketsSnap = await getDocs(collection(db, 'events', eventId, 'tickets'));
  const foundDoc = eventTicketsSnap.docs.find((d) => {
    const t = d.data() as EventTicket;
    return (
      d.id === searchTicketId ||
      t.ticketNumber?.toUpperCase() === searchTicketNumber ||
      t.ticketNumber?.toUpperCase() === `ST-${searchTicketNumber}` ||
      t.qrPayload === cleanInput
    );
  });

  if (foundDoc) {
    return checkInTicket(foundDoc.ref, scannerUid);
  }

  // 3. Fallback: global search
  return checkInByTicketNumberOrId(cleanInput, scannerUid);
}

export async function checkInByQRPayload(qrText: string, scannerUid: string) {
  const parsed = parseQRPayload(qrText);

  if (parsed && parsed.eventId && parsed.ticketId) {
    try {
      const ticketRef = doc(db, 'events', parsed.eventId, 'tickets', parsed.ticketId);
      const ticketSnap = await getDoc(ticketRef);
      if (ticketSnap.exists()) {
        return await checkInTicket(ticketRef, scannerUid);
      }
    } catch {
      // Fallback to search below
    }
  }

  const searchKey = parsed?.ticketNumber || parsed?.ticketId || qrText.trim();
  return checkInByTicketNumberOrId(searchKey, scannerUid);
}

export async function checkInByTicketNumber(ticketNumber: string, scannerUid: string) {
  return checkInByTicketNumberOrId(ticketNumber, scannerUid);
}

export async function checkInByTicketNumberOrId(inputStr: string, scannerUid: string) {
  const cleanInput = inputStr.trim();
  if (!cleanInput) {
    throw new Error('Please enter or scan a valid ticket number');
  }

  const normalizedNumber = cleanInput.toUpperCase();

  // Try collectionGroup query wrapped in try/catch (handles missing Firestore index gracefully)
  try {
    let ticketsSnap = await getDocs(
      query(collectionGroup(db, 'tickets'), where('ticketNumber', '==', normalizedNumber))
    );

    if (ticketsSnap.empty && !normalizedNumber.startsWith('ST-')) {
      ticketsSnap = await getDocs(
        query(collectionGroup(db, 'tickets'), where('ticketNumber', '==', `ST-${normalizedNumber}`))
      );
    }

    if (!ticketsSnap.empty) {
      return await checkInTicket(ticketsSnap.docs[0].ref, scannerUid);
    }
  } catch (indexErr) {
    console.warn('CollectionGroup query failed (index missing in Firebase Console), falling back to event scan:', indexErr);
  }

  // Reliable Fallback: Iterate events to find ticket without requiring collectionGroup index
  const allEvents = await getDocs(collection(db, 'events'));
  for (const evDoc of allEvents.docs) {
    const ticketsCol = await getDocs(collection(db, 'events', evDoc.id, 'tickets'));
    const found = ticketsCol.docs.find((d) => {
      const data = d.data() as EventTicket;
      return (
        d.id === cleanInput ||
        data.ticketNumber?.toUpperCase() === normalizedNumber ||
        data.ticketNumber?.toUpperCase() === `ST-${normalizedNumber}` ||
        data.qrPayload === cleanInput
      );
    });
    if (found) {
      return checkInTicket(found.ref, scannerUid);
    }
  }

  throw new Error(`Ticket "${cleanInput}" not found`);
}

async function syncParticipantArrival(eventId: string, ticketId: string, checkedInAt: string) {
  const event = await getEvent(eventId);
  if (!event?.participants?.length) return;

  const participants = event.participants.map((participant) =>
    participant.ticketId === ticketId || participant.id === ticketId
      ? { ...participant, arrived: true, arrivedAt: checkedInAt }
      : participant
  );

  if (participants.some((p, i) => p.arrived !== event.participants![i].arrived)) {
    await updateEvent(eventId, { participants });
  }
}

async function checkInTicket(ticketRef: ReturnType<typeof doc>, scannerUid: string) {
  const ticketSnap = await getDoc(ticketRef);
  if (!ticketSnap.exists()) throw new Error('Ticket not found');

  const ticket = { id: ticketSnap.id, ...ticketSnap.data() } as EventTicket;
  const event = await getEvent(ticket.eventId);
  if (!event) throw new Error('Event not found');

  if (ticket.checkedIn) throw new Error(`Guest "${ticket.guestName}" has already been checked in`);

  const checkedInAt = now();
  await updateDoc(
    ticketRef,
    removeUndefinedFields({
      checkedIn: true,
      checkedInAt,
      checkedInBy: scannerUid,
    })
  );

  await syncParticipantArrival(ticket.eventId, ticket.id, checkedInAt);

  return {
    ticket: { ...ticket, checkedIn: true, checkedInAt, checkedInBy: scannerUid },
    event,
  };
}

export function getUpcomingEvents(events: EventRecord[], todayOverride?: string) {
  const today = todayOverride || new Date().toISOString().split('T')[0];
  const upcoming = events
    .filter((e) => {
      if (e.status === 'cancelled' || e.status === 'draft') return false;
      const eventDate = (e.date || '').slice(0, 10);
      return !eventDate || eventDate >= today;
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // If strict date filter yielded 0 upcoming but there are active events, show all non-cancelled/non-draft events
  if (upcoming.length === 0) {
    const published = events.filter((e) => e.status !== 'cancelled' && e.status !== 'draft');
    if (published.length > 0) {
      return published.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
  }

  return upcoming;
}

export function getPastEvents(events: EventRecord[]) {
  const today = new Date().toISOString().split('T')[0];
  return events.filter((e) => {
    const eventDate = (e.date || '').slice(0, 10);
    return (eventDate && eventDate < today) || e.status === 'completed';
  });
}
