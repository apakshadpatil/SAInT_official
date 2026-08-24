import JSZip from 'jszip';
import type { EventRecord, CertificateConfig, EventTeam, TeamMemberDetail } from '../types';
import { uploadBlobToSupabase, SUPABASE_BUCKET } from './supabase';

export const DEFAULT_CERTIFICATE_CONFIG: CertificateConfig = {
  fontFamily: "'Playfair Display', 'Cinzel', 'Georgia', serif",
  primaryColor: '#0f172a',
  accentColor: '#b45309',
  nameFontSize: 52,
  nameOffsetY: 0,
  nameOffsetX: 0,
  nameUppercase: true,
  nameUnderline: false,
  showEventTitle: true,
  eventFontSize: 34,
  eventOffsetY: 0,
  showBodyText: true,
  bodyText: 'for active participation and outstanding commitment in',
  bodyFontSize: 22,
  bodyOffsetY: 0,
  organizationName: "Student Association of Information Technology (SAInT) — JSPM's RSCOE",
  showOrganization: false,
  signatoryName: 'Faculty Coordinator',
  signatoryTitle: 'Faculty Advisor, IT Dept',
  signatory2Name: 'Student President',
  signatory2Title: 'SAInT Core Committee',
  showSignatories: true,
  signatoriesOffsetY: 0,
  showDate: true,
  dateOffsetY: 0,
  showCertificateId: true,
  certificateIdOffsetY: 0,
};

/**
 * Load image with CORS-safe fallback (fetch -> blob -> Object URL)
 * to prevent canvas tainting during export.
 */
