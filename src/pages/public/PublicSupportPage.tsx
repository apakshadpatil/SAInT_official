import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Headphones,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getSiteSettings } from '../../services/applicationService';
import {
  createSupportTicket,
  getSupportTicketByNumber,
  subscribeUserSupportTickets,
} from '../../services/supportService';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '../../types/supportTicket';

const CATEGORIES: TicketCategory[] = [
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

const PRIORITIES: { value: TicketPriority; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'General questions' },
  { value: 'medium', label: 'Medium', hint: 'Needs attention soon' },
  { value: 'high', label: 'High', hint: 'Blocking important work' },
  { value: 'urgent', label: 'Urgent', hint: 'Immediate response needed' },
];

const FAQS = [
  {
    q: 'How long does a response take?',
    a: 'Most tickets are triaged within 24 hours. Urgent issues such as event-day access, payments, or attendance are prioritised first.',
  },
  {
    q: 'Can I track a ticket I already submitted?',
    a: 'Yes. Use the ticket number from your confirmation (for example TKT-2026-1234) in the lookup panel, or sign in to see tickets raised with your account.',
  },
  {
    q: 'What should I include in the description?',
    a: 'Share what happened, where it happened (page or event), who was affected, and what you already tried. Screenshots described in text also help.',
  },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  working: 'In progress',
  under_review: 'Under review',
  resolved: 'Resolved',
  closed: 'Closed',
};

