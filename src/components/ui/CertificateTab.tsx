import { useEffect, useRef, useState } from 'react';
import type { EventRecord, CertificateConfig, EventParticipant } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  renderCertificateCanvas,
  downloadCertificate,
  downloadAllCertificatesAsZip,
  DEFAULT_CERTIFICATE_CONFIG,
} from '../../utils/certificateGenerator';
import {
  uploadFileToSupabase,
  removeFileFromSupabase,
  SUPABASE_BUCKET,
} from '../../utils/supabase';
import {
  sendParticipantCertificate,
  sendBulkCertificates,
  type BulkCertificateProgress,
} from '../../services/emailService';
import {
  Award,
  Download,
  Upload,
  Send,
  CheckCircle2,
  Sparkles,
  Sliders,
  Mail,
  AlertTriangle,
  Trash2,
  ExternalLink,
  RefreshCw,
  Copy,
  Users,
  Eye,
  Check,
  X,
  FileCheck,
  FolderArchive,
} from 'lucide-react';

interface CertificateTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function CertificateTab({ event, onUpdate, canEdit }: CertificateTabProps) {
  const { showToast } = useToast();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Flag to prevent the external config sync effect from overwriting local config
  // when we are the ones who just triggered the update (avoids reload loop).
  const suppressConfigSyncRef = useRef(false);

