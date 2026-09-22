import { useState, useEffect, useRef } from 'react';
import type { EventRecord, TicketTier, RegistrationFieldsConfig, EventCoordinatorContact } from '../../types';
import { getEventCoordinators } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessEventSettings } from '../../utils/permissions';
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
  ShieldCheck,
  Trash2,
  Upload,
  Image as ImageIcon,
  SlidersVertical,
  Link as LinkIcon,
  RefreshCw,
  Save,
  ClipboardList,
  Info,
  User,
  Phone,
  Plus,
} from 'lucide-react';
import { uploadDataUrlToSupabase, uploadFileToSupabase, SUPABASE_BUCKET } from '../../utils/supabase';
import { uploadFileToStorage, formatFileSize } from '../../utils/fileUtils';
import { compressEventBanner } from '../../utils/imageOptimizer';
import { sendDirectEmail, openWebMailClient, validateEmail } from '../../services/emailService';
import { isValidRegistrationUrl } from '../../utils/urlValidation';

interface SettingsTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  isSuperAdmin?: boolean;
  canManageSettings?: boolean;
  onDelete?: () => Promise<void>;
}

export default function SettingsTab({
  event,
  onUpdate,
  isSuperAdmin: propIsSuperAdmin,
  canManageSettings: propCanManageSettings,
  onDelete,
}: SettingsTabProps) {
  const { profile } = useAuth();
  const canAccess =
    propCanManageSettings !== undefined
      ? propCanManageSettings
      : Boolean(propIsSuperAdmin || canAccessEventSettings(profile));
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const [registrationUrl, setRegistrationUrl] = useState(event.registrationUrl || '');
  const [enableDomainSelection, setEnableDomainSelection] = useState(event.enableDomainSelection || false);
  const [autoAllocateByDomain, setAutoAllocateByDomain] = useState(event.autoAllocateByDomain || false);

  // Event Coordinators / Contact Persons State
  const [coordinators, setCoordinators] = useState<EventCoordinatorContact[]>(() => getEventCoordinators(event));

  const handleAddCoordinator = () => {
    setCoordinators((prev) => [...prev, { name: '', phone: '' }]);
  };

  const handleRemoveCoordinator = (index: number) => {
    setCoordinators((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCoordinator = (index: number, field: 'name' | 'phone', value: string) => {
    setCoordinators((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Event Banner Upload State
  const [bannerUploading, setBannerUploading] = useState(false);
  const [showManualBannerUrl, setShowManualBannerUrl] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Registration Form Fields Configuration State
  const getInitialRegFields = (evt: EventRecord): RegistrationFieldsConfig => ({
    name: {
      enabled: evt.registrationFields?.name?.enabled ?? true,
      required: evt.registrationFields?.name?.required ?? true,
      label: evt.registrationFields?.name?.label ?? '',
    },
    email: {
      enabled: evt.registrationFields?.email?.enabled ?? true,
      required: evt.registrationFields?.email?.required ?? false,
      label: evt.registrationFields?.email?.label ?? '',
    },
    phone: {
      enabled: evt.registrationFields?.phone?.enabled ?? true,
      required: evt.registrationFields?.phone?.required ?? false,
      label: evt.registrationFields?.phone?.label ?? '',
    },
    college: {
      enabled: evt.registrationFields?.college?.enabled ?? true,
      required: evt.registrationFields?.college?.required ?? false,
      label: evt.registrationFields?.college?.label ?? '',
    },
    department: {
      enabled: evt.registrationFields?.department?.enabled ?? true,
      required: evt.registrationFields?.department?.required ?? false,
      label: evt.registrationFields?.department?.label ?? '',
    },
    year: {
      enabled: evt.registrationFields?.year?.enabled ?? false,
      required: evt.registrationFields?.year?.required ?? false,
      label: evt.registrationFields?.year?.label ?? '',
    },
  });

  const getInitialTerms = (evt: EventRecord) => {
    if (evt.registrationTerms?.trim()) return evt.registrationTerms;
    if (evt.rules?.length) return evt.rules.join('\n\n');
    return '';
  };

  const [regFields, setRegFields] = useState<RegistrationFieldsConfig>(getInitialRegFields(event));
  const [registrationTerms, setRegistrationTerms] = useState<string>(getInitialTerms(event));
  const [savingRegSettings, setSavingRegSettings] = useState(false);

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
    setRegistrationUrl(event.registrationUrl || '');
    setEnableDomainSelection(event.enableDomainSelection || false);
    setAutoAllocateByDomain(event.autoAllocateByDomain || false);
    setTeamsEnabled(event.teamsEnabled || false);
    setMinTeamSize(event.minTeamSize || 2);
    setMaxTeamSize(event.maxTeamSize || 4);
    setRequireTeamName(event.requireTeamName !== false);
    setRegFields(getInitialRegFields(event));
    setRegistrationTerms(getInitialTerms(event));
    setCoordinators(getEventCoordinators(event));
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

  if (!canAccess) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--dash-border)' }}>
        <p style={{ color: 'var(--dash-muted)' }}>Only superadmins and core team members can access event settings</p>
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
    if (registrationUrl && !isValidRegistrationUrl(registrationUrl)) {
      showToast('Please enter a valid external registration URL (https://...).', 'error');
      return;
    }

    // Validate coordinators
    for (let i = 0; i < coordinators.length; i++) {
      const c = coordinators[i];
      const nameTrim = c.name.trim();
      const phoneTrim = c.phone.trim();
      if (nameTrim || phoneTrim) {
        if (!nameTrim) {
          showToast(`Please enter a name for Coordinator #${i + 1}`, 'error');
          return;
        }
        if (!phoneTrim) {
          showToast(`Please enter a contact number for Coordinator #${i + 1}`, 'error');
          return;
        }
        const digits = phoneTrim.replace(/\D/g, '');
        if (digits.length < 10) {
          showToast(`Please enter a valid 10-digit mobile number for Coordinator #${i + 1}`, 'error');
          return;
        }
      }
    }

    const cleanCoordinators = coordinators
      .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }))
      .filter((c) => c.name && c.phone);

    setLoading(true);
    try {
      const trimmedImage = imageURL.trim();
      const updatePayload: Partial<EventRecord> = {
        title: title.trim(),
        description: description.trim(),
        date,
        startTime,
        endTime,
        location: location.trim(),
        venue: venue.trim(),
        budget: budget ? Number(budget) : undefined,
        status,
        imageURL: trimmedImage,
        registrationUrl: registrationUrl.trim() || '',
        enableDomainSelection,
        autoAllocateByDomain,
        registrationFields: regFields,
        coordinators: cleanCoordinators,
        eventCoordinatorContacts: cleanCoordinators,
      };
      // Keep registrationBannerUrl in sync if main event banner was updated
      if (trimmedImage !== (event.imageURL || '')) {
        updatePayload.registrationBannerUrl = trimmedImage;
      }
      await onUpdate(updatePayload);
      showToast('Event details and schedule saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save event details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBannerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast('Unsupported file type. Please select a PNG, JPG, JPEG, or WebP image.', 'error');
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast(`Image file is too large (${formatFileSize(file.size)}). Max allowed size is 5MB.`, 'error');
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
      return;
    }

    // Inspect image aspect ratio before upload
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load image preview'));
        };
        img.src = objectUrl;
      });

      const ratio = dimensions.width / dimensions.height;
      // 16:9 is ~1.778. Give a warning if ratio is significantly non-16:9.
      if (ratio < 1.45 || ratio > 2.05) {
        showToast(
          `Notice: Uploaded image is ${dimensions.width}×${dimensions.height} (ratio ${ratio.toFixed(2)}:1). Recommended standard is 16:9 (e.g. 1920×1080). Image will be accepted, but may crop to 16:9.`,
          'info'
        );
      }
    } catch {
      // Proceed even if dimension check fails
    }

    setBannerUploading(true);
    try {
      const fileToUpload = await compressEventBanner(file);
      const ext = fileToUpload.type === 'image/webp' ? 'webp' : (fileToUpload.name.split('.').pop() || 'png');
      const dest = `banners/${event.id}_${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFileToSupabase(fileToUpload, dest);
      } catch (err) {
        console.warn('Supabase upload failed, falling back to Firebase Storage...', err);
        publicUrl = await uploadFileToStorage(fileToUpload, dest);
      }
      setImageURL(publicUrl);
      await onUpdate({ imageURL: publicUrl, registrationBannerUrl: publicUrl });
      showToast('Event banner uploaded and saved successfully!', 'success');
    } catch (err: any) {
      console.error('Banner upload failed:', err);
      showToast(err.message || 'Failed to upload event banner', 'error');
    } finally {
      setBannerUploading(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  const handleRemoveBanner = async () => {
    if (!window.confirm('Are you sure you want to remove this event banner image?')) return;
    setImageURL('');
    try {
      await onUpdate({ imageURL: '', registrationBannerUrl: '' });
      showToast('Event banner removed successfully', 'info');
    } catch {
      showToast('Failed to remove event banner', 'error');
    }
  };

  const handleToggleRegField = (key: keyof RegistrationFieldsConfig, prop: 'enabled' | 'required') => {
    setRegFields((prev) => {
      const current = prev[key] || { enabled: true, required: false };
      if (prop === 'enabled') {
        const nextEnabled = !current.enabled;
        return {
          ...prev,
          [key]: {
            ...current,
            enabled: nextEnabled,
            // If field is disabled, it cannot be required
            required: nextEnabled ? current.required : false,
          },
        };
      } else {
        return {
          ...prev,
          [key]: {
            ...current,
            required: !current.required,
          },
        };
      }
    });
  };

  const handleUpdateRegFieldLabel = (key: keyof RegistrationFieldsConfig, label: string) => {
    setRegFields((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { enabled: true, required: false }),
        label,
      },
    }));
  };

  const handleSaveRegistrationSettings = async () => {
    setSavingRegSettings(true);
    try {
      const cleanTerms = registrationTerms.trim();
      await onUpdate({
        registrationFields: regFields,
        registrationUrl: registrationUrl.trim() || '',
        registrationTerms: cleanTerms,
        rules: cleanTerms ? cleanTerms.split('\n').map((l) => l.trim()).filter(Boolean) : [],
      });
      showToast('Registration settings and terms saved successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save registration settings', 'error');
    } finally {
      setSavingRegSettings(false);
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
      {/* Access Permission Status Banner */}
      <div
        className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{
          borderColor: 'rgba(16, 185, 129, 0.25)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), var(--dash-card))',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>
                Event Administration &amp; Settings
              </p>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Core &amp; Admin Full Access
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Core members and administrators have full permission to modify event information, team orchestrator, bulk communications, domain controls, and export records.
            </p>
          </div>
        </div>
      </div>

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

          {/* Event Coordinators / Contact Persons */}
          <div className="sm:col-span-2 pt-4 border-t" style={{ borderColor: 'var(--dash-border)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <label className="block text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                  <Users2 className="w-4 h-4 text-blue-500" />
                  Event Coordinators / Contact Persons
                </label>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                  Add student or faculty coordinator names and mobile numbers. They will be displayed publicly with direct call links on the Details and Register pages.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCoordinator}
                className="btn-secondary !text-xs !py-1.5 !px-3 self-start sm:self-auto flex items-center gap-1.5 cursor-pointer hover:bg-blue-600/10 hover:text-blue-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Coordinator
              </button>
            </div>

            {coordinators.length === 0 ? (
              <div
                className="rounded-xl border border-dashed p-4 text-center text-xs"
                style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}
              >
                No coordinators added yet. Click &quot;Add Coordinator&quot; above to provide event contact persons.
              </div>
            ) : (
              <div className="space-y-3">
                {coordinators.map((coord, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 rounded-xl border"
                    style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card-bg, rgba(255,255,255,0.02))' }}
                  >
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Coordinator Name *
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={coord.name}
                          onChange={(e) => handleUpdateCoordinator(index, 'name', e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="input-field w-full text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Mobile / Contact Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={coord.phone}
                          onChange={(e) => handleUpdateCoordinator(index, 'phone', e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="input-field w-full text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div className="sm:self-end pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleRemoveCoordinator(index)}
                        className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-colors flex items-center gap-1 text-xs cursor-pointer w-full sm:w-auto justify-center"
                        title="Remove coordinator"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden">Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </form>

      {/* 2. Event Banner & Cover Image (Image Upload) */}
      <div
        className="rounded-2xl border p-6 space-y-4"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <ImageIcon className="w-5 h-5 text-blue-500" />
                Event Banner &amp; Cover Visual
              </h4>
              {imageURL && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Banner Active
                </span>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Main event header banner displayed on the event details page, dashboard cards, and public explore portal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={bannerFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleBannerFileSelect}
              className="hidden"
            />
            {imageURL ? (
              <>
                <button
                  type="button"
                  onClick={() => bannerFileInputRef.current?.click()}
                  disabled={bannerUploading}
                  className="btn-secondary !text-xs !py-1.5 !px-3 flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Replace Banner
                </button>
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  disabled={bannerUploading}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => bannerFileInputRef.current?.click()}
                disabled={bannerUploading}
                className="btn-primary !text-xs !py-1.5 !px-4 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <Upload className="w-3.5 h-3.5" />
                {bannerUploading ? 'Uploading Banner...' : 'Upload Event Banner'}
              </button>
            )}
          </div>
        </div>

        {/* Banner Dimension Guidance */}
        <div className="rounded-xl border p-3 flex items-start gap-2.5 bg-blue-500/5 border-blue-500/20 text-xs">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-blue-300">
              Recommended size: 1920 × 1080 px (16:9 aspect ratio)
            </p>
            <p style={{ color: 'var(--dash-muted)' }}>
              Also accepts 1280 × 720 px or any 16:9 image. For best results, keep important text and logos away from extreme edges.
            </p>
          </div>
        </div>

        {/* Upload Container & Preview */}
        {imageURL ? (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 group aspect-video max-h-72">
              <img
                src={imageURL}
                alt={title || 'Event Banner'}
                className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <p className="text-xs text-white font-medium">
                  Aspect Ratio: 16:9 • Recommended resolution: 1920×1080 px
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--dash-muted)' }}>
              <span className="truncate max-w-md">Source: {imageURL}</span>
              <button
                type="button"
                onClick={() => setShowManualBannerUrl(!showManualBannerUrl)}
                className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer text-xs"
              >
                <LinkIcon className="w-3 h-3" />
                {showManualBannerUrl ? 'Hide URL Editor' : 'Edit URL directly'}
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !bannerUploading && bannerFileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all space-y-3 group"
            style={{ borderColor: 'var(--dash-border)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              {bannerUploading ? (
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              ) : (
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--dash-text)' }}>
                {bannerUploading ? 'Uploading your banner to cloud storage...' : 'Click to Upload Event Banner Image'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                PNG, JPG, JPEG, or WebP up to 5MB (1920×1080 px recommended, 16:9)
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-xs text-blue-400 font-semibold group-hover:underline">
                Browse file from computer →
              </span>
              <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>•</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowManualBannerUrl(!showManualBannerUrl);
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Paste Image URL
              </button>
            </div>
          </div>
        )}

        {/* Optional Manual URL input */}
        {showManualBannerUrl && (
          <div className="p-3.5 rounded-xl border bg-slate-900/40 space-y-2 animate-fade-in" style={{ borderColor: 'var(--dash-border)' }}>
            <label className="block text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
              Direct Banner Image URL (External / Hosted)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imageURL}
                onChange={(e) => setImageURL(e.target.value)}
                placeholder="https://..."
                className="input-field flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => onUpdate({ imageURL: imageURL.trim(), registrationBannerUrl: imageURL.trim() }).then(() => showToast('Banner URL saved!', 'success'))}
                className="btn-secondary !text-xs !py-1.5 !px-3 shrink-0"
              >
                Apply URL
              </button>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
              Provide a direct image URL if your banner is hosted on an external CDN.
            </p>
          </div>
        )}
      </div>

      {/* 3. Registration Settings & Form Fields Configuration */}
      <div
        className="rounded-2xl border p-6 space-y-5"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <SlidersVertical className="w-5 h-5 text-indigo-500" />
                Registration Settings &amp; Form Fields
              </h4>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                Customizable per Event
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Configure which registration fields are enabled, whether they are mandatory or optional, and registration flow rules.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveRegistrationSettings}
            disabled={savingRegSettings}
            className="btn-primary !text-xs !py-2 !px-4 flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20"
          >
            {savingRegSettings ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving Fields...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Registration Settings
              </>
            )}
          </button>
        </div>

        {/* External Registration Link Setting */}
        <div className="p-4 rounded-xl border space-y-2 bg-slate-900/30" style={{ borderColor: 'var(--dash-border)' }}>
          <label className="block text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
            External Registration URL (Optional Override)
          </label>
          <input
            type="url"
            value={registrationUrl}
            onChange={(e) => setRegistrationUrl(e.target.value)}
            placeholder="https://unstop.com/... or https://forms.gle/..."
            className="input-field w-full text-xs"
          />
          <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
            If set, clicking "Register" on the public event page redirects directly to this external portal. Leave empty to use SAInT's built-in digital pass registration flow.
          </p>
        </div>

        {/* Registration Form Fields Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-blue-400" />
              Registration Form Fields Configuration
            </h5>
            <span className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
              Controls both solo registrations and team member entry fields
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-slate-900/60" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}>
                  <th className="py-3 px-4 font-bold">Field Name</th>
                  <th className="py-3 px-4 font-bold">Custom Label</th>
                  <th className="py-3 px-4 font-bold">Purpose &amp; Usage</th>
                  <th className="py-3 px-4 font-bold text-center">Show on Form</th>
                  <th className="py-3 px-4 font-bold text-center">Required</th>
                  <th className="py-3 px-4 font-bold text-right">Field Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
                {[
                  {
                    key: 'name' as const,
                    label: 'Full Name',
                    desc: 'Primary attendee / team leader / member identification',
                    lockedEnabled: true,
                  },
                  {
                    key: 'email' as const,
                    label: 'Email Address',
                    desc: 'Ticket delivery, QR pass updates, rulebook distribution',
                  },
                  {
                    key: 'phone' as const,
                    label: 'Phone Number',
                    desc: 'Direct communication, team coordination, emergency contact',
                  },
                  {
                    key: 'college' as const,
                    label: 'College / Institute',
                    desc: 'Participant university or educational institution',
                  },
                  {
                    key: 'department' as const,
                    label: 'Department / Branch',
                    desc: 'Academic department (e.g. IT, Computer Engineering, AI/DS)',
                  },
                  {
                    key: 'year' as const,
                    label: 'Year of Study',
                    desc: 'Class standing (e.g. 1st Year, 2nd Year, 3rd Year, 4th Year)',
                  },
                ].map((field) => {
                  const cfg = regFields[field.key] || { enabled: true, required: false };
                  const isEnabled = cfg.enabled;
                  const isRequired = cfg.required;

                  return (
                    <tr
                      key={field.key}
                      className="hover:bg-slate-900/30 transition-colors"
                      style={{ color: 'var(--dash-text)' }}
                    >
                      <td className="py-3.5 px-4 font-bold">
                        <div className="flex items-center gap-2">
                          <span>{field.label}</span>
                          {field.lockedEnabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal">
                              Core
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={cfg.label || ''}
                          onChange={(e) => handleUpdateRegFieldLabel(field.key, e.target.value)}
                          placeholder={field.label}
                          maxLength={60}
                          className="input-field w-full text-xs !py-1.5 !px-2.5"
                          style={{ minWidth: '130px' }}
                          title="Custom label shown on the registration form. Leave empty to use the default."
                        />
                        {cfg.label && cfg.label.trim() !== '' && (
                          <p className="text-[10px] mt-0.5 text-emerald-400">✓ Custom label active</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                        {field.desc}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => !field.lockedEnabled && handleToggleRegField(field.key, 'enabled')}
                          disabled={field.lockedEnabled}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${field.lockedEnabled
                              ? 'bg-blue-600/30 text-blue-300 cursor-not-allowed opacity-80'
                              : isEnabled
                                ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                          {isEnabled ? <Check className="w-3.5 h-3.5" /> : null}
                          {isEnabled ? 'ON' : 'OFF'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRegField(field.key, 'required')}
                          disabled={!isEnabled}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${!isEnabled
                              ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                              : isRequired
                                ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                          {isRequired ? <Check className="w-3.5 h-3.5" /> : null}
                          {isRequired ? 'REQUIRED' : 'OPTIONAL'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isEnabled ? (
                          <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Hidden from Form
                          </span>
                        ) : isRequired ? (
                          <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Visible • Mandatory
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Visible • Optional
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
            Tip: If a field is set to "Hidden from Form", it will not be displayed on the public registration page or requested from teammates.
          </p>
        </div>

        {/* Registration Terms & Conditions Text Area */}
        <div className="p-4 sm:p-5 rounded-xl border space-y-2.5 bg-slate-900/30" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Registration Terms &amp; Conditions
            </label>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono text-slate-400 bg-slate-800">
              One Large Text Area
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
            Enter all registration rules, requirements, code of conduct, and guidelines as one complete text block. Sub-rules, numbered items, paragraphs, and formatting are displayed naturally on the registration page.
          </p>
          <textarea
            value={registrationTerms}
            onChange={(e) => setRegistrationTerms(e.target.value)}
            rows={8}
            placeholder="1. Provide accurate registration details and carry your QR pass to the event.&#10;2. Follow the event schedule and venue instructions.&#10;3. Maintain respectful conduct throughout the event.&#10;&#10;Additional rules, eligibility, and instructions..."
            className="input-field w-full text-xs font-sans leading-relaxed resize-y min-h-[160px]"
          />
        </div>
      </div>

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
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${teamsEnabled
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

      {/* 5. Export Data, Archive & Danger Zone */}
      <div className={`grid gap-4 ${onDelete ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
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

        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.03)' }}>
          <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-500">
            <Archive className="w-4 h-4" />
            Archive Event
          </h4>
          <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
            Hide this event from public discovery and active lists while preserving historical tickets and attendee logs.
          </p>
          <button onClick={handleArchiveEvent} className="btn-secondary !text-xs !py-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 w-full cursor-pointer">
            Archive Event
          </button>
        </div>

        {onDelete && (
          <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
            <h4 className="font-semibold text-sm flex items-center gap-2 text-red-500">
              <Trash2 className="w-4 h-4" />
              Delete Event
            </h4>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Permanently erase this event and all associated records from the database.
            </p>
            <button
              onClick={async () => {
                setDeleting(true);
                try {
                  await onDelete();
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="btn-secondary !text-xs !py-2 text-red-400 border-red-500/30 hover:bg-red-500/10 w-full cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete Event (Permanent)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
