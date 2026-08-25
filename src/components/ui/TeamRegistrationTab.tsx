import { useState, useMemo } from 'react';
import type { EventRecord, EventTeam, TeamMemberDetail } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Users2,
  Plus,
  Search,
  Download,
  Mail,
  Award,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FolderArchive,
  UserCheck,
  Building,
  Phone,
  FileSpreadsheet,
  X,
  Layers,
} from 'lucide-react';
import {
  downloadTeamCertificatesAsZip,
  downloadAllCertificatesAsZip,
} from '../../utils/certificateGenerator';
import {
  sendTeamCertificates,
  type BulkCertificateProgress,
} from '../../services/emailService';
import { updateTeamArrivalStatus } from '../../services/eventService';

interface TeamRegistrationTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
}

export default function TeamRegistrationTab({
  event,
  onUpdate,
  canEdit,
  canDelete,
}: TeamRegistrationTabProps) {
  const { showToast } = useToast();
  const teams: EventTeam[] = event.teams || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [filterArrival, setFilterArrival] = useState<'all' | 'arrived' | 'pending'>('all');
  const [filterCerts, setFilterCerts] = useState<'all' | 'issued' | 'pending'>('all');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Modal / Form state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  // Form fields
  const [teamName, setTeamName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [tierName, setTierName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);

  // Processing state for certificates / ZIP
  const [processingTeamId, setProcessingTeamId] = useState<string | null>(null);
  const [teamProgress, setTeamProgress] = useState<BulkCertificateProgress | null>(null);
  const [downloadingAllZip, setDownloadingAllZip] = useState(false);
  const [allZipProgress, setAllZipProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const hasTemplate = Boolean(event.certificateConfig?.templateUrl);

  // Stats
  const totalTeams = teams.length;
  const arrivedTeams = teams.filter((t) => t.arrived).length;
  const totalMembersCount = teams.reduce((acc, t) => acc + 1 + (t.members?.length || 0), 0);
  const teamsWithCerts = teams.filter((t) => t.certificatesSent || (t.memberCertificateUrls && Object.keys(t.memberCertificateUrls).length > 0)).length;

  // Filtered list
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.teamName.toLowerCase().includes(q) ||
        t.leadName.toLowerCase().includes(q) ||
        t.leadEmail.toLowerCase().includes(q) ||
        (t.members || []).some((m) => m.name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q)));

      const matchesArrival =
        filterArrival === 'all' ? true : filterArrival === 'arrived' ? t.arrived : !t.arrived;

      const hasCert = Boolean(t.certificatesSent || (t.memberCertificateUrls && Object.keys(t.memberCertificateUrls).length > 0));
      const matchesCerts =
        filterCerts === 'all' ? true : filterCerts === 'issued' ? hasCert : !hasCert;

      return matchesSearch && matchesArrival && matchesCerts;
    });
  }, [teams, searchTerm, filterArrival, filterCerts]);

  // Open Add / Edit Modal
  const handleOpenAddModal = () => {
    setEditingTeamId(null);
    setTeamName('');
    setLeadName('');
    setLeadEmail('');
    setLeadPhone('');
    setCollege('');
    setDepartment('');
    setTierName('');
    setTransactionId('');
    setNotes('');
    setMembers([{ name: '', email: '', phone: '', college: '', department: '' }]);
    setShowTeamModal(true);
  };

  const handleOpenEditModal = (t: EventTeam) => {
    setEditingTeamId(t.id);
    setTeamName(t.teamName);
    setLeadName(t.leadName);
    setLeadEmail(t.leadEmail);
    setLeadPhone(t.leadPhone || '');
    setCollege(t.college || '');
    setDepartment(t.department || '');
    setTierName(t.tierName || '');
    setTransactionId(t.transactionId || '');
    setNotes(t.notes || '');
    setMembers(t.members && t.members.length > 0 ? [...t.members] : [{ name: '', email: '', phone: '', college: '', department: '' }]);
    setShowTeamModal(true);
  };

  // Add / Remove dynamic member rows
  const handleAddMemberRow = () => {
    setMembers([...members, { name: '', email: '', phone: '', college: '', department: '' }]);
  };

  const handleRemoveMemberRow = (idx: number) => {
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleMemberChange = (idx: number, field: keyof TeamMemberDetail, val: string) => {
    const updated = [...members];
    updated[idx] = { ...updated[idx], [field]: val };
    setMembers(updated);
  };

  // Save Team
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !leadName.trim()) {
      showToast('Team name and team lead name are required', 'error');
      return;
    }

    setSavingTeam(true);
    try {
      const cleanMembers = members.filter((m) => m.name.trim().length > 0);

      let updatedTeams: EventTeam[];
      if (editingTeamId) {
        updatedTeams = teams.map((t) =>
          t.id === editingTeamId
            ? {
                ...t,
                teamName: teamName.trim(),
                leadName: leadName.trim(),
                leadEmail: leadEmail.trim().toLowerCase(),
                leadPhone: leadPhone.trim(),
                college: college.trim(),
                department: department.trim(),
                tierName: tierName.trim(),
                transactionId: transactionId.trim(),
                notes: notes.trim(),
                memberCount: cleanMembers.length + 1,
                members: cleanMembers,
              }
            : t
        );
        showToast(`Team "${teamName}" updated successfully!`, 'success');
      } else {
        const newTeam: EventTeam = {
          id: `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventId: event.id,
          teamName: teamName.trim(),
          leadName: leadName.trim(),
          leadEmail: leadEmail.trim().toLowerCase(),
          leadPhone: leadPhone.trim(),
          college: college.trim(),
          department: department.trim(),
          tierName: tierName.trim(),
          transactionId: transactionId.trim(),
          notes: notes.trim(),
          memberCount: cleanMembers.length + 1,
          members: cleanMembers,
          registeredAt: new Date().toISOString(),
          arrived: false,
        };
        updatedTeams = [newTeam, ...teams];
        showToast(`Team "${teamName}" registered successfully!`, 'success');
      }

      await onUpdate({ teams: updatedTeams });
      setShowTeamModal(false);
    } catch (err: any) {
      console.error('Failed to save team:', err);
      showToast(err.message || 'Failed to save team registration', 'error');
    } finally {
      setSavingTeam(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove team "${name}" and all its member records?`)) {
      return;
    }
    try {
      const updated = teams.filter((t) => t.id !== teamId);
      await onUpdate({ teams: updated });
      showToast(`Team "${name}" removed.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete team', 'error');
    }
  };

  // Toggle Arrival
  const handleToggleArrival = async (t: EventTeam) => {
    const targetArrived = !t.arrived;
    try {
      const updated = teams.map((team) =>
        team.id === t.id
          ? { ...team, arrived: targetArrived, arrivedAt: targetArrived ? new Date().toISOString() : undefined }
          : team
      );
      await onUpdate({ teams: updated });
      await updateTeamArrivalStatus(event.id, t.id, targetArrived);
      showToast(
        targetArrived ? `Marked Team "${t.teamName}" as arrived!` : `Marked Team "${t.teamName}" as pending.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update arrival status', 'error');
    }
  };

  // Generate & Dispatch Team Certificates
  const handleIssueTeamCertificates = async (t: EventTeam) => {
    if (!hasTemplate) {
      showToast('Please upload a certificate template in the Certificates tab first', 'error');
      return;
    }

    setProcessingTeamId(t.id);
    setTeamProgress({ current: 0, total: 1 + (t.members?.length || 0), currentName: 'Initializing...', status: 'rendering' });

    try {
      const result = await sendTeamCertificates(event, t, event.certificateConfig, (prog) => {
        setTeamProgress(prog);
      });
      showToast(`Generated & processed credentials for ${result.successful} members of "${t.teamName}"!`, 'success');
    } catch (err: any) {
      console.error('Team certificate issuance error:', err);
      showToast(err.message || 'Failed to issue team certificates', 'error');
    } finally {
      setProcessingTeamId(null);
      setTeamProgress(null);
    }
  };

  // Download Single Team ZIP
  const handleDownloadTeamZip = async (t: EventTeam) => {
    if (!hasTemplate) {
      showToast('Please upload a certificate template in the Certificates tab first', 'error');
      return;
    }

    try {
      showToast(`Packaging certificates for Team "${t.teamName}"...`, 'info');
      await downloadTeamCertificatesAsZip(event, t, event.certificateConfig);
      showToast(`Downloaded certificates for Team "${t.teamName}"!`, 'success');
    } catch (err: any) {
      console.error('Failed to download team zip:', err);
      showToast(err.message || 'Failed to download team certificates', 'error');
    }
  };

  // Download ALL Team Certificates in ONE ZIP
  const handleDownloadAllTeamsZip = async () => {
    if (!hasTemplate) {
      showToast('Please upload a certificate template in the Certificates tab first', 'error');
      return;
    }

    if (teams.length === 0) {
      showToast('No teams registered for this event', 'error');
      return;
    }

    // Flatten all team members into participants list with teamName attribute
    const allMembersList: Array<{ id: string; name: string; email?: string; teamName: string }> = [];
    teams.forEach((t) => {
      allMembersList.push({
        id: `${t.id}_lead_${t.leadName}`,
        name: t.leadName,
        email: t.leadEmail,
        teamName: t.teamName,
      });
      (t.members || []).forEach((m) => {
        allMembersList.push({
          id: `${t.id}_${m.name}`,
          name: m.name,
          email: m.email,
          teamName: t.teamName,
        });
      });
    });

    setDownloadingAllZip(true);
    setAllZipProgress({ current: 0, total: allMembersList.length, name: 'Starting package...' });

    try {
      await downloadAllCertificatesAsZip(event, allMembersList, event.certificateConfig, (cur, tot, name) => {
        setAllZipProgress({ current: cur, total: tot, name });
      });
      showToast(`Downloaded ZIP containing certificates for all ${allMembersList.length} team members!`, 'success');
    } catch (err: any) {
      console.error('All teams ZIP error:', err);
      showToast(err.message || 'Failed to generate all team certificates ZIP', 'error');
    } finally {
      setDownloadingAllZip(false);
      setAllZipProgress(null);
    }
  };

  // Export CSV
  const handleExportTeamsCsv = () => {
    if (teams.length === 0) {
      showToast('No team records to export', 'error');
      return;
    }

    const rows: string[][] = [
      [
        'Team Name',
        'Role',
        'Member Name',
        'Email',
        'Phone',
        'College',
        'Department',
        'Tier',
        'Transaction ID',
        'Arrival Status',
        'Arrival Time',
        'Certificate Link',
        'Registered At',
      ],
    ];

    teams.forEach((t) => {
      const leadCert = t.memberCertificateUrls?.[t.leadEmail || t.leadName] || '';
      // Lead Row
      rows.push([
        t.teamName,
        'Team Leader',
        t.leadName,
        t.leadEmail || '',
        t.leadPhone || '',
        t.college || '',
        t.department || '',
        t.tierName || '',
        t.transactionId || '',
        t.arrived ? 'Arrived' : 'Pending',
        t.arrivedAt || '',
        leadCert,
        t.registeredAt || '',
      ]);

      // Member Rows
      (t.members || []).forEach((m) => {
        const memCert = t.memberCertificateUrls?.[m.email || m.name] || '';
        rows.push([
          t.teamName,
          'Member',
          m.name,
          m.email || '',
          m.phone || '',
          m.college || t.college || '',
          m.department || t.department || '',
          t.tierName || '',
          t.transactionId || '',
          t.arrived ? 'Arrived' : 'Pending',
          t.arrivedAt || '',
          memCert,
          t.registeredAt || '',
        ]);
      });
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Teams_${event.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported team registry CSV successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div
        className="rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
              Team Registration &amp; Management Studio
            </h3>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Register teams, manage group rosters, track check-ins, generate team credentials with dynamic badges, and export records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportTeamsCsv}
            disabled={teams.length === 0}
            className="btn-secondary !text-xs !py-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download full CSV roster with team names, member contact details, and certificate links"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Export CSV
          </button>

          <button
            onClick={handleDownloadAllTeamsZip}
            disabled={!hasTemplate || downloadingAllZip || teams.length === 0}
            className="btn-secondary !text-xs !py-2.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            style={{ borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.08)' }}
            title="Generate and download all team members certificates in one ZIP"
          >
            <FolderArchive className="w-4 h-4 text-blue-400" />
            {downloadingAllZip ? 'Packaging Team Certs...' : 'Download All Team Certs (ZIP)'}
          </button>

          {canEdit && (
            <button
              onClick={handleOpenAddModal}
              className="btn-primary !text-xs !py-2.5 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register New Team
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Users2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>
              {totalTeams}
            </p>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Registered Teams
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>
              {totalMembersCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Total Members
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>
              {arrivedTeams} / {totalTeams}
            </p>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Arrived Teams
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>
              {teamsWithCerts}
            </p>
            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              Certificates Issued
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar if Downloading All ZIP */}
      {downloadingAllZip && allZipProgress && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              Generating &amp; Bundling All Team Member Credentials...
            </span>
            <span>
              {allZipProgress.current} / {allZipProgress.total}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-200"
              style={{
                width: `${Math.round((allZipProgress.current / Math.max(1, allZipProgress.total)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-slate-400 truncate">Current: {allZipProgress.name}</p>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div
        className="rounded-2xl border p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Team Name, Leader, Member, or Email..."
            className="input-field w-full !pl-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto">
          <select
            value={filterArrival}
            onChange={(e) => setFilterArrival(e.target.value as any)}
            className="input-field text-xs !py-2 shrink-0"
          >
            <option value="all">All Check-in Status</option>
            <option value="arrived">✓ Arrived Teams</option>
            <option value="pending">Pending Check-in</option>
          </select>

          <select
            value={filterCerts}
            onChange={(e) => setFilterCerts(e.target.value as any)}
            className="input-field text-xs !py-2 shrink-0"
          >
            <option value="all">All Credentials</option>
            <option value="issued">✉ Certificates Issued</option>
            <option value="pending">Not Issued</option>
          </select>
        </div>
      </div>

      {/* Teams List */}
      {filteredTeams.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center space-y-3"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto text-blue-400">
            <Users2 className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
            {teams.length === 0 ? 'No Teams Registered Yet' : 'No Teams Match Your Search'}
          </h4>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--dash-muted)' }}>
            {teams.length === 0
              ? 'Start by registering your first group or team using the "Register New Team" button above.'
              : 'Try clearing your search query or adjusting the arrival and certificate filters.'}
          </p>
          {canEdit && teams.length === 0 && (
            <button onClick={handleOpenAddModal} className="btn-primary !text-xs !py-2.5 !px-5 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Register Team
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const isExpanded = expandedTeamId === team.id;
            const isProcessingThis = processingTeamId === team.id;
            const totalRoster = 1 + (team.members?.length || 0);
            const certsCount = team.memberCertificateUrls ? Object.keys(team.memberCertificateUrls).length : 0;

            return (
              <div
                key={team.id}
                className="rounded-2xl border transition-all"
                style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-base">
                      {team.teamName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-base truncate" style={{ color: 'var(--dash-text)' }}>
                          {team.teamName}
                        </h4>
                        {team.tierName && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {team.tierName}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400">
                          {totalRoster} Members
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            team.arrived
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {team.arrived ? '✓ Arrived' : 'Pending'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <strong className="text-slate-300">Lead:</strong> {team.leadName}
                        </span>
                        {team.leadEmail && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Mail className="w-3 h-3 text-slate-500" /> {team.leadEmail}
                          </span>
                        )}
                        {team.leadPhone && (
                          <span className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-500" /> {team.leadPhone}
                          </span>
                        )}
                        {team.college && (
                          <span className="flex items-center gap-1 text-[11px]">
                            <Building className="w-3 h-3 text-slate-500" /> {team.college}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Arrival check-in button */}
                    <button
                      onClick={() => handleToggleArrival(team)}
                      className={`btn-secondary !text-xs !py-1.5 !px-3 flex items-center gap-1.5 cursor-pointer ${
                        team.arrived ? '!bg-emerald-500/10 !text-emerald-400 !border-emerald-500/30' : ''
                      }`}
                      title={team.arrived ? 'Mark pending' : 'Mark arrived'}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {team.arrived ? 'Arrived' : 'Check In'}
                    </button>

                    {/* Issue / Email Team Certificates */}
                    <button
                      onClick={() => handleIssueTeamCertificates(team)}
                      disabled={isProcessingThis || !hasTemplate}
                      className="btn-secondary !text-xs !py-1.5 !px-3 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.08)' }}
                      title="Generate and issue official certificates to each team member"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      {isProcessingThis ? 'Processing...' : certsCount > 0 ? `Re-issue (${certsCount})` : 'Issue Certs'}
                    </button>

                    {/* Download Team ZIP */}
                    <button
                      onClick={() => handleDownloadTeamZip(team)}
                      disabled={!hasTemplate}
                      className="p-2 rounded-xl border border-blue-500/20 hover:bg-blue-500/10 text-blue-400 cursor-pointer disabled:opacity-40"
                      title="Download certificates of all members as ZIP"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEditModal(team)}
                        className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
                        title="Edit Team Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteTeam(team.id, team.teamName)}
                        className="p-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-400 cursor-pointer"
                        title="Delete Team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Expand Roster Toggle */}
                    <button
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                      className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800/80 text-slate-400 cursor-pointer"
                      title={isExpanded ? 'Collapse Roster' : 'View Team Roster'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Progress bar if processing this team */}
                {isProcessingThis && teamProgress && (
                  <div className="px-5 pb-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating Team Credentials...
                        </span>
                        <span>
                          {teamProgress.current} / {teamProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-200"
                          style={{
                            width: `${Math.round((teamProgress.current / Math.max(1, teamProgress.total)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-amber-300/80 truncate">Member: {teamProgress.currentName}</p>
                    </div>
                  </div>
                )}

                {/* Expanded Roster Detail Table */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                    <div className="flex items-center justify-between pb-2 mb-2">
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                        Team Roster ({totalRoster} Members)
                      </h5>
                      {team.transactionId && (
                        <span className="text-xs font-mono text-slate-400">
                          TxID: <strong className="text-slate-200">{team.transactionId}</strong>
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b text-slate-400" style={{ borderColor: 'var(--dash-border)' }}>
                            <th className="pb-2">Role</th>
                            <th className="pb-2">Member Name</th>
                            <th className="pb-2">Email</th>
                            <th className="pb-2">Phone</th>
                            <th className="pb-2">College / Dept</th>
                            <th className="pb-2 text-right">Certificate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {/* Leader Row */}
                          <tr className="hover:bg-slate-800/20">
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Team Leader
                              </span>
                            </td>
                            <td className="py-2.5 font-semibold" style={{ color: 'var(--dash-text)' }}>
                              {team.leadName}
                            </td>
                            <td className="py-2.5 font-mono text-[11px] text-slate-400">
                              {team.leadEmail || 'No email'}
                            </td>
                            <td className="py-2.5 text-slate-400">{team.leadPhone || '—'}</td>
                            <td className="py-2.5 text-slate-400">
                              {team.college || team.department ? `${team.college || ''} ${team.department ? `(${team.department})` : ''}` : '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              {team.memberCertificateUrls?.[team.leadEmail || team.leadName] ? (
                                <a
                                  href={team.memberCertificateUrls[team.leadEmail || team.leadName]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" /> View CDN
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-500">Not Issued</span>
                              )}
                            </td>
                          </tr>

                          {/* Member Rows */}
                          {(team.members || []).map((m, idx) => {
                            const certUrl = team.memberCertificateUrls?.[m.email || m.name];
                            return (
                              <tr key={idx} className="hover:bg-slate-800/20">
                                <td className="py-2.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                                    Member #{idx + 2}
                                  </span>
                                </td>
                                <td className="py-2.5 font-medium" style={{ color: 'var(--dash-text)' }}>
                                  {m.name}
                                </td>
                                <td className="py-2.5 font-mono text-[11px] text-slate-400">
                                  {m.email || 'No email'}
                                </td>
                                <td className="py-2.5 text-slate-400">{m.phone || '—'}</td>
                                <td className="py-2.5 text-slate-400">
                                  {m.college || m.department ? `${m.college || ''} ${m.department ? `(${m.department})` : ''}` : '—'}
                                </td>
                                <td className="py-2.5 text-right">
                                  {certUrl ? (
                                    <a
                                      href={certUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                                    >
                                      <ExternalLink className="w-3 h-3" /> View CDN
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-slate-500">Not Issued</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {team.notes && (
                      <p className="mt-3 text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800">
                        <strong>Notes:</strong> {team.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Register / Edit Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="w-full max-w-2xl rounded-3xl border p-6 space-y-5 my-8 shadow-2xl relative"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <Users2 className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                  {editingTeamId ? 'Edit Team Registration' : 'Register New Team'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4">
              {/* Team Name & Tier */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Team Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. CyberKnights"
                    className="input-field w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Ticket Tier / Category
                  </label>
                  <input
                    type="text"
                    value={tierName}
                    onChange={(e) => setTierName(e.target.value)}
                    placeholder="e.g. Squad (4 Members) or Custom"
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              {/* Team Leader Section */}
              <div className="p-3.5 rounded-2xl bg-slate-900/40 border space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
                <span className="text-xs font-bold text-amber-400 block uppercase tracking-wide">
                  Team Leader Details
                </span>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Leader Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Leader Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="rahul@example.com"
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Leader Phone
                    </label>
                    <input
                      type="tel"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="9876543210"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      College / Institute
                    </label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="JSPM RSCOE"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Department / Branch
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="IT / CS"
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Additional Members List */}
              <div className="p-3.5 rounded-2xl bg-slate-900/40 border space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 block uppercase tracking-wide">
                    Additional Team Members ({members.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMemberRow}
                    className="btn-secondary !text-[11px] !py-1 !px-2.5 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Member
                  </button>
                </div>

                {members.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No additional members added yet. Click &quot;Add Member&quot; to include teammates.</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {members.map((mem, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-950/60 border space-y-2 relative"
                        style={{ borderColor: 'var(--dash-border)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">
                            Member #{idx + 2}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberRow(idx)}
                            className="p-1 rounded text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={mem.name}
                            onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                            placeholder="Full Name"
                            className="input-field text-xs !py-1.5"
                          />
                          <input
                            type="email"
                            value={mem.email || ''}
                            onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                            placeholder="Email address"
                            className="input-field text-xs !py-1.5"
                          />
                        </div>

                        <div className="grid sm:grid-cols-3 gap-2">
                          <input
                            type="tel"
                            value={mem.phone || ''}
                            onChange={(e) => handleMemberChange(idx, 'phone', e.target.value)}
                            placeholder="Phone Number"
                            className="input-field text-xs !py-1.5"
                          />
                          <input
                            type="text"
                            value={mem.college || ''}
                            onChange={(e) => handleMemberChange(idx, 'college', e.target.value)}
                            placeholder="College Name"
                            className="input-field text-xs !py-1.5"
                          />
                          <input
                            type="text"
                            value={mem.department || ''}
                            onChange={(e) => handleMemberChange(idx, 'department', e.target.value)}
                            placeholder="Department"
                            className="input-field text-xs !py-1.5"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction ID & Notes */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                    Payment Reference / Transaction ID
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. UPI-TXN-123456"
                    className="input-field w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--dash-muted)' }}>
                    Internal Notes / Comments
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special requirements, seat preference..."
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="btn-secondary !text-xs !py-2.5 !px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTeam}
                  className="btn-primary !text-xs !py-2.5 !px-5 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingTeam ? 'Saving Team...' : editingTeamId ? 'Update Team' : 'Register Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
