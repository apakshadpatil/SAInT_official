import { useEffect, useState, useMemo } from 'react';
import {
  subscribeDocuments,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocumentFile,
} from '../../services/documentService';
import { subscribeEvents } from '../../services/eventService';
import type { DocumentFile, EventRecord } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Download,
  Calendar,
  FileSpreadsheet,
  FileImage,
  FileCode,
  Search,
  Plus,
  Filter,
  Trash2,
  Upload,
  FolderOpen,
  CheckCircle2,
  Tag,
  Pencil,
  Ticket,
} from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';
import { isCoreMember } from '../../utils/permissions';
import { useToast } from '../../contexts/ToastContext';

const ACADEMIC_YEARS = ['All Years', '2026-2027', '2025-2026', '2024-2025', '2023-2024', '2022-2023'];
const FORM_ACADEMIC_YEARS = ['2026-2027', '2025-2026', '2024-2025', '2023-2024', '2022-2023'];
const DEFAULT_CATEGORIES = [
  'Guidebook & SOPs',
  'Activity & Event Reports',
  'Document Templates',
  'Official Circulars & Notices',
  'Meeting Minutes & Agendas',
  'General / Other',
];

export default function DocumentationPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);

  // Filter & View states
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedEventId, setSelectedEventId] = useState('All Events');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Upload drawer state
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [category, setCategory] = useState('Guidebook & SOPs');
  const [customCategory, setCustomCategory] = useState('');
  const [eventId, setEventId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Edit modal state
  const [editingDoc, setEditingDoc] = useState<DocumentFile | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAcademicYear, setEditAcademicYear] = useState('2025-2026');
  const [editCategory, setEditCategory] = useState('Guidebook & SOPs');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editEventId, setEditEventId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  const canManage = isCoreMember(profile);

  useEffect(() => {
    const unsubDocs = subscribeDocuments(setDocuments);
    const unsubEvents = subscribeEvents(setEvents);
    return () => {
      unsubDocs();
      unsubEvents();
    };
  }, []);

  const allCategories = useMemo(() => {
    return Array.from(
      new Set(['All Categories', ...DEFAULT_CATEGORIES, ...documents.map((d) => d.category).filter(Boolean) as string[]])
    );
  }, [documents]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUploadError('');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !file || !title.trim()) return;

    setUploading(true);
    setUploadError('');

    const finalCategory = category === '__CUSTOM__' ? customCategory.trim() || 'General / Other' : category;
    const selectedEvent = events.find((ev) => ev.id === eventId);

    try {
      await uploadDocument(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          academicYear,
          category: finalCategory,
          eventId: eventId || undefined,
          eventName: selectedEvent?.title || undefined,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploadedBy: profile.uid,
          uploadedByName: profile.displayName,
        },
        file
      );

      setTitle('');
      setDescription('');
      setCategory('Guidebook & SOPs');
      setCustomCategory('');
      setEventId('');
      setFile(null);
      showToast('Document uploaded successfully!', 'success');
      setIsUploading(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      showToast('Upload error occurred.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (docFile: DocumentFile) => {
    setEditingDoc(docFile);
    setEditTitle(docFile.title);
    setEditDescription(docFile.description || '');
    setEditAcademicYear(docFile.academicYear || '2025-2026');

    if (docFile.category && DEFAULT_CATEGORIES.includes(docFile.category)) {
      setEditCategory(docFile.category);
      setEditCustomCategory('');
    } else if (docFile.category) {
      setEditCategory('__CUSTOM__');
      setEditCustomCategory(docFile.category);
    } else {
      setEditCategory('General / Other');
      setEditCustomCategory('');
    }

    setEditEventId(docFile.eventId || '');
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editTitle.trim()) return;

    setUpdating(true);
    setEditError('');

    const finalCategory = editCategory === '__CUSTOM__' ? editCustomCategory.trim() || 'General / Other' : editCategory;
    const selectedEvent = events.find((ev) => ev.id === editEventId);

    try {
      await updateDocument(editingDoc.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        academicYear: editAcademicYear,
        category: finalCategory,
        eventId: editEventId || undefined,
        eventName: selectedEvent ? selectedEvent.title : editEventId ? editingDoc.eventName : undefined,
      });

      showToast('Document details updated.', 'success');
      setEditingDoc(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update document');
      showToast('Update failed.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocument(id);
      showToast('Document deleted.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const handleDownload = async (docFile: DocumentFile) => {
    setDownloadingId(docFile.id);
    try {
      await downloadDocumentFile(docFile);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const getFileIcon = (fileType: string = '') => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (type.includes('image')) return <FileImage className="w-5 h-5 text-amber-500" />;
    if (type.includes('code') || type.includes('json') || type.includes('html'))
      return <FileCode className="w-5 h-5 text-indigo-500" />;
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  // Filter documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !search.trim() ||
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.description?.toLowerCase().includes(search.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
        doc.uploadedByName.toLowerCase().includes(search.toLowerCase()) ||
        doc.eventName?.toLowerCase().includes(search.toLowerCase());

      const matchesYear = selectedYear === 'All Years' || doc.academicYear === selectedYear;
      const matchesCategory = selectedCategory === 'All Categories' || doc.category === selectedCategory;
      const matchesEvent = selectedEventId === 'All Events' || doc.eventId === selectedEventId;

      return matchesSearch && matchesYear && matchesCategory && matchesEvent;
    });
  }, [documents, search, selectedYear, selectedCategory, selectedEventId]);

  // Group by Academic Year
  const yearGroups = useMemo(() => {
    return FORM_ACADEMIC_YEARS.map((yr) => ({
      year: yr,
      docs: filteredDocs.filter((d) => (d.academicYear || '2025-2026') === yr),
    })).filter((group) => (selectedYear === 'All Years' ? group.docs.length > 0 : group.year === selectedYear));
  }, [filteredDocs, selectedYear]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Documentation & Vault</h1>
          <p className="page-header-sub">
            Curated archive of official guidebooks, activity reports, templates, and event-wise records
          </p>
        </div>

        {canManage && (
          <button onClick={() => setIsUploading(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>Upload Resource</span>
          </button>
        )}
      </div>

      {/* ── KPI Metrics Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: 'var(--dash-accent)' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Total Vault Files
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: 'var(--dash-text)' }}>
                {documents.length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Active documents recorded
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'var(--dash-accent-soft)', borderRadius: '6px' }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--dash-accent)' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#f59e0b' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Linked Events
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: '#f59e0b' }}>
                {events.length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Associated program archives
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px' }}
            >
              <Ticket className="w-4 h-4 text-amber-500" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#3b82f6' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Academic Years
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: '#3b82f6' }}>
                {FORM_ACADEMIC_YEARS.length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Historical records span
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px' }}
            >
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-accent-bar" style={{ background: '#10b981' }} />
          <div className="flex items-start justify-between mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                Cloud Sync
              </p>
              <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: '#10b981' }}>
                100%
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                Storage bucket active
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="dash-card !p-3 space-y-3" style={{ borderRadius: '6px' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
            <input
              type="text"
              placeholder="Search by title, description, filename, or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="dash-input !pl-8 !py-1.5 !text-xs !w-full"
              style={{ borderRadius: '4px' }}
            />
          </div>

          {/* Academic Year Selection Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {ACADEMIC_YEARS.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className="px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  background: selectedYear === yr ? 'var(--dash-accent)' : 'transparent',
                  color: selectedYear === yr ? '#ffffff' : 'var(--dash-muted)',
                  border: `1px solid ${selectedYear === yr ? 'var(--dash-accent)' : 'var(--dash-border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Category & Event Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
            <Filter className="w-3 h-3 shrink-0 opacity-60" style={{ color: 'var(--dash-muted)' }} />
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all"
                style={{
                  background: selectedCategory === cat ? 'var(--dash-accent-soft)' : 'var(--dash-hover)',
                  color: selectedCategory === cat ? 'var(--dash-accent)' : 'var(--dash-muted)',
                  border: `1px solid ${selectedCategory === cat ? 'var(--dash-accent)' : 'var(--dash-border)'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {events.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <Ticket className="w-3.5 h-3.5 text-amber-500" />
              <select
                className="dash-input !py-1 !px-2 !text-xs !w-auto"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ borderRadius: '4px' }}
              >
                <option value="All Events">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    Event: {ev.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Document List (Grouped by Year) ── */}
      <div className="space-y-6">
        {yearGroups.map((group) => (
          <div key={group.year} className="space-y-3">
            {/* Year Group Heading */}
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--dash-accent)' }} />
                <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--dash-text)' }}>
                  Academic Year {group.year}
                </h2>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5"
                style={{
                  background: 'var(--dash-hover)',
                  color: 'var(--dash-muted)',
                  border: '1px solid var(--dash-border)',
                  borderRadius: '4px',
                }}
              >
                {group.docs.length} resource{group.docs.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Document Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {group.docs.map((docFile) => (
                <div
                  key={docFile.id}
                  className="dash-card flex flex-col justify-between group transition-all duration-150"
                  style={{ borderRadius: '6px', borderColor: 'var(--dash-card-border)' }}
                >
                  <div>
                    {/* Header tags */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-7 h-7 flex items-center justify-center shrink-0"
                          style={{
                            background: 'var(--dash-hover)',
                            borderRadius: '4px',
                            border: '1px solid var(--dash-border)',
                          }}
                        >
                          {getFileIcon(docFile.fileType)}
                        </div>

                        {docFile.category && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 truncate max-w-[140px]"
                            style={{
                              background: 'var(--dash-hover)',
                              color: 'var(--dash-text)',
                              border: '1px solid var(--dash-border)',
                              borderRadius: '4px',
                            }}
                          >
                            {docFile.category}
                          </span>
                        )}
                      </div>

                      {docFile.eventName && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 truncate max-w-[120px]"
                          style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: '4px',
                          }}
                        >
                          {docFile.eventName}
                        </span>
                      )}
                    </div>

                    <h3
                      className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-blue-500 transition-colors"
                      style={{ color: 'var(--dash-text)' }}
                    >
                      {docFile.title}
                    </h3>
                    <p className="text-xs font-mono truncate mt-1" style={{ color: 'var(--dash-muted)' }}>
                      {docFile.fileName}
                    </p>
                    {docFile.description && (
                      <p className="text-xs line-clamp-2 mt-1.5 leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                        {docFile.description}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between pt-3 mt-4 border-t text-xs"
                    style={{ borderColor: 'var(--dash-border)' }}
                  >
                    <span className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>
                      By {docFile.uploadedByName?.split(' ')[0] || 'Member'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(docFile)}
                        disabled={downloadingId === docFile.id}
                        className="btn-outline !py-1 !px-2 !text-xs font-semibold"
                        style={{ borderRadius: '4px' }}
                      >
                        <Download className="w-3 h-3" />
                        <span>{downloadingId === docFile.id ? 'Fetching...' : 'Get'}</span>
                      </button>

                      {(canManage || docFile.uploadedBy === profile?.uid) && (
                        <>
                          <button
                            onClick={() => openEditModal(docFile)}
                            className="p-1.5 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                            title="Edit details"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(docFile.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {yearGroups.length === 0 && (
          <div
            className="py-16 text-center dash-card border-dashed flex flex-col items-center justify-center"
            style={{ borderRadius: '6px' }}
          >
            <FolderOpen className="w-8 h-8 mb-2 opacity-30" style={{ color: 'var(--dash-text)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
              No documentation found
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Try changing the search query or year filter.
            </p>
          </div>
        )}
      </div>

      {/* ── Upload Drawer ── */}
      {isUploading && (
        <RightPanel open={isUploading} onClose={() => setIsUploading(false)} title="Upload Vault Document" width="480px">
          {uploadError && (
            <div
              className="p-2.5 text-xs text-red-400 border border-red-500/20 mb-4"
              style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}
            >
              {uploadError}
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Document Title *
              </label>
              <input
                className="dash-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Activity Report 2025"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}>
                  <Calendar className="w-3 h-3 text-blue-500" /> Academic Year *
                </label>
                <select className="dash-input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required>
                  {FORM_ACADEMIC_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}>
                  <Tag className="w-3 h-3 text-purple-500" /> Category *
                </label>
                <select className="dash-input" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__CUSTOM__">+ Custom Category...</option>
                </select>
              </div>
            </div>

            {category === '__CUSTOM__' && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Custom Category Name *
                </label>
                <input
                  className="dash-input"
                  placeholder="e.g. Sponsorship Pitch Deck"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}>
                <Ticket className="w-3 h-3 text-amber-500" /> Event Association (Optional)
              </label>
              <select className="dash-input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">No Event Link (General Document)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Description (Optional)
              </label>
              <textarea
                className="dash-input min-h-[75px] resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide brief summary or guidelines..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                File Attachment *
              </label>
              <label
                className="flex flex-col items-center gap-2 cursor-pointer text-center border border-dashed p-5 transition hover:border-blue-500"
                style={{ borderColor: 'var(--dash-border)', borderRadius: '6px', background: 'var(--dash-hover)' }}
              >
                <Upload className="w-6 h-6 text-blue-500" />
                <span className="text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
                  {file ? file.name : 'Select file (PDF, Word, Excel, Images)'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>
                  Uploaded to Supabase Vault bucket
                </span>
                <input type="file" className="hidden" onChange={handleFileChange} required />
              </label>
            </div>

            <div className="pt-2">
              <button type="submit" className="btn-primary w-full !py-2.5 !text-xs font-bold" disabled={uploading || !file}>
                {uploading ? 'Uploading Resource...' : 'Confirm & Upload'}
              </button>
            </div>
          </form>
        </RightPanel>
      )}

      {/* ── Edit Drawer ── */}
      {editingDoc && (
        <RightPanel open={!!editingDoc} onClose={() => setEditingDoc(null)} title="Edit Resource Details" width="480px">
          {editError && (
            <div
              className="p-2.5 text-xs text-red-400 border border-red-500/20 mb-4"
              style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}
            >
              {editError}
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Document Title *
              </label>
              <input
                className="dash-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}>
                  <Calendar className="w-3 h-3 text-blue-500" /> Academic Year *
                </label>
                <select className="dash-input" value={editAcademicYear} onChange={(e) => setEditAcademicYear(e.target.value)} required>
                  {FORM_ACADEMIC_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}>
                  <Tag className="w-3 h-3 text-purple-500" /> Category *
                </label>
                <select className="dash-input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} required>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__CUSTOM__">+ Custom Category...</option>
                </select>
              </div>
            </div>

            {editCategory === '__CUSTOM__' && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Custom Category Name *
                </label>
                <input
                  className="dash-input"
                  value={editCustomCategory}
                  onChange={(e) => setEditCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--dash-muted)' }}>
                <Ticket className="w-3 h-3 text-amber-500" /> Event Association
              </label>
              <select className="dash-input" value={editEventId} onChange={(e) => setEditEventId(e.target.value)}>
                <option value="">No Event Link (General)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                Description
              </label>
              <textarea
                className="dash-input min-h-[75px] resize-none"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="pt-3 flex items-center gap-2">
              <button type="submit" className="btn-primary flex-1 !py-2.5 !text-xs font-bold" disabled={updating}>
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="btn-secondary !py-2.5 !text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </RightPanel>
      )}
    </div>
  );
}
