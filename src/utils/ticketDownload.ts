import type { EventRecord, EventTicket } from '../types';

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

export function downloadTicketImage(
  event: EventRecord,
  ticket: EventTicket,
  qrDataUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 460;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 800, 460);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, 800, 460, 24);
    ctx.fill();

    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(550, 30);
    ctx.lineTo(550, 430);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText("SAInT — JSPM's RSCOE IT Dept", 40, 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    const titleLines = wrapText(ctx, event.title, 470);
    titleLines.forEach((l, i) => ctx.fillText(l, 40, 100 + i * 36));
    const afterTitle = 100 + titleLines.length * 36 + 20;

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px sans-serif';
    ctx.fillText(`📅  ${event.date}   ·   ${event.startTime} – ${event.endTime}`, 40, afterTitle);
    ctx.fillText(`📍  ${event.location} · ${event.venue}`, 40, afterTitle + 26);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, afterTitle + 50);
    ctx.lineTo(510, afterTitle + 50);
    ctx.stroke();

    const nameY = afterTitle + 80;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '12px sans-serif';
    ctx.fillText('REGISTERED FOR', 40, nameY);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(ticket.guestName, 40, nameY + 26);
    if (ticket.guestEmail) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '13px sans-serif';
      ctx.fillText(ticket.guestEmail, 40, nameY + 50);
    }

    const ticketY = nameY + 90;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px sans-serif';
    ctx.fillText('TICKET NO.', 40, ticketY);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(ticket.ticketNumber, 40, ticketY + 22);

    const qrImg = new Image();
    qrImg.onerror = () => reject(new Error('Failed to load QR image'));
    qrImg.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.roundRect(572, 50, 190, 190, 16);
      ctx.fill();
      ctx.drawImage(qrImg, 580, 58, 174, 174);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Scan at Entry', 667, 265);
      ctx.fillText(ticket.ticketNumber, 667, 283);

      const a = document.createElement('a');
      a.download = `SAInT-Ticket-${ticket.ticketNumber}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      resolve();
    };
    qrImg.src = qrDataUrl;
  });
}
