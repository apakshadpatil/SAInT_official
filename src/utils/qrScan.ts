export interface ParsedQRPayload {
  eventId: string;
  ticketId: string;
  ticketNumber: string;
}

export function parseQRPayload(text: string): ParsedQRPayload | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Try JSON payload format
  try {
    const data = JSON.parse(trimmed);
    if (data && (data.ticketId || data.ticketNumber)) {
      return {
        eventId: data.eventId || '',
        ticketId: data.ticketId || data.id || '',
        ticketNumber: data.ticketNumber || data.ticketId || '',
      };
    }
  } catch {
    // Not valid JSON, continue to other delimiters
  }

  // 2. Try Pipe delimiter: eventId|ticketId|ticketNumber
  if (trimmed.includes('|')) {
    const [eventId, ticketId, ticketNumber] = trimmed.split('|');
    if (ticketId || eventId) {
      return {
        eventId: eventId || '',
        ticketId: ticketId || eventId,
        ticketNumber: ticketNumber || ticketId || eventId,
      };
    }
  }

  // 3. Try Colon delimiter: eventId:ticketId:ticketNumber or ticketId:ticketNumber:guestName
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      return {
        eventId: parts[0] || '',
        ticketId: parts[1] || parts[0],
        ticketNumber: parts[2] || parts[1] || parts[0],
      };
    }
  }

  // 4. Plain ST- ticket number or ticket ID
  if (/^ST-[A-Z0-9]+$/i.test(trimmed) || trimmed.length > 5) {
    return {
      eventId: '',
      ticketId: trimmed,
      ticketNumber: trimmed.toUpperCase(),
    };
  }

  return null;
}

export function qrScanKey(eventId: string, ticketId: string): string {
  return `${eventId}:${ticketId}`;
}

export function buildQRPayload(eventId: string, ticketId: string, ticketNumber: string): string {
  return JSON.stringify({ eventId, ticketId, ticketNumber, source: 'SAInT' });
}