export async function loadCorsSafeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);

    img.onerror = async () => {
      // Fallback: fetch as blob and create object URL
      try {
        const response = await fetch(src, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching image`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve(fallbackImg);
        };
        fallbackImg.onerror = (e) => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error(`Failed to load certificate template image: ${e}`));
        };
        fallbackImg.src = blobUrl;
      } catch (err) {
        reject(new Error(`Unable to load certificate template from Supabase Storage: ${err}`));
      }
    };

    img.src = src;
  });
}

/**
 * Renders the certificate canvas using strictly the uploaded Supabase template.
 * Throws an error if no template has been uploaded for the event.
 */
export async function renderCertificateCanvas(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string; teamName?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<HTMLCanvasElement> {
  const config: CertificateConfig = {
    ...DEFAULT_CERTIFICATE_CONFIG,
    ...(event.certificateConfig || {}),
    ...(customConfig || {}),
  };

  const templateUrl = config.templateUrl;
  if (!templateUrl) {
    throw new Error(
      'No certificate template has been uploaded for this event. An official template must be uploaded to Supabase Storage before generating certificates.'
    );
  }

  // Load the uploaded template from Supabase Storage
  const bgImg = await loadCorsSafeImage(templateUrl);

  const width = Math.max(1600, bgImg.naturalWidth || 1920);
  const height = Math.max(1100, bgImg.naturalHeight || 1080);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  // 1. Draw the exact uploaded template background
  ctx.drawImage(bgImg, 0, 0, width, height);

  const centerX = width / 2;
  const baseFont = config.fontFamily || "'Playfair Display', 'Georgia', serif";

  // 2. Organization Name (Optional header overlay if template doesn't already contain it)
  if (config.showOrganization && config.organizationName) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = config.accentColor || '#b45309';
    ctx.font = `bold ${Math.round(width * 0.012)}px sans-serif`;
    ctx.letterSpacing = '3px';
    ctx.fillText(config.organizationName.toUpperCase(), centerX, height * 0.16);
    ctx.restore();
  }

  // 3. Participant Name (Dynamically placed & centered)
  const nameY = height * 0.44 + (config.nameOffsetY || 0);
  const nameX = centerX + (config.nameOffsetX || 0);
  const rawName = participant.name || 'Participant Name';
  const displayName = config.nameUppercase !== false ? rawName.toUpperCase() : rawName;
  const nameFontSize = config.nameFontSize || Math.round(width * 0.032);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = config.primaryColor || '#0f172a';
  ctx.font = `bold ${nameFontSize}px ${baseFont}`;
  ctx.fillText(displayName, nameX, nameY);

  // Optional Name Underline
  if (config.nameUnderline) {
    const textMetrics = ctx.measureText(displayName);
    const lineSpan = Math.max(260, textMetrics.width + 60);
    ctx.strokeStyle = config.accentColor || '#b45309';
    ctx.lineWidth = Math.max(2, Math.round(width * 0.0015));
    ctx.beginPath();
    ctx.moveTo(nameX - lineSpan / 2, nameY + nameFontSize * 0.6);
    ctx.lineTo(nameX + lineSpan / 2, nameY + nameFontSize * 0.6);
    ctx.stroke();
  }
  ctx.restore();

  // 3.5 Team Name Badge (If participant has a team name)
  if (participant.teamName) {
    const teamY = nameY + nameFontSize * 0.72;
    const teamFontSize = Math.round(nameFontSize * 0.38);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.accentColor || '#b45309';
    ctx.font = `600 ${teamFontSize}px sans-serif`;
    ctx.letterSpacing = '1.5px';
    ctx.fillText(`(TEAM: ${participant.teamName.toUpperCase()})`, centerX, teamY);
    ctx.restore();
  }

  // 4. Body Subtitle Text
  if (config.showBodyText !== false && config.bodyText) {
    const bodyY = height * 0.54 + (config.bodyOffsetY || 0);
    const bodyFontSize = config.bodyFontSize || Math.round(width * 0.014);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.primaryColor || '#334155';
    ctx.font = `500 ${bodyFontSize}px ${baseFont}`;
    ctx.fillText(config.bodyText, centerX, bodyY);
    ctx.restore();
  }

  // 5. Event Title
  if (config.showEventTitle !== false && event.title) {
    const eventY = height * 0.63 + (config.eventOffsetY || 0);
    const eventFontSize = config.eventFontSize || Math.round(width * 0.022);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.accentColor || '#0284c7';
    ctx.font = `bold ${eventFontSize}px ${baseFont}`;
    ctx.fillText(`"${event.title}"`, centerX, eventY);
    ctx.restore();
  }

  // 6. Event Date & Venue Info
  if (config.showDate !== false) {
    const dateY = height * 0.71 + (config.dateOffsetY || 0);
    const dateFontSize = Math.round(width * 0.011);
    const venueText = event.venue || event.location || "JSPM's RSCOE";
    const dateText = config.customDateText || (event.date ? `Conducted on ${event.date} · ${venueText}` : venueText);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 ${dateFontSize}px sans-serif`;
    ctx.fillText(dateText, centerX, dateY);
    ctx.restore();
  }

  // 7. Signatories (Left & Right)
  if (config.showSignatories !== false) {
    const sigY = height * 0.84 + (config.signatoriesOffsetY || 0);
    const leftSigX = width * 0.24;
    const rightSigX = width * 0.76;
    const sigLineWidth = Math.round(width * 0.16);

    // Left Signatory (Faculty Coordinator)
    if (config.signatoryName) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftSigX - sigLineWidth / 2, sigY - 24);
      ctx.lineTo(leftSigX + sigLineWidth / 2, sigY - 24);
      ctx.stroke();

      ctx.fillStyle = config.primaryColor || '#0f172a';
      ctx.font = `bold ${Math.round(width * 0.011)}px sans-serif`;
      ctx.fillText(config.signatoryName, leftSigX, sigY);

      if (config.signatoryTitle) {
        ctx.fillStyle = '#64748b';
        ctx.font = `normal ${Math.round(width * 0.009)}px sans-serif`;
        ctx.fillText(config.signatoryTitle, leftSigX, sigY + 20);
      }
      ctx.restore();
    }

    // Right Signatory (Student President / Lead)
    if (config.signatory2Name) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rightSigX - sigLineWidth / 2, sigY - 24);
      ctx.lineTo(rightSigX + sigLineWidth / 2, sigY - 24);
      ctx.stroke();

      ctx.fillStyle = config.primaryColor || '#0f172a';
      ctx.font = `bold ${Math.round(width * 0.011)}px sans-serif`;
      ctx.fillText(config.signatory2Name, rightSigX, sigY);

      if (config.signatory2Title) {
        ctx.fillStyle = '#64748b';
        ctx.font = `normal ${Math.round(width * 0.009)}px sans-serif`;
        ctx.fillText(config.signatory2Title, rightSigX, sigY + 20);
      }
      ctx.restore();
    }
  }

  // 8. Certificate ID & Verification Reference
  if (config.showCertificateId !== false) {
    const certIdY = height - 40 + (config.certificateIdOffsetY || 0);
    const cleanId = (participant.id || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const certId = `CERT-ST-${cleanId}-${event.id.slice(-4).toUpperCase()}`;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
    ctx.font = `${Math.round(width * 0.0075)}px monospace`;
    ctx.fillText(`Certificate ID: ${certId} · Authenticated Digital Credential · SAInT JSPM RSCOE`, centerX, certIdY);
    ctx.restore();
  }

  return canvas;
}

/**
 * Render certificate specifically for a team member (includes Team Name).
 */
