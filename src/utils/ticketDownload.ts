import type { EventRecord, EventTicket, TicketSize } from '../types';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function getTicketDimensions(event: EventRecord): { width: number; height: number; size: TicketSize } {
  const size = event.ticketSize || 'standard';
  if (size === 'badge') return { width: 600, height: 900, size };
  if (size === 'compact') return { width: 640, height: 340, size };
  if (size === 'wide') return { width: 1000, height: 480, size };
  if (size === 'custom' && event.customTicketWidth && event.customTicketHeight) {
    return {
      width: Math.max(400, Math.min(2400, event.customTicketWidth)),
      height: Math.max(300, Math.min(2400, event.customTicketHeight)),
      size,
    };
  }
  return { width: 800, height: 460, size: 'standard' };
}

export function downloadTicketImage(
  event: EventRecord,
  ticket: EventTicket,
  qrDataUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { width, height, size } = getTicketDimensions(event);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    const isPortraitBadge = size === 'badge' || height > width;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a0f1d');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, Math.min(24, Math.floor(width * 0.04)));
    ctx.fill();

    // Subtle background mesh/glow
    const glow = ctx.createRadialGradient(width * 0.8, height * 0.2, 10, width * 0.8, height * 0.2, width * 0.6);
    glow.addColorStop(0, 'rgba(59, 130, 246, 0.22)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const qrImg = new Image();
    qrImg.onerror = () => reject(new Error('Failed to load QR image'));
    qrImg.onload = () => {
      if (isPortraitBadge) {
        // --- PORTRAIT BADGE LAYOUT ---
        // Header
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("SAInT — JSPM's RSCOE IT Dept", width / 2, 45);

        // Event Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        const titleLines = wrapText(ctx, event.title, width - 80);
        titleLines.forEach((line, idx) => {
          ctx.fillText(line, width / 2, 85 + idx * 34);
        });

        const afterTitleY = 85 + titleLines.length * 34 + 10;

        // Tier / Badge pill
        if (ticket.tierName || event.enableTieredTicketing) {
          const tierLabel = ticket.tierName || 'GENERAL PASS';
          ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.beginPath();
          ctx.roundRect(width / 2 - 120, afterTitleY, 240, 32, 16);
          ctx.fill();
          ctx.fillStyle = '#93c5fd';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(tierLabel.toUpperCase(), width / 2, afterTitleY + 21);
        }

        // Center QR Code
        const qrSize = 220;
        const qrX = (width - qrSize) / 2;
        const qrY = afterTitleY + 50;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
        ctx.fill();
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // Ticket Number
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ticket.ticketNumber, width / 2, qrY + qrSize + 35);

        // Divider
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, qrY + qrSize + 55);
        ctx.lineTo(width - 40, qrY + qrSize + 55);
        ctx.stroke();

        // Attendee info
        const infoY = qrY + qrSize + 90;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px sans-serif';
        ctx.fillText('PASS HOLDER / TEAM LEADER', width / 2, infoY);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(ticket.guestName, width / 2, infoY + 30);

        if (ticket.guestEmail) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '14px sans-serif';
          ctx.fillText(ticket.guestEmail, width / 2, infoY + 54);
        }

        // Team members preview if applicable
        if (ticket.teamMembers && ticket.teamMembers.length > 0) {
          ctx.fillStyle = '#60a5fa';
          ctx.font = 'bold 12px sans-serif';
          const memberNames = ticket.teamMembers.map((m) => m.name).filter(Boolean).join(', ');
          ctx.fillText(`Teammates: ${memberNames}`, width / 2, infoY + 80);
        }

        // Event schedule footer
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '12px sans-serif';
        ctx.fillText(`📅 ${event.date} · ⏰ ${event.startTime} - ${event.endTime}`, width / 2, height - 45);
        ctx.fillText(`📍 ${event.location}, ${event.venue}`, width / 2, height - 25);
      } else {
        // --- LANDSCAPE / STANDARD / WIDE LAYOUT ---
        const qrColumnWidth = Math.min(260, Math.floor(width * 0.32));
        const dividerX = width - qrColumnWidth - 30;

        // Dashed tear line
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dividerX, 25);
        ctx.lineTo(dividerX, height - 25);
        ctx.stroke();
        ctx.setLineDash([]);

        // Header
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText("SAInT — JSPM's RSCOE IT Dept", 40, 48);

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${width >= 900 ? '28px' : '24px'} sans-serif`;
        const titleLines = wrapText(ctx, event.title, dividerX - 60);
        titleLines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 40, 85 + i * 32));
        const afterTitle = 85 + Math.min(titleLines.length, 2) * 32 + 10;

        // Event details
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '13px sans-serif';
        ctx.fillText(`📅 ${event.date}   ·   ⏰ ${event.startTime} – ${event.endTime}`, 40, afterTitle + 10);
        ctx.fillText(`📍 ${event.location} · ${event.venue}`, 40, afterTitle + 32);

        // Attendee Info
        const nameY = afterTitle + 70;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '11px sans-serif';
        ctx.fillText(ticket.teamSize && ticket.teamSize > 1 ? 'TEAM LEADER / ATTENDEE' : 'PASS HOLDER', 40, nameY);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(ticket.guestName, 40, nameY + 24);

        if (ticket.guestEmail) {
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '12px sans-serif';
          ctx.fillText(ticket.guestEmail, 40, nameY + 44);
        }

        // Tier / Team badge
        if (ticket.tierName) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`Tier: ${ticket.tierName}`, 40, nameY + 66);
        }

        // Ticket number
        const ticketY = Math.min(height - 35, nameY + 95);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px sans-serif';
        ctx.fillText('TICKET NO.', 40, ticketY);
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 17px monospace';
        ctx.fillText(ticket.ticketNumber, 40, ticketY + 18);

        // QR Code box on right
        const qrSize = Math.min(180, qrColumnWidth - 30);
        const qrX = dividerX + (qrColumnWidth + 30 - qrSize) / 2;
        const qrY = (height - qrSize - 40) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
        ctx.fill();
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Scan at Entry Gate', qrX + qrSize / 2, qrY + qrSize + 22);
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(ticket.ticketNumber, qrX + qrSize / 2, qrY + qrSize + 38);
      }

      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to generate ticket image'));
            return;
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');

          a.href = url;
          a.download = `SAInT-Ticket-${ticket.ticketNumber}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();

          // Give Chrome time to start the download before releasing the URL
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          resolve();
        }, 'image/png');
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to download ticket'));
      }
    };
    qrImg.src = qrDataUrl;
  });
}
