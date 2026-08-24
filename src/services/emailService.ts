import type { EventRecord, EventParticipant, CertificateConfig, EventTeam } from '../types';
import { generateAndUploadCertificate, generateAndUploadTeamMemberCertificate } from '../utils/certificateGenerator';
import { updateEvent } from './eventService';

export interface EmailPayload {
  to: string | string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  attachmentUrls?: string[];
}

export interface SendEmailResult {
  success: boolean;
  provider: 'api' | 'webclient' | 'clipboard';
  message: string;
  error?: string;
}

export interface BulkCertificateProgress {
  current: number;
  total: number;
  currentName: string;
  status: 'rendering' | 'uploading' | 'sending' | 'completed' | 'failed';
  error?: string;
}

/**
 * Validates an email address.
 */
export function validateEmail(email?: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(trimmed);
}

/**
 * Normalizes email address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Formats standard plain-text and HTML email content for certificate issuance.
 */
export function buildCertificateEmailContent(
  event: EventRecord,
  participant: { name: string; email?: string; id?: string },
  certificateUrl: string
): { subject: string; textBody: string; htmlBody: string } {
  const participantName = participant.name || 'Participant';
  const eventTitle = event.title || 'SAInT Event';
  const dateStr = event.date || 'Recent Event';
  const venueStr = event.venue || event.location || "JSPM's Rajarshi Shahu College of Engineering, Pune";
  const orgName = event.certificateConfig?.organizationName || "Student Association of Information Technology (SAInT) — JSPM's RSCOE";

  const subject = `Your Official Certificate of Participation: ${eventTitle}`;

  const textBody = `Dear ${participantName},

Congratulations on your active participation in "${eventTitle}" organized on ${dateStr} at ${venueStr} by ${orgName}.

Your official, verified digital Certificate of Participation has been generated and securely stored in our credentials repository.

Access and download your high-resolution certificate here:
${certificateUrl}

Certificate Details:
- Event: ${eventTitle}
- Recipient: ${participantName}
- Date: ${dateStr}
- Verification: Authenticated Credential

Thank you for being an enthusiastic part of this initiative!

Warm regards,
Organizing Committee
${orgName}
Department of Information Technology, JSPM's RSCOE`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 0; font-size: 14px; color: #94a3b8; }
        .content { padding: 32px 24px; }
        .badge { display: inline-block; padding: 4px 12px; background: #fef3c7; color: #b45309; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
        .name { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .card { background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }
        .card-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .card-row:last-child { margin-bottom: 0; }
        .card-label { color: #64748b; }
        .card-val { font-weight: 600; color: #0f172a; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Certificate of Participation</h1>
          <p>${orgName}</p>
        </div>
        <div class="content">
          <span class="badge">Official Credential</span>
          <div class="name">Dear ${participantName},</div>
          <p>Congratulations on your active participation in <strong>"${eventTitle}"</strong> organized on ${dateStr} at ${venueStr}.</p>
          <p>Your official digital certificate has been issued and stored in our verified cloud repository.</p>
          
          <div class="card">
            <div class="card-row"><span class="card-label">Event:</span><span class="card-val">${eventTitle}</span></div>
            <div class="card-row"><span class="card-label">Participant:</span><span class="card-val">${participantName}</span></div>
            <div class="card-row"><span class="card-label">Date:</span><span class="card-val">${dateStr}</span></div>
            <div class="card-row"><span class="card-label">Location:</span><span class="card-val">${venueStr}</span></div>
          </div>

          <div class="btn-wrapper">
            <a href="${certificateUrl}" class="btn" target="_blank" rel="noopener noreferrer">View & Download Certificate</a>
          </div>

          <p style="font-size: 13px; color: #64748b; text-align: center;">
            Direct Link: <a href="${certificateUrl}" style="color: #2563eb; word-break: break-all;">${certificateUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0 0 4px 0;"><strong>${orgName}</strong></p>
          <p style="margin: 0;">Department of Information Technology · JSPM's RSCOE, Pune</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Attempts to dispatch an email via a configured serverless/API endpoint or Resend integration.
 * Returns true if an external API was successfully called, false if fallback client should be used.
 */
export async function sendDirectEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const apiUrl = import.meta.env.VITE_EMAIL_API_URL as string;
  const resendKey = import.meta.env.VITE_RESEND_API_KEY as string;

  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return {
          success: true,
          provider: 'api',
          message: 'Email dispatched successfully via API endpoint',
        };
      }
      const errText = await res.text();
      console.warn('[EmailService] API dispatch returned non-200:', errText);
    } catch (e) {
      console.warn('[EmailService] API dispatch network error:', e);
    }
  }

  if (resendKey) {
    try {
      const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'SAInT RSCOE <certificates@saint.club>',
          to: toList,
          bcc: payload.bcc,
          subject: payload.subject,
          html: payload.html || payload.body,
        }),
      });

      if (res.ok) {
        return {
          success: true,
          provider: 'api',
          message: 'Email delivered successfully via Resend API',
        };
      }
    } catch (e) {
      console.warn('[EmailService] Resend API error:', e);
    }
  }

  return {
    success: false,
    provider: 'webclient',
    message: 'No backend email endpoint configured; falling back to web mail client launcher',
  };
}

