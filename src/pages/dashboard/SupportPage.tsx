import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getAllUsers } from '../../services/authService';
import {
  addTicketComment,
  assignSupportTicket,
  subscribeSupportTickets,
  subscribeUserSupportTickets,
  updateTicketInvestigationNotes,
  updateTicketPriority,
  updateTicketStatus,
} from '../../services/supportService';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus, UserProfile } from '../../types';
import { isCoreMember } from '../../utils/permissions';
import { CardSkeleton, DataStateWrapper, StatGridSkeleton } from '../../components/ui/skeleton';

const CATEGORIES: Array<TicketCategory | 'all'> = [
  'all',
  'General Inquiry',
  'Event Management',
  'Financial & Reimbursement',
  'Access & Permissions',
  'Bug / Technical',
  'Feature Request',
  'Attendance & Tickets',
  'Team & Position',
  'Other',
];

const STATUSES: TicketStatus[] = ['open', 'working', 'under_review', 'resolved', 'closed'];

const STATUS_META: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)' },
  working: { label: 'Working', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
  under_review: { label: 'Under review', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)' },
  resolved: { label: 'Resolved', color: '#059669', bg: 'rgba(16, 185, 129, 0.12)' },
  closed: { label: 'Closed', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
};

const PRIORITY_META: Record<TicketPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
  high: { label: 'High', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)' },
  medium: { label: 'Medium', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
  low: { label: 'Low', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function whatsappHref(phone: string, ticketNumber: string, name: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  const international = digits.length === 10 ? `91${digits}` : digits;
  if (international.length < 10) return null;
  const text = encodeURIComponent(`Hello ${name}, this is SAInT Support regarding ticket ${ticketNumber}.`);
  return `https://wa.me/${international}?text=${text}`;
}

export default function SupportPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const canManage = isCoreMember(profile);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [assignees, setAssignees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [newComment, setNewComment] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const unsub = canManage
      ? subscribeSupportTickets((items) => {
          setTickets(items || []);
          setLoading(false);
        })
      : subscribeUserSupportTickets(profile.uid, (items) => {
          setTickets(items || []);
          setLoading(false);
        });

    if (canManage) {
      getAllUsers()
        .then((users) => {
          setAssignees(users.filter((user) => user.status === 'approved' && (user.role === 'core' || user.role === 'superadmin')));
        })
        .catch(console.error);
    }

    return () => unsub && unsub();
  }, [profile, canManage]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    setInvestigationNotes(selectedTicket?.investigationNotes || '');
    setResolutionSummary(selectedTicket?.resolutionSummary || '');
  }, [selectedTicket?.id, selectedTicket?.investigationNotes, selectedTicket?.resolutionSummary]);

  const stats = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    active: tickets.filter((ticket) => ticket.status === 'working' || ticket.status === 'under_review').length,
    urgent: tickets.filter((ticket) => ticket.priority === 'urgent' || ticket.priority === 'high').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        ticket.title?.toLowerCase().includes(q) ||
        ticket.description?.toLowerCase().includes(q) ||
        ticket.ticketNumber?.toLowerCase().includes(q) ||
        ticket.name?.toLowerCase().includes(q) ||
        ticket.email?.toLowerCase().includes(q) ||
        ticket.assignedToName?.toLowerCase().includes(q)
      );
    });
  }, [tickets, queryText, statusFilter, priorityFilter, categoryFilter]);

  const actorName = profile?.displayName || 'System';

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(successMsg, 'success');
    } catch (error: any) {
      showToast(error?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = (uid: string) => {
    if (!selectedTicket || !canManage) return;
    const member = assignees.find((user) => user.uid === uid);
    runAction(
      () => assignSupportTicket(selectedTicket.id, member ? { uid: member.uid, name: member.displayName, email: member.email } : null, actorName),
      member ? `Assigned to ${member.displayName}` : 'Ticket unassigned'
    );
  };

  const handleAddComment = () => {
    if (!selectedTicket || !newComment.trim()) return;
    runAction(async () => {
      await addTicketComment(selectedTicket.id, {
        authorId: profile?.uid || 'system',
        authorName: actorName,
        authorRole: profile?.role || 'member',
        authorPhoto: profile?.photoURL ?? undefined,
        message: newComment.trim(),
        isInternal: canManage ? internalNote : false,
      });
      setNewComment('');
    }, 'Comment added');
  };

  const visibleComments = (selectedTicket?.comments || []).filter((comment) => canManage || !comment.isInternal);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Support tickets</h1>
          <p className="page-header-sub">
            {canManage
              ? 'Triage, assign, and resolve incoming requests from the public desk and members.'
              : 'Track the tickets you have submitted and add follow-up comments.'}
          </p>
        </div>
        <Link to="/support" className="btn-outline">
          <ExternalLink className="h-4 w-4" />
          Public desk
        </Link>
      </div>

      <DataStateWrapper loading={loading} skeleton={<StatGridSkeleton count={4} columns="grid-cols-2 lg:grid-cols-4" />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Open', value: stats.open, color: '#d97706', icon: Clock },
            { label: 'In progress', value: stats.active, color: '#2563eb', icon: LifeBuoy },
            { label: 'High / urgent', value: stats.urgent, color: '#dc2626', icon: AlertTriangle },
            { label: 'Resolved', value: stats.resolved, color: '#059669', icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.label} className="stat-card">
              <div className="stat-card-accent-bar" style={{ background: item.color }} />
              <div className="mt-1 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>{item.label}</p>
                  <p className="mt-1 text-3xl font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center" style={{ background: `${item.color}18`, borderRadius: '6px' }}>
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </DataStateWrapper>

      <div className="dash-card !p-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1">
          {(['all', ...STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: statusFilter === status ? 'var(--dash-accent)' : 'transparent',
                color: statusFilter === status ? '#ffffff' : 'var(--dash-muted)',
                borderRadius: '4px',
              }}
            >
              {status === 'all' ? `All (${tickets.length})` : STATUS_META[status].label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:justify-end">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--dash-muted)' }} />
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search title, requester, ticket #"
              className="dash-input !w-full !py-1.5 !pl-8 !text-xs"
            />
          </div>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')} className="dash-input !w-full !py-1.5 !text-xs md:!w-36">
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as TicketCategory | 'all')} className="dash-input !w-full !py-1.5 !text-xs md:!w-48">
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category === 'all' ? 'All categories' : category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <DataStateWrapper
          loading={loading}
          isEmpty={filtered.length === 0}
          emptyTitle={tickets.length === 0 ? 'No support tickets yet' : 'No tickets match these filters'}
          emptyDescription="Adjust search or filters, or wait for a new request from the public support desk."
          skeleton={<CardSkeleton count={6} />}
        >
          <div className="space-y-3">
            {filtered.map((ticket) => {
              const selected = ticket.id === selectedTicketId;
              const status = STATUS_META[ticket.status] || STATUS_META.open;
              const priority = PRIORITY_META[ticket.priority] || PRIORITY_META.medium;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="w-full text-left dash-card !p-4 transition"
                  style={{
                    borderColor: selected ? 'var(--dash-accent)' : 'var(--dash-card-border)',
                    boxShadow: selected ? '0 0 0 1px var(--dash-accent)' : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                        {ticket.ticketNumber}
                      </p>
                      <h3 className="mt-1 truncate text-sm font-bold" style={{ color: 'var(--dash-text)' }}>{ticket.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--dash-muted)' }}>{ticket.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: priority.color, background: priority.bg }}>{priority.label}</span>
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ color: status.color, background: status.bg }}>{status.label}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                    <span>{ticket.name}</span>
                    <span>{ticket.category}</span>
                    <span>{ticket.assignedToName || 'Unassigned'}</span>
                    <span>{formatDate(ticket.createdAt)}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{(ticket.comments || []).length}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </DataStateWrapper>

        <aside className="dash-card sticky top-4 h-fit !p-0 overflow-hidden">
          {!selectedTicket ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: 'var(--dash-accent-soft)' }}>
                <LifeBuoy className="h-5 w-5" style={{ color: 'var(--dash-accent)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Select a ticket</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--dash-muted)' }}>Open a request to investigate, assign, and update status.</p>
            </div>
          ) : (
            <div>
              <div className="border-b p-4" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>{selectedTicket.ticketNumber}</p>
                    <h2 className="mt-1 text-base font-black" style={{ color: 'var(--dash-text)' }}>{selectedTicket.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedTicketId(null)} className="p-1" style={{ color: 'var(--dash-muted)' }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--dash-muted)' }}>{selectedTicket.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded px-2 py-1 text-[11px] font-bold" style={{ color: STATUS_META[selectedTicket.status].color, background: STATUS_META[selectedTicket.status].bg }}>
                    {STATUS_META[selectedTicket.status].label}
                  </span>
                  <span className="rounded px-2 py-1 text-[11px] font-bold" style={{ color: PRIORITY_META[selectedTicket.priority].color, background: PRIORITY_META[selectedTicket.priority].bg }}>
                    {PRIORITY_META[selectedTicket.priority].label}
                  </span>
                  <span className="rounded px-2 py-1 text-[11px] font-semibold" style={{ color: 'var(--dash-muted)', background: 'var(--dash-hover)' }}>
                    {selectedTicket.category}
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid gap-2 text-xs" style={{ color: 'var(--dash-muted)' }}>
                  <p><span className="font-semibold" style={{ color: 'var(--dash-text)' }}>Requester:</span> {selectedTicket.name}</p>
                  <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {selectedTicket.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {selectedTicket.phone}</p>
                  <p>Created {formatDate(selectedTicket.createdAt)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a href={`mailto:${selectedTicket.email}?subject=${encodeURIComponent(`SAInT Support ${selectedTicket.ticketNumber}`)}`} className="btn-outline !px-3 !py-1.5 !text-xs">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                  {whatsappHref(selectedTicket.phone, selectedTicket.ticketNumber, selectedTicket.name) && (
                    <a
                      href={whatsappHref(selectedTicket.phone, selectedTicket.ticketNumber, selectedTicket.name)!}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline !px-3 !py-1.5 !text-xs"
                    >
                      <Phone className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(selectedTicket.ticketNumber).then(() => showToast('Ticket number copied.', 'success'))}
                    className="btn-outline !px-3 !py-1.5 !text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy ID
                  </button>
                </div>

                {canManage && (
                  <>
                    <label className="block text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
                      Assign to core member
                      <select
                        value={selectedTicket.assignedToUid || ''}
                        onChange={(e) => handleAssign(e.target.value)}
                        disabled={busy}
                        className="dash-input mt-1 !w-full !py-2 !text-xs"
                      >
                        <option value="">Unassigned</option>
                        {assignees.map((user) => (
                          <option key={user.uid} value={user.uid}>{user.displayName} — {user.email}</option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>Status</p>
                      <div className="flex flex-wrap gap-1">
                        {STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={busy || selectedTicket.status === status}
                            onClick={() => runAction(
                              () => updateTicketStatus(selectedTicket.id, status, actorName, status === 'resolved' || status === 'closed' ? resolutionSummary : undefined),
                              `Marked ${STATUS_META[status].label}`
                            )}
                            className="px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              borderRadius: '4px',
                              background: selectedTicket.status === status ? STATUS_META[status].bg : 'var(--dash-hover)',
                              color: selectedTicket.status === status ? STATUS_META[status].color : 'var(--dash-muted)',
                            }}
                          >
                            {STATUS_META[status].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>Priority</p>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(PRIORITY_META) as TicketPriority[]).map((priority) => (
                          <button
                            key={priority}
                            type="button"
                            disabled={busy}
                            onClick={() => runAction(() => updateTicketPriority(selectedTicket.id, priority, actorName), 'Priority updated')}
                            className="px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              borderRadius: '4px',
                              background: selectedTicket.priority === priority ? PRIORITY_META[priority].bg : 'var(--dash-hover)',
                              color: selectedTicket.priority === priority ? PRIORITY_META[priority].color : 'var(--dash-muted)',
                            }}
                          >
                            {PRIORITY_META[priority].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
                      Investigation notes
                      <textarea
                        value={investigationNotes}
                        onChange={(e) => setInvestigationNotes(e.target.value)}
                        rows={4}
                        className="dash-input mt-1 !w-full !text-xs"
                        placeholder="Internal investigation details"
                      />
                    </label>
                    <label className="block text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
                      Resolution summary
                      <textarea
                        value={resolutionSummary}
                        onChange={(e) => setResolutionSummary(e.target.value)}
                        rows={3}
                        className="dash-input mt-1 !w-full !text-xs"
                        placeholder="What fixed the issue"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => updateTicketInvestigationNotes(selectedTicket.id, investigationNotes, actorName), 'Notes saved')}
                        className="btn-outline !px-3 !py-1.5 !text-xs"
                      >
                        Save notes
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(
                          () => updateTicketStatus(selectedTicket.id, 'resolved', actorName, resolutionSummary),
                          'Ticket resolved'
                        )}
                        className="btn-primary !px-3 !py-1.5 !text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark resolved
                      </button>
                    </div>
                  </>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>Conversation</p>
                  <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
                    {visibleComments.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>No comments yet.</p>
                    )}
                    {visibleComments.map((comment) => (
                      <div key={comment.id} className="rounded-lg p-2.5" style={{ background: 'var(--dash-hover)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>{comment.authorName}</p>
                          {comment.isInternal && <span className="text-[10px] font-bold uppercase text-amber-600">Internal</span>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--dash-muted)' }}>{comment.message}</p>
                        <p className="mt-1 text-[10px]" style={{ color: 'var(--dash-muted)' }}>{formatDate(comment.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="dash-input !w-full !text-xs"
                    placeholder="Add an update for this ticket"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {canManage && (
                      <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                        <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                        Internal note
                      </label>
                    )}
                    <button type="button" disabled={busy || !newComment.trim()} onClick={handleAddComment} className="btn-primary !px-3 !py-1.5 !text-xs ml-auto">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Add comment
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>Activity</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {(selectedTicket.activityLog || []).slice(0, 12).map((log) => (
                      <div key={log.id} className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                        <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{log.action}</span>
                        <span> · {log.performedBy} · {formatDate(log.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
