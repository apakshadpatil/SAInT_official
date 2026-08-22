import { useEffect, useRef, useState } from 'react';
import type { EventRecord, CertificateConfig } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { renderCertificateCanvas, downloadCertificate, DEFAULT_CERTIFICATE_CONFIG } from '../../utils/certificateGenerator';
import { uploadDataUrlToSupabase, SUPABASE_BUCKET } from '../../utils/supabase';
import { Award, Download, Upload, Send, CheckCircle2, Sparkles, Sliders, Palette, Mail } from 'lucide-react';

interface CertificateTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function CertificateTab({ event, onUpdate, canEdit }: CertificateTabProps) {
  const { showToast } = useToast();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<CertificateConfig>({
    ...DEFAULT_CERTIFICATE_CONFIG,
    ...(event.certificateConfig || {}),
  });

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('Alex Johnson');
  const [loading, setLoading] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);

  const participants = event.participants || [];

  useEffect(() => {
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
      try {
        const participantObj = {
          id: selectedParticipantId || 'PREVIEW-1',
          name: previewName || 'Alex Johnson',
          email: 'alex@example.com',
        };
        const canvas = await renderCertificateCanvas(event, participantObj, config);
        if (active && canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.borderRadius = '12px';
          canvas.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
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
  }, [event, config, previewName, selectedParticipantId]);

  const handleTemplateUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG/JPG)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setConfig((prev) => ({ ...prev, templateUrl: dataUrl }));
      showToast('Certificate template image loaded into preview', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      let finalTemplateUrl = config.templateUrl;
      if (config.templateUrl && config.templateUrl.startsWith('data:')) {
        const dest = `certificates/templates/${event.id}_${Date.now()}.png`;
        finalTemplateUrl = await uploadDataUrlToSupabase(config.templateUrl, dest, 'template.png', SUPABASE_BUCKET);
      }

      const updatedConfig = { ...config, templateUrl: finalTemplateUrl || undefined };
      await onUpdate({
        certificateConfig: updatedConfig,
      });
      setConfig(updatedConfig);
      showToast('Certificate template & configuration saved successfully!', 'success');
    } catch (err) {
      console.error('Failed to save certificate configuration:', err);
      showToast('Failed to save certificate configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSingle = async () => {
    try {
      const participantObj = {
        id: selectedParticipantId || 'TEST',
        name: previewName || 'Participant',
        email: 'participant@example.com',
      };
      await downloadCertificate(event, participantObj, config);
      showToast(`Downloaded certificate for ${participantObj.name}`, 'success');
    } catch (err) {
      showToast('Failed to generate certificate', 'error');
    }
  };

  const handleBulkDownload = async (onlyArrived = false) => {
    const list = onlyArrived ? participants.filter((p) => p.arrived) : participants;
    if (list.length === 0) {
      showToast(onlyArrived ? 'No arrived participants found' : 'No participants registered for this event', 'error');
      return;
    }

    setGeneratingBulk(true);
    showToast(`Generating ${list.length} certificates...`, 'info');
    try {
      for (const p of list) {
        await downloadCertificate(event, p, config);
        // Small delay to prevent browser download throttling
        await new Promise((r) => setTimeout(r, 400));
      }
      showToast(`Generated & downloaded all ${list.length} certificates!`, 'success');
    } catch (err) {
      showToast('Error during bulk certificate generation', 'error');
    } finally {
      setGeneratingBulk(false);
    }
  };

  const handleDistributeEmails = async (onlyArrived = true) => {
    const list = onlyArrived ? participants.filter((p) => p.arrived) : participants;
    const recipientEmails = list.map((p) => p.email).filter(Boolean);

    if (recipientEmails.length === 0) {
      showToast('No valid participant email addresses found', 'error');
      return;
    }

    setSendingEmails(true);
    try {
      const subject = `Your Certificate of Participation for ${event.title}`;
      const body = `Dear Participant,\n\nThank you for attending ${event.title} organized by SAInT (Student Association of Information Technology) at JSPM's RSCOE.\n\nYour verified Certificate of Participation has been issued. You can also view and download it directly from the event portal.\n\nWarm regards,\nSAInT Organizing Team\nJSPM's RSCOE IT Department`;

      const mailtoLink = `mailto:${recipientEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;

      // Mark participants as certificateSent in background
      const updatedParticipants = participants.map((p) => {
        if (list.some((item) => item.id === p.id)) {
          return { ...p, certificateSent: true };
        }
        return p;
      });
      await onUpdate({ participants: updatedParticipants });

      showToast(`Certificate email prepared for ${recipientEmails.length} participants!`, 'success');
    } catch (err) {
      showToast('Failed to distribute certificate emails', 'error');
    } finally {
      setSendingEmails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--dash-border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
              Automatic Certificate Distributor & Studio
            </h3>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Design custom certificates with centered participant names and event titles, then download in bulk or dispatch via email.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="btn-primary flex items-center gap-2 !py-2.5 !px-5 shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {loading ? 'Saving Design...' : 'Save Certificate Design'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Live Canvas Preview & Participant Switcher */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Live Centered Certificate Preview
              </span>

              {/* Participant selector */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedParticipantId}
                  onChange={(e) => handleParticipantChange(e.target.value)}
                  className="input-field !py-1.5 !px-3 text-xs flex-1 sm:w-56"
                >
                  <option value="">-- Preview Sample Name --</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.arrived ? '✓ Arrived' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Name Override if no participant selected */}
            {!selectedParticipantId && (
              <div className="flex items-center gap-2">
                <label className="text-xs shrink-0" style={{ color: 'var(--dash-muted)' }}>Preview Name:</label>
                <input
                  type="text"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  className="input-field !py-1 !px-2.5 text-xs flex-1"
                  placeholder="e.g. Alex Johnson"
                />
              </div>
            )}

            {/* Live Canvas Mount Point */}
            <div
              ref={canvasContainerRef}
              className="w-full flex items-center justify-center rounded-xl overflow-hidden min-h-[300px] bg-slate-950/60 p-2 border"
              style={{ borderColor: 'var(--dash-border)' }}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handleDownloadSingle}
                className="btn-secondary !text-xs !py-2 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Single Sample
              </button>

              <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                Resolution: 1600 × 1100 px (Ultra HD Print Quality)
              </p>
            </div>
          </div>

          {/* Bulk Generation & Email Distribution Box */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Send className="w-4 h-4 text-blue-500" />
              Batch Generation & Email Distribution
            </h4>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Total Registered: <strong>{participants.length}</strong> · Arrived &amp; Verified: <strong>{participants.filter((p) => p.arrived).length}</strong>
            </p>

            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleBulkDownload(true)}
                disabled={generatingBulk}
                className="btn-secondary !text-xs !py-2.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                {generatingBulk ? 'Generating...' : 'Download for Arrived Only'}
              </button>

              <button
                onClick={() => handleBulkDownload(false)}
                disabled={generatingBulk}
                className="btn-secondary !text-xs !py-2.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-500" />
                {generatingBulk ? 'Generating...' : 'Download All Participants'}
              </button>

              <button
                onClick={() => handleDistributeEmails(true)}
                disabled={sendingEmails}
                className="btn-primary !text-xs !py-2.5 flex items-center justify-center gap-2 cursor-pointer sm:col-span-2"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <Mail className="w-4 h-4" />
                {sendingEmails ? 'Preparing Emails...' : 'Send Certificate Email to Arrived Attendees'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customization Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <Palette className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                Template &amp; Visual Style
              </h4>
            </div>

            {/* Built-in Presets */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--dash-muted)' }}>
                Preset Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'navy_gold', label: 'Luxury Navy & Gold', bg: '#0b193d', border: '#fbbf24' },
                  { id: 'cyber_green', label: 'Cyber Tech Matrix', bg: '#050c08', border: '#22c55e' },
                  { id: 'royal_crimson', label: 'Royal Maroon & Gold', bg: '#4c0519', border: '#f59e0b' },
                  { id: 'clean_white', label: 'Institutional White', bg: '#ffffff', border: '#1e3a8a' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setConfig((prev) => ({ ...prev, presetStyle: preset.id as any, templateUrl: undefined }))}
                    className="p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20"
                    style={{
                      borderColor: config.presetStyle === preset.id && !config.templateUrl ? preset.border : 'var(--dash-border)',
                      background: preset.bg,
                      boxShadow: config.presetStyle === preset.id && !config.templateUrl ? `0 0 12px ${preset.border}55` : 'none',
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: preset.id === 'clean_white' ? '#111827' : '#ffffff' }}>
                      {preset.label}
                    </span>
                    <span className="text-[10px] opacity-75" style={{ color: preset.id === 'clean_white' ? '#475569' : '#e2e8f0' }}>
                      Auto-generated
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Background Upload */}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--dash-muted)' }}>
                Or Upload Custom Certificate Background
              </label>
              <p className="text-[11px] mb-2" style={{ color: 'var(--dash-muted)' }}>
                PNG or JPG with borders &amp; logo. Names will align in the center.
              </p>
              <label className="btn-secondary !text-xs !py-2 flex items-center justify-center gap-2 cursor-pointer w-full">
                <Upload className="w-3.5 h-3.5" /> Upload Background Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleTemplateUpload(e.target.files[0])}
                  className="hidden"
                />
              </label>
              {config.templateUrl && (
                <div className="flex items-center justify-between mt-2 text-xs text-emerald-500">
                  <span>✓ Custom background template active</span>
                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, templateUrl: undefined }))}
                    className="text-red-400 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Typography & Position Controls */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <Sliders className="w-4 h-4 text-blue-500" />
              <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                Certificate Text &amp; Signatures
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Organization / Issuer Name
                </label>
                <input
                  type="text"
                  value={config.organizationName || ''}
                  onChange={(e) => setConfig({ ...config, organizationName: e.target.value })}
                  className="input-field w-full text-xs"
                  placeholder="e.g. SAInT — JSPM's RSCOE"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Body Subtitle Text
                </label>
                <textarea
                  value={config.bodyText || ''}
                  onChange={(e) => setConfig({ ...config, bodyText: e.target.value })}
                  className="input-field w-full text-xs"
                  rows={2}
                  placeholder="for active participation and outstanding enthusiasm in"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Participant Name Size (px)
                  </label>
                  <input
                    type="number"
                    min="24"
                    max="80"
                    value={config.nameFontSize || 46}
                    onChange={(e) => setConfig({ ...config, nameFontSize: Number(e.target.value) || 46 })}
                    className="input-field w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Vertical Offset Y (px)
                  </label>
                  <input
                    type="number"
                    min="-200"
                    max="200"
                    value={config.nameOffsetY || 0}
                    onChange={(e) => setConfig({ ...config, nameOffsetY: Number(e.target.value) || 0 })}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={config.signatoryName || ''}
                    onChange={(e) => setConfig({ ...config, signatoryName: e.target.value })}
                    className="input-field w-full text-xs"
                    placeholder="Prof. Faculty Coordinator"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Signatory Title
                  </label>
                  <input
                    type="text"
                    value={config.signatoryTitle || ''}
                    onChange={(e) => setConfig({ ...config, signatoryTitle: e.target.value })}
                    className="input-field w-full text-xs"
                    placeholder="SAInT Faculty Advisor"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
