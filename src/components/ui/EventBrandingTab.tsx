import { useState, useRef } from 'react';
import type { EventRecord } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Smartphone,
  Monitor,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Save,
  Layers,
  Palette
} from 'lucide-react';
import { uploadFileToSupabase } from '../../utils/supabase';
import { uploadFileToStorage, formatFileSize } from '../../utils/fileUtils';

interface EventBrandingTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export default function EventBrandingTab({ event, onUpdate, canEdit }: EventBrandingTabProps) {
  const { showToast } = useToast();

  // Banner states
  const [bannerPreview, setBannerPreview] = useState<string>(event.registrationBannerUrl || '');
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // Background states
  const [bgPreview, setBgPreview] = useState<string>(event.registrationBackgroundUrl || '');
  const [bgFile, setBgFile] = useState<File | null>(null);

  // Preview simulator mode
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [savingChanges, setSavingChanges] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Helper validation
  const validateFile = (file: File): boolean => {
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      showToast('Unsupported file type. Please upload a PNG, JPG, JPEG, or WebP image.', 'error');
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(`Image file is too large (${formatFileSize(file.size)}). Max allowed size is 5MB.`, 'error');
      return false;
    }
    return true;
  };

  // ── Handle Banner File Selection ──────────────────────────────────────────
  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateFile(file)) {
      if (bannerInputRef.current) bannerInputRef.current.value = '';
      return;
    }
    setBannerFile(file);
    const objectUrl = URL.createObjectURL(file);
    setBannerPreview(objectUrl);
    showToast('Banner image selected. Click "Save Branding Changes" to apply.', 'info');
  };

  // ── Handle Background File Selection ──────────────────────────────────────
  const handleBgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateFile(file)) {
      if (bgInputRef.current) bgInputRef.current.value = '';
      return;
    }
    setBgFile(file);
    const objectUrl = URL.createObjectURL(file);
    setBgPreview(objectUrl);
    showToast('Background image selected. Click "Save Branding Changes" to apply.', 'info');
  };

  // ── Remove Banner ─────────────────────────────────────────────────────────
  const handleRemoveBanner = async () => {
    if (!window.confirm('Remove registration page banner? The portal will fall back to the default event cover image.')) return;
    setBannerFile(null);
    setBannerPreview('');
    if (bannerInputRef.current) bannerInputRef.current.value = '';
    showToast('Banner cleared. Click "Save Branding Changes" to commit.', 'info');
  };

  // ── Remove Background ─────────────────────────────────────────────────────
  const handleRemoveBg = async () => {
    if (!window.confirm('Remove custom registration background? The portal will revert to the default gradient background.')) return;
    setBgFile(null);
    setBgPreview('');
    if (bgInputRef.current) bgInputRef.current.value = '';
    showToast('Background cleared. Click "Save Branding Changes" to commit.', 'info');
  };

  // ── Upload Helper ─────────────────────────────────────────────────────────
  const uploadImage = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const dest = `${folder}/${event.id}_${Date.now()}.${ext}`;
    try {
      return await uploadFileToSupabase(file, dest);
    } catch (supabaseErr) {
      console.warn('Supabase storage upload failed, attempting Firebase Storage fallback...', supabaseErr);
      try {
        return await uploadFileToStorage(file, dest);
      } catch (fbErr) {
        console.error('All storage upload attempts failed:', fbErr);
        throw new Error('Image upload failed. Please verify storage permissions and try again.');
      }
    }
  };

  // ── Save All Branding Changes ─────────────────────────────────────────────
  const handleSaveAllBranding = async () => {
    if (!canEdit) {
      showToast('You do not have permission to edit this event', 'error');
      return;
    }

    setSavingChanges(true);
    try {
      let finalBannerUrl = bannerPreview;
      let finalBgUrl = bgPreview;

      // Upload banner file if newly selected
      if (bannerFile) {
        finalBannerUrl = await uploadImage(bannerFile, 'banners');
        setBannerPreview(finalBannerUrl);
        setBannerFile(null);
      } else if (!bannerPreview) {
        finalBannerUrl = '';
      }

      // Upload bg file if newly selected
      if (bgFile) {
        finalBgUrl = await uploadImage(bgFile, 'backgrounds');
        setBgPreview(finalBgUrl);
        setBgFile(null);
      } else if (!bgPreview) {
        finalBgUrl = '';
      }

      await onUpdate({
        registrationBannerUrl: finalBannerUrl || undefined,
        registrationBackgroundUrl: finalBgUrl || undefined,
      });

      showToast('Registration portal branding saved successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to save branding:', err);
      showToast(err.message || 'Failed to save branding settings', 'error');
    } finally {
      setSavingChanges(false);
    }
  };

  const hasUnsavedChanges = Boolean(
    bannerFile ||
    bgFile ||
    bannerPreview !== (event.registrationBannerUrl || '') ||
    bgPreview !== (event.registrationBackgroundUrl || '')
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <Palette className="w-5 h-5 text-blue-500" />
                Registration Portal Branding &amp; Visuals
              </h3>
              {hasUnsavedChanges && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Configure event-specific banner and background images exclusively for this event's registration portal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/events/${event.id}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 hover:border-slate-600 bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Public Details Page
            </a>

            <a
              href={`/events/${event.id}/register`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Live Registration Page
            </a>

            <button
              type="button"
              onClick={handleSaveAllBranding}
              disabled={savingChanges || !canEdit || !hasUnsavedChanges}
              className="btn-primary !text-xs !py-2 !px-4 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-40"
            >
              {savingChanges ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving Visuals...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Branding Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grid for Banner and Background upload cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── CARD 1: Registration Banner ──────────────────────────────────── */}
        <div
          className="rounded-2xl border p-5 sm:p-6 space-y-4 flex flex-col justify-between"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                    Registration Page Banner
                  </h4>
                  <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    Header banner shown on the registration form card
                  </p>
                </div>
              </div>

              {bannerPreview && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Custom Banner Active
                </span>
              )}
            </div>

            {/* Banner Preview Area */}
            {bannerPreview ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 group aspect-[21/9]">
                  <img
                    src={bannerPreview}
                    alt="Registration Banner Preview"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <span className="text-[11px] text-white font-medium">
                      Aspect Ratio: ~21:9 (Recommended: 1200x500px)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-slate-400 truncate">
                    {bannerFile ? `Selected: ${bannerFile.name}` : 'Using uploaded banner'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={!canEdit || savingChanges}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                    >
                      Replace Banner
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      disabled={!canEdit || savingChanges}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 font-semibold cursor-pointer"
                      title="Remove custom banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => bannerInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all space-y-2 group"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors mx-auto" />
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--dash-text)' }}>
                    Click to Upload Registration Banner
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                    PNG, JPG, WebP up to 5MB (1200x500px recommended)
                  </p>
                </div>
                <span className="inline-block text-[11px] text-blue-400 font-semibold">
                  Browse file from device →
                </span>
              </div>
            )}

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleBannerSelect}
              className="hidden"
            />
          </div>

          <div className="pt-3 border-t text-[11px] space-y-1" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Falls back gracefully to standard event cover image if unconfigured.
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Automatically adapts responsively to desktop and phone screens.
            </p>
          </div>
        </div>

        {/* ── CARD 2: Registration Background Image ────────────────────────── */}
        <div
          className="rounded-2xl border p-5 sm:p-6 space-y-4 flex flex-col justify-between"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                    Registration Page Background
                  </h4>
                  <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    Full-viewport background image with readability overlay
                  </p>
                </div>
              </div>

              {bgPreview && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Custom Background Active
                </span>
              )}
            </div>

            {/* Background Preview Area */}
            {bgPreview ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 group aspect-[21/9]">
                  <img
                    src={bgPreview}
                    alt="Registration Background Preview"
                    className="w-full h-full object-cover"
                  />
                  {/* Glassmorphism Dark Readability Overlay */}
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center backdrop-blur-md">
                      <span className="text-[11px] font-bold text-white">
                        Simulated Readability Contrast
                      </span>
                      <p className="text-[10px] text-slate-300">
                        Form inputs &amp; text will remain 100% sharp &amp; readable
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-slate-400 truncate">
                    {bgFile ? `Selected: ${bgFile.name}` : 'Using uploaded background'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bgInputRef.current?.click()}
                      disabled={!canEdit || savingChanges}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                    >
                      Replace Background
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveBg}
                      disabled={!canEdit || savingChanges}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 font-semibold cursor-pointer"
                      title="Remove custom background"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => bgInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all space-y-2 group"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors mx-auto" />
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--dash-text)' }}>
                    Click to Upload Background Image
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                    PNG, JPG, WebP up to 5MB (1920x1080px recommended)
                  </p>
                </div>
                <span className="inline-block text-[11px] text-indigo-400 font-semibold">
                  Browse file from device →
                </span>
              </div>
            )}

            <input
              ref={bgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleBgSelect}
              className="hidden"
            />
          </div>

          <div className="pt-3 border-t text-[11px] space-y-1" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Falls back gracefully to the standard deep midnight gradient if unconfigured.
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Overlay automatically adjusts for high-contrast accessibility.
            </p>
          </div>
        </div>
      </div>

      {/* ── Viewport Simulator Box ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 sm:p-6 space-y-4"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Eye className="w-4 h-4 text-blue-400" />
              Registration Portal Live Viewport Simulator
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Preview how the custom banner and background will compose together on mobile and laptop screens.
            </p>
          </div>

          {/* Viewport Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                previewDevice === 'desktop'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop / Laptop
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                previewDevice === 'mobile'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile Phone (~390px)
            </button>
          </div>
        </div>

        {/* Simulator Container */}
        <div className="flex justify-center p-4 sm:p-8 rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden">
          <div
            className={`transition-all duration-300 relative rounded-2xl overflow-hidden border shadow-2xl ${
              previewDevice === 'desktop'
                ? 'w-full max-w-3xl min-h-[380px]'
                : 'w-[360px] sm:w-[390px] min-h-[460px]'
            }`}
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
              background: bgPreview
                ? `url(${bgPreview}) center/cover no-repeat`
                : 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)',
            }}
          >
            {/* Scrim Overlay */}
            <div className={`w-full h-full p-4 sm:p-6 ${bgPreview ? 'bg-slate-950/75 backdrop-blur-[3px]' : ''}`}>
              {/* Fake Registration Form Card */}
              <div
                className="rounded-xl overflow-hidden border shadow-xl mx-auto"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                {/* Banner in simulator */}
                {bannerPreview ? (
                  <img
                    src={bannerPreview}
                    alt="Banner"
                    className="w-full h-32 sm:h-44 object-cover"
                  />
                ) : event.imageURL ? (
                  <img
                    src={event.imageURL}
                    alt="Default Event Cover"
                    className="w-full h-32 sm:h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-28 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center text-white/50 text-xs">
                    Default Event Banner
                  </div>
                )}

                {/* Form Content Mockup */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Registration Pass
                  </div>
                  <h5 className="font-extrabold text-sm sm:text-base text-white truncate">
                    {event.title || 'Event Title'}
                  </h5>
                  <div className="space-y-2 pt-1">
                    <div className="h-8 rounded-lg bg-white/5 border border-white/10 px-3 flex items-center text-[11px] text-slate-400">
                      Full Name
                    </div>
                    <div className="h-8 rounded-lg bg-white/5 border border-white/10 px-3 flex items-center text-[11px] text-slate-400">
                      Email Address
                    </div>
                    <div className="h-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                      Confirm &amp; Generate Digital Entry Pass
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
