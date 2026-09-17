import { useState, useEffect, useRef } from 'react';
import type { EventRecord, EventParticipant, EventTicket } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'qrcode';
import {
  Download,
  Trash2,
  UserCheck,
  UserPlus,
  RotateCcw,
  CheckSquare,
  Square,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  Eye,
  ExternalLink,
  X,
  MessageCircle,
  UploadCloud,
  Check,
  AlertCircle,
  Maximize2,
} from 'lucide-react';
import {
  updateParticipantArrivalStatus,
  batchUpdateParticipantsArrival,
  updatePaymentVerificationStatus,
  registerParticipantForEvent,
} from '../../services/eventService';
import { downloadTicketImage } from '../../utils/ticketDownload';
import { uploadFileToSupabase } from '../../utils/supabase';
import { logActivity } from '../../services/activityService';

interface ParticipantsTabProps {
  event: EventRecord;
  canEdit: boolean;
  canDelete: boolean;
  onParticipantsChange?: (participants: EventParticipant[]) => Promise<void>;
}

export default function ParticipantsTab({ event, canEdit, canDelete, onParticipantsChange }: ParticipantsTabProps) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'arrived' | 'pending'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [proofModalParticipant, setProofModalParticipant] = useState<EventParticipant | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  // Manual participant registration state
  const formRef = useRef<HTMLDivElement>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedTierId, setSelectedTierId] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'verified' | 'pending' | 'rejected'>('verified');
  const [paymentScreenshotFile, setPaymentScreenshotFile] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string>('');
  const [paymentScreenshotError, setPaymentScreenshotError] = useState<string>('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>('');
  const [showFullQRModal, setShowFullQRModal] = useState(false);

  // Success ticket state after manual registration
  const [successTicket, setSuccessTicket] = useState<EventTicket | null>(null);
  const [successQrUrl, setSuccessQrUrl] = useState<string>('');
  const [downloadingTicket, setDownloadingTicket] = useState(false);

  useEffect(() => {
    if (event.participants) {
      setParticipants(event.participants);
    }
  }, [event.participants]);

  const handleOpenRegisterModal = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCollege('');
    setDepartment('');
    setSelectedTierId(event.ticketTiers?.[0]?.id || '');
    setSelectedDomainId(event.participantDomains?.[0]?.id || '');
    setTransactionId('');
    setPaymentStatus('verified');
    setPaymentScreenshotFile(null);
    setPaymentScreenshotPreview('');
    setPaymentScreenshotError('');
    setCustomResponses({});
    setFormError('');
    setSuccessTicket(null);
    setSuccessQrUrl('');
    setShowRegisterModal(true);

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const handleScreenshotChange = (file: File | null) => {
    setPaymentScreenshotError('');
    if (!file) {
      setPaymentScreenshotFile(null);
      setPaymentScreenshotPreview('');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPaymentScreenshotError('Please upload a valid image (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPaymentScreenshotError('Image size must be less than 5 MB.');
      return;
    }
    setPaymentScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      const msg = 'Participant full name is required';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    setRegistering(true);
    try {
      // 1. Duplicate check
      const normEmail = email.trim().toLowerCase();
      const normPhone = phone.trim().replace(/\D/g, '');

      const isDuplicateParticipant = participants.some((p) => {
        const pEmail = p.email?.trim().toLowerCase();
        const pPhone = p.phone?.trim().replace(/\D/g, '');
        if (normEmail && pEmail && pEmail === normEmail) return true;
        if (normPhone && pPhone && pPhone === normPhone) return true;
        return false;
      });

      const teams = event.teams || [];
      const isDuplicateInTeams = teams.some((t) => {
        const tEmail = t.leadEmail?.trim().toLowerCase();
        const tPhone = t.leadPhone?.trim().replace(/\D/g, '');
        if (normEmail && tEmail && tEmail === normEmail) return true;
        if (normPhone && tPhone && tPhone === normPhone) return true;
        return (t.members || []).some((m) => {
          const mEmail = m.email?.trim().toLowerCase();
          const mPhone = m.phone?.trim().replace(/\D/g, '');
          if (normEmail && mEmail && mEmail === normEmail) return true;
          if (normPhone && mPhone && mPhone === normPhone) return true;
          return false;
        });
      });

      if (isDuplicateParticipant || isDuplicateInTeams) {
        const dupMsg = 'Existing registration found for this event.';
        setFormError(dupMsg);
        showToast(dupMsg, 'error');
        setRegistering(false);
        return;
      }

      // 2. Upload payment proof if provided
      let uploadedProofUrl = '';
      let uploadedProofPath = '';
      if (paymentScreenshotFile) {
        const cleanFileName = paymentScreenshotFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedProofPath = `payment_proofs/${event.id}/${Date.now()}_${cleanFileName}`;
        uploadedProofUrl = await uploadFileToSupabase(paymentScreenshotFile, uploadedProofPath);
      }

      const selectedTier = (event.ticketTiers || []).find((t) => t.id === selectedTierId);
      const selectedDomain = (event.participantDomains || []).find((d) => d.id === selectedDomainId);

      // 3. Register participant
      const regResult = await registerParticipantForEvent(event.id, {
        name: name.trim(),
        email: email.trim().toLowerCase() || undefined,
        phone: phone.trim() || undefined,
        college: college.trim() || undefined,
        department: department.trim() || undefined,
        domain: selectedDomain?.name,
        domainId: selectedDomainId || undefined,
        tierId: selectedTier?.id,
        tierName: selectedTier?.name,
        transactionId: transactionId.trim() || undefined,
        paymentScreenshotUrl: uploadedProofUrl || undefined,
        paymentScreenshotPath: uploadedProofPath || undefined,
        paymentStatus: paymentStatus,
        customResponses: Object.keys(customResponses).length > 0 ? customResponses : undefined,
        registrationSource: 'manual',
      });

      // 4. Log activity
      await logActivity(
        profile?.uid || 'coordinator',
        profile?.displayName || 'Coordinator',
        profile?.email || '',
        'manual_registration',
        `Manually registered participant "${name.trim()}" for event "${event.title}"`
      );

      // 5. Generate QR Code
      const qrUrl = await QRCode.toDataURL(regResult.ticket.qrPayload, { width: 300, margin: 2 });
      setSuccessTicket(regResult.ticket);
      setSuccessQrUrl(qrUrl);

      // 6. Update local participants list immediately
      const newParticipantList = [regResult.participant, ...participants];
      setParticipants(newParticipantList);
      if (onParticipantsChange) {
        await onParticipantsChange(newParticipantList);
      }

      showToast(`Participant "${name}" registered successfully! Entry ticket generated.`, 'success');

      // 7. Auto-download ticket image
      try {
        await downloadTicketImage(event, regResult.ticket, qrUrl);
      } catch (dlErr) {
        console.warn('Auto download participant ticket note:', dlErr);
      }
    } catch (err: any) {
      console.error('Failed to register participant:', err);
      setFormError(err.message || 'Failed to register participant');
      showToast(err.message || 'Failed to register participant', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdatePayment = async (
    participant: EventParticipant,
    status: 'pending' | 'verified' | 'rejected'
  ) => {
    const ticketId = participant.ticketId || participant.id;
    setUpdatingPaymentId(participant.id);
    try {
      await updatePaymentVerificationStatus(event.id, ticketId, status, profile);
      const updated = participants.map((p) =>
        p.id === participant.id ? { ...p, paymentStatus: status } : p
      );
      setParticipants(updated);
      if (proofModalParticipant && proofModalParticipant.id === participant.id) {
        setProofModalParticipant({ ...proofModalParticipant, paymentStatus: status });
      }
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast(`Payment marked as ${status}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status', 'error');
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.ticketId && p.ticketId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (p.college && p.college.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' ? true :
                          filterStatus === 'arrived' ? p.arrived :
                          !p.arrived;
    return matchesSearch && matchesStatus;
  });

  const toggleArrival = async (participant: EventParticipant) => {
    const targetArrived = !participant.arrived;
    const participantId = participant.id;
    setProcessingId(participantId);

    // Optimistic UI update
    const updated = participants.map((p) =>
      p.id === participantId
        ? { ...p, arrived: targetArrived, arrivedAt: targetArrived ? new Date().toISOString() : undefined }
        : p
    );
    setParticipants(updated);

    try {
      await updateParticipantArrivalStatus(
        event.id,
        participant.ticketId || participant.id,
        targetArrived,
        profile?.uid
      );
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast(
        targetArrived
          ? `Marked ${participant.name} as arrived!`
          : `Marked ${participant.name} as pending (unarrived).`,
        'success'
      );
    } catch (err: any) {
      // Revert on error
      setParticipants(participants);
      showToast(err.message || 'Failed to update arrival status', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchArrival = async (arrived: boolean) => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one participant', 'info');
      return;
    }

    setLoading(true);
    const selectedSet = new Set(selectedIds);
    const updated = participants.map((p) =>
      selectedSet.has(p.id)
        ? { ...p, arrived, arrivedAt: arrived ? new Date().toISOString() : undefined }
        : p
    );
    setParticipants(updated);

    try {
      await batchUpdateParticipantsArrival(event.id, selectedIds, arrived, profile?.uid);
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast(
        `Successfully marked ${selectedIds.length} participant(s) as ${arrived ? 'arrived' : 'pending'}!`,
        'success'
      );
      setSelectedIds([]);
    } catch (err: any) {
      setParticipants(participants);
      showToast(err.message || 'Failed to batch update attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParticipants.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const removeParticipant = async (participantId: string) => {
    if (!window.confirm('Remove this participant from the event?')) return;

    setLoading(true);
    try {
      const updated = participants.filter((p) => p.id !== participantId);
      setParticipants(updated);
      if (onParticipantsChange) {
        await onParticipantsChange(updated);
      }
      showToast('Participant removed', 'success');
    } catch (err) {
      showToast('Failed to remove participant', 'error');
    } finally {
      setLoading(false);
    }
  };

  const customFieldLabels = (event.customFields || []).map((f) => f.label);

  const downloadTicket = (participant: EventParticipant) => {
    if (!participant.ticketId) {
      showToast('Ticket not generated yet', 'error');
      return;
    }

    const customVals = (event.customFields || []).map((f) => participant.customResponses?.[f.id] || '');

    const rows = [[
      'Name', 'Email', 'Ticket ID', 'College', 'Department', 'Domain', ...customFieldLabels, 'Arrived', 'Arrival Time', 'Allocated Lab', 'Allocated Classroom'
    ], [
      participant.name,
      participant.email,
      participant.ticketId,
      participant.college || '',
      participant.department || '',
      participant.domain || '',
      ...customVals,
      participant.arrived ? 'Arrived' : 'Pending',
      participant.arrivedAt || '',
      participant.allocatedLab || '',
      participant.allocatedClassroom || '',
    ]];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${participant.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Ticket data downloaded', 'success');
  };

  const downloadAllTickets = () => {
    const rows = [
      ['Name', 'Email', 'Ticket ID', 'College', 'Department', 'Domain', ...customFieldLabels, 'Arrived', 'Arrival Time', 'Allocated Lab', 'Allocated Classroom'],
      ...(participants.map((participant) => [
        participant.name,
        participant.email,
        participant.ticketId || '',
        participant.college || '',
        participant.department || '',
        participant.domain || '',
        ...(event.customFields || []).map((f) => participant.customResponses?.[f.id] || ''),
        participant.arrived ? 'Arrived' : 'Pending',
        participant.arrivedAt || '',
        participant.allocatedLab || '',
        participant.allocatedClassroom || '',
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-tickets-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Tickets export downloaded', 'success');
  };

  const exportParticipantCsv = () => {
    const rows = [
      ['Name', 'Email', 'College', 'Department', 'Domain', ...customFieldLabels, 'Arrived', 'Arrival Time', 'Allocated Lab', 'Allocated Classroom'],
      ...(participants.map((participant) => [
        participant.name,
        participant.email,
        participant.college || '',
        participant.department || '',
        participant.domain || '',
        ...(event.customFields || []).map((f) => participant.customResponses?.[f.id] || ''),
        participant.arrived ? 'Arrived' : 'Pending',
        participant.arrivedAt || '',
        participant.allocatedLab || '',
        participant.allocatedClassroom || '',
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Participants exported', 'success');
  };

  const stats = {
    total: participants.length,
    arrived: participants.filter(p => p.arrived).length,
    pending: participants.filter(p => !p.arrived).length,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div
        className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
              Participants &amp; Attendance Studio
            </h3>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Register new participants, track live check-ins, manage payment verification, and export credentials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={exportParticipantCsv}
            disabled={participants.length === 0}
            className="btn-secondary !text-xs !py-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download full participant CSV roster"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={downloadAllTickets}
            disabled={participants.length === 0}
            className="btn-secondary !text-xs !py-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Export all ticket data"
          >
            <Download className="w-4 h-4 text-blue-400" />
            All Tickets
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenRegisterModal}
              className="btn-primary !text-xs !py-2.5 flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Register New Participant
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 transition-all" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--dash-muted)' }}>Total Participants</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: 'var(--dash-text)' }}>
            {stats.total}
          </p>
        </div>
        <div className="rounded-2xl border p-4 transition-all" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.04)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-500">Arrived</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.arrived}</p>
            {stats.total > 0 && (
              <span className="text-xs font-semibold text-emerald-500">
                ({Math.round((stats.arrived / stats.total) * 100)}%)
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border p-4 transition-all" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.04)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold text-amber-500">Pending Arrival</p>
          <p className="text-3xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">{stats.pending}</p>
        </div>
      </div>

      {/* Search, Filter, and Bulk Actions Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="text"
            placeholder="Search by name, email, ticket ID, college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field flex-1 min-w-0"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'border-[var(--dash-border)] text-[var(--dash-muted)] hover:text-[var(--dash-text)]'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('arrived')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === 'arrived'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'border-[var(--dash-border)] text-[var(--dash-muted)] hover:text-emerald-500'
              }`}
            >
              Arrived ({stats.arrived})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'border-[var(--dash-border)] text-[var(--dash-muted)] hover:text-amber-500'
              }`}
            >
              Pending ({stats.pending})
            </button>
          </div>
        </div>

        {canEdit && selectedIds.length > 0 && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl border bg-slate-900/40 backdrop-blur-md" style={{ borderColor: 'var(--dash-border)' }}>
            <span className="text-xs font-semibold px-2 text-slate-300">
              {selectedIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => handleBatchArrival(true)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Mark Arrived
            </button>
            <button
              type="button"
              onClick={() => handleBatchArrival(false)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Mark Unarrived
            </button>
          </div>
        )}
      </div>

      {/* Participants Table */}
      <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--dash-border)' }}>
              <tr>
                {canEdit && (
                  <th className="w-10 px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                      title="Select all"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredParticipants.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Participant
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Contact & Ticket
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Institution / Dept
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Payment &amp; Proof
                </th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Arrival Status
                </th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Studio Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--dash-muted)' }}>No participants found matching current filters</p>
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant) => {
                  const isSelected = selectedIds.includes(participant.id);
                  const isBusy = processingId === participant.id;

                  return (
                    <tr
                      key={participant.id}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{
                        background: participant.arrived ? 'rgba(16,185,129,0.03)' : undefined,
                      }}
                    >
                      {canEdit && (
                        <td className="w-10 px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(participant.id)}
                            className="text-slate-400 hover:text-slate-200"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-500" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>
                          {participant.name}
                        </div>
                        {participant.tierName && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {participant.tierName}
                          </span>
                        )}
                        {participant.teamMembers && participant.teamMembers.length > 0 && (
                          <p className="text-xs mt-1 text-slate-400">
                            +{participant.teamMembers.length} teammates: {participant.teamMembers.map((m) => m.name).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono" style={{ color: 'var(--dash-text)' }}>
                          {participant.email}
                        </p>
                        {participant.ticketId && (
                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {participant.ticketId.slice(0, 10)}...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                          {participant.college || '—'}
                        </p>
                        {participant.department && (
                          <p className="text-[11px] text-slate-500">
                            {participant.department}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {event.ticketingEnabled || participant.transactionId || participant.paymentScreenshotUrl ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {participant.paymentStatus === 'verified' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" /> Verified
                                </span>
                              ) : participant.paymentStatus === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                  <XCircle className="w-3 h-3" /> Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}

                              {participant.paymentScreenshotUrl && (
                                <button
                                  type="button"
                                  onClick={() => setProofModalParticipant(participant)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-400/30 transition-colors"
                                  title="View Payment Screenshot"
                                >
                                  <Eye className="w-3 h-3" /> View Proof
                                </button>
                              )}
                            </div>

                            {participant.transactionId ? (
                              <p className="text-[11px] font-mono text-slate-300 truncate max-w-[150px]" title={participant.transactionId}>
                                UTR: {participant.transactionId}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic">No UTR</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Free Event</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              participant.arrived
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {participant.arrived ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Arrived
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                Pending
                              </>
                            )}
                          </span>
                          {participant.arrived && participant.arrivedAt && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              {new Date(participant.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Toggle Arrival Button */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => toggleArrival(participant)}
                              disabled={isBusy || loading}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                                participant.arrived
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                              title={participant.arrived ? 'Mark as Unarrived / Pending' : 'Mark as Arrived'}
                            >
                              {participant.arrived ? (
                                <>
                                  <RotateCcw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                                  <span>Unarrived</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                                  <span>Check In</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => downloadTicket(participant)}
                            disabled={loading}
                            className="p-1.5 rounded-xl border transition-colors hover:bg-blue-500/10 text-blue-400 border-blue-500/20"
                            title="Download ticket"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removeParticipant(participant.id)}
                              disabled={loading}
                              className="p-1.5 rounded-xl border transition-colors hover:bg-red-500/10 text-red-400 border-red-500/20"
                              title="Remove participant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Exports */}
      {stats.total > 0 && canEdit && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={downloadAllTickets}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download All Tickets
          </button>
          <button
            type="button"
            onClick={exportParticipantCsv}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Participants CSV
          </button>
        </div>
      )}

      {/* Payment Proof Modal */}
      {proofModalParticipant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setProofModalParticipant(null)}
        >
          <div
            className="relative bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Payment Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProofModalParticipant(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs bg-black/30 p-3 rounded-xl border border-white/5">
                <div>
                  <span className="text-slate-400 block">Participant</span>
                  <strong className="text-white font-medium text-sm">{proofModalParticipant.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Ticket ID</span>
                  <span className="text-white font-mono">{proofModalParticipant.ticketId ? proofModalParticipant.ticketId.slice(0, 12) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">UPI Transaction ID / UTR</span>
                  <span className="text-blue-300 font-mono font-bold select-all">{proofModalParticipant.transactionId || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Current Status</span>
                  <span className={`font-bold capitalize ${
                    proofModalParticipant.paymentStatus === 'verified'
                      ? 'text-emerald-400'
                      : proofModalParticipant.paymentStatus === 'rejected'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}>
                    {proofModalParticipant.paymentStatus || 'Pending'}
                  </span>
                </div>
              </div>

              {proofModalParticipant.paymentScreenshotUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Payment Screenshot</span>
                    <a
                      href={proofModalParticipant.paymentScreenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open Full Image
                    </a>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center max-h-80">
                    <img
                      src={proofModalParticipant.paymentScreenshotUrl}
                      alt="Payment Screenshot"
                      className="max-h-80 w-auto object-contain rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-black/20 rounded-xl border border-white/5">
                  No payment screenshot uploaded for this participant.
                </div>
              )}
            </div>

            {canEdit && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleUpdatePayment(proofModalParticipant, 'rejected')}
                  disabled={updatingPaymentId === proofModalParticipant.id}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject Payment
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdatePayment(proofModalParticipant, 'verified')}
                  disabled={updatingPaymentId === proofModalParticipant.id}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
                >
                  <CheckCircle2 className="w-4 h-4" /> Verify Payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register New Participant Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div
            ref={formRef}
            className="w-full max-w-2xl rounded-3xl border p-6 space-y-5 my-8 shadow-2xl relative"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                  {successTicket ? 'Participant Registration Confirmed!' : 'Register New Participant'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterModal(false);
                  setSuccessTicket(null);
                  setSuccessQrUrl('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Result View */}
            {successTicket ? (
              <div className="text-center space-y-5 animate-fade-in py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>
                    Registration Completed Successfully!
                  </h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                    Entry pass for <strong className="text-blue-400">{successTicket.guestName}</strong> has been created.
                  </p>
                </div>

                {/* QR Display */}
                {successQrUrl && (
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-xl border border-slate-200">
                    <img src={successQrUrl} alt="Participant Ticket QR" className="w-48 h-48 block mx-auto" />
                  </div>
                )}

                {/* Pass Details */}
                <div
                  className="rounded-2xl p-4 text-xs space-y-2 max-w-md mx-auto text-left border"
                  style={{ borderColor: 'var(--dash-border)', background: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--dash-muted)' }}>Pass Number:</span>
                    <span className="font-mono font-bold text-blue-400">{successTicket.ticketNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--dash-muted)' }}>Attendee:</span>
                    <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{successTicket.guestName}</span>
                  </div>
                  {successTicket.guestEmail && (
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--dash-muted)' }}>Email ID:</span>
                      <span className="font-mono" style={{ color: 'var(--dash-text)' }}>{successTicket.guestEmail}</span>
                    </div>
                  )}
                  {successTicket.tierName && (
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--dash-muted)' }}>Ticket Tier:</span>
                      <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{successTicket.tierName}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2.5 max-w-md mx-auto pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (successTicket && successQrUrl) {
                        setDownloadingTicket(true);
                        try {
                          await downloadTicketImage(event, successTicket, successQrUrl);
                          showToast('Downloaded ticket pass image!', 'success');
                        } catch (err: any) {
                          showToast('Download failed: ' + err.message, 'error');
                        } finally {
                          setDownloadingTicket(false);
                        }
                      }
                    }}
                    disabled={downloadingTicket}
                    className="btn-primary !text-xs !py-3 !px-5 flex items-center justify-center gap-2 w-full cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {downloadingTicket ? 'Downloading Pass Image...' : 'Download Ticket Pass Image'}
                  </button>

                  <div className="grid sm:grid-cols-2 gap-2">
                    {event.whatsappGroupUrl && (
                      <a
                        href={event.whatsappGroupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-semibold transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" /> Join WhatsApp Group
                      </a>
                    )}
                    {event.rulebookUrl && (
                      <a
                        href={event.rulebookUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> Access Rulebook
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setSuccessTicket(null);
                      setSuccessQrUrl('');
                    }}
                    className="btn-secondary !text-xs !py-2.5 w-full cursor-pointer mt-2"
                  >
                    Done &amp; Return to Participants Studio
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveParticipant} className="space-y-4">
                {/* Form Error Alert Banner */}
                {formError && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Full Name & Tier */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Ticket Tier / Category
                    </label>
                    {event.ticketTiers && event.ticketTiers.length > 0 ? (
                      <select
                        value={selectedTierId}
                        onChange={(e) => setSelectedTierId(e.target.value)}
                        className="input-field w-full text-xs"
                      >
                        <option value="">Select Tier (Optional)</option>
                        {event.ticketTiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.price !== undefined ? `(₹${t.price})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value="Standard Entry"
                        className="input-field w-full text-xs opacity-60"
                      />
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="attendee@example.com"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                {/* College & Department */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      College / Institute
                    </label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. JSPM RSCOE"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Department / Branch
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                {/* Domain Selection if enabled */}
                {Boolean(event.enableDomainSelection && event.participantDomains?.length) && (
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Domain / Track
                    </label>
                    <select
                      value={selectedDomainId}
                      onChange={(e) => setSelectedDomainId(e.target.value)}
                      className="input-field w-full text-xs"
                    >
                      <option value="">Choose Domain (Optional)</option>
                      {event.participantDomains?.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom Event Fields from Form Builder */}
                {((event.customFields || []).filter((f) => !f.tierId || f.tierId === selectedTierId).length > 0) && (
                  <div className="p-3.5 rounded-2xl bg-slate-900/40 border space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
                    <span className="text-xs font-bold text-violet-400 block uppercase tracking-wide">
                      Custom Event Questions
                    </span>
                    <div className="space-y-3">
                      {(event.customFields || [])
                        .filter((f) => !f.tierId || f.tierId === selectedTierId)
                        .map((field) => (
                          <div key={field.id}>
                            <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                              {field.label} {field.required ? <span className="text-red-400">*</span> : '(Optional)'}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                value={customResponses[field.id] || ''}
                                onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                                required={field.required}
                                placeholder={field.placeholder || `Enter ${field.label}`}
                                rows={2}
                                className="input-field w-full text-xs"
                              />
                            ) : field.type === 'select' ? (
                              <select
                                value={customResponses[field.id] || ''}
                                onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                                required={field.required}
                                className="input-field w-full text-xs"
                              >
                                <option value="">Select {field.label}...</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                                value={customResponses[field.id] || ''}
                                onChange={(e) => setCustomResponses({ ...customResponses, [field.id]: e.target.value })}
                                required={field.required}
                                placeholder={field.placeholder || `Enter ${field.label}`}
                                className="input-field w-full text-xs"
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Payment Information & Proof Section */}
                <div className="p-3.5 rounded-2xl bg-slate-900/40 border space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wide flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Payment Details &amp; Proof
                    </span>
                    {(event.paymentQRUrl || event.ticketTiers?.find((t) => t.id === selectedTierId)?.paymentQRUrl) && (
                      <button
                        type="button"
                        onClick={() => setShowFullQRModal(true)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" /> View Event Payment QR
                      </button>
                    )}
                  </div>

                  {/* Payment Screenshot Upload */}
                  <div className="space-y-2">
                    <label className="block text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                      Upload Payment Screenshot (Optional for manual backup)
                    </label>

                    {paymentScreenshotPreview ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-700 bg-slate-950/60 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={paymentScreenshotPreview}
                            alt="Screenshot Preview"
                            className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">
                              {paymentScreenshotFile?.name || 'Payment_Proof.png'}
                            </p>
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Attached
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 cursor-pointer transition-colors">
                            Change
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleScreenshotChange(e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleScreenshotChange(null)}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl cursor-pointer bg-slate-950/40 hover:bg-slate-900/50 transition-colors">
                        <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-300">Click to upload payment screenshot</span>
                        <span className="text-[10px] text-slate-500">JPG, PNG, or WebP up to 5 MB</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleScreenshotChange(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    )}

                    {paymentScreenshotError && (
                      <p className="text-[11px] text-red-400">{paymentScreenshotError}</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                        UPI Transaction ID / UTR
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="e.g. 425612349870 or UPI Ref ID"
                        className="input-field w-full text-xs font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                        Payment Status
                      </label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value as any)}
                        className="input-field w-full text-xs"
                      >
                        <option value="verified">Verified / Completed</option>
                        <option value="pending">Pending Verification</option>
                        <option value="rejected">Rejected / Unpaid</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="btn-secondary !text-xs !py-2.5 !px-4 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="btn-primary !text-xs !py-2.5 !px-5 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {registering ? 'Registering Participant...' : 'Register Participant'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Enlarged Payment QR Modal */}
      {showFullQRModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setShowFullQRModal(false)}
        >
          <div
            className="relative bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">Event Payment QR</span>
              <button
                type="button"
                onClick={() => setShowFullQRModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-white rounded-2xl shadow-xl">
              <img
                src={
                  event.ticketTiers?.find((t) => t.id === selectedTierId)?.paymentQRUrl ||
                  event.paymentQRUrl ||
                  ''
                }
                alt="Event Payment QR"
                className="w-64 h-64 object-contain rounded-lg"
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Scan via any UPI banking app (Google Pay, PhonePe, Paytm, BHIM)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

