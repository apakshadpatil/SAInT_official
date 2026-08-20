import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import { getHomeImages, updateHomeImages } from '../../services/applicationService';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, ImagePlus, Trash2, Save, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, SUPABASE_BUCKET, SUPABASE_QUOTA_MB } from '../../utils/supabase';

const MAX_IMAGES = 3;

export default function HomeImagesPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<(string | null)[]>(Array(MAX_IMAGES).fill(null));
  const [loading, setLoading] = useState(false);

  // Storage usage state
  const [storageUsedBytes, setStorageUsedBytes] = useState<number>(0);
  const quotaMb = SUPABASE_QUOTA_MB || 512; // default 512MB
  const quotaBytes = quotaMb * 1024 * 1024;
  const [loadingStorage, setLoadingStorage] = useState(false);

  useEffect(() => {
    getHomeImages()
      .then((savedImages) => {
        setImages(savedImages.slice(0, MAX_IMAGES));
        setPendingFiles(Array(MAX_IMAGES).fill(null));
      })
      .catch((err) => {
        console.error('Failed to load home images', err);
      });

    // fetch storage usage on mount
    fetchStorageUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch storage usage after uploads/removals
  useEffect(() => {
    fetchStorageUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, pendingFiles]);

  async function fetchStorageUsage() {
    if (!supabase || !SUPABASE_BUCKET) return;
    setLoadingStorage(true);
    try {
      let total = 0;
      // list files in bucket root (supabase list may return folders and files)
      const { data: listData, error: listError } = await supabase.storage.from(SUPABASE_BUCKET).list('', { limit: 1000 });
      if (listError) throw listError;
      if (!listData) {
        setStorageUsedBytes(0);
        return;
      }

      // listData items may represent files or folders; if item.size exists use it, otherwise try to fetch metadata
      for (const item of listData as any[]) {
        if (item?.size) {
          total += Number(item.size);
          continue;
        }
        const filePath = item?.name || item?.id;
        if (!filePath) continue;

        // try getMetadata
        try {
          // @ts-ignore
          const metaRes = await supabase.storage.from(SUPABASE_BUCKET).getMetadata(filePath);
          if (metaRes?.data?.metadata?.size) {
            total += Number(metaRes.data.metadata.size);
            continue;
          }
        } catch (e) {
          // ignore
        }

        // fallback: download and measure
        try {
          const { data: blob, error: dlErr } = await supabase.storage.from(SUPABASE_BUCKET).download(filePath);
          if (dlErr || !blob) continue;
          const arrayBuffer = await blob.arrayBuffer();
          total += arrayBuffer.byteLength;
        } catch (e) {
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

  const handleFileChange = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

      try {
        const safeName = file.name.replace(/\s+/g, '_');
        const path = `home_banners/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file as File, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;

        // Try to get the public URL; fall back to constructing the public URL path
        // getPublicUrl may return { data: { publicUrl } } depending on SDK version
        // use a safe fallback to the known public storage URL structure
        let publicUrl = '';
        try {
          const res = await supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
          if (res?.data?.publicUrl) publicUrl = res.data.publicUrl;
        } catch (e) {
          // ignored - will use fallback
        }
        if (!publicUrl) {
          publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(path)}`;
        }

        setPendingFiles((current) => current.map((item, idx) => (idx === index ? publicUrl : item)));
      } catch (err) {
        console.error('Supabase upload failed', err);
        showToast(err instanceof Error ? err.message : 'Image upload failed', 'error');
      }
    };

  const handleRemove = async (index: number) => {
    // Determine which URL/path is being removed
    const removedUrl = pendingFiles[index] || images[index] || '';

    // Optimistically update UI
    setImages((curr) => curr.filter((_, idx) => idx !== index));
    setPendingFiles((curr) => curr.map((item, idx) => (idx === index ? null : item)));

    if (!removedUrl) return;

    try {
      // Try to extract storage path from public URL
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
          else {
            // Couldn't confidently map to a storage path; skip deletion
            return;
          }
        }
      }

      const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove([path]);
      if (error) {
        console.warn('Failed to delete object from Supabase:', error.message || error);
        showToast('Image removed from UI but could not be deleted from storage.', 'info');
      } else {
        showToast('Image removed and storage object deleted.', 'success');
      }
    } catch (err) {
      console.error('Error deleting storage object', err);
      showToast('Image removed from UI but deletion failed in background.', 'info');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const nextImages = Array.from({ length: MAX_IMAGES }, (_, index) => {
        if (pendingFiles[index]) return pendingFiles[index] as string;
        return images[index] ?? '';
      }).filter(Boolean);
      await updateHomeImages(nextImages);
      setImages(nextImages);
      setPendingFiles(Array(MAX_IMAGES).fill(null));
      showToast('Landing page images updated successfully.', 'success');
      // refresh storage usage after changes
      fetchStorageUsage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save images', 'error');
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-700 text-sm font-medium mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Landing Page Images</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Upload up to three banner images for the public home page.</p>

          {/* Storage usage progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="text-slate-600">Storage used for bucket "{SUPABASE_BUCKET}"</div>
              <div className="text-slate-500">{loadingStorage ? 'Calculating...' : `${(storageUsedBytes / (1024*1024)).toFixed(2)} MB / ${quotaMb} MB`}</div>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-2" style={{ width: `${Math.min(100, Math.round((storageUsedBytes / quotaBytes) * 100))}%` }} />
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-primary !py-3 !px-5">
          <Save className="w-4 h-4" /> Save Images
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: MAX_IMAGES }, (_, index) => {
          const preview = pendingFiles[index] || images[index] || '';
          return (
            <label key={index} className="block rounded-3xl border border-dashed border-slate-300 p-4 text-center cursor-pointer hover:border-blue-400 transition-colors">
              <div className="flex h-44 items-center justify-center rounded-3xl bg-slate-100 overflow-hidden mb-4">
                {preview ? (
                  <img src={preview} alt={`Landing preview ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <div className="flex items-center gap-2">
                      <ImagePlus className="w-6 h-6" />
                      <UploadCloud className="w-5 h-5 text-slate-400" />
                    </div>
                    <span className="text-sm">Choose file from device</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFileChange(index, event)} />
              {preview && (
                <button type="button" onClick={(event) => { event.stopPropagation(); handleRemove(index); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              )}
            </label>
          );
        })}
      </div>

      {!images.length && pendingFiles.every((item) => !item) && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
          No images are currently configured for the landing page.
        </div>
      )}
    </div>
  );
}
