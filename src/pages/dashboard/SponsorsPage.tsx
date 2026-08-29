import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ExternalLink,
  Globe,
  Handshake,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  createSponsor,
  deleteSponsor,
  subscribeSponsors,
  updateSponsor,
  uploadSponsorLogo,
} from '../../services/sponsorService';
import type { Sponsor } from '../../types';
import { isCoreMember, isSuperAdmin } from '../../utils/permissions';

export default function SponsorsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage = isSuperAdmin(profile) || isCoreMember(profile);

  useEffect(() => {
    const unsubscribe = subscribeSponsors((list) => {
      setSponsors(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingSponsor(null);
    setWebsiteUrl('');
    setSelectedFile(null);
    setPreviewUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setWebsiteUrl(sponsor.websiteUrl || '');
    setSelectedFile(null);
    setPreviewUrl(sponsor.logoUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingSponsor(null);
    setWebsiteUrl('');
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, SVG, WebP).', 'error');
      return;
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      showToast('Logo file size must be less than 10MB.', 'error');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      showToast('You do not have permission to manage sponsors.', 'error');
      return;
    }

    // Validate
    if (!editingSponsor && !selectedFile) {
      showToast('Please upload a sponsor logo.', 'error');
      return;
    }

    let cleanedUrl = websiteUrl.trim();
    if (cleanedUrl && !cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
      cleanedUrl = `https://${cleanedUrl}`;
    }

    setSubmitting(true);
    try {
      if (editingSponsor) {
        let logoUrl = editingSponsor.logoUrl;
        if (selectedFile) {
          logoUrl = await uploadSponsorLogo(selectedFile);
        }

        await updateSponsor(editingSponsor.id, {
          logoUrl: selectedFile ? logoUrl : undefined,
          websiteUrl: cleanedUrl,
        });

        showToast('Sponsor updated successfully.', 'success');
      } else {
        if (!selectedFile) throw new Error('No logo file selected');
        const logoUrl = await uploadSponsorLogo(selectedFile);

        await createSponsor({
          logoUrl,
          websiteUrl: cleanedUrl || undefined,
        });

        showToast('Sponsor added successfully.', 'success');
      }

      closeModal();
    } catch (err) {
      console.error('Failed to save sponsor:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save sponsor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sponsor: Sponsor) => {
    if (!canManage) {
      showToast('You do not have permission to delete sponsors.', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this sponsor?')) {
      return;
    }

    setDeletingId(sponsor.id);
    try {
      await deleteSponsor(sponsor.id, sponsor.logoUrl);
      showToast('Sponsor removed successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete sponsor:', err);
      showToast(err instanceof Error ? err.message : 'Failed to delete sponsor.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--dash-text)' }}>
            <Handshake className="w-7 h-7 text-blue-500" />
            Sponsors Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Manage sponsor logos and external partner links displayed in the Home Page Sponsors carousel.
          </p>
        </div>

        {canManage && (
          <button
            onClick={openAddModal}
            className="btn-primary flex items-center gap-2 self-start sm:self-auto !py-2.5 !px-4 font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Sponsor
          </button>
        )}
      </div>

      {/* Sponsors Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : sponsors.length === 0 ? (
        <div className="dash-card text-center py-16 px-6 border-dashed" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>No sponsors added yet</h2>
          <p className="text-sm max-w-md mx-auto mt-1.5 leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
            Add your event sponsors and partners to feature their brand logos in a seamless horizontal carousel on the home page.
          </p>
          {canManage && (
            <button onClick={openAddModal} className="btn-primary mt-5 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add First Sponsor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="dash-card flex flex-col justify-between overflow-hidden group hover:border-blue-500/40 transition-all duration-200"
              style={{ borderColor: 'var(--dash-border)' }}
            >
              {/* Logo Preview Container */}
              <div className="p-5 flex items-center justify-center min-h-[140px] rounded-xl bg-white/[0.03] border border-white/5 relative">
                <img
                  src={sponsor.logoUrl}
                  alt="Sponsor logo"
                  className="max-h-20 max-w-[85%] object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Sponsor Details & Actions */}
              <div className="p-4 pt-3 flex flex-col gap-3 flex-1 justify-between">
                <div className="min-w-0">
                  {sponsor.websiteUrl ? (
                    <a
                      href={sponsor.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5 truncate max-w-full"
                      title={sponsor.websiteUrl}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{sponsor.websiteUrl.replace(/^https?:\/\//i, '')}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs italic opacity-50 flex items-center gap-1.5" style={{ color: 'var(--dash-muted)' }}>
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      No website URL
                    </span>
                  )}
                  <p className="text-[10px] mt-1 opacity-60" style={{ color: 'var(--dash-muted)' }}>
                    Added {new Date(sponsor.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                    <button
                      type="button"
                      onClick={() => openEditModal(sponsor)}
                      className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1"
                      title="Edit Sponsor"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sponsor)}
                      disabled={deletingId === sponsor.id}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      title="Delete Sponsor"
                    >
                      {deletingId === sponsor.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Sponsor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="dash-card w-full max-w-md p-6 rounded-2xl shadow-2xl relative space-y-5 animate-scale-up"
            style={{ background: 'var(--dash-sidebar)', borderColor: 'var(--dash-border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dash-border)' }}>
              <h2 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                {editingSponsor ? 'Edit Sponsor' : 'Add New Sponsor'}
              </h2>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Logo Upload Section */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Sponsor Logo *
                </label>

                {previewUrl ? (
                  <div className="p-4 rounded-xl border flex flex-col items-center justify-center gap-3 bg-white/[0.02]" style={{ borderColor: 'var(--dash-border)' }}>
                    <img
                      src={previewUrl}
                      alt="Logo preview"
                      className="max-h-24 max-w-[80%] object-contain"
                    />
                    <label className="btn-outline !py-1.5 !px-3 text-xs cursor-pointer flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>Replace Logo File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleFileChange}
                        disabled={submitting}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/60 transition-colors bg-white/[0.02]" style={{ borderColor: 'var(--dash-border)' }}>
                    <ImagePlus className="w-8 h-8 text-blue-400 mb-2" />
                    <p className="text-xs font-bold" style={{ color: 'var(--dash-text)' }}>
                      Click to upload sponsor logo
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                      PNG, SVG, JPG, WebP (Transparent background recommended)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleFileChange}
                      disabled={submitting}
                    />
                  </label>
                )}
              </div>

              {/* Website URL Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Website URL (Optional)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://sponsor.com"
                    className="input-field !pl-9"
                    disabled={submitting}
                  />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  If provided, visitors clicking the logo on the home page will open this link in a new tab.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!editingSponsor && !selectedFile)}
                  className="btn-primary flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingSponsor ? 'Update Sponsor' : 'Add Sponsor'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