function statusTone(status: TicketStatus) {
  if (status === 'resolved' || status === 'closed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'working' || status === 'under_review') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function priorityTone(priority: TicketPriority) {
  if (priority === 'urgent') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (priority === 'high') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (priority === 'low') return 'bg-slate-50 text-slate-600 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export default function PublicSupportPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [category, setCategory] = useState<TicketCategory>('General Inquiry');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{ ticketNumber: string; name: string } | null>(null);
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [lookupNumber, setLookupNumber] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpTicket, setLookedUpTicket] = useState<SupportTicket | null>(null);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    getSiteSettings()
      .then((settings) => {
        setWhatsappGroupLink(typeof settings.whatsappGroupLink === 'string' ? settings.whatsappGroupLink : '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (profile?.displayName) setName(profile.displayName);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.email) setEmail(profile.email);
  }, [profile?.displayName, profile?.phone, profile?.email]);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeUserSupportTickets(profile.uid, setMyTickets);
    return () => unsub && unsub();
  }, [profile?.uid]);

  const descriptionCount = description.trim().length;
  const canSubmit = useMemo(
    () => Boolean(name.trim() && phone.trim() && email.trim() && title.trim() && description.trim().length >= 20),
    [name, phone, email, title, description]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmit) {
      showToast('Please complete all fields. Description should be at least 20 characters.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSupportTicket({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        userId: profile?.uid || `guest-${Date.now()}`,
        userRole: profile?.role === 'core' || profile?.role === 'superadmin' ? profile.role : 'member',
        userPhotoURL: profile?.photoURL || undefined,
        title: title.trim(),
        category,
        priority,
        description: description.trim(),
      });

      setSuccessTicket({ ticketNumber: result.ticketNumber, name: name.trim() });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('General Inquiry');
      showToast(`Support ticket ${result.ticketNumber} raised successfully.`, 'success');
    } catch (error: any) {
      showToast(error?.message || 'Unable to raise the support ticket right now.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyTicketNumber = async (ticketNumber: string) => {
    try {
      await navigator.clipboard.writeText(ticketNumber);
      showToast('Ticket number copied.', 'success');
    } catch {
      showToast('Could not copy ticket number.', 'error');
    }
  };

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lookupNumber.trim()) {
      showToast('Enter a ticket number to look up.', 'error');
      return;
    }
    setLookupLoading(true);
    setLookedUpTicket(null);
    try {
      const ticket = await getSupportTicketByNumber(lookupNumber);
      if (!ticket) {
        showToast('No ticket found with that number.', 'error');
        return;
      }
      setLookedUpTicket(ticket);
    } catch (error: any) {
      showToast(error?.message || 'Unable to look up this ticket right now.', 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section
          className="overflow-hidden rounded-2xl border bg-white p-5 shadow-sm sm:p-8"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">SAInT support desk</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Need help? We are here.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Raise a ticket for events, access, reimbursements, or platform issues. The core team reviews every request and follows up on the contact details you provide.
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Back to home
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div
            className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {!successTicket ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <LifeBuoy className="h-4 w-4 text-blue-600" />
                  Raise a ticket
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Full name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                      placeholder="Your full name"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Phone / WhatsApp
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                      placeholder="e.g. 9876543210"
                      required
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategory(item)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          category === item
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Priority</p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {PRIORITIES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setPriority(item.value)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          priority === item.value
                            ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                            : 'border-slate-200 bg-slate-50 hover:border-blue-200'
                        }`}
                      >
                        <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{item.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Subject
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                    placeholder="Brief summary of your issue"
                    maxLength={120}
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Describe your issue
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                    placeholder="Tell us the problem, where it happened, and what you need help with..."
                    required
                  />
                  <span className={`mt-1 block text-xs ${descriptionCount < 20 ? 'text-slate-400' : 'text-emerald-600'}`}>
                    {descriptionCount}/20 characters minimum
                  </span>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Typical first response within 24 hours
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit ticket'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Ticket raised</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-900">{successTicket.ticketNumber}</h2>
                  <button
                    type="button"
                    onClick={() => copyTicketNumber(successTicket.ticketNumber)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Thank you, {successTicket.name}. The SAInT team will review this request and contact you on the email or WhatsApp number you provided.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {whatsappGroupLink.trim() && (
                    <a
                      href={whatsappGroupLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Join community WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSuccessTicket(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    Raise another ticket
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border bg-blue-600 p-5 text-white shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-100">
                <ShieldCheck className="h-4 w-4" />
                Support promise
              </div>
              <h2 className="mt-3 text-2xl font-black">Clear, accountable, and human.</h2>
              <ul className="mt-5 space-y-3 text-sm text-blue-50">
                <li className="flex gap-3"><span className="mt-0.5 text-white">✓</span> Prompt triage for event, access, payment, and platform issues.</li>
                <li className="flex gap-3"><span className="mt-0.5 text-white">✓</span> Follow-up on the contact details you submit with the ticket.</li>
                <li className="flex gap-3"><span className="mt-0.5 text-white">✓</span> Status updates from assignment through resolution.</li>
              </ul>
              {whatsappGroupLink.trim() && (
                <a
                  href={whatsappGroupLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  Community WhatsApp
                </a>
              )}
            </div>

            <div
              className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Search className="h-4 w-4 text-blue-600" />
                Look up a ticket
              </div>
              <form onSubmit={handleLookup} className="flex gap-2">
                <input
                  value={lookupNumber}
                  onChange={(e) => setLookupNumber(e.target.value.toUpperCase())}
                  placeholder="TKT-2026-1234"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {lookupLoading ? '...' : 'Check'}
                </button>
              </form>
              {lookedUpTicket && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{lookedUpTicket.ticketNumber}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{lookedUpTicket.title}</p>
                    </div>
                    <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${statusTone(lookedUpTicket.status)}`}>
                      {STATUS_LABEL[lookedUpTicket.status] || lookedUpTicket.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {lookedUpTicket.category} · {lookedUpTicket.assignedToName || 'Unassigned'}
                  </p>
                </div>
              )}
            </div>

            <div
              className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <HelpCircle className="h-4 w-4 text-blue-600" />
                Common questions
              </div>
              <div className="space-y-2">
                {FAQS.map((item, index) => (
                  <button
                    key={item.q}
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-800">{item.q}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition ${openFaq === index ? 'rotate-180' : ''}`} />
                    </span>
                    {openFaq === index && <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {profile?.uid && myTickets.length > 0 && (
          <section
            className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Your recent tickets
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myTickets.slice(0, 6).map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">{ticket.ticketNumber}</p>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTone(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{ticket.title}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className={`rounded-md border px-2 py-0.5 font-semibold ${statusTone(ticket.status)}`}>
                      {STATUS_LABEL[ticket.status] || ticket.status}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              Signed-in members can also follow tickets from the dashboard when access is granted.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