  const [config, setConfig] = useState<CertificateConfig>({
    ...DEFAULT_CERTIFICATE_CONFIG,
    ...(event.certificateConfig || {}),
  });

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('Alex Johnson');
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkCertificateProgress | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    issuedUrls: Array<{ id: string; name: string; email: string; url: string }>;
  } | null>(null);

  // Single Participant Email Modal State
  const [emailModalParticipant, setEmailModalParticipant] = useState<EventParticipant | null>(null);
  const [sendingSingleEmail, setSendingSingleEmail] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const participants = event.participants || [];
  const arrivedParticipants = participants.filter((p) => p.arrived);
  const hasUploadedTemplate = Boolean(config.templateUrl);

  useEffect(() => {
    // Skip if this component itself triggered the update (avoid re-render loop)
    if (suppressConfigSyncRef.current) {
      suppressConfigSyncRef.current = false;
      return;
    }
    if (event.certificateConfig) {
      setConfig({
        ...DEFAULT_CERTIFICATE_CONFIG,
        ...event.certificateConfig,
      });
    }
  }, [event.certificateConfig]);

  useEffect(() => {
    if (participants.length > 0 && !selectedParticipantId) {
      setSelectedParticipantId(participants[0].id);
      setPreviewName(participants[0].name);
    }
  }, [participants, selectedParticipantId]);

  const handleParticipantChange = (id: string) => {
    setSelectedParticipantId(id);
    const found = participants.find((p) => p.id === id);
    if (found) {
      setPreviewName(found.name);
    }
  };

  // Re-render live preview canvas on config/name change
  useEffect(() => {
    let active = true;

    const renderPreview = async () => {
      if (!hasUploadedTemplate) {
        if (canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
        }
        return;
      }

      try {
        const participantObj = {
          id: selectedParticipantId || 'PREVIEW-01',
          name: previewName || 'Alex Johnson',
          email: 'alex@example.com',
        };

        const canvas = await renderCertificateCanvas(event, participantObj, config);
        if (active && canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.borderRadius = '10px';
          canvas.style.boxShadow = '0 12px 36px rgba(0,0,0,0.45)';
          canvasContainerRef.current.appendChild(canvas);
        }
      } catch (err) {
        console.error('Failed to render certificate preview:', err);
      }
    };

    void renderPreview();
    return () => {
      active = false;
    };
  }, [event, config, previewName, selectedParticipantId, hasUploadedTemplate]);

  // Upload template directly to Supabase Storage
  const handleTemplateFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG, JPG, or WEBP)', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('Template image exceeds 15MB. Please choose a smaller file.', 'error');
      return;
    }

    setUploadingTemplate(true);
    try {
      // 1. If an existing template exists in Supabase Storage, remove it
      if (config.templatePath) {
        await removeFileFromSupabase(config.templatePath, SUPABASE_BUCKET);
      }

      // 2. Upload the new template to Supabase Storage
      const ext = file.name.split('.').pop() || 'png';
      const cleanEventId = event.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const storagePath = `certificates/templates/${cleanEventId}_${Date.now()}.${ext}`;

      const publicUrl = await uploadFileToSupabase(file, storagePath, SUPABASE_BUCKET);

      // 3. Update local state and event record in database
      const updatedConfig: CertificateConfig = {
        ...config,
        templateUrl: publicUrl,
        templatePath: storagePath,
        templateUploadedAt: new Date().toISOString(),
        templateOriginalName: file.name,
      };

      setConfig(updatedConfig);
      suppressConfigSyncRef.current = true; // prevent sync effect from re-applying stale props
      await onUpdate({
        certificateConfig: updatedConfig,
      });

      showToast('Certificate template uploaded to Supabase Storage successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to upload certificate template:', err);
      showToast(err.message || 'Failed to upload certificate template to Supabase Storage', 'error');
    } finally {
      setUploadingTemplate(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove template from Supabase Storage and reset event
  const handleDeleteTemplate = async () => {
    if (!window.confirm('Are you sure you want to remove this certificate template from Supabase Storage?')) {
      return;
    }

    setDeletingTemplate(true);
    try {
      if (config.templatePath) {
        await removeFileFromSupabase(config.templatePath, SUPABASE_BUCKET);
      }

      const updatedConfig: CertificateConfig = {
        ...config,
        templateUrl: undefined,
        templatePath: undefined,
        templateUploadedAt: undefined,
        templateOriginalName: undefined,
      };

      setConfig(updatedConfig);
      suppressConfigSyncRef.current = true; // prevent sync effect from re-applying stale props
      await onUpdate({
        certificateConfig: updatedConfig,
      });

      showToast('Certificate template removed successfully.', 'info');
    } catch (err: any) {
      console.error('Failed to remove certificate template:', err);
      showToast('Failed to delete template from storage', 'error');
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Save typography and layout configuration
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      suppressConfigSyncRef.current = true; // prevent sync effect from re-applying stale props
      await onUpdate({
        certificateConfig: config,
      });
      showToast('Certificate typography & alignment settings saved!', 'success');
    } catch (err) {
      console.error('Failed to save certificate configuration:', err);
      showToast('Failed to save certificate configuration', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Download single certificate
  const handleDownloadSingle = async () => {
    if (!hasUploadedTemplate) {
      showToast('Please upload a certificate template before generating certificates', 'error');
      return;
    }

    setGeneratingSingle(true);
    try {
      const participantObj = {
        id: selectedParticipantId || 'SAMPLE',
        name: previewName || 'Participant',
        email: 'participant@example.com',
      };
      await downloadCertificate(event, participantObj, config);
      showToast(`Downloaded certificate for ${participantObj.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate certificate', 'error');
    } finally {
      setGeneratingSingle(false);
    }
  };

  // Download all participant certificates packed in a single ZIP file
  const handleDownloadAllZip = async (onlyArrived: boolean = false) => {
    if (!hasUploadedTemplate) {
      showToast('Please upload a certificate template before generating certificates', 'error');
      return;
    }

    const targetList = onlyArrived ? arrivedParticipants : participants;
    if (targetList.length === 0) {
      showToast(
        onlyArrived ? 'No arrived participants found for this event' : 'No registered participants found',
        'error'
      );
      return;
    }

    setDownloadingZip(true);
    setZipProgress({ current: 0, total: targetList.length, name: 'Preparing certificates...' });

    try {
      await downloadAllCertificatesAsZip(
        event,
        targetList,
        config,
        (current, total, name) => {
          setZipProgress({ current, total, name });
        }
      );
      showToast(`Generated & downloaded ZIP containing ${targetList.length} certificates!`, 'success');
    } catch (err: any) {
      console.error('ZIP download error:', err);
      showToast(err.message || 'Failed to generate certificates ZIP archive', 'error');
    } finally {
      setDownloadingZip(false);
      setZipProgress(null);
    }
  };

  // Trigger single participant email modal
  const handleOpenEmailModal = (participant: EventParticipant) => {
    setEmailModalParticipant(participant);
    setCopiedUrl(false);
  };

  // Execute single participant email send
  const handleSendSingleEmail = async (client: 'gmail' | 'outlook' | 'default') => {
    if (!emailModalParticipant) return;
    if (!hasUploadedTemplate) {
      showToast('Please upload a certificate template before dispatching emails', 'error');
      return;
    }

    setSendingSingleEmail(true);
    try {
      const result = await sendParticipantCertificate(event, emailModalParticipant, config, client);
      showToast(result.message, 'success');
      setEmailModalParticipant(null);
    } catch (err: any) {
      console.error('Failed to dispatch certificate email:', err);
      showToast(err.message || 'Failed to dispatch certificate email', 'error');
    } finally {
      setSendingSingleEmail(false);
    }
  };

  // Bulk Generate and Dispatch Certificates
  const handleBulkDispatch = async (onlyArrived: boolean) => {
    if (!hasUploadedTemplate) {
      showToast('Please upload an official certificate template in Supabase Storage first', 'error');
      return;
    }

    const targetList = onlyArrived ? arrivedParticipants : participants;
    if (targetList.length === 0) {
      showToast(
        onlyArrived ? 'No arrived participants found for this event' : 'No registered participants found',
        'error'
      );
      return;
    }

    setShowBulkModal(true);
    setGeneratingBulk(true);
    setBulkResults(null);

    try {
      const result = await sendBulkCertificates(
        event,
        targetList,
        config,
        (progress) => {
          setBulkProgress(progress);
        }
      );

      setBulkResults({
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        issuedUrls: result.issuedUrls,
      });

      showToast(`Generated & processed ${result.successful} certificates successfully!`, 'success');
    } catch (err: any) {
      console.error('Bulk generation error:', err);
      showToast(err.message || 'Failed during bulk certificate processing', 'error');
    } finally {
      setGeneratingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
              Official Certificate Studio &amp; Cloud Dispatcher
            </h3>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Upload your official event template to Supabase Storage, align participant details dynamically, and issue verified credentials via email.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig || uploadingTemplate}
            className="btn-primary flex items-center gap-2 !py-2.5 !px-5 shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {savingConfig ? 'Saving Settings...' : 'Save Alignment Settings'}
          </button>
        )}
      </div>

      {/* Warning callout if no template uploaded */}
      {!hasUploadedTemplate && (
        <div
          className="rounded-2xl border p-5 flex flex-col md:flex-row items-start md:items-center gap-4 bg-amber-500/10 border-amber-500/30 text-amber-300"
        >
          <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 mt-0.5 md:mt-0" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-amber-200">
              Official Certificate Template Required
            </h4>
            <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
              In accordance with security standards, all certificate generation requires an official template image uploaded by an authorized organizer. No predefined or hardcoded templates are permitted. Please upload your template below to begin previewing, generating, and issuing certificates.
            </p>
          </div>
          <label className="btn-primary !bg-amber-600 hover:!bg-amber-500 !text-slate-950 font-bold !text-xs !py-2.5 !px-4 shrink-0 flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            Upload Template to Supabase
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => e.target.files?.[0] && handleTemplateFileUpload(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Main Grid: Left Studio Preview / Right Controls */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Live Canvas Preview & Participant Switcher */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            <div
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b"
              style={{ borderColor: 'var(--dash-border)' }}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Live Dynamic Certificate Preview
              </span>

              {/* Participant selector */}
              {hasUploadedTemplate && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedParticipantId}
                    onChange={(e) => handleParticipantChange(e.target.value)}
                    className="input-field !py-1.5 !px-3 text-xs flex-1 sm:w-56"
                  >
                    <option value="">-- Custom Sample Name --</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.arrived ? '✓ Arrived' : ''} {p.certificateSent ? '✉ Sent' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Custom Name Override if no participant selected */}
            {hasUploadedTemplate && !selectedParticipantId && (
              <div className="flex items-center gap-2">
                <label className="text-xs shrink-0" style={{ color: 'var(--dash-muted)' }}>
                  Preview Name:
                </label>
                <input
                  type="text"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  className="input-field !py-1 !px-2.5 text-xs flex-1"
                  placeholder="e.g. Alex Johnson"
                />
              </div>
            )}

            {/* Live Canvas Mount Point or Placeholder */}
            {hasUploadedTemplate ? (
              <div
                ref={canvasContainerRef}
                className="w-full flex items-center justify-center rounded-xl overflow-hidden min-h-[340px] bg-slate-950/60 p-2 border"
                style={{ borderColor: 'var(--dash-border)' }}
              />
            ) : (
              <div
                className="w-full flex flex-col items-center justify-center rounded-xl min-h-[320px] bg-slate-950/40 p-8 border border-dashed text-center"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3">
                  <Award className="w-7 h-7 text-amber-500" />
                </div>
                <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  No Template Uploaded for this Event
                </h4>
                <p className="text-xs max-w-sm mt-1 mb-4" style={{ color: 'var(--dash-muted)' }}>
                  Upload a high-resolution PNG or JPG certificate template in the Template Management panel on the right.
                </p>
                <label className="btn-secondary !text-xs !py-2 !px-4 flex items-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Select Template File
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => e.target.files?.[0] && handleTemplateFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Preview Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handleDownloadSingle}
                disabled={!hasUploadedTemplate || generatingSingle}
                className="btn-secondary !text-xs !py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                {generatingSingle ? 'Generating...' : 'Download Sample Certificate'}
              </button>

              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                Template: {config.templateOriginalName || (hasUploadedTemplate ? 'Supabase Storage CDN' : 'None')}
              </p>
            </div>
          </div>

          {/* Batch Generation & Email Distribution Box */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <Send className="w-4 h-4 text-blue-500" />
                Batch Generation &amp; Universal Email Dispatch
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                {participants.length} Registered · {arrivedParticipants.length} Arrived
              </span>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
              Bulk certificate issuance generates official PNG credentials for each attendee, uploads them to Supabase Storage, attaches the authenticated CDN download link, and dispatches email notifications.
            </p>

            {/* Email delivery mode notice */}
            {!import.meta.env.VITE_RESEND_API_KEY && !import.meta.env.VITE_EMAIL_API_URL ? (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-200 mb-0.5">No Email Backend Configured</p>
                  <p className="text-[11px] leading-relaxed text-amber-300/80">
                    Certificates are generated &amp; stored in Supabase, but emails are opened in <strong>your</strong> mail client — participants won&apos;t receive them automatically.
                    To enable automatic delivery, add <code className="bg-amber-900/40 px-1 rounded">VITE_RESEND_API_KEY</code> to your <code className="bg-amber-900/40 px-1 rounded">.env</code> file.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Email API configured — certificates will be delivered directly to participants.
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleBulkDispatch(true)}
                disabled={!hasUploadedTemplate || generatingBulk || downloadingZip || arrivedParticipants.length === 0}
                className="btn-primary !text-xs !py-2.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <Mail className="w-4 h-4" />
                {generatingBulk ? 'Processing...' : `Issue to Arrived Only (${arrivedParticipants.length})`}
              </button>

              <button
                onClick={() => handleBulkDispatch(false)}
                disabled={!hasUploadedTemplate || generatingBulk || downloadingZip || participants.length === 0}
                className="btn-secondary !text-xs !py-2.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users className="w-4 h-4 text-blue-400" />
                {generatingBulk ? 'Processing...' : `Issue to All Registered (${participants.length})`}
              </button>
            </div>

            {/* Bulk ZIP Download Buttons */}
            <div className="pt-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5" style={{ borderColor: 'var(--dash-border)' }}>
              <button
                onClick={() => handleDownloadAllZip(false)}
                disabled={!hasUploadedTemplate || downloadingZip || generatingBulk || participants.length === 0}
                className="btn-secondary !text-xs !py-2.5 flex-1 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.08)' }}
              >
                <FolderArchive className="w-4 h-4 text-blue-400" />
                {downloadingZip ? `Zipping (${zipProgress?.current || 0}/${zipProgress?.total || participants.length})...` : `Download All (${participants.length}) as ZIP`}
              </button>

              <button
                onClick={() => handleDownloadAllZip(true)}
                disabled={!hasUploadedTemplate || downloadingZip || generatingBulk || arrivedParticipants.length === 0}
                className="btn-secondary !text-xs !py-2.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)' }}
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                {`Download Arrived (${arrivedParticipants.length}) as ZIP`}
              </button>
            </div>

            {/* ZIP Progress Bar */}
            {downloadingZip && zipProgress && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Packaging ZIP Archive...
                  </span>
                  <span>{zipProgress.current} / {zipProgress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((zipProgress.current / Math.max(1, zipProgress.total)) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 truncate">Current: {zipProgress.name}</p>
              </div>
            )}
          </div>

          {/* Participant Credentials & Issuance Table */}
          {participants.length > 0 && (
            <div
              className="rounded-2xl border p-4 space-y-3"
              style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
            >
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--dash-text)' }}>
                  Participant Certificate Registry ({participants.length})
                </h4>
                <span className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  {participants.filter((p) => p.certificateSent).length} Delivered
                </span>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-400" style={{ borderColor: 'var(--dash-border)' }}>
                      <th className="pb-2">Participant</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Arrival</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {participants.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/20">
                        <td className="py-2.5 font-medium" style={{ color: 'var(--dash-text)' }}>
                          {p.name}
                        </td>
                        <td className="py-2.5 font-mono text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                          {p.email || 'No email'}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              p.arrived ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {p.arrived ? '✓ Arrived' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {p.certificateSent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                              <Check className="w-3 h-3" /> Issued &amp; Sent
                            </span>
                          ) : p.certificateUrl ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400">
                              <FileCheck className="w-3 h-3" /> Generated
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Not Issued</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.certificateUrl && (
                              <a
                                href={p.certificateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-slate-800 text-blue-400"
                                title="Open Certificate in Supabase CDN"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleOpenEmailModal(p)}
                              disabled={!hasUploadedTemplate}
                              className="p-1 rounded hover:bg-slate-800 text-emerald-400 disabled:opacity-40"
                              title="Send or prepare email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Template Management & Customizer Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Supabase Storage Template Management Card */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Supabase Storage Template
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                {SUPABASE_BUCKET}
              </span>
            </div>

            {hasUploadedTemplate ? (
              <div className="space-y-3">
                <div
                  className="p-3 rounded-xl border space-y-2 bg-slate-900/60"
                  style={{ borderColor: 'var(--dash-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active Official Template
                    </span>
                    <a
                      href={config.templateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View CDN Image
                    </a>
                  </div>

                  <div className="text-[11px] space-y-1 text-slate-400 font-mono">
                    <p className="truncate">
                      <strong>File:</strong> {config.templateOriginalName || 'certificate_template.png'}
                    </p>
                    {config.templatePath && (
                      <p className="truncate">
                        <strong>Storage Path:</strong> {config.templatePath}
                      </p>
                    )}
                    {config.templateUploadedAt && (
                      <p>
                        <strong>Uploaded:</strong> {new Date(config.templateUploadedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    className={`btn-secondary !text-xs !py-2 flex-1 flex items-center justify-center gap-2 cursor-pointer ${
                      uploadingTemplate ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${uploadingTemplate ? 'animate-spin' : ''}`} />
                    {uploadingTemplate ? 'Uploading...' : 'Replace Template'}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={uploadingTemplate || deletingTemplate}
                      onChange={(e) => e.target.files?.[0] && handleTemplateFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    disabled={deletingTemplate || uploadingTemplate}
                    className="p-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                    title="Remove template from Supabase Storage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                  Upload a high-resolution certificate background image (with borders, logos, and branding). Participant names and event metadata will be dynamically rendered on top.
                </p>

                <label
                  className={`btn-primary !text-xs !py-3 flex items-center justify-center gap-2 cursor-pointer w-full ${
                    uploadingTemplate ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className={`w-4 h-4 ${uploadingTemplate ? 'animate-spin' : ''}`} />
                  {uploadingTemplate ? 'Uploading to Supabase Storage...' : 'Upload Template Image (PNG / JPG)'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadingTemplate}
                    onChange={(e) => e.target.files?.[0] && handleTemplateFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Typography & Position Alignment Controls */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-500" />
                <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Participant Details &amp; Alignment
                </h4>
              </div>
            </div>

            <div className="space-y-4">
              {/* Participant Name Formatting */}
              <div className="p-3 rounded-xl bg-slate-900/40 border space-y-2.5" style={{ borderColor: 'var(--dash-border)' }}>
                <span className="text-xs font-bold text-amber-400 block">1. Participant Name Placement</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Font Size (px)
                    </label>
                    <input
                      type="number"
                      min="24"
                      max="100"
                      value={config.nameFontSize || 52}
                      onChange={(e) => setConfig({ ...config, nameFontSize: Number(e.target.value) || 52 })}
                      className="input-field w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Vertical Offset Y (px)
                    </label>
                    <input
                      type="number"
                      min="-400"
                      max="400"
                      value={config.nameOffsetY || 0}
                      onChange={(e) => setConfig({ ...config, nameOffsetY: Number(e.target.value) || 0 })}
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Name Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.primaryColor || '#0f172a'}
                        onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.primaryColor || '#0f172a'}
                        onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                        className="input-field flex-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-1.5 pt-3">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.nameUppercase !== false}
                        onChange={(e) => setConfig({ ...config, nameUppercase: e.target.checked })}
                        className="rounded"
                      />
                      Uppercase Name
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config.nameUnderline)}
                        onChange={(e) => setConfig({ ...config, nameUnderline: e.target.checked })}
                        className="rounded"
                      />
                      Ornamental Underline
                    </label>
                  </div>
                </div>
              </div>

              {/* Subtitle / Body Text */}
              <div className="p-3 rounded-xl bg-slate-900/40 border space-y-2.5" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">2. Body Subtitle Text</span>
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showBodyText !== false}
                      onChange={(e) => setConfig({ ...config, showBodyText: e.target.checked })}
                      className="rounded"
                    />
                    Display Subtitle
                  </label>
                </div>

                {config.showBodyText !== false && (
                  <>
                    <textarea
                      value={config.bodyText || ''}
                      onChange={(e) => setConfig({ ...config, bodyText: e.target.value })}
                      className="input-field w-full text-xs"
                      rows={2}
                      placeholder="for active participation and outstanding commitment in"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                          Body Size (px)
                        </label>
                        <input
                          type="number"
                          min="14"
                          max="40"
                          value={config.bodyFontSize || 22}
                          onChange={(e) => setConfig({ ...config, bodyFontSize: Number(e.target.value) || 22 })}
                          className="input-field w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                          Body Offset Y (px)
                        </label>
                        <input
                          type="number"
                          min="-200"
                          max="200"
                          value={config.bodyOffsetY || 0}
                          onChange={(e) => setConfig({ ...config, bodyOffsetY: Number(e.target.value) || 0 })}
                          className="input-field w-full text-xs"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Event Title Alignment */}
              <div className="p-3 rounded-xl bg-slate-900/40 border space-y-2.5" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">3. Event Title</span>
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showEventTitle !== false}
                      onChange={(e) => setConfig({ ...config, showEventTitle: e.target.checked })}
                      className="rounded"
                    />
                    Display Title
                  </label>
                </div>

                {config.showEventTitle !== false && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Title Size (px)
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="60"
                        value={config.eventFontSize || 34}
                        onChange={(e) => setConfig({ ...config, eventFontSize: Number(e.target.value) || 34 })}
                        className="input-field w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Title Offset Y (px)
                      </label>
                      <input
                        type="number"
                        min="-200"
                        max="200"
                        value={config.eventOffsetY || 0}
                        onChange={(e) => setConfig({ ...config, eventOffsetY: Number(e.target.value) || 0 })}
                        className="input-field w-full text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Signatories & Verification ID */}
              <div className="p-3 rounded-xl bg-slate-900/40 border space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">4. Signatories &amp; Verification</span>
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showSignatories !== false}
                      onChange={(e) => setConfig({ ...config, showSignatories: e.target.checked })}
                      className="rounded"
                    />
                    Show Signatories
                  </label>
                </div>

                {config.showSignatories !== false && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] mb-1 text-slate-400">Left Signatory Name</label>
                        <input
                          type="text"
                          value={config.signatoryName || ''}
                          onChange={(e) => setConfig({ ...config, signatoryName: e.target.value })}
                          className="input-field w-full text-xs"
                          placeholder="Prof. Faculty Coordinator"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-slate-400">Left Signatory Title</label>
                        <input
                          type="text"
                          value={config.signatoryTitle || ''}
                          onChange={(e) => setConfig({ ...config, signatoryTitle: e.target.value })}
                          className="input-field w-full text-xs"
                          placeholder="Faculty Advisor, IT Dept"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] mb-1 text-slate-400">Right Signatory Name</label>
                        <input
                          type="text"
                          value={config.signatory2Name || ''}
                          onChange={(e) => setConfig({ ...config, signatory2Name: e.target.value })}
                          className="input-field w-full text-xs"
                          placeholder="Student President"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-slate-400">Right Signatory Title</label>
                        <input
                          type="text"
                          value={config.signatory2Title || ''}
                          onChange={(e) => setConfig({ ...config, signatory2Title: e.target.value })}
                          className="input-field w-full text-xs"
                          placeholder="SAInT Core Committee"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showCertificateId !== false}
                      onChange={(e) => setConfig({ ...config, showCertificateId: e.target.checked })}
                      className="rounded"
                    />
                    Include Verification Certificate ID
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showDate !== false}
                      onChange={(e) => setConfig({ ...config, showDate: e.target.checked })}
                      className="rounded"
                    />
                    Show Date &amp; Venue
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Progress & Summary Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-5 bg-slate-900 border-slate-700 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-white">
                  {generatingBulk ? 'Generating & Dispatching Certificates...' : 'Certificate Batch Summary'}
                </h3>
              </div>
              {!generatingBulk && (
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {generatingBulk && bulkProgress && (
              <div className="space-y-4 py-3">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>
                    Processing: <strong>{bulkProgress.currentName}</strong>
                  </span>
                  <span>
                    {bulkProgress.current} / {bulkProgress.total} (
                    {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                    style={{
                      width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%`,
                    }}
                  />
                </div>

                <p className="text-xs text-center text-slate-400 font-mono">
                  Stage: {bulkProgress.status.toUpperCase()}
                </p>
              </div>
            )}

            {!generatingBulk && bulkResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="text-lg font-bold text-white">{bulkResults.total}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400">Successful</p>
                    <p className="text-lg font-bold text-emerald-300">{bulkResults.successful}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-red-400">Failed</p>
                    <p className="text-lg font-bold text-red-300">{bulkResults.failed}</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700 text-xs text-slate-300 space-y-1">
                  <p>
                    ✓ All certificates stored permanently in <strong>Supabase Storage</strong> under bucket{' '}
                    <code>{SUPABASE_BUCKET}</code>.
                  </p>
                  <p>✓ Participant database records updated with permanent credentials.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="btn-primary !text-xs !py-2 !px-6 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Participant Email Dispatcher Modal */}
      {emailModalParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-5 bg-slate-900 border-slate-700 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  Send Certificate to {emailModalParticipant.name}
                </h3>
              </div>
              <button
                onClick={() => setEmailModalParticipant(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1.5">
                <p>
                  <strong className="text-slate-400">Recipient:</strong>{' '}
                  <span className="text-white font-semibold">{emailModalParticipant.name}</span> (
                  <span className="font-mono text-slate-300">{emailModalParticipant.email}</span>)
                </p>
                <p>
                  <strong className="text-slate-400">Event:</strong>{' '}
                  <span className="text-white">{event.title}</span>
                </p>
                {emailModalParticipant.certificateUrl && (
                  <p className="truncate">
                    <strong className="text-slate-400">Certificate URL:</strong>{' '}
                    <a
                      href={emailModalParticipant.certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline"
                    >
                      {emailModalParticipant.certificateUrl}
                    </a>
                  </p>
                )}
              </div>

              {emailModalParticipant.certificateUrl && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(emailModalParticipant.certificateUrl || '');
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2500);
                  }}
                  className="btn-secondary w-full !text-xs !py-2 flex items-center justify-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedUrl ? 'Copied Certificate Link!' : 'Copy Supabase Certificate URL'}
                </button>
              )}

              <p className="text-[11px] text-slate-400 pt-1">
                Choose an email client to send the official certificate credential:
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => handleSendSingleEmail('gmail')}
                  disabled={sendingSingleEmail}
                  className="p-2.5 rounded-xl border border-slate-700 hover:border-red-500/50 bg-slate-800/80 hover:bg-red-500/10 text-center transition cursor-pointer"
                >
                  <span className="block font-bold text-xs text-white">Gmail Web</span>
                  <span className="text-[10px] text-slate-400">Direct Composer</span>
                </button>

                <button
                  onClick={() => handleSendSingleEmail('outlook')}
                  disabled={sendingSingleEmail}
                  className="p-2.5 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-slate-800/80 hover:bg-blue-500/10 text-center transition cursor-pointer"
                >
                  <span className="block font-bold text-xs text-white">Outlook</span>
                  <span className="text-[10px] text-slate-400">Web Mail</span>
                </button>

                <button
                  onClick={() => handleSendSingleEmail('default')}
                  disabled={sendingSingleEmail}
                  className="p-2.5 rounded-xl border border-slate-700 hover:border-emerald-500/50 bg-slate-800/80 hover:bg-emerald-500/10 text-center transition cursor-pointer"
                >
                  <span className="block font-bold text-xs text-white">Default App</span>
                  <span className="text-[10px] text-slate-400">Mailto Client</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