export async function renderTeamCertificateCanvas(
  event: EventRecord,
  team: { teamName: string; id?: string },
  member: { name: string; email?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<HTMLCanvasElement> {
  return renderCertificateCanvas(
    event,
    {
      id: `${team.id || 'team'}_${member.name}`,
      name: member.name,
      email: member.email,
      teamName: team.teamName,
    },
    customConfig
  );
}

/**
 * Generate a Blob directly from the rendered certificate canvas.
 */
export async function generateCertificateBlob(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string; teamName?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<Blob> {
  const canvas = await renderCertificateCanvas(event, participant, customConfig);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert certificate canvas to Blob'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Generate and upload a participant's certificate to Supabase Storage.
 * Returns the permanent public CDN URL.
 */
export async function generateAndUploadCertificate(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string; teamName?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<string> {
  const blob = await generateCertificateBlob(event, participant, customConfig);
  const cleanPartId = (participant.id || `part_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const destPath = `certificates/issued/${event.id}/${cleanPartId}.png`;
  return uploadBlobToSupabase(blob, destPath, 'image/png', SUPABASE_BUCKET);
}

/**
 * Generate and upload a team member's certificate to Supabase Storage.
 */
export async function generateAndUploadTeamMemberCertificate(
  event: EventRecord,
  team: EventTeam,
  member: TeamMemberDetail,
  customConfig?: Partial<CertificateConfig>
): Promise<string> {
  const cleanMemberName = member.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTeamName = team.teamName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const participant = {
    id: `${team.id}_${cleanMemberName}`,
    name: member.name,
    email: member.email,
    teamName: team.teamName,
  };
  const blob = await generateCertificateBlob(event, participant, customConfig);
  const destPath = `certificates/issued/${event.id}/teams/${cleanTeamName}/${cleanMemberName}_${Date.now()}.png`;
  return uploadBlobToSupabase(blob, destPath, 'image/png', SUPABASE_BUCKET);
}

/**
 * Generate and trigger download for a single participant's certificate.
 */
export async function downloadCertificate(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string; teamName?: string },
  customConfig?: Partial<CertificateConfig>
): Promise<void> {
  const canvas = await renderCertificateCanvas(event, participant, customConfig);
  const dataUrl = canvas.toDataURL('image/png');
  const cleanName = participant.name.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanEvent = event.title.replace(/[^a-zA-Z0-9]/g, '_');
  const a = document.createElement('a');
  a.download = `Certificate_${cleanName}_${cleanEvent}.png`;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Bulk generate and download ALL participant certificates packed into a single ZIP archive.
 */
export async function downloadAllCertificatesAsZip(
  event: EventRecord,
  participants: Array<{ id?: string; name: string; email?: string; teamName?: string }>,
  customConfig?: Partial<CertificateConfig>,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<void> {
  if (!participants || participants.length === 0) {
    throw new Error('No participants to download certificates for.');
  }

  const zip = new JSZip();
  const folder = zip.folder(`Certificates_${event.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`) || zip;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (onProgress) {
      onProgress(i + 1, participants.length, p.name);
    }

    try {
      const blob = await generateCertificateBlob(event, p, customConfig);
      const cleanName = p.name.replace(/[^a-zA-Z0-9_-]/g, '_') || `Participant_${i + 1}`;
      const prefix = String(i + 1).padStart(3, '0');
      folder.file(`${prefix}_${cleanName}.png`, blob);
    } catch (err) {
      console.error(`Failed rendering certificate for ${p.name} in ZIP:`, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const cleanEvent = event.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `All_Certificates_${cleanEvent}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Bulk generate and download certificates for all members of a Team packed in a ZIP.
 */
export async function downloadTeamCertificatesAsZip(
  event: EventRecord,
  team: EventTeam,
  customConfig?: Partial<CertificateConfig>,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<void> {
  const allMembers: Array<{ name: string; email?: string }> = [
    { name: team.leadName, email: team.leadEmail },
    ...(team.members || []).filter((m) => m.name && m.name.toLowerCase() !== team.leadName.toLowerCase()),
  ];

  const zip = new JSZip();
  const cleanTeamName = team.teamName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(`Team_${cleanTeamName}_Certificates`) || zip;

  for (let i = 0; i < allMembers.length; i++) {
    const m = allMembers[i];
    if (onProgress) {
      onProgress(i + 1, allMembers.length, m.name);
    }

    try {
      const participant = {
        id: `${team.id}_${m.name}`,
        name: m.name,
        email: m.email,
        teamName: team.teamName,
      };
      const blob = await generateCertificateBlob(event, participant, customConfig);
      const cleanMemberName = m.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      folder.file(`${cleanMemberName}_${cleanTeamName}.png`, blob);
    } catch (err) {
      console.error(`Failed rendering team certificate for ${m.name}:`, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `Certificates_Team_${cleanTeamName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

