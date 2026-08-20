import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeEvents,
  createEvent,
  getUpcomingEvents,
  getPastEvents,
} from '../../services/eventService';
import type { EventRecord } from '../../types';
import { canCreateEvents, canEditEvents } from '../../utils/permissions';
import { fileToDataUrl, MAX_INLINE_FILE_SIZE, formatFileSize } from '../../utils/fileUtils';
import { uploadFileToSupabase, supabase, SUPABASE_BUCKET, SUPABASE_QUOTA_MB } from '../../utils/supabase';
import { Calendar, Clock, MapPin, Plus, Image, LayoutGrid, List } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';
import { useToast } from '../../contexts/ToastContext';

export default function EventsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventRecord[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formLoc, setFormLoc] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formImage, setFormImage] = useState('');
  const [bannersDisabled, setBannersDisabled] = useState<boolean>(() => {
    try { return localStorage.getItem('disableEventBanners') === '1'; } catch { return false; }
  });
  const [formStatus, setFormStatus] = useState<EventRecord['status']>('published');
  const [storageUsedBytes, setStorageUsedBytes] = useState<number>(0);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const quotaMb = SUPABASE_QUOTA_MB || 512;
  const quotaBytes = quotaMb * 1024 * 1024;
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => { const unsub = subscribeEvents(setEvents); return unsub; }, []);
  useEffect(() => { fetchStorageUsage(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStorageUsage() {
    if (!supabase) return;
    setLoadingStorage(true);
    try {
      let total = 0;
      const limit = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).list('events', { limit, offset });
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const item of data as any[]) {
          if (typeof item.size === 'number') total += Number(item.size);
        }
        if (data.length < limit) break;
        offset += data.length;
      }
      setStorageUsedBytes(total);
    } catch (e) {
      console.error('Failed to fetch events storage usage', e);
    } finally {
      setLoadingStorage(false);
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dest = `events/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const url = await uploadFileToSupabase(file as File, dest);
      setFormImage(url);
      showToast('Image uploaded successfully.', 'success');
      fetchStorageUsage();
      return;
    } catch (err) {
      console.warn('Supabase upload failed, attempting data URL fallback', err);
      if (bannersDisabled) { showToast('Banner uploads are disabled.', 'info'); return; }
      showToast('Storage upload failed. Using inline preview for small files.', 'info');
    }
    if (file.size > MAX_INLINE_FILE_SIZE) {
      showToast(`Image too large (≤ ${formatFileSize(MAX_INLINE_FILE_SIZE)}).`, 'error');
      return;
    }
    try {
      const { dataUrl } = await fileToDataUrl(file);
      const b64 = dataUrl.split(',')[1] || '';
      const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
      const bytes = Math.ceil((b64.length * 3) / 4) - padding;
      if (bytes > 1048487) { showToast('Image too large for inline storage.', 'error'); return; }
      setFormImage(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to read image', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const payload: Partial<EventRecord> = {
        title: formTitle, description: formDesc, date: formDate,
        startTime: formStartTime, endTime: formEndTime, location: formLoc,
        venue: formVenue, status: formStatus, participantIds: [],
        createdBy: profile.uid, createdByName: profile.displayName,
      };
      if (formImage) {
        if (formImage.startsWith('data:')) {
          const parts = formImage.split(',');
          const b64 = parts[1] || '';
          const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
          const bytes = Math.ceil((b64.length * 3) / 4) - padding;
          if (bytes > 1048487) {
            try {
              const mimeMatch = parts[0].match(/data:(.*?);base64/);
              const mime = mimeMatch ? mimeMatch[1] : 'image/png';
              const binary = atob(b64);
              let n = binary.length;
              const u8 = new Uint8Array(n);
              while (n--) u8[n] = binary.charCodeAt(n);
              const blob = new Blob([u8], { type: mime });
              const f = new File([blob], `event_inline_${Date.now()}.${mime.split('/')[1] || 'png'}`, { type: mime });
              const dest = `events/${Date.now()}_inline.${mime.split('/')[1] || 'png'}`;
              const url = await uploadFileToSupabase(f, dest);
              payload.imageURL = url;
            } catch { showToast('Image too large — upload failed.', 'error'); return; }
          } else { payload.imageURL = formImage; }
        } else { payload.imageURL = formImage; }
      }
      await createEvent(payload as Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt'>);
      showToast('Event created successfully.', 'success');
      setIsCreating(false);
      resetForm();
      fetchStorageUsage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create event.', 'error');
    }
  };

  const resetForm = () => {
    setFormTitle(''); setFormDesc(''); setFormDate(''); setFormStartTime('');
    setFormEndTime(''); setFormLoc(''); setFormVenue(''); setFormImage('');
    setFormStatus('published');
  };

  const upcoming = getUpcomingEvents(events);
  const past = getPastEvents(events);
  const filtered = activeTab === 'upcoming' ? upcoming : past;

  const storagePercent = Math.min(100, Math.round((storageUsedBytes / quotaBytes) * 100));

  return (
    <div className="space-y-0">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Events</h1>
          <p className="page-header-sub">Schedule and track student association events</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border" style={{ borderColor: 'var(--dash-border)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 transition-all"
              style={{ background: viewMode === 'grid' ? 'var(--dash-accent-soft)' : 'transparent', color: viewMode === 'grid' ? 'var(--dash-accent)' : 'var(--dash-muted)', border: 'none', cursor: 'pointer' }}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 transition-all"
              style={{ background: viewMode === 'list' ? 'var(--dash-accent-soft)' : 'transparent', color: viewMode === 'list' ? 'var(--dash-accent)' : 'var(--dash-muted)', border: 'none', cursor: 'pointer', borderLeft: '1px solid var(--dash-border)' }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {canCreateEvents(profile) && (
            <button onClick={() => { resetForm(); setIsCreating(true); }} className="btn-primary">
              <Plus className="w-4 h-4" /> New Event
            </button>
          )}
          {canEditEvents(profile) && (
            <button
              onClick={() => {
                const newVal = !bannersDisabled;
                try { localStorage.setItem('disableEventBanners', newVal ? '1' : '0'); } catch {}
                setBannersDisabled(newVal);
                showToast(newVal ? 'Banner images disabled.' : 'Banner images enabled.', 'info');
              }}
              className="btn-outline"
            >
              {bannersDisabled ? 'Enable Banners' : 'Disable Banners'}
            </button>
          )}
        </div>
      </div>

      {/* ── Storage Bar ── */}
      <div className="dash-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Image className="w-3.5 h-3.5" style={{ color: 'var(--dash-muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--dash-muted)' }}>Banner Storage ({SUPABASE_BUCKET})</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
            {loadingStorage ? 'Calculating…' : `${(storageUsedBytes / (1024 * 1024)).toFixed(2)} MB / ${quotaMb} MB`}
          </span>
        </div>
        <div className="w-full h-1.5 overflow-hidden" style={{ background: 'var(--dash-border)', borderRadius: '999px' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${storagePercent}%`,
              background: storagePercent > 80 ? '#ef4444' : storagePercent > 60 ? '#f59e0b' : 'var(--dash-accent)',
              borderRadius: '999px',
            }}
          />
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="tab-bar">
        <button className={`tab-item${activeTab === 'upcoming' ? ' active' : ''}`} onClick={() => setActiveTab('upcoming')}>
          Upcoming <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5" style={{ background: 'var(--dash-hover)', borderRadius: '4px' }}>{upcoming.length}</span>
        </button>
        <button className={`tab-item${activeTab === 'past' ? ' active' : ''}`} onClick={() => setActiveTab('past')}>
          Past <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5" style={{ background: 'var(--dash-hover)', borderRadius: '4px' }}>{past.length}</span>
        </button>
      </div>

      {/* ── Events Grid / List ── */}
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <div
              key={event.id}
              onClick={() => navigate(`/dashboard/events/${event.id}`)}
              className="dash-card !p-0 cursor-pointer overflow-hidden flex flex-col"
              style={{ transition: 'border-color 0.15s, box-shadow 0.15s' }}
            >
              {/* Banner */}
              {event.imageURL ? (
                <div className="h-36 overflow-hidden shrink-0">
                  <img src={event.imageURL} alt={event.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className="h-36 flex items-center justify-center shrink-0 border-b"
                  style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-accent-soft)' }}
                >
                  <Calendar className="w-8 h-8" style={{ color: 'var(--dash-accent)', opacity: 0.5 }} />
                </div>
              )}

              <div className="p-4 flex flex-col flex-1">
                {/* Meta row */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5"
                    style={{
                      background: event.status === 'published' ? 'rgba(16,185,129,0.08)' : 'var(--dash-hover)',
                      color: event.status === 'published' ? '#10b981' : 'var(--dash-muted)',
                      border: `1px solid ${event.status === 'published' ? 'rgba(16,185,129,0.2)' : 'var(--dash-border)'}`,
                      borderRadius: '4px',
                    }}
                  >
                    {event.status}
                  </span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--dash-muted)' }}>
                    {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <h3 className="font-bold text-sm leading-snug line-clamp-1 mb-1" style={{ color: 'var(--dash-text)' }}>
                  {event.title}
                </h3>
                <p className="text-xs line-clamp-2 leading-relaxed flex-1" style={{ color: 'var(--dash-muted)' }}>
                  {event.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    <Clock className="w-3 h-3" />
                    <span>{event.startTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[110px]">{event.location}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full">
              <div className="dash-card empty-state">
                <Calendar className="empty-state-icon" />
                <p className="empty-state-text">No events in this category</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="dash-card !p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Calendar className="empty-state-icon" />
              <p className="empty-state-text">No events in this category</p>
            </div>
          ) : (
            filtered.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/dashboard/events/${event.id}`)}
                className="data-row cursor-pointer"
              >
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--dash-accent-soft)', borderRadius: '6px' }}
                >
                  <Calendar className="w-4 h-4" style={{ color: 'var(--dash-accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--dash-text)' }}>{event.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>{event.date} · {event.startTime}</span>
                    <span className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                      <MapPin className="w-3 h-3 inline mr-0.5" />{event.location}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 shrink-0"
                  style={{
                    background: event.status === 'published' ? 'rgba(16,185,129,0.08)' : 'var(--dash-hover)',
                    color: event.status === 'published' ? '#10b981' : 'var(--dash-muted)',
                    border: `1px solid ${event.status === 'published' ? 'rgba(16,185,129,0.2)' : 'var(--dash-border)'}`,
                    borderRadius: '4px',
                  }}
                >
                  {event.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Create Event Drawer ── */}
      {isCreating && (
        <RightPanel open={isCreating} onClose={() => setIsCreating(false)} title="New Event" width="480px">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="field-label">Event Title *</label>
              <input className="input-field" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Description *</label>
              <textarea className="input-field min-h-[80px]" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Date *</label>
              <input className="input-field" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Start Time *</label>
                <input className="input-field" type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} required />
              </div>
              <div>
                <label className="field-label">End Time *</label>
                <input className="input-field" type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Location *</label>
                <input className="input-field" value={formLoc} onChange={(e) => setFormLoc(e.target.value)} placeholder="e.g. Auditorium" required />
              </div>
              <div>
                <label className="field-label">Venue Detail *</label>
                <input className="input-field" value={formVenue} onChange={(e) => setFormVenue(e.target.value)} placeholder="e.g. Block A, 3rd Floor" required />
              </div>
            </div>
            {!bannersDisabled ? (
              <div>
                <label className="field-label">Banner Image (Optional)</label>
                <input type="file" accept="image/*" className="input-field" onChange={handleImageUpload} />
                {formImage && <img src={formImage} alt="" className="mt-2 h-40 w-full object-cover" style={{ borderRadius: '6px' }} />}
              </div>
            ) : (
              <p className="text-xs py-2" style={{ color: 'var(--dash-muted)' }}>Banner images are disabled.</p>
            )}
            <div>
              <label className="field-label">Status</label>
              <select className="input-field" value={formStatus} onChange={(e) => setFormStatus(e.target.value as EventRecord['status'])}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full !py-3">Create Event</button>
          </form>
        </RightPanel>
      )}
    </div>
  );
}
