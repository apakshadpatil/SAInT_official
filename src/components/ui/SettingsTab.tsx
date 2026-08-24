import { useState, useEffect } from 'react';
import type { EventRecord, TicketTier } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Archive,
  Send,
  Download,
  BarChart3,
  Boxes,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Paperclip,
  FileText,
  X,
  CheckCircle2,
  Edit3,
  Users2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Check,
} from 'lucide-react';
import { uploadDataUrlToSupabase, SUPABASE_BUCKET } from '../../utils/supabase';
import { sendDirectEmail, openWebMailClient, validateEmail } from '../../services/emailService';

interface SettingsTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  isSuperAdmin: boolean;
}

export default function SettingsTab({ event, onUpdate, isSuperAdmin }: SettingsTabProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);

  // Event Details State
  const [title, setTitle] = useState(event.title || '');
  const [description, setDescription] = useState(event.description || '');
  const [date, setDate] = useState(event.date || '');
  const [startTime, setStartTime] = useState(event.startTime || '');
  const [endTime, setEndTime] = useState(event.endTime || '');
  const [location, setLocation] = useState(event.location || '');
  const [venue, setVenue] = useState(event.venue || '');
  const [budget, setBudget] = useState(event.budget ? String(event.budget) : '');
  const [status, setStatus] = useState<EventRecord['status']>(event.status || 'published');
  const [imageURL, setImageURL] = useState(event.imageURL || '');
  const [enableDomainSelection, setEnableDomainSelection] = useState(event.enableDomainSelection || false);
  const [autoAllocateByDomain, setAutoAllocateByDomain] = useState(event.autoAllocateByDomain || false);

  // Team Event Orchestration State
  const [teamsEnabled, setTeamsEnabled] = useState(event.teamsEnabled || false);
  const [minTeamSize, setMinTeamSize] = useState<number>(event.minTeamSize || 2);
  const [maxTeamSize, setMaxTeamSize] = useState<number>(event.maxTeamSize || 4);
  const [requireTeamName, setRequireTeamName] = useState<boolean>(event.requireTeamName !== false);
  const [savingTeamsConfig, setSavingTeamsConfig] = useState(false);

  // Email State
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const participants = event.participants || [];

  useEffect(() => {
    setTitle(event.title || '');
    setDescription(event.description || '');
    setDate(event.date || '');
    setStartTime(event.startTime || '');
    setEndTime(event.endTime || '');
    setLocation(event.location || '');
    setVenue(event.venue || '');
    setBudget(event.budget ? String(event.budget) : '');
    setStatus(event.status || 'published');
    setImageURL(event.imageURL || '');
    setEnableDomainSelection(event.enableDomainSelection || false);
    setAutoAllocateByDomain(event.autoAllocateByDomain || false);
    setTeamsEnabled(event.teamsEnabled || false);
    setMinTeamSize(event.minTeamSize || 2);
    setMaxTeamSize(event.maxTeamSize || 4);
    setRequireTeamName(event.requireTeamName !== false);
  }, [event]);

  const handleSaveTeamsConfig = async (explicitEnable?: boolean) => {
    const isEnabling = explicitEnable !== undefined ? explicitEnable : teamsEnabled;
    const min = Math.max(2, Number(minTeamSize) || 2);
    const max = Math.max(min, Number(maxTeamSize) || min);

    if (isEnabling && min < 2) {
      showToast('Minimum team size must be at least 2 members', 'error');
      return;
    }
    if (isEnabling && max < min) {
      showToast('Maximum team size cannot be less than minimum team size', 'error');
      return;
    }

    setSavingTeamsConfig(true);
    try {
      // 1. Synchronize ticket tiers for each team size between min and max
      const existingTiers = event.ticketTiers || [];
      const updatedTiers: TicketTier[] = [];

      for (let size = min; size <= max; size++) {
        const existing = existingTiers.find((t) => t.teamSize === size);
        let tierLabel = '';
        if (size === 2) tierLabel = 'Duo (2 Members)';
        else if (size === 3) tierLabel = 'Trio (3 Members)';
        else if (size === 4) tierLabel = 'Squad (4 Members)';
        else tierLabel = `Team of ${size} Members`;

        if (existing) {
          updatedTiers.push({
            ...existing,
            teamSize: size,
            name: existing.name || tierLabel,
          });
        } else {
          updatedTiers.push({
            id: `tier_team_${size}_${Date.now()}`,
            name: tierLabel,
            teamSize: size,
            price: 0,
            description: `Registration pass for a ${size}-member team.`,
          });
        }
      }

      // 2. Ensure "Team Name" is injected into custom form builder if not present
      const existingFields = event.customFields || [];
      const hasTeamNameField = existingFields.some(
        (f) => f.label.toLowerCase().includes('team name') || f.id === 'field_team_name'
      );
      const nextFields = hasTeamNameField
        ? existingFields
        : [
            {
              id: 'field_team_name',
              label: 'Team Name',
              type: 'text' as const,
              required: true,
              placeholder: 'e.g. CyberKnights / CodeCrafters',
            },
            ...existingFields,
          ];

      await onUpdate({
        teamsEnabled: isEnabling,
        minTeamSize: min,
        maxTeamSize: max,
        requireTeamName,
        enableTieredTicketing: isEnabling ? true : event.enableTieredTicketing,
        ticketingEnabled: isEnabling ? true : event.ticketingEnabled,
        ticketTiers: isEnabling ? updatedTiers : event.ticketTiers,
        customFields: isEnabling ? nextFields : event.customFields,
      });

      setTeamsEnabled(isEnabling);
      setMinTeamSize(min);
      setMaxTeamSize(max);

      showToast(
        isEnabling
          ? `Team Event mode activated! Orchestrated ${updatedTiers.length} tier(s) (${min}-${max} members), registration form, and ticketing.`
          : 'Team Event mode turned off.',
        'success'
      );
    } catch (err) {
      showToast('Failed to update team event configuration', 'error');
    } finally {
      setSavingTeamsConfig(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--dash-border)' }}>
        <p style={{ color: 'var(--dash-muted)' }}>Only superadmins can access event settings</p>
      </div>
    );
  }

  const handleSaveEventDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Event title is required', 'error');
      return;
    }
    if (!date) {
      showToast('Event date is required', 'error');
      return;
    }

    setLoading(true);
    try {
      await onUpdate({
        title: title.trim(),
        description: description.trim(),
        date,
        startTime,
        endTime,
        location: location.trim(),
        venue: venue.trim(),
        budget: budget ? Number(budget) : undefined,
        status,
        imageURL: imageURL.trim() || undefined,
        enableDomainSelection,
        autoAllocateByDomain
      });
      showToast('Event details and schedule saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save event details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    setUploadingAttachment(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target?.result as string;
          const dest = `attachments/${event.id}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const publicUrl = await uploadDataUrlToSupabase(dataUrl, dest, file.name, SUPABASE_BUCKET);
          setAttachedFile({ name: file.name, url: publicUrl, size: file.size });
          showToast(`Attached ${file.name} successfully!`, 'success');
        } catch (uploadErr) {
          showToast('Failed to upload file to storage', 'error');
        } finally {
          setUploadingAttachment(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingAttachment(false);
      showToast('Failed to process file', 'error');
    }
  };

  const handleBulkEmail = async () => {
    if (!emailBody.trim()) {
      showToast('Please enter an email message', 'error');
      return;
    }

    const recipientEmails = participants.map((p) => p.email).filter(validateEmail);

    if (recipientEmails.length === 0) {
      showToast('No registered participant emails found', 'error');
      return;
    }

    setSendingBulkEmail(true);
    try {
      let fullBody = emailBody;
      if (attachedFile) {
        fullBody += `\n\n---------------------------------------\nATTACHED DOCUMENT / RESOURCE:\nFile: ${attachedFile.name}\nDownload Link: ${attachedFile.url}\n---------------------------------------`;
      }

      const subject = emailSubject || `Updates: ${event.title}`;

      // Try direct API dispatch
      const apiResult = await sendDirectEmail({
        to: recipientEmails[0],
        bcc: recipientEmails.slice(1),
        subject,
        body: fullBody,
        attachmentUrls: attachedFile ? [attachedFile.url] : undefined,
      });

      if (apiResult.success) {
        showToast(`Email dispatched to ${recipientEmails.length} participants!`, 'success');
      } else {
        openWebMailClient({
          bcc: recipientEmails,
          subject,
          body: fullBody,
          client: 'default',
        });
        showToast(`Prepared email for ${recipientEmails.length} participants`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch email', 'error');
    } finally {
      setSendingBulkEmail(false);
    }
  };

  const handleCopyAllEmails = () => {
    const participants = event.participants || [];
    const emails = participants.map((p) => p.email).filter(Boolean).join(', ');
    if (!emails) {
      showToast('No participant emails found', 'error');
      return;
    }
    navigator.clipboard.writeText(emails);
    showToast(`Copied ${participants.length} email addresses to clipboard!`, 'success');
  };

  const handleToggleDomainSelection = async () => {
    try {
      await onUpdate({ enableDomainSelection: !event.enableDomainSelection });
      showToast('Domain selection setting updated', 'success');
    } catch {
      showToast('Failed to update domain selection setting', 'error');
    }
  };

  const handleArchiveEvent = async () => {
    if (!window.confirm('Archive this event? It will no longer appear in the active events list.')) return;

    setLoading(true);
    try {
      await onUpdate({
        status: 'cancelled',
      });
      showToast('Event archived successfully', 'success');
    } catch (err) {
      showToast('Failed to archive event', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAttendees = () => {
    try {
      const rows = (event.participants || []).map((participant) => [
        participant.name,
        participant.email,
        participant.arrived ? 'Arrived' : 'Pending',
        participant.arrivedAt || '',
        [participant.college, participant.department].filter(Boolean).join(' / '),
      ]);

      const attendeeData = [
        ['Name', 'Email', 'Status', 'Arrival Time', 'Department'].join(','),
        ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([attendeeData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${event.title}-${Date.now()}.csv`;
      a.click();
      showToast('Attendee list exported', 'success');
    } catch (err) {
      showToast('Failed to export attendees', 'error');
    }
  };

  const checkedIn = participants.filter((p) => p.arrived).length;

  return (
    <div className="space-y-6">
      {/* 1. Event Information & Schedule Editor */}
      <form onSubmit={handleSaveEventDetails} className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <h4 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Edit3 className="w-5 h-5 text-blue-500" />
              Event Details &amp; Schedule Settings
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Change the event title, description, date, timing, venue, budget, and publishing status.
            </p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary !text-xs !py-2 !px-4 flex items-center gap-2 cursor-pointer">
            <CheckCircle2 className="w-4 h-4" />
            {loading ? 'Saving Changes...' : 'Save Event Details'}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
              Event Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input-field w-full text-sm font-bold"
              placeholder="e.g. HackSAInT 2026 Hackathon"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
              Event Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-field w-full text-xs"
              placeholder="Detailed description of the event..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
              <Calendar className="w-3.5 h-3.5 text-blue-500" /> Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input-field w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
              Event Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventRecord['status'])}
              className="input-field w-full text-xs"
            >
              <option value="draft">Draft (Hidden from Public)</option>
              <option value="published">Published (Open for Registration)</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled / Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
              <Clock className="w-3.5 h-3.5 text-indigo-500" /> Start Time *
            </label>
            <input
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              placeholder="e.g. 10:00 AM"
              className="input-field w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
              <Clock className="w-3.5 h-3.5 text-indigo-500" /> End Time *
            </label>
            <input
              type="text"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              placeholder="e.g. 5:00 PM"
              className="input-field w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
              <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Location / City
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. JSPM RSCOE, Pune"
              className="input-field w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
              <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Specific Venue / Hall
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. IT Department Seminar Hall"
              className="input-field w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
              <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Allocated Budget (₹)
            </label>
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 25000"
              className="input-field w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
              Banner Image URL
            </label>
            <input
              type="text"
              value={imageURL}
              onChange={(e) => setImageURL(e.target.value)}
              placeholder="https://..."
              className="input-field w-full text-xs"
            />
          </div>
        </div>
      </form>

      {/* 2. Team Event Mode & Dynamic Orchestration */}
      <div
        className="rounded-2xl border p-6 space-y-4"
        style={{
          borderColor: teamsEnabled ? 'rgba(59, 130, 246, 0.4)' : 'var(--dash-border)',
          background: teamsEnabled
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), var(--dash-card))'
            : 'var(--dash-card)',
        }}
      >
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b"
          style={{ borderColor: 'var(--dash-border)' }}
        >
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <Users2 className="w-5 h-5 text-blue-500" />
                Team Event Mode &amp; Orchestrator
              </h4>
              {teamsEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Turn this event into a team competition. Automatically orchestrates ticket tiers, team registration forms, QR payments, and certificate generation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleSaveTeamsConfig(!teamsEnabled)}
            disabled={savingTeamsConfig}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              teamsEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {teamsEnabled ? (
              <>
                <ToggleRight className="w-5 h-5 text-white" />
                Team Event: Enabled
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5 text-slate-400" />
                Turn On Team Event
              </>
            )}
          </button>
        </div>

        {teamsEnabled && (
          <div className="space-y-4 pt-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Minimum Team Size (Members) *
                </label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={minTeamSize}
                  onChange={(e) => setMinTeamSize(Math.max(2, parseInt(e.target.value) || 2))}
                  className="input-field w-full text-xs font-bold"
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                  Smallest group size permitted (e.g. 2 for Duo).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Maximum Team Size (Members) *
                </label>
                <input
                  type="number"
                  min={minTeamSize}
                  max="50"
                  value={maxTeamSize}
                  onChange={(e) => setMaxTeamSize(Math.max(minTeamSize, parseInt(e.target.value) || minTeamSize))}
                  className="input-field w-full text-xs font-bold"
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                  Largest group size permitted (e.g. 4 for Squad).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="requireTeamNameCheck"
                checked={requireTeamName}
                onChange={(e) => setRequireTeamName(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="requireTeamNameCheck" className="text-xs font-medium cursor-pointer" style={{ color: 'var(--dash-text)' }}>
                Require Team Name during registration
              </label>
            </div>

            {/* Orchestration Summary Banner */}
            <div
              className="rounded-xl border p-3.5 space-y-2"
              style={{ borderColor: 'rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.03)' }}
            >
              <p className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                <Sparkles className="w-3.5 h-3.5" />
                Interlinked Orchestration Capabilities:
              </p>
              <ul className="text-[11px] space-y-1.5" style={{ color: 'var(--dash-muted)' }}>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <strong>Ticketing Studio:</strong> Automatically creates {Math.max(1, maxTeamSize - minTeamSize + 1)} team tier passes ({minTeamSize} to {maxTeamSize} members) with individual QR code upload and custom pricing.
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <strong>Registration Form:</strong> Automatically gathers Team Name and individual details (Name, Email, Phone, College, Dept) for each member.
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <strong>Teams Studio:</strong> Enables group check-ins, roster management, CSV exports, and team-branded credential generation.
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSaveTeamsConfig(true)}
                disabled={savingTeamsConfig}
                className="btn-primary !text-xs !py-2 !px-5 flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                {savingTeamsConfig ? 'Synchronizing All Modules...' : 'Save & Synchronize All Modules'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Bulk Email with Document Attachments */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <h4 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Send className="w-5 h-5 text-blue-500" />
              Bulk Email Dispatcher &amp; Document Attachments
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Attach guideline PDFs, schedules, or rulebooks and email all {participants.length} registered participants.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyAllEmails}
            className="btn-secondary !text-xs !py-1.5 !px-3 shrink-0 cursor-pointer"
          >
            Copy All {participants.length} Emails
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
              Email Subject
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="input-field w-full text-xs font-medium"
              placeholder="Email subject..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
              Email Body
            </label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="input-field w-full text-xs min-h-32"
              placeholder="Email message..."
            />
          </div>

          {/* Attachment Box */}
          <div className="p-3.5 rounded-xl border space-y-2 bg-slate-900/30" style={{ borderColor: 'var(--dash-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" /> Document Attachment
              </span>
              <label className="text-xs text-blue-400 hover:underline cursor-pointer flex items-center gap-1">
                <span>{uploadingAttachment ? 'Uploading...' : attachedFile ? 'Replace Document' : '+ Attach Document'}</span>
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleAttachmentUpload(e.target.files[0])}
                  className="hidden"
                  disabled={uploadingAttachment}
                />
              </label>
            </div>

            {attachedFile ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-800/40 border-slate-700/60 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium text-white truncate">{attachedFile.name}</span>
                  {attachedFile.size && (
                    <span className="text-[10px] text-slate-400">
                      ({Math.round(attachedFile.size / 1024)} KB)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={attachedFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    View
                  </a>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                Attach a PDF, DOCX, ZIP, or image. A permanent high-speed download link will be inserted directly in the outgoing email.
              </p>
            )}
          </div>

          <button
            onClick={handleBulkEmail}
            disabled={loading || sendingBulkEmail || !emailBody.trim()}
            className="btn-primary w-full !py-2.5 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sendingBulkEmail ? 'Dispatching Emails...' : `Send Email with Attachment to ${participants.length} Participants`}
          </button>
        </div>
      </div>

      {/* 3. Event Statistics */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <h4 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--dash-text)' }}>
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          Event Statistics
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>Total Participants</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
              {participants.length}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>Tickets Generated</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
              {participants.length}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>Checked In</p>
            <p className="text-2xl font-bold mt-1 text-green-500">{checkedIn}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>Check-in Rate</p>
            <p className="text-2xl font-bold mt-1 text-blue-500">
              {participants.length ? Math.round((checkedIn / participants.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* 4. Domain & Space Controls */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
          <Boxes className="w-5 h-5 text-emerald-500" />
          Domains &amp; Space Allocation
        </h4>
        <div className="flex items-center justify-between rounded-xl p-4 border" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <p className="font-medium text-xs sm:text-sm" style={{ color: 'var(--dash-text)' }}>Enable Domain Selection</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>Allow participants to choose a domain during registration.</p>
          </div>
          <button
            onClick={handleToggleDomainSelection}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${event.enableDomainSelection ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            {event.enableDomainSelection ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* 5. Export Data & Archive */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <h4 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <Download className="w-4 h-4 text-blue-500" />
            Export Attendee Records
          </h4>
          <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
            Download a formatted CSV spreadsheet of all registered attendees, arrival status, and department details.
          </p>
          <button onClick={handleExportAttendees} className="btn-secondary !text-xs !py-2 w-full cursor-pointer">
            Export Attendees (CSV)
          </button>
        </div>

        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' }}>
          <h4 className="font-semibold text-sm flex items-center gap-2 text-red-500">
            <Archive className="w-4 h-4" />
            Archive Event
          </h4>
          <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
            Hide this event from public discovery and active lists while preserving historical tickets and attendee logs.
          </p>
          <button onClick={handleArchiveEvent} className="btn-secondary !text-xs !py-2 text-red-400 border-red-500/30 hover:bg-red-500/10 w-full cursor-pointer">
            Archive Event
          </button>
        </div>
      </div>
    </div>
  );
}
