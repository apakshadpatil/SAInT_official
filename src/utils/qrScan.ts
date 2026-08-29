export interface ParsedQRPayload {
  eventId: string;
  ticketId: string;
  ticketNumber: string;
}

export function parseQRPayload(text: string): ParsedQRPayload | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Try JSON payload format (Primary SAInT QR format)
  try {
    const data = JSON.parse(trimmed);
    if (data && typeof data === 'object' && (data.ticketId || data.ticketNumber || data.id)) {
      return {
        eventId: typeof data.eventId === 'string' ? data.eventId.trim() : '',
        ticketId: typeof data.ticketId === 'string' ? data.ticketId.trim() : (typeof data.id === 'string' ? data.id.trim() : ''),
        ticketNumber: typeof data.ticketNumber === 'string' ? data.ticketNumber.trim().toUpperCase() : (typeof data.ticketId === 'string' ? data.ticketId.trim().toUpperCase() : ''),
      };
    }
  } catch {
    // Not valid JSON, continue to other delimiters
  }

  // 2. Try Pipe delimiter: eventId|ticketId|ticketNumber
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length >= 2) {
      return {
        eventId: parts[0] || '',
        ticketId: parts[1] || parts[0],
        ticketNumber: (parts[2] || parts[1] || parts[0]).toUpperCase(),
      };
    }
  }

  // 3. Try Colon delimiter (exclude URLs like http:// or https://)
  if (trimmed.includes(':') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const parts = trimmed.split(':').map((p) => p.trim());
    if (parts.length >= 2 && !parts.some((p) => p.includes('/'))) {
      return {
        eventId: parts[0] || '',
        ticketId: parts[1] || parts[0],
        ticketNumber: (parts[2] || parts[1] || parts[0]).toUpperCase(),
      };
    }
  }

  // 4. Plain ST- ticket number or alphanumerical ticket ID
  if (/^ST-[A-Z0-9]+$/i.test(trimmed)) {
    return {
      eventId: '',
      ticketId: '',
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