/**
 * Launches web mail client or native mail client with URL length chunking.
 */
export function openWebMailClient(options: {
  to?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  client?: 'gmail' | 'outlook' | 'default';
}): void {
  const { to = [], bcc = [], subject, body, client = 'default' } = options;

  const toStr = to.join(',');
  const bccStr = bcc.join(',');

  if (client === 'gmail') {
    const params = new URLSearchParams();
    if (toStr) params.set('to', toStr);
    if (bccStr) params.set('bcc', bccStr);
    params.set('su', subject);
    params.set('body', body);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`, '_blank');
    return;
  }

  if (client === 'outlook') {
    const params = new URLSearchParams();
    if (toStr) params.set('to', toStr);
    if (bccStr) params.set('bcc', bccStr);
    params.set('subject', subject);
    params.set('body', body);
    window.open(`https://outlook.live.com/mail/0/deeplink/compose?${params.toString()}`, '_blank');
    return;
  }

  // Default mailto:
  let mailto = `mailto:${encodeURIComponent(toStr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (bccStr) {
    mailto += `&bcc=${encodeURIComponent(bccStr)}`;
  }

  // Safe fallback if mailto URI exceeds standard browser limits
  if (mailto.length > 2000) {
    console.warn('[EmailService] mailto URI exceeds 2000 chars, opening with truncated to/bcc');
    mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  window.location.href = mailto;
}

/**
 * Dispatches a single participant certificate:
 * 1. Generates and uploads certificate to Supabase Storage if not already uploaded.
 * 2. Saves certificateUrl and certificateSent in participant record.
 * 3. Sends or prepares email.
 */
export async function sendParticipantCertificate(
  event: EventRecord,
  participant: EventParticipant,
  customConfig?: Partial<CertificateConfig>,
  clientChoice: 'gmail' | 'outlook' | 'default' = 'default'
): Promise<{ success: boolean; certificateUrl: string; message: string }> {
  if (!participant.email || !validateEmail(participant.email)) {
    throw new Error(`Participant "${participant.name}" does not have a valid email address.`);
  }

  // 1. Generate & Upload certificate to Supabase Storage
  let certUrl = participant.certificateUrl;
  if (!certUrl) {
    certUrl = await generateAndUploadCertificate(event, participant, customConfig);
  }

  // 2. Build email content
  const { subject, textBody, htmlBody } = buildCertificateEmailContent(event, participant, certUrl);

  // 3. Try direct API dispatch
  const apiResult = await sendDirectEmail({
    to: participant.email,
    subject,
    body: textBody,
    html: htmlBody,
    attachmentUrls: [certUrl],
  });

  // 4. If API not configured, launch user's web mail client
  if (!apiResult.success) {
    openWebMailClient({
      to: [participant.email],
      subject,
      body: textBody,
      client: clientChoice,
    });
  }

  // 5. Update participant in database
  const updatedParticipants = (event.participants || []).map((p) => {
    if (p.id === participant.id) {
      return {
        ...p,
        certificateUrl: certUrl,
        certificateSent: apiResult.success, // only mark sent if actually delivered via API
      };
    }
    return p;
  });

  await updateEvent(event.id, {
    participants: updatedParticipants,
  });

  return {
    success: true,
    certificateUrl: certUrl,
    message: apiResult.success
      ? `Certificate emailed directly to ${participant.name} (${participant.email})!`
      : `Mail client opened for ${participant.name} — review the draft and click Send. Certificate link: ${certUrl}`,
  };
}

/**
 * Bulk generates and dispatches certificates to participants.
 */
export async function sendBulkCertificates(
  event: EventRecord,
  targetParticipants: EventParticipant[],
  customConfig?: Partial<CertificateConfig>,
  onProgress?: (progress: BulkCertificateProgress) => void
): Promise<{
  total: number;
  successful: number;
  failed: number;
  updatedParticipants: EventParticipant[];
  issuedUrls: Array<{ id: string; name: string; email: string; url: string }>;
}> {
  const total = targetParticipants.length;
  if (total === 0) {
    throw new Error('No eligible participants found to generate certificates for.');
  }

  let successful = 0;
  let failed = 0;
  const issuedUrls: Array<{ id: string; name: string; email: string; url: string }> = [];

  const participantsMap = new Map<string, EventParticipant>(
    (event.participants || []).map((p) => [p.id, { ...p }])
  );

  for (let i = 0; i < total; i++) {
    const p = targetParticipants[i];
    const index = i + 1;

    try {
      if (onProgress) {
        onProgress({
          current: index,
          total,
          currentName: p.name,
          status: 'rendering',
        });
      }

      // Generate & Upload
      let certUrl = p.certificateUrl;
      if (!certUrl) {
        if (onProgress) {
          onProgress({
            current: index,
            total,
            currentName: p.name,
            status: 'uploading',
          });
        }
        certUrl = await generateAndUploadCertificate(event, p, customConfig);
      }

      // Direct email attempt if valid email
      if (validateEmail(p.email)) {
        if (onProgress) {
          onProgress({
            current: index,
            total,
            currentName: p.name,
            status: 'sending',
          });
        }
        const { subject, textBody, htmlBody } = buildCertificateEmailContent(event, p, certUrl);
        await sendDirectEmail({
          to: p.email,
          subject,
          body: textBody,
          html: htmlBody,
          attachmentUrls: [certUrl],
        });
      }

      // Update participant entry
      const existing = participantsMap.get(p.id) || p;
      participantsMap.set(p.id, {
        ...existing,
        certificateUrl: certUrl,
        certificateSent: true,
      });

      issuedUrls.push({
        id: p.id,
        name: p.name,
        email: p.email,
        url: certUrl,
      });

      successful++;

      if (onProgress) {
        onProgress({
          current: index,
          total,
          currentName: p.name,
          status: 'completed',
        });
      }

      // Mild delay to prevent client throttling
      await new Promise((r) => setTimeout(r, 200));
    } catch (err: any) {
      failed++;
      console.error(`[BulkCertificates] Error processing participant ${p.name}:`, err);
      if (onProgress) {
        onProgress({
          current: index,
          total,
          currentName: p.name,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  const updatedParticipants = Array.from(participantsMap.values());

  // Commit updated participant credentials to Firestore
  await updateEvent(event.id, {
    participants: updatedParticipants,
  });

  return {
    total,
    successful,
    failed,
    updatedParticipants,
    issuedUrls,
  };
}

/**
 * Generate and dispatch certificates to all members of a registered Team.
 */
export async function sendTeamCertificates(
  event: EventRecord,
  team: EventTeam,
  customConfig?: Partial<CertificateConfig>,
  onProgress?: (progress: BulkCertificateProgress) => void
): Promise<{
  total: number;
  successful: number;
  failed: number;
  memberUrls: Record<string, string>;
}> {
  const allMembers: Array<{ name: string; email: string; phone?: string }> = [
    { name: team.leadName, email: team.leadEmail, phone: team.leadPhone },
    ...(team.members || []).map((m) => ({ name: m.name, email: m.email || '', phone: m.phone })),
  ];

  const total = allMembers.length;
  let successful = 0;
  let failed = 0;
  const memberUrls: Record<string, string> = { ...(team.memberCertificateUrls || {}) };

  for (let i = 0; i < total; i++) {
    const member = allMembers[i];
    const index = i + 1;

    try {
      if (onProgress) {
        onProgress({
          current: index,
          total,
          currentName: member.name,
          status: 'rendering',
        });
      }

      // Generate & Upload certificate for this member with team name
      let certUrl = memberUrls[member.email || member.name];
      if (!certUrl) {
        if (onProgress) {
          onProgress({
            current: index,
            total,
            currentName: member.name,
            status: 'uploading',
          });
        }
        certUrl = await generateAndUploadTeamMemberCertificate(event, team, member, customConfig);
        memberUrls[member.email || member.name] = certUrl;
      }

      // If member has email, attempt direct email dispatch
      if (validateEmail(member.email)) {
        if (onProgress) {
          onProgress({
            current: index,
            total,
            currentName: member.name,
            status: 'sending',
          });
        }
        const { subject, textBody, htmlBody } = buildCertificateEmailContent(
          event,
          { name: member.name, email: member.email },
          certUrl
        );
        await sendDirectEmail({
          to: member.email,
          subject,
          body: textBody,
          html: htmlBody,
          attachmentUrls: [certUrl],
        });
      }

      successful++;
      if (onProgress) {
        onProgress({
          current: index,
          total,
          currentName: member.name,
          status: 'completed',
        });
      }

      await new Promise((r) => setTimeout(r, 200));
    } catch (err: any) {
      failed++;
      console.error(`[sendTeamCertificates] Failed for member ${member.name}:`, err);
      if (onProgress) {
        onProgress({
          current: index,
          total,
          currentName: member.name,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  // Update team record inside event
  const updatedTeams = (event.teams || []).map((t) => {
    if (t.id === team.id) {
      return {
        ...t,
        memberCertificateUrls: memberUrls,
        certificatesSent: true,
      };
    }
    return t;
  });

  await updateEvent(event.id, { teams: updatedTeams });

  return {
    total,
    successful,
    failed,
    memberUrls,
  };
}

