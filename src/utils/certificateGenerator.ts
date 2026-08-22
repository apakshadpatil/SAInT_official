import type { EventRecord, CertificateConfig } from '../types';

export const DEFAULT_CERTIFICATE_CONFIG: CertificateConfig = {
  presetStyle: 'navy_gold',
  fontFamily: "'Playfair Display', 'Cinzel', 'Georgia', serif",
  primaryColor: '#e2e8f0',
  accentColor: '#fbbf24',
  nameFontSize: 44,
  nameOffsetY: 0,
  eventFontSize: 30,
  eventOffsetY: 0,
  bodyText: 'for active participation and outstanding enthusiasm in',
  organizationName: "Student Association of Information Technology (SAInT) — JSPM's RSCOE",
  signatoryName: 'Prof. Faculty Coordinator',
  signatoryTitle: 'SAInT Faculty Advisor & HOD (IT)',
  showDate: true,
  showCertificateId: true,
};

export async function renderCertificateCanvas(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<HTMLCanvasElement> {
  const config: CertificateConfig = {
    ...DEFAULT_CERTIFICATE_CONFIG,
    ...(event.certificateConfig || {}),
    ...(customConfig || {}),
  };

  const width = 1600;
  const height = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // If custom background template image exists, load and draw it
  let hasDrawnBg = false;
  if (config.templateUrl) {
    try {
      const bgImg = await loadImage(config.templateUrl);
      ctx.drawImage(bgImg, 0, 0, width, height);
      hasDrawnBg = true;
    } catch (e) {
      console.warn('Failed to load custom certificate template, falling back to preset', e);
    }
  }

  if (!hasDrawnBg) {
    // Render procedural styled preset background
    drawPresetBackground(ctx, width, height, config.presetStyle || 'navy_gold');
  }

  // --- Center Content Drawing ---
  const centerX = width / 2;

  // 1. Organization / Header
  ctx.textAlign = 'center';
  ctx.fillStyle = config.accentColor || '#fbbf24';
  ctx.font = 'bold 18px sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText((config.organizationName || "SAInT — JSPM's RSCOE").toUpperCase(), centerX, 180);

  // 2. Certificate Header
  ctx.fillStyle = config.primaryColor || '#ffffff';
  ctx.font = 'bold 54px ' + (config.fontFamily || 'serif');
  ctx.fillText('CERTIFICATE OF PARTICIPATION', centerX, 260);

  // 3. Subtitle Line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'italic 20px ' + (config.fontFamily || 'serif');
  ctx.fillText('PROUDLY PRESENTED TO', centerX, 340);

  // 4. Participant Name (Highlighted & Centered)
  const nameY = 430 + (config.nameOffsetY || 0);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${config.nameFontSize || 46}px ${config.fontFamily || 'serif'}`;
  ctx.fillText(participant.name.toUpperCase(), centerX, nameY);

  // Name Underline Ornament
  ctx.strokeStyle = config.accentColor || '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const nameWidth = ctx.measureText(participant.name.toUpperCase()).width;
  const lineSpan = Math.max(300, nameWidth + 60);
  ctx.moveTo(centerX - lineSpan / 2, nameY + 20);
  ctx.lineTo(centerX + lineSpan / 2, nameY + 20);
  ctx.stroke();

  // 5. Body Text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '22px ' + (config.fontFamily || 'serif');
  const body = config.bodyText || 'for active participation and outstanding enthusiasm in';
  ctx.fillText(body, centerX, 525);

  // 6. Event Title (Highlighted)
  const eventY = 600 + (config.eventOffsetY || 0);
  ctx.fillStyle = config.accentColor || '#60a5fa';
  ctx.font = `bold ${config.eventFontSize || 34}px ${config.fontFamily || 'serif'}`;
  ctx.fillText(`"${event.title}"`, centerX, eventY);

  // 7. Event Date & Venue Info
  if (config.showDate !== false) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '17px sans-serif';
    ctx.fillText(`Organized on ${event.date} at ${event.location || event.venue || "JSPM's RSCOE"}`, centerX, eventY + 50);
  }

  // 8. Bottom Signatures & Seal
  const bottomY = 900;

  // Left: Coordinator Signatory
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(220, bottomY);
  ctx.lineTo(480, bottomY);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(config.signatoryName || 'Prof. Faculty Coordinator', 350, bottomY + 30);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText(config.signatoryTitle || 'SAInT Faculty Advisor', 350, bottomY + 52);

  // Right: President / Lead Signatory
  ctx.beginPath();
  ctx.moveTo(width - 480, bottomY);
  ctx.lineTo(width - 220, bottomY);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Student President', width - 350, bottomY + 30);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText('SAInT Core Committee', width - 350, bottomY + 52);

  // Center Emblem / Seal
  ctx.beginPath();
  ctx.arc(centerX, bottomY + 10, 42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
  ctx.fill();
  ctx.strokeStyle = config.accentColor || '#fbbf24';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = config.accentColor || '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('VERIFIED', centerX, bottomY + 8);
  ctx.fillText('SAInT', centerX, bottomY + 24);

  // 9. Certificate ID verification reference
  if (config.showCertificateId !== false) {
    const certId = `CERT-ST-${(participant.id || 'GEN').slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '12px monospace';
    ctx.fillText(`Certificate ID: ${certId} · Authenticated Digital Credential`, centerX, height - 40);
  }

  return canvas;
}

function drawPresetBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: 'navy_gold' | 'cyber_green' | 'royal_crimson' | 'clean_white'
) {
  if (style === 'cyber_green') {
    // Cyber Green Aesthetic
    ctx.fillStyle = '#050c08';
    ctx.fillRect(0, 0, width, height);

    // Tech Grid
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer Neon Border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, 65, width - 130, height - 130);
  } else if (style === 'royal_crimson') {
    // Royal Crimson Aesthetic
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#3b0712');
    grad.addColorStop(0.5, '#4c0519');
    grad.addColorStop(1, '#1e050b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Gold Double Border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(50, 50, width - 100, height - 100);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(65, 65, width - 130, height - 130);
  } else if (style === 'clean_white') {
    // Clean White Institutional
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 6;
    ctx.strokeRect(50, 50, width - 100, height - 100);
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.strokeRect(65, 65, width - 130, height - 130);
  } else {
    // Default: Luxury Navy & Gold
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#060d1f');
    grad.addColorStop(0.5, '#0b193d');
    grad.addColorStop(1, '#050c1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Gold Corner Accents & Double Borders
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(68, 68, width - 136, height - 136);

    // Corner Ornaments
    drawCornerOrnament(ctx, 50, 50, 40);
    drawCornerOrnament(ctx, width - 50, 50, 40, true, false);
    drawCornerOrnament(ctx, 50, height - 50, 40, false, true);
    drawCornerOrnament(ctx, width - 50, height - 50, 40, true, true);
  }
}

function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flipX = false,
  flipY = false
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function downloadCertificate(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<void> {
  const canvas = await renderCertificateCanvas(event, participant, customConfig);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.download = `Certificate-${participant.name.replace(/\s+/g, '_')}-${event.title.replace(/\s+/g, '_')}.png`;
  a.href = dataUrl;
  a.click();
}
