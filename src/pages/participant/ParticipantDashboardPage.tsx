import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  LogOut,
  MapPin,
  Plus,
  QrCode,
  Sparkles,
  Ticket,
  Users,
  X,
  Copy,
  Check,
  Award,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import QRCode from 'qrcode';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { getEventTickets, getEvents, updateParticipantTicketTeam } from '../../services/eventService';
import { logoutUser } from '../../services/authService';
import { downloadTicketImage } from '../../utils/ticketDownload';
import { downloadCertificate } from '../../utils/certificateGenerator';
import type { EventRecord, EventTicket, TeamMemberDetail } from '../../types';

type Registration = { event: EventRecord; ticket: EventTicket };

type ActiveTab = 'passes' | 'teams' | 'certificates';

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Date to be announced';
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export default function ParticipantDashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('passes');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // QR Modal
  const [activeTicket, setActiveTicket] = useState<Registration | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Team Editor Modal
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');

  // Certificate State
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);

  const contactEmail = profile?.participantEmail?.toLowerCase().trim();

  const loadRegistrations = async (isManualRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allEvents = await getEvents(true);
      const ticketLists = await Promise.all(
        allEvents.map(async (event) => {
          try {
            const tickets = await getEventTickets(event.id);
            return { event, tickets };
          } catch {
            return { event, tickets: [] };
          }
        })
      );

      const matches = ticketLists.flatMap(({ event, tickets }) =>
        tickets
          .filter(
            (ticket) =>
              ticket.participantUid === user.uid ||
              (contactEmail && ticket.guestEmail?.trim().toLowerCase() === contactEmail)
          )
          .map((ticket) => ({ event, ticket }))
      );

      matches.sort((a, b) => (a.event.date || '').localeCompare(b.event.date || ''));
      setRegistrations(matches);

      // Link any unassigned matching tickets to user UID
      await Promise.all(
        matches
          .filter(({ ticket }) => !ticket.participantUid)
          .map(({ event, ticket }) =>
            updateDoc(doc(db, 'events', event.id, 'tickets', ticket.id), {
              participantUid: user.uid,
            }).catch(() => {})
          )
      );
    } catch (err) {
      console.error('Could not load participant registrations', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, [contactEmail, user?.uid]);

  // Generate QR code when modal opens
  useEffect(() => {
    if (!activeTicket) {
      setQrDataUrl('');
      return;
    }
    const payload = activeTicket.ticket.qrPayload || activeTicket.ticket.ticketNumber;
    QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: { dark: '#11111c', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [activeTicket]);

  const handleCopyTicket = (ticketNumber: string) => {
    navigator.clipboard.writeText(ticketNumber);
    setCopiedId(ticketNumber);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadTicket = async (reg: Registration) => {
    try {
      const ticketQr = await QRCode.toDataURL(
        reg.ticket.qrPayload || reg.ticket.ticketNumber,
        { width: 600, margin: 2 }
      );
      await downloadTicketImage(reg.event, reg.ticket, ticketQr);
    } catch (err) {
      console.error('Failed to download ticket image', err);
    }
  };

  const openTeamEditor = (reg: Registration) => {
    setEditingRegistration(reg);
    setTeamName(reg.ticket.teamName || '');
    let initialMembers = reg.ticket.teamMembers ? [...reg.ticket.teamMembers] : [];

    // If tier is selected with a fixed team size, ensure exact member slots
    const matchedTier = reg.event.ticketTiers?.find(
      (t) => t.id === reg.ticket.tierId || t.name === reg.ticket.tierName
    );
    const tierSize = reg.ticket.teamSize || matchedTier?.teamSize;

    if (tierSize && tierSize > 1) {
      const requiredTeammates = tierSize - 1;
      while (initialMembers.length < requiredTeammates) {
        initialMembers.push({ name: '', email: '', phone: '', college: '', department: '' });
      }
      if (initialMembers.length > requiredTeammates) {
        initialMembers = initialMembers.slice(0, requiredTeammates);
      }
    }

    setMembers(initialMembers);
    setTeamError('');
    setTeamSuccess('');
  };

  const addMember = () => {
    setMembers((current) => [
      ...current,
      { name: '', email: '', phone: '', college: '', department: '' },
    ]);
  };

  const updateMember = (index: number, field: keyof TeamMemberDetail, value: string) => {
    setMembers((current) =>
      current.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const removeMember = (index: number) => {
    setMembers((current) => current.filter((_, i) => i !== index));
  };

  const saveTeamChanges = async () => {
    if (!editingRegistration) return;
    if (members.some((m) => !m.name.trim())) {
      setTeamError('Every teammate requires at least a full name.');
      return;
    }
    setSavingTeam(true);
    setTeamError('');
    setTeamSuccess('');
    try {
      await updateParticipantTicketTeam(
        editingRegistration.event.id,
        editingRegistration.ticket.id,
        teamName,
        members
      );
      setTeamSuccess('Team details saved successfully!');
      setTimeout(() => {
        setEditingRegistration(null);
        loadRegistrations(true);
      }, 900);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Could not save team changes.');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDownloadMemberCert = async (
    reg: Registration,
    member: { name: string; email?: string; id?: string }
  ) => {
    const certKey = `${reg.ticket.id}_${member.name}`;
    setDownloadingCertId(certKey);
    try {
      const participantInfo = {
        name: member.name || 'Participant',
        email: member.email || contactEmail,
        id: member.id || reg.ticket.ticketNumber,
        teamName: reg.ticket.teamName,
      };
      await downloadCertificate(reg.event, participantInfo);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Certificate template is not configured or issued for this event yet.'
      );
    } finally {
      setDownloadingCertId(null);
    }
  };

  const handleDownloadAllTeamCerts = async (reg: Registration) => {
    const allMembers = [
      { name: reg.ticket.guestName || 'Team Lead', email: reg.ticket.guestEmail || contactEmail, id: reg.ticket.ticketNumber },
      ...(reg.ticket.teamMembers || []).map((m, idx) => ({
        name: m.name,
        email: m.email,
        id: `${reg.ticket.ticketNumber}-M${idx + 2}`,
      })),
    ].filter((m) => m.name && m.name.trim().length > 0);

    const certKey = `${reg.ticket.id}_ALL`;
    setDownloadingCertId(certKey);
    try {
      for (const m of allMembers) {
        await downloadCertificate(reg.event, {
          name: m.name,
          email: m.email,
          id: m.id,
          teamName: reg.ticket.teamName,
        });
        await new Promise((r) => setTimeout(r, 450));
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Certificate template is not configured or issued for this event yet.'
      );
    } finally {
      setDownloadingCertId(null);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
    navigate('/participant-auth', { replace: true });
  };

  const teamRegistrations = useMemo(() => {
    return registrations.filter(
      (r) =>
        r.ticket.teamName ||
        (r.ticket.teamMembers && r.ticket.teamMembers.length > 0) ||
        r.event.teamsEnabled
    );
  }, [registrations]);

  const certificateRegistrations = useMemo(() => {
    return registrations.filter(
      (r) =>
        Boolean(r.event.certificateConfig?.templateUrl) ||
        r.event.status === 'completed'
    );
  }, [registrations]);

  return (
    <div className="participant-space">
      {/* ── Top Navigation Bar ── */}
      <header className="participant-topbar">
        <Link to="/" className="participant-logo">
          <span><Sparkles size={14} /></span>
          SAInT <b>PARTICIPANT</b>
        </Link>
        <div className="participant-top-actions">
          <span className="participant-user">
            @{profile?.participantUsername || 'participant'}
          </span>

          <button
            type="button"
            onClick={() => loadRegistrations(true)}
            disabled={refreshing}
            title="Sync Passes"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing…' : 'Sync'}</span>
          </button>

          <button type="button" onClick={handleSignOut}>
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="participant-hero">
        <div>
          <p className="participant-kicker">PARTICIPANT PASSBOARD</p>
          <h1>
            Your events,<br />
            <span>all in one place.</span>
          </h1>
          <p>
            Welcome, <strong>{profile?.displayName || 'Participant'}</strong>. Use your digital passes for entry on event days, manage your team rosters, copy ticket IDs, and download certificates.
          </p>
        </div>

        <div className="participant-hero-meter" aria-label="Total passes">
          <span>{registrations.length}</span>
          <small>PASSES LINKED</small>
        </div>
      </section>

      {/* ── Main Content Area ── */}
      <main className="participant-content">
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('passes')}
            style={{
              border: 0,
              padding: '0.65rem 1.15rem',
              fontWeight: 800,
              fontSize: '0.74rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              background: activeTab === 'passes' ? '#171321' : '#e6dfd3',
              color: activeTab === 'passes' ? '#fff9ef' : '#514a52',
              boxShadow: activeTab === 'passes' ? '3px 3px 0 #c4a24c' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Ticket size={14} /> Registered Passes ({registrations.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            style={{
              border: 0,
              padding: '0.65rem 1.15rem',
              fontWeight: 800,
              fontSize: '0.74rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              background: activeTab === 'teams' ? '#171321' : '#e6dfd3',
              color: activeTab === 'teams' ? '#fff9ef' : '#514a52',
              boxShadow: activeTab === 'teams' ? '3px 3px 0 #c4a24c' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Users size={14} /> Teams &amp; Teammates ({teamRegistrations.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('certificates')}
            style={{
              border: 0,
              padding: '0.65rem 1.15rem',
              fontWeight: 800,
              fontSize: '0.74rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              background: activeTab === 'certificates' ? '#171321' : '#e6dfd3',
              color: activeTab === 'certificates' ? '#fff9ef' : '#514a52',
              boxShadow: activeTab === 'certificates' ? '3px 3px 0 #c4a24c' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Award size={14} /> Issued Certificates ({certificateRegistrations.length})
          </button>
        </div>

        {/* ── TAB 1: PASSES ── */}
        {activeTab === 'passes' && (
          <div>
            <div className="participant-section-label">
              <span>REGISTERED PASSES</span>
              <em>{registrations.length} {registrations.length === 1 ? 'EVENT' : 'EVENTS'}</em>
            </div>

            {loading ? (
              <div className="participant-ticket-grid">
                <div className="participant-ticket-skeleton" />
                <div className="participant-ticket-skeleton" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="participant-empty">
                <Ticket size={34} />
                <h2>No event passes found</h2>
                <p>
                  Passes are automatically linked to your registered email (<strong style={{ color: '#1a1622' }}>{contactEmail || 'your email'}</strong>). Explore upcoming events to register.
                </p>
                <Link to="/events">Explore Events</Link>
              </div>
            ) : (
              <div className="participant-ticket-grid">
                {registrations.map((reg) => {
                  const { event, ticket } = reg;
                  const isCheckedIn = Boolean(ticket.checkedIn);
                  return (
                    <article key={ticket.id} className="participant-ticket-card">
                      <div className="participant-ticket-accent" aria-hidden="true" />

                      <div className="participant-ticket-head">
                        <span>{ticket.tierName || 'EVENT PASS'}</span>
                        <button
                          type="button"
                          onClick={() => setActiveTicket(reg)}
                          title="View Live QR Code"
                          aria-label="View QR Code"
                        >
                          <QrCode size={18} />
                        </button>
                      </div>

                      <h2>{event.title}</h2>

                      <div className="participant-ticket-meta">
                        <span>
                          <CalendarDays size={14} /> {formatDate(event.date)}
                        </span>
                        <span>
                          <MapPin size={14} /> {event.location || event.venue || 'JSPM RSCOE Campus'}
                        </span>
                        {ticket.teamName && (
                          <span style={{ color: '#f4d06f', fontWeight: 700 }}>
                            <Users size={14} /> Team: {ticket.teamName}
                          </span>
                        )}
                        <span style={{ color: isCheckedIn ? '#4ade80' : '#f4d06f' }}>
                          <CheckCircle2 size={14} /> {isCheckedIn ? 'Checked In' : 'Entry Ready'}
                        </span>
                      </div>

                      {/* Ticket Number Badge & Copy Button */}
                      <div className="participant-ticket-number">
                        <small>TICKET NUMBER</small>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong>{ticket.ticketNumber}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopyTicket(ticket.ticketNumber)}
                            style={{
                              border: '1px solid #51495d',
                              background: 'transparent',
                              color: copiedId === ticket.ticketNumber ? '#4ade80' : '#bdb7c7',
                              padding: '0.3rem 0.55rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            {copiedId === ticket.ticketNumber ? (
                              <>
                                <Check size={12} /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="participant-ticket-buttons">
                        <button type="button" onClick={() => setActiveTicket(reg)}>
                          <QrCode size={14} /> Live QR
                        </button>
                        <button type="button" onClick={() => handleDownloadTicket(reg)}>
                          <Download size={14} /> Download
                        </button>
                      </div>

                      {(ticket.teamMembers?.length || ticket.teamName || event.teamsEnabled) && (
                        <button
                          type="button"
                          className="participant-team-link"
                          onClick={() => openTeamEditor(reg)}
                        >
                          <Users size={14} />
                          <span>Manage Team ({ticket.teamMembers?.length || 0} members)</span>
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: TEAMS & TEAMMATES ── */}
        {activeTab === 'teams' && (
          <div>
            <div className="participant-section-label">
              <span>TEAM ROSTERS</span>
              <em>{teamRegistrations.length} {teamRegistrations.length === 1 ? 'TEAM' : 'TEAMS'}</em>
            </div>

            {teamRegistrations.length === 0 ? (
              <div className="participant-empty">
                <Users size={34} />
                <h2>No team events registered</h2>
                <p>When you register for team events, you can manage your group members and details here.</p>
                <Link to="/events">Explore Events</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {teamRegistrations.map((reg) => {
                  const { event, ticket } = reg;
                  const teammates = ticket.teamMembers || [];
                  return (
                    <div
                      key={ticket.id}
                      style={{
                        background: '#191622',
                        color: '#fbf6ed',
                        padding: '1.75rem',
                        boxShadow: '7px 7px 0 rgba(109,40,217,.18)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #3d3548',
                          paddingBottom: '1rem',
                          marginBottom: '1.25rem',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <span style={{ color: '#f4d06f', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                            {event.title}
                          </span>
                          <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.45rem', letterSpacing: '-0.03em' }}>
                            Team: {ticket.teamName || 'Unnamed Team'}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTeamEditor(reg)}
                          style={{
                            border: 0,
                            background: '#f4d06f',
                            color: '#1a1622',
                            padding: '0.65rem 1rem',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <Edit3 size={14} /> Edit Team &amp; Teammates
                        </button>
                      </div>

                      {/* Lead Info */}
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid #3b3345',
                          padding: '1rem',
                          marginBottom: '1rem',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.75rem',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div>
                          <span style={{ color: '#958b9f', fontSize: '0.62rem', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                            Team Leader
                          </span>
                          <strong style={{ color: '#fff' }}>{ticket.guestName}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#958b9f', fontSize: '0.62rem', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                            Leader Email
                          </span>
                          <span style={{ color: '#d3cce0' }}>{ticket.guestEmail || contactEmail}</span>
                        </div>
                        <div>
                          <span style={{ color: '#958b9f', fontSize: '0.62rem', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>
                            Leader Phone
                          </span>
                          <span style={{ color: '#d3cce0' }}>{ticket.guestPhone || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Members List */}
                      <div>
                        <span style={{ color: '#f4d06f', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', display: 'block', marginBottom: '0.6rem' }}>
                          TEAMMATES ({teammates.length})
                        </span>
                        {teammates.length === 0 ? (
                          <div className="participant-no-members">
                            No additional teammates added. Click &quot;Edit Team &amp; Teammates&quot; to add your roster.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                            {teammates.map((m, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: '#120f1a',
                                  border: '1px solid #372f44',
                                  padding: '0.85rem',
                                  fontSize: '0.75rem',
                                }}
                              >
                                <strong style={{ color: '#fbf6ed', display: 'block', marginBottom: '0.35rem' }}>
                                  0{idx + 2}. {m.name || 'Teammate'}
                                </strong>
                                {m.email && <div style={{ color: '#aba2b8', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.15rem 0' }}><Mail size={11} /> {m.email}</div>}
                                {m.phone && <div style={{ color: '#aba2b8', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.15rem 0' }}><Phone size={11} /> {m.phone}</div>}
                                {m.college && <div style={{ color: '#aba2b8', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.15rem 0' }}><Building2 size={11} /> {m.college}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ISSUED CERTIFICATES ── */}
        {activeTab === 'certificates' && (
          <div>
            <div className="participant-section-label">
              <span>DIGITAL CREDENTIALS &amp; CERTIFICATES</span>
              <em>{certificateRegistrations.length} {certificateRegistrations.length === 1 ? 'RECORD' : 'RECORDS'}</em>
            </div>

            {registrations.length === 0 ? (
              <div className="participant-empty">
                <Award size={34} />
                <h2>No certificates found</h2>
                <p>Certificates will appear here once your registered events conclude.</p>
                <Link to="/events">Explore Events</Link>
              </div>
            ) : (
              <div className="participant-ticket-grid">
                {registrations.map((reg) => {
                  const { event, ticket } = reg;
                  const isReady =
                    Boolean(event.certificateConfig?.templateUrl) ||
                    event.status === 'completed';
                  return (
                    <article key={ticket.id} className="participant-ticket-card">
                      <div className="participant-ticket-head">
                        <span style={{ color: '#4ade80' }}>DIGITAL CERTIFICATE</span>
                        <Award size={18} style={{ color: '#4ade80' }} />
                      </div>

                      <h2>{event.title}</h2>

                      <div className="participant-ticket-meta">
                        <span>Issued to: <strong style={{ color: '#fff' }}>{ticket.guestName}</strong></span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          ID: {ticket.ticketNumber}
                        </span>
                        <span style={{ color: isReady ? '#4ade80' : '#f4d06f' }}>
                          {isReady ? '✅ Ready to Download' : '⏳ Post-event verification'}
                        </span>
                      </div>

                      {/* ── Certificate download section ── */}
                      {(ticket.teamMembers && ticket.teamMembers.length > 0) ? (() => {
                        const allMembers = [
                          {
                            name: ticket.guestName || 'Team Lead',
                            email: ticket.guestEmail || contactEmail,
                            id: ticket.ticketNumber,
                            role: 'Team Lead',
                          },
                          ...ticket.teamMembers.map((m, idx) => ({
                            name: m.name,
                            email: m.email,
                            id: `${ticket.ticketNumber}-M${idx + 2}`,
                            role: `Member ${idx + 2}`,
                          })),
                        ].filter(m => m.name && m.name.trim().length > 0);

                        const allKey = `${ticket.id}_ALL`;
                        const isAllLoading = downloadingCertId === allKey;

                        return (
                          <div style={{ marginTop: '12px' }}>
                            {/* Section label */}
                            <div style={{ fontSize: '0.6rem', color: '#f4d06f', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                              Team Certificates — {allMembers.length} Members
                            </div>

                            {/* Per-member rows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {allMembers.map((m) => {
                                const mKey = `${ticket.id}_${m.name}`;
                                const isMLoading = downloadingCertId === mKey || isAllLoading;
                                return (
                                  <div
                                    key={mKey}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      background: 'rgba(255,255,255,0.04)',
                                      borderRadius: '6px',
                                      padding: '7px 10px',
                                      border: '1px solid rgba(255,255,255,0.07)',
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                                      <div style={{ color: '#666', fontSize: '0.6rem', marginTop: '2px' }}>{m.role}</div>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={isMLoading}
                                      onClick={() => handleDownloadMemberCert(reg, m)}
                                      style={{
                                        display: 'inline-flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: '5px',
                                        flexShrink: 0,
                                        marginLeft: '10px',
                                        fontSize: '0.62rem',
                                        fontWeight: 600,
                                        padding: '5px 10px',
                                        whiteSpace: 'nowrap',
                                        border: '1px solid rgba(244,208,111,0.35)',
                                        background: 'rgba(244,208,111,0.08)',
                                        color: '#f4d06f',
                                        borderRadius: '5px',
                                        cursor: isMLoading ? 'not-allowed' : 'pointer',
                                        opacity: isMLoading ? 0.5 : 1,
                                        letterSpacing: '0.04em',
                                      }}
                                    >
                                      <Download size={11} />
                                      {downloadingCertId === mKey ? 'Working…' : 'Download'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Bulk download */}
                            <button
                              type="button"
                              disabled={isAllLoading}
                              onClick={() => handleDownloadAllTeamCerts(reg)}
                              style={{
                                display: 'inline-flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '7px',
                                marginTop: '10px',
                                width: '100%',
                                background: isAllLoading ? 'rgba(244,208,111,0.3)' : 'linear-gradient(135deg,#f4d06f,#e8b84b)',
                                color: '#111',
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                letterSpacing: '0.06em',
                                padding: '9px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: isAllLoading ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Download size={13} />
                              {isAllLoading ? 'Generating All…' : `Download All ${allMembers.length} Certificates`}
                            </button>
                          </div>
                        );
                      })() : (
                        /* Solo registration — single gold download button */
                        <div style={{ marginTop: '12px' }}>
                          <button
                            type="button"
                            disabled={downloadingCertId === `${ticket.id}_${ticket.guestName}`}
                            onClick={() => handleDownloadMemberCert(reg, {
                              name: ticket.guestName || profile?.displayName || 'Participant',
                              email: ticket.guestEmail || contactEmail,
                              id: ticket.ticketNumber,
                            })}
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '7px',
                              width: '100%',
                              background: 'linear-gradient(135deg,#f4d06f,#e8b84b)',
                              color: '#111',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              letterSpacing: '0.06em',
                              padding: '9px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: downloadingCertId === `${ticket.id}_${ticket.guestName}` ? 'not-allowed' : 'pointer',
                              opacity: downloadingCertId === `${ticket.id}_${ticket.guestName}` ? 0.6 : 1,
                            }}
                          >
                            <Download size={14} />
                            {downloadingCertId === `${ticket.id}_${ticket.guestName}` ? 'Generating…' : 'Download Certificate PNG'}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Day-of-event helpful note */}
        <div className="participant-day-note">
          <Sparkles size={18} />
          <span>
            <strong>Pro Tip:</strong> Keep your live QR code ready at the event registration desk for instant pass check-in.
          </span>
        </div>
      </main>

      {/* ── Live QR Code Modal ── */}
      {activeTicket && (
        <div className="participant-modal-backdrop">
          <div className="participant-qr-modal">
            <button
              type="button"
              className="participant-modal-close"
              onClick={() => setActiveTicket(null)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
            <p>DIGITAL PASS SCANNER</p>
            <h2>{activeTicket.event.title}</h2>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${activeTicket.ticket.ticketNumber}`}
              />
            ) : (
              <div style={{ height: 260, display: 'grid', placeItems: 'center' }}>
                <QrCode size={40} />
              </div>
            )}
            <strong>{activeTicket.ticket.ticketNumber}</strong>
            <span>Present this pass to volunteers at the entrance</span>
            <button
              type="button"
              className="participant-submit"
              onClick={() => handleDownloadTicket(activeTicket)}
            >
              <Download size={16} /> Save Pass Image
            </button>
          </div>
        </div>
      )}

      {/* ── Team & Teammates Edit Modal ── */}
      {editingRegistration && (
        <div className="participant-modal-backdrop">
          <div className="participant-team-modal">
            <button
              type="button"
              className="participant-modal-close"
              onClick={() => setEditingRegistration(null)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
            <p className="participant-kicker">TEAM ROSTER EDITOR</p>
            <h2>{editingRegistration.event.title}</h2>

            {Boolean(
              editingRegistration.ticket.tierId ||
              editingRegistration.ticket.tierName ||
              (editingRegistration.ticket.teamSize && editingRegistration.ticket.teamSize > 0)
            ) && (
              <div
                style={{
                  background: '#fef3c7',
                  borderLeft: '3px solid #d97706',
                  color: '#92400e',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span>
                  🔒 <strong>Tier Fixed ({editingRegistration.ticket.tierName || 'Selected Tier'}):</strong> You cannot add or remove member slots for this tier. You can edit the existing member details below.
                </span>
              </div>
            )}

            {teamError && <div className="participant-editor-error">{teamError}</div>}
            {teamSuccess && (
              <div style={{ background: '#dcfce7', color: '#166534', padding: '0.75rem', fontSize: '0.78rem', marginBottom: '1rem', fontWeight: 700 }}>
                {teamSuccess}
              </div>
            )}

            <label>
              Team Name
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Cyber Ninjas"
              />
            </label>

            <div className="participant-team-members">
              <div>
                <span>TEAMMATES ({members.length})</span>
                {!Boolean(
                  editingRegistration.ticket.tierId ||
                  editingRegistration.ticket.tierName ||
                  (editingRegistration.ticket.teamSize && editingRegistration.ticket.teamSize > 0)
                ) && (
                  <button type="button" onClick={addMember}>
                    <Plus size={13} /> Add Member
                  </button>
                )}
              </div>

              {members.length === 0 ? (
                <div className="participant-no-members">
                  No teammates added yet. Click &quot;Add Member&quot; to include your team partners.
                </div>
              ) : (
                members.map((member, index) => {
                  const isTierLocked = Boolean(
                    editingRegistration.ticket.tierId ||
                    editingRegistration.ticket.tierName ||
                    (editingRegistration.ticket.teamSize && editingRegistration.ticket.teamSize > 0)
                  );
                  return (
                    <div
                      key={index}
                      className="participant-member-editor"
                      style={{ gridTemplateColumns: isTierLocked ? '25px 1fr 1fr 1fr' : undefined }}
                    >
                      <b>{index + 2}.</b>
                      <input
                        value={member.name}
                        onChange={(e) => updateMember(index, 'name', e.target.value)}
                        placeholder="Full Name *"
                        required
                      />
                      <input
                        value={member.email || ''}
                        onChange={(e) => updateMember(index, 'email', e.target.value)}
                        placeholder="Email"
                        type="email"
                      />
                      <input
                        value={member.phone || ''}
                        onChange={(e) => updateMember(index, 'phone', e.target.value)}
                        placeholder="Phone / College"
                      />
                      {!isTierLocked && (
                        <button
                          type="button"
                          onClick={() => removeMember(index)}
                          title="Remove teammate"
                          aria-label="Remove member"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.8rem' }}>
              <button
                type="button"
                className="participant-submit"
                disabled={savingTeam}
                onClick={saveTeamChanges}
                style={{ flex: 1 }}
              >
                {savingTeam ? 'Saving…' : 'Save Team Roster'}
              </button>
              <button
                type="button"
                onClick={() => setEditingRegistration(null)}
                style={{
                  border: '1px solid #cfc5b8',
                  background: 'transparent',
                  padding: '1rem 1.25rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: '#413a44',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
