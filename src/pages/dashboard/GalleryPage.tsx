import { useEffect, useState } from 'react';
import { Eye, EyeOff, ImagePlus, Loader2, Save, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { isSuperAdmin } from '../../utils/permissions';
import { extractSupabasePathFromPublicUrl, removeFileFromSupabase, uploadFileToSupabase } from '../../utils/supabase';
import { getGalleryConfig, updateGalleryConfig } from '../../services/galleryService';
import type { GalleryImage } from '../../types';

export default function GalleryPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getGalleryConfig().then((config) => { setImages(config.images); setVisible(config.visible); }).catch(() => showToast('Unable to load gallery', 'error')).finally(() => setLoading(false)); }, [showToast]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !profile) return;
    setUploading(true);
    try {
      const newImages = await Promise.all(files.map(async (file, index) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `gallery/${Date.now()}_${index}_${safeName}`;
        const url = await uploadFileToSupabase(file, storagePath);
        return { id: `gallery_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`, url, storagePath, alt: file.name.replace(/\.[^.]+$/, ''), uploadedAt: new Date().toISOString(), uploadedBy: profile.uid, uploadedByName: profile.displayName || `${profile.firstName} ${profile.lastName}` } satisfies GalleryImage;
      }));
      setImages((current) => [...newImages, ...current]);
      showToast(`${newImages.length} photo(s) ready. Save to publish them.`, 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Gallery upload failed', 'error'); }
    finally { setUploading(false); event.target.value = ''; }
  };

  const remove = async (image: GalleryImage) => {
    setImages((current) => current.filter((item) => item.id !== image.id));
    try { await removeFileFromSupabase(image.storagePath || extractSupabasePathFromPublicUrl(image.url) || ''); } catch { showToast('Photo removed from this gallery; its storage cleanup will be retried later.', 'info'); }
  };
  const save = async () => { setSaving(true); try { await updateGalleryConfig(images, visible); showToast('Gallery settings published.', 'success'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not publish gallery', 'error'); } finally { setSaving(false); } };

  if (!profile || !isSuperAdmin(profile)) return <div className="dash-card text-center py-16"><p className="font-semibold">Not authorized</p><p className="text-sm mt-2" style={{ color: 'var(--dash-muted)' }}>Only superadmins can manage the public gallery.</p></div>;
  if (loading) return <div className="h-48 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return <div className="space-y-6 animate-fade-in-up"><div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Gallery</h1><p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Upload photos to the Supabase <code>gallery/</code> folder and control public visibility.</p></div><button onClick={save} disabled={saving || uploading} className="btn-primary inline-flex justify-center items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Publish changes</button></div><div className="rounded-2xl border p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}><div className="flex gap-3"><div className={`p-3 rounded-xl ${visible ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>{visible ? <Eye /> : <EyeOff />}</div><div><h2 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Public gallery visibility</h2><p className="text-sm" style={{ color: 'var(--dash-muted)' }}>{visible ? 'Gallery is visible on the website.' : 'Gallery is hidden from public visitors.'}</p></div></div><button onClick={() => setVisible((current) => !current)} className="btn-secondary">Turn {visible ? 'off' : 'on'}</button></div><label className="rounded-2xl border-2 border-dashed p-8 flex flex-col items-center cursor-pointer" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}><UploadCloud className="w-8 h-8 mb-3 text-blue-600" /><span className="font-semibold" style={{ color: 'var(--dash-text)' }}>Add gallery photos</span><span className="text-sm mt-1">PNG, JPG, WebP or GIF — select one or more files</span><input type="file" accept="image/*" multiple className="sr-only" onChange={upload} disabled={uploading} /></label>{uploading && <p className="text-sm text-blue-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading photos…</p>}<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{images.map((image) => <div key={image.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}><img src={image.url} alt={image.alt || 'Gallery'} className="aspect-square w-full object-cover" /><div className="p-3 flex gap-2"><input value={image.alt || ''} onChange={(event) => setImages((current) => current.map((item) => item.id === image.id ? { ...item, alt: event.target.value } : item))} className="input-field !py-2 text-xs min-w-0" placeholder="Photo caption" /><button onClick={() => remove(image)} className="p-2 text-red-500" aria-label="Remove photo"><Trash2 className="w-4 h-4" /></button></div></div>)}</div>{images.length === 0 && <div className="text-center py-10 text-sm" style={{ color: 'var(--dash-muted)' }}><ImagePlus className="w-7 h-7 mx-auto mb-2" />No gallery photos yet.</div>}</div>;
}
