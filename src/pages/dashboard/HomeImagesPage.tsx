import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import { getHomeImagesConfig, updateHomeImagesConfig } from '../../services/applicationService';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, ImagePlus, Trash2, Save, UploadCloud, Eye, EyeOff, Loader2, Plus, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, SUPABASE_BUCKET, SUPABASE_QUOTA_MB } from '../../utils/supabase';

export default function HomeImagesPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [showHomeImages, setShowHomeImages] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Storage usage state
  const [storageUsedBytes, setStorageUsedBytes] = useState<number>(0);
  const quotaMb = SUPABASE_QUOTA_MB || 512;
  const quotaBytes = quotaMb * 1024 * 1024;
  const [loadingStorage, setLoadingStorage] = useState(false);

  useEffect(() => {
    getHomeImagesConfig()
      .then((config) => {
        setImages(config.images || []);
        setShowHomeImages(config.showHomeImages !== false);
      })
      .catch((err) => {
        console.error('Failed to load home images config', err);
      });

    fetchStorageUsage();
  }, []);

  async function fetchStorageUsage() {
    if (!supabase || !SUPABASE_BUCKET) return;
    setLoadingStorage(true);
    try {
      let total = 0;
      const { data: listData, error: listError } = await supabase.storage.from(SUPABASE_BUCKET).list('', { limit: 1000 });
      if (listError) throw listError;
      if (!listData) {
        setStorageUsedBytes(0);
        return;
      }

      for (const item of listData as any[]) {
        if (item?.size) {
          total += Number(item.size);
          continue;
        }
        const filePath = item?.name || item?.id;
        if (!filePath) continue;

        try {
          // @ts-ignore
          const metaRes = await supabase.storage.from(SUPABASE_BUCKET).getMetadata(filePath);
          if (metaRes?.data?.metadata?.size) {
            total += Number(metaRes.data.metadata.size);
            continue;
          }
        } catch {
          // ignore
        }

        try {
          const { data: blob, error: dlErr } = await supabase.storage.from(SUPABASE_BUCKET).download(filePath);
          if (dlErr || !blob) continue;
          const arrayBuffer = await blob.arrayBuffer();
          total += arrayBuffer.byteLength;
        } catch {
          // ignore single file failures
        }
      }

      setStorageUsedBytes(total);
    } catch (e) {
      console.error('Failed to fetch storage usage', e);
    } finally {
      setLoadingStorage(false);
    }
  }

  // Handle uploading one or multiple new images
  const handleAddNewFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/\s+/g, '_');
        const path = `home_banners/${Date.now()}_${i}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;

        let publicUrl = '';
        try {
          const res = await supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
          if (res?.data?.publicUrl) publicUrl = res.data.publicUrl;
        } catch {
          // fallback
        }
        if (!publicUrl) {
          publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(path)}`;
        }

        newUrls.push(publicUrl);
      }

      const updated = [...images, ...newUrls];
      setImages(updated);
      showToast(`${newUrls.length} image(s) uploaded successfully. Click Save to publish.`, 'success');
      fetchStorageUsage();
    } catch (err) {
      console.error('Upload failed', err);
      showToast(err instanceof Error ? err.message : 'Image upload failed', 'error');
    } finally {
      setUploading(false);
      // Reset input value so same files can be re-selected if needed
      event.target.value = '';
    }
  };

  // Replace a specific image at index
  const handleReplaceFile = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const safeName = file.name.replace(/\s+/g, '_');
      const path = `home_banners/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      let publicUrl = '';
      try {
        const res = await supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
        if (res?.data?.publicUrl) publicUrl = res.data.publicUrl;
      } catch {
        // fallback
      }
      if (!publicUrl) {
        publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(path)}`;
      }

      setImages((curr) => {
        const copy = [...curr];
        copy[index] = publicUrl;
        return copy;
      });
      showToast('Image replaced. Click Save to publish changes.', 'success');
      fetchStorageUsage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Replacement upload failed', 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    const removedUrl = images[index];
    setImages((curr) => curr.filter((_, idx) => idx !== index));

    if (!removedUrl) return;

    try {
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const publicPrefix = `${base}/storage/v1/object/public/${SUPABASE_BUCKET}/`;
      let path = removedUrl;
      if (removedUrl.startsWith('http')) {
        const idx = removedUrl.indexOf(publicPrefix);
        if (idx !== -1) {
          path = decodeURIComponent(removedUrl.substring(idx + publicPrefix.length));
        } else {
          const parts = removedUrl.split(`/${SUPABASE_BUCKET}/`);
          if (parts.length > 1) path = decodeURIComponent(parts[1]);
          else return;
        }
      }

      await supabase.storage.from(SUPABASE_BUCKET).remove([path]);
      fetchStorageUsage();
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateHomeImagesConfig(images, showHomeImages);
      showToast('Landing page images & settings saved successfully!', 'success');
      fetchStorageUsage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!profile || !isSuperAdmin(profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center p-8 rounded-3xl border bg-white/80 shadow-sm">
          <p className="text-lg font-semibold">Not authorized</p>
          <p className="text-sm text-slate-500 mt-2">Only superadmins can manage the landing page images.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-700 text-sm font-medium mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Landing Page Images</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Manage multiple showcase banner photos displayed on the public home landing page.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || uploading}
          className="btn-primary !py-3 !px-6 flex items-center gap-2 font-bold cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Visibility Toggle Card */}
      <div className="rounded-3xl border p-5 sm:p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-2xl ${showHomeImages ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-400'}`}>
              {showHomeImages ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
                Display Images on Landing Page
              </h3>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                {showHomeImages
                  ? 'Landing showcase banner section is currently VISIBLE to all visitors on the homepage.'
                  : 'Landing showcase banner section is currently HIDDEN from the public homepage.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHomeImages(!showHomeImages)}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              showHomeImages
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {showHomeImages ? '✓ Visible (Enabled)' : '✕ Hidden (Disabled)'}
          </button>
        </div>
      </div>

      {/* Storage Quota Monitor */}
      <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
          <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
            <HardDrive className="w-4 h-4 text-blue-500" />
            <span>Storage Used ({SUPABASE_BUCKET})</span>
          </div>
          <div style={{ color: 'var(--dash-muted)' }}>
            {loadingStorage ? 'Calculating...' : `${(storageUsedBytes / (1024 * 1024)).toFixed(2)} MB / ${quotaMb} MB`}
          </div>
        </div>
        <div className="w-full bg-slate-200/40 h-2 rounded-full overflow-hidden">
          <div
            className="bg-blue-500 h-2 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((storageUsedBytes / quotaBytes) * 100))}%` }}
          />
        </div>
      </div>

      {/* Images Grid — Unlimited Multiple Images */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">
            Showcase Images ({images.length} configured)
          </h3>
          <label className="btn-secondary !py-2 !px-4 text-xs font-bold cursor-pointer inline-flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-500" />
            <span>Upload Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddNewFiles}
              disabled={uploading}
            />
          </label>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((url, index) => (
            <div
              key={index}
              className="group relative rounded-3xl border overflow-hidden p-3 flex flex-col justify-between transition-all hover:border-blue-500/50 hover:shadow-xl"
              style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
            >
              <div className="relative h-44 w-full rounded-2xl overflow-hidden bg-slate-900 mb-3">
                <img src={url} alt={`Landing ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-mono text-white">
                  #{index + 1}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                <label className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer">
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleReplaceFile(index, e)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Add Image Upload Card */}
          <label className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] transition-colors bg-white/[0.02] hover:bg-blue-500/[0.03]">
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-blue-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs font-semibold">Uploading to Supabase...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">Add Showcase Photos</p>
                  <p className="text-[11px] text-slate-500 mt-1">Select one or multiple images</p>
                </div>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddNewFiles}
              disabled={uploading}
            />
          </label>
        </div>

        {images.length === 0 && !uploading && (
          <div className="mt-4 rounded-3xl border border-dashed p-8 text-center" style={{ borderColor: 'var(--dash-border)' }}>
            <UploadCloud className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>No images uploaded yet</p>
            <p className="text-xs text-slate-500 mt-1">Upload multiple photos from your device to showcase activities on the homepage.</p>
          </div>
        )}
      </div>
    </div>
  );
}
