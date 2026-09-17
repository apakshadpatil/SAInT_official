import { useState, useMemo, useRef } from 'react';
import type { EventRecord, EventTeam, TeamMemberDetail, EventTicket } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'qrcode';
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
  CheckCircle2,
  MessageCircle,
  UploadCloud,
  Check,
  AlertCircle,
  Maximize2,
  CreditCard,
} from 'lucide-react';
import {
  downloadTeamCertificatesAsZip,
  downloadAllCertificatesAsZip,
} from '../../utils/certificateGenerator';
import {
  sendTeamCertificates,
  sendSingleTeamMemberCertificate,
  type BulkCertificateProgress,
} from '../../services/emailService';
import { updateTeamArrivalStatus, registerParticipantForEvent } from '../../services/eventService';
import { downloadTicketImage } from '../../utils/ticketDownload';
import { uploadFileToSupabase } from '../../utils/supabase';
import { logActivity } from '../../services/activityService';

/**
 * Robust helper to resolve a certificate URL for any team member or lead.
 */
export function getTeamMemberCertUrl(
  team: EventTeam,
  member: { name?: string; email?: string; certificateUrl?: string }
): string {
  if (member.certificateUrl) return member.certificateUrl;
  if (!team.memberCertificateUrls) return '';

  const urls = team.memberCertificateUrls;
  const cleanEmail = (member.email || '').trim();
  const lowerEmail = cleanEmail.toLowerCase();
  const cleanName = (member.name || '').trim();

  return (
    (cleanEmail && urls[cleanEmail]) ||
    (lowerEmail && urls[lowerEmail]) ||
    (cleanName && urls[cleanName]) ||
    (member.name && urls[member.name]) ||
    ''
  );
}

export function teamHasAnyCertificates(team: EventTeam): boolean {
  if (team.certificatesSent) return true;
  if (team.memberCertificateUrls && Object.keys(team.memberCertificateUrls).length > 0) return true;
  if (team.members && team.members.some((m) => Boolean(m.certificateUrl))) return true;
  return false;
}

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

  const formRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

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
  const [selectedTierId, setSelectedTierId] = useState('');
  const [tierName, setTierName] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'verified' | 'pending' | 'rejected'>('verified');
  const [paymentScreenshotFile, setPaymentScreenshotFile] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string>('');
  const [paymentScreenshotError, setPaymentScreenshotError] = useState<string>('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);
  const [formError, setFormError] = useState<string>('');
  const [showFullQRModal, setShowFullQRModal] = useState(false);

  // Ticket generation success state
  const [successTicket, setSuccessTicket] = useState<EventTicket | null>(null);
  const [successQrUrl, setSuccessQrUrl] = useState<string>('');
  const [downloadingTicket, setDownloadingTicket] = useState(false);

  // Processing state for certificates / ZIP
  const [processingTeamId, setProcessingTeamId] = useState<string | null>(null);
  const [teamProgress, setTeamProgress] = useState<BulkCertificateProgress | null>(null);
  const [issuingMemberKey, setIssuingMemberKey] = useState<string | null>(null);
  const [downloadingAllZip, setDownloadingAllZip] = useState(false);
  const [allZipProgress, setAllZipProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const hasTemplate = Boolean(event.certificateConfig?.templateUrl);

  // Stats
  const totalTeams = teams.length;
  const arrivedTeams = teams.filter((t) => t.arrived).length;
  const totalMembersCount = teams.reduce((acc, t) => acc + 1 + (t.members?.length || 0), 0);
  const teamsWithCerts = teams.filter((t) => teamHasAnyCertificates(t)).length;

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

      const hasCert = teamHasAnyCertificates(t);
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
    setSelectedTierId(event.ticketTiers?.[0]?.id || '');
    setTierName(event.ticketTiers?.[0]?.name || '');
    setSelectedDomainId(event.participantDomains?.[0]?.id || '');
    setTransactionId('');
    setPaymentStatus('verified');
    setPaymentScreenshotFile(null);
    setPaymentScreenshotPreview('');
    setPaymentScreenshotError('');
    setCustomResponses({});
    setNotes('');
    setFormError('');
    setSuccessTicket(null);
    setSuccessQrUrl('');
    setMembers([{ name: '', email: '', phone: '', college: '', department: '' }]);
    setShowTeamModal(true);

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const handleOpenEditModal = (t: EventTeam) => {
    setEditingTeamId(t.id);
    setTeamName(t.teamName);
    setLeadName(t.leadName);
    setLeadEmail(t.leadEmail);
    setLeadPhone(t.leadPhone || '');
    setCollege(t.college || '');
    setDepartment(t.department || '');
    setSelectedTierId(t.tierId || '');
    setTierName(t.tierName || '');
    setSelectedDomainId('');
    setTransactionId(t.transactionId || '');
    setPaymentStatus(t.paymentStatus || 'verified');
    setPaymentScreenshotFile(null);
    setPaymentScreenshotPreview(t.paymentScreenshotUrl || '');
    setPaymentScreenshotError('');
    setCustomResponses(t.customResponses || {});
    setNotes(t.notes || '');
    setFormError('');
    setSuccessTicket(null);
    setSuccessQrUrl('');
    setMembers(t.members && t.members.length > 0 ? [...t.members] : [{ name: '', email: '', phone: '', college: '', department: '' }]);
    setShowTeamModal(true);

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
    setFormError('');

    if (!teamName.trim() || !leadName.trim()) {
      const msg = 'Team name and team leader name are required';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    setSavingTeam(true);
    try {
      if (editingTeamId) {
        const existingTeam = teams.find((t) => t.id === editingTeamId);
        const cleanMembers = members
          .filter((m) => m.name.trim().length > 0)
          .map((m) => {
            const existingMem = existingTeam?.members?.find(
              (em) => (m.email && em.email === m.email) || m.name === em.name
            );
            return {
              ...m,
              certificateUrl: m.certificateUrl || existingMem?.certificateUrl || (existingTeam ? getTeamMemberCertUrl(existingTeam, m) : undefined),
            };
          });

        let uploadedProofUrl = existingTeam?.paymentScreenshotUrl;
        let uploadedProofPath = existingTeam?.paymentScreenshotPath;
        if (paymentScreenshotFile) {
          const cleanFileName = paymentScreenshotFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          uploadedProofPath = `payment_proofs/${event.id}/${Date.now()}_${cleanFileName}`;
          uploadedProofUrl = await uploadFileToSupabase(paymentScreenshotFile, uploadedProofPath);
        }

        const updatedTeams = teams.map((t) =>
          t.id === editingTeamId
            ? {
                ...t,
                teamName: teamName.trim(),
                leadName: leadName.trim(),
                leadEmail: leadEmail.trim().toLowerCase(),
                leadPhone: leadPhone.trim(),
                college: college.trim(),
                department: department.trim(),
                tierId: selectedTierId || t.tierId,
                tierName: tierName.trim() || t.tierName,
                transactionId: transactionId.trim(),
                paymentScreenshotUrl: uploadedProofUrl,
                paymentScreenshotPath: uploadedProofPath,
                paymentStatus: paymentStatus,
                customResponses: customResponses,
                notes: notes.trim(),
                memberCount: cleanMembers.length + 1,
                members: cleanMembers,
                memberCertificateUrls: t.memberCertificateUrls,
                certificatesSent: t.certificatesSent,
              }
            : t
        );

        await onUpdate({ teams: updatedTeams });
        showToast(`Team "${teamName}" updated successfully!`, 'success');
        setShowTeamModal(false);
      } else {
        // --- DUPLICATE REGISTRATION CHECK ---
        const cleanMembers = members.filter((m) => m.name.trim().length > 0);
        const normTeamName = teamName.trim().toLowerCase();
        const normLeadEmail = leadEmail.trim().toLowerCase();
        const normLeadPhone = leadPhone.trim().replace(/\D/g, '');

        // 1. Check duplicate team name
        const isDuplicateTeamName = teams.some(
          (t) => t.teamName.trim().toLowerCase() === normTeamName
        );

        // 2. Check duplicate leader email or phone in teams
        const isDuplicateLeaderInTeams = teams.some((t) => {
          const tEmail = t.leadEmail?.trim().toLowerCase();
          const tPhone = t.leadPhone?.trim().replace(/\D/g, '');
          if (normLeadEmail && tEmail && tEmail === normLeadEmail) return true;
          if (normLeadPhone && tPhone && tPhone === normLeadPhone) return true;
          return false;
        });

        // 3. Check duplicate members in teams
        const isDuplicateMemberInTeams = cleanMembers.some((m) => {
          const mEmail = m.email?.trim().toLowerCase();
          const mPhone = m.phone?.trim().replace(/\D/g, '');
          return teams.some((t) => {
            const tLeadEmail = t.leadEmail?.trim().toLowerCase();
            const tLeadPhone = t.leadPhone?.trim().replace(/\D/g, '');
            if (mEmail && tLeadEmail && tLeadEmail === mEmail) return true;
            if (mPhone && tLeadPhone && tLeadPhone === mPhone) return true;
            return (t.members || []).some((tm) => {
              const tmEmail = tm.email?.trim().toLowerCase();
              const tmPhone = tm.phone?.trim().replace(/\D/g, '');
              if (mEmail && tmEmail && tmEmail === mEmail) return true;
              if (mPhone && tmPhone && tmPhone === mPhone) return true;
              return false;
            });
          });
        });

        // 4. Check duplicate in existing participants
        const participants = event.participants || [];
        const isDuplicateInParticipants = participants.some((p) => {
          const pEmail = p.email?.trim().toLowerCase();
          const pPhone = p.phone?.trim().replace(/\D/g, '');
          if (normLeadEmail && pEmail && pEmail === normLeadEmail) return true;
          if (normLeadPhone && pPhone && pPhone === normLeadPhone) return true;
          return cleanMembers.some((m) => {
            const mEmail = m.email?.trim().toLowerCase();
            const mPhone = m.phone?.trim().replace(/\D/g, '');
            if (mEmail && pEmail && pEmail === mEmail) return true;
            if (mPhone && pPhone && pPhone === mPhone) return true;
            return false;
          });
        });

        if (isDuplicateTeamName || isDuplicateLeaderInTeams || isDuplicateMemberInTeams || isDuplicateInParticipants) {
          const dupMsg = 'Existing registration found for this event.';
          setFormError(dupMsg);
          showToast(dupMsg, 'error');
          setSavingTeam(false);
          return;
        }

        // Upload payment screenshot if provided
        let uploadedProofUrl = '';
        let uploadedProofPath = '';
        if (paymentScreenshotFile) {
          const cleanFileName = paymentScreenshotFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          uploadedProofPath = `payment_proofs/${event.id}/${Date.now()}_${cleanFileName}`;
          uploadedProofUrl = await uploadFileToSupabase(paymentScreenshotFile, uploadedProofPath);
        }

        const selectedTier = (event.ticketTiers || []).find((t) => t.id === selectedTierId);
        const selectedDomain = (event.participantDomains || []).find((d) => d.id === selectedDomainId);

        // Register participant + team using core event service
        const regResult = await registerParticipantForEvent(event.id, {
          name: leadName.trim(),
          email: leadEmail.trim().toLowerCase() || undefined,
          phone: leadPhone.trim() || undefined,
          college: college.trim() || undefined,
          department: department.trim() || undefined,
          domain: selectedDomain?.name,
          domainId: selectedDomainId || undefined,
          tierId: selectedTier?.id,
          tierName: selectedTier ? selectedTier.name : (tierName.trim() || undefined),
          teamSize: cleanMembers.length + 1,
          teamMembers: cleanMembers,
          transactionId: transactionId.trim() || undefined,
          paymentScreenshotUrl: uploadedProofUrl || undefined,
          paymentScreenshotPath: uploadedProofPath || undefined,
          paymentStatus: paymentStatus,
          customResponses: {
            ...customResponses,
            teamName: teamName.trim(),
            'Team Name': teamName.trim(),
          },
          registrationSource: 'manual',
        });

        // Audit Log
        await logActivity(
          profile?.uid || 'coordinator',
          profile?.displayName || 'Coordinator',
          profile?.email || '',
          'manual_registration',
          `Manually registered team "${teamName.trim()}" (${cleanMembers.length + 1} members) for event "${event.title}"`
        );

        // Generate QR code data URL for ticket viewing
        const qrUrl = await QRCode.toDataURL(regResult.ticket.qrPayload, { width: 300, margin: 2 });
        setSuccessTicket(regResult.ticket);
        setSuccessQrUrl(qrUrl);

        // Update local teams array
        const newTeamItem: EventTeam = {
          id: `team_${regResult.ticket.id}`,
          eventId: event.id,
          teamName: teamName.trim(),
          leadName: leadName.trim(),
          leadEmail: leadEmail.trim().toLowerCase(),
          leadPhone: leadPhone.trim(),
          college: college.trim(),
          department: department.trim(),
          tierId: selectedTier?.id,
          tierName: selectedTier ? selectedTier.name : (tierName.trim() || undefined),
          transactionId: transactionId.trim(),
          paymentScreenshotUrl: uploadedProofUrl || undefined,
          paymentScreenshotPath: uploadedProofPath || undefined,
          paymentStatus: paymentStatus,
          customResponses: customResponses,
          memberCount: cleanMembers.length + 1,
          members: cleanMembers,
          registeredAt: regResult.ticket.createdAt || new Date().toISOString(),
          arrived: false,
        };

        await onUpdate({ teams: [newTeamItem, ...teams] });
        showToast(`Team "${teamName}" registered successfully! Ticket generated.`, 'success');

        // Automatic pass image download
        try {
          await downloadTicketImage(event, regResult.ticket, qrUrl);
        } catch (dlErr) {
          console.warn('Auto download ticket pass info:', dlErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to save team:', err);
      setFormError(err.message || 'Failed to save team registration');
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

      // Synchronize parent state immediately so UI updates without page reload
      await onUpdate({ teams: result.updatedTeams });

      showToast(`Generated & processed credentials for ${result.successful} members of "${t.teamName}"!`, 'success');
    } catch (err: any) {
      console.error('Team certificate issuance error:', err);
      showToast(err.message || 'Failed to issue team certificates', 'error');
    } finally {
      setProcessingTeamId(null);
      setTeamProgress(null);
    }
  };

  // Generate & Dispatch Single Member Certificate
  const handleIssueSingleMember = async (
    team: EventTeam,
    member: TeamMemberDetail,
    isLead: boolean = false
  ) => {
    if (!hasTemplate) {
      showToast('Please upload a certificate template in the Certificates tab first', 'error');
      return;
    }

    const memberKey = `${team.id}_${isLead ? 'lead' : 'member'}_${member.name}_${member.email || ''}`;
    setIssuingMemberKey(memberKey);

    try {
      showToast(`Generating certificate for ${member.name}...`, 'info');
      const result = await sendSingleTeamMemberCertificate(event, team, member, event.certificateConfig);
      await onUpdate({ teams: result.updatedTeams });
      showToast(`Certificate generated and assigned for "${member.name}"!`, 'success');
    } catch (err: any) {
      console.error('Single member certificate issuance error:', err);
      showToast(err.message || 'Failed to generate certificate', 'error');
    } finally {
      setIssuingMemberKey(null);
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
      const leadCert = getTeamMemberCertUrl(t, { name: t.leadName, email: t.leadEmail });
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
        const memCert = getTeamMemberCertUrl(t, m);
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
            const allTeamMembers = [
              { name: team.leadName, email: team.leadEmail },
              ...(team.members || []),
            ];
            const certsCount = allTeamMembers.filter((m) => Boolean(getTeamMemberCertUrl(team, m))).length;

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
                        {team.paymentStatus && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                              team.paymentStatus === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : team.paymentStatus === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            Payment: {team.paymentStatus.toUpperCase()}
                          </span>
                        )}
                        {team.transactionId && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-300 bg-slate-800 border border-slate-700">
                            UTR: {team.transactionId}
                          </span>
                        )}
                        {team.paymentScreenshotUrl && (
                          <a
                            href={team.paymentScreenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Proof
                          </a>
                        )}
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
                              {(() => {
                                const leadCertUrl = getTeamMemberCertUrl(team, { name: team.leadName, email: team.leadEmail });
                                const isIssuingLead = issuingMemberKey === `${team.id}_lead_${team.leadName}_${team.leadEmail || ''}`;

                                if (leadCertUrl) {
                                  return (
                                    <div className="inline-flex items-center justify-end gap-2">
                                      <a
                                        href={leadCertUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-colors"
                                        title="Open public certificate image"
                                      >
                                        <ExternalLink className="w-3 h-3" /> View CDN
                                      </a>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleIssueSingleMember(
                                              team,
                                              {
                                                name: team.leadName,
                                                email: team.leadEmail,
                                                phone: team.leadPhone,
                                                college: team.college,
                                                department: team.department,
                                              },
                                              true
                                            )
                                          }
                                          disabled={Boolean(issuingMemberKey) || !hasTemplate}
                                          className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-40"
                                          title="Re-generate and refresh certificate"
                                        >
                                          {isIssuingLead ? (
                                            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                          ) : (
                                            'Re-issue'
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="inline-flex items-center justify-end gap-2">
                                    <span className="text-[11px] text-slate-500">Not Issued</span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleIssueSingleMember(
                                            team,
                                            {
                                              name: team.leadName,
                                              email: team.leadEmail,
                                              phone: team.leadPhone,
                                              college: team.college,
                                              department: team.department,
                                            },
                                            true
                                          )
                                        }
                                        disabled={Boolean(issuingMemberKey) || !hasTemplate}
                                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 disabled:opacity-40 transition-colors"
                                        title="Generate certificate for Team Leader"
                                      >
                                        {isIssuingLead ? (
                                          <>
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                            <span>Issuing...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Award className="w-3 h-3" />
                                            <span>Generate</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>

                          {/* Member Rows */}
                          {(team.members || []).map((m, idx) => {
                            const certUrl = getTeamMemberCertUrl(team, m);
                            const isIssuingMem = issuingMemberKey === `${team.id}_member_${m.name}_${m.email || ''}`;

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
                                    <div className="inline-flex items-center justify-end gap-2">
                                      <a
                                        href={certUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-colors"
                                        title="Open public certificate image"
                                      >
                                        <ExternalLink className="w-3 h-3" /> View CDN
                                      </a>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => handleIssueSingleMember(team, m, false)}
                                          disabled={Boolean(issuingMemberKey) || !hasTemplate}
                                          className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-40"
                                          title="Re-generate and refresh certificate"
                                        >
                                          {isIssuingMem ? (
                                            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                          ) : (
                                            'Re-issue'
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center justify-end gap-2">
                                      <span className="text-[11px] text-slate-500">Not Issued</span>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => handleIssueSingleMember(team, m, false)}
                                          disabled={Boolean(issuingMemberKey) || !hasTemplate}
                                          className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 disabled:opacity-40 transition-colors"
                                          title="Generate certificate for this member"
                                        >
                                          {isIssuingMem ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              <span>Issuing...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Award className="w-3 h-3" />
                                              <span>Generate</span>
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
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
            ref={formRef}
            className="w-full max-w-2xl rounded-3xl border p-6 space-y-5 my-8 shadow-2xl relative"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex items-center gap-2">
                <Users2 className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                  {successTicket ? 'Team Registration Confirmed!' : editingTeamId ? 'Edit Team Registration' : 'Register New Team'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTeamModal(false);
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
                    Team Registration Completed!
                  </h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                    Entry pass for <strong className="text-blue-400">{successTicket.guestName}</strong> ({teamName}) has been generated.
                  </p>
                </div>

                {/* QR Display */}
                {successQrUrl && (
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-xl border border-slate-200">
                    <img src={successQrUrl} alt="Team Ticket QR" className="w-48 h-48 block mx-auto" />
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
                    <span style={{ color: 'var(--dash-muted)' }}>Team Name:</span>
                    <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{teamName}</span>
                  </div>
                  {successTicket.tierName && (
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--dash-muted)' }}>Tier / Category:</span>
                      <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{successTicket.tierName}</span>
                    </div>
                  )}
                  {members.filter((m) => m.name.trim()).length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                      <span className="font-semibold text-slate-300">Teammates: </span>
                      <span style={{ color: 'var(--dash-muted)' }}>
                        {members.filter((m) => m.name.trim()).map((m) => m.name).join(', ')}
                      </span>
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
                      setShowTeamModal(false);
                      setSuccessTicket(null);
                      setSuccessQrUrl('');
                    }}
                    className="btn-secondary !text-xs !py-2.5 w-full cursor-pointer mt-2"
                  >
                    Done &amp; Return to Teams Studio
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveTeam} className="space-y-4">
                {/* Form Error Alert Banner */}
                {formError && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Team Name & Tier Selection */}
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
                    {event.ticketTiers && event.ticketTiers.length > 0 ? (
                      <select
                        value={selectedTierId}
                        onChange={(e) => {
                          const tid = e.target.value;
                          setSelectedTierId(tid);
                          const tierObj = event.ticketTiers?.find((t) => t.id === tid);
                          if (tierObj) {
                            setTierName(tierObj.name);
                            if (tierObj.teamSize && tierObj.teamSize > 1) {
                              const extraNeeded = tierObj.teamSize - 1;
                              if (members.length < extraNeeded) {
                                const added: TeamMemberDetail[] = Array.from(
                                  { length: extraNeeded - members.length },
                                  () => ({ name: '', email: '', phone: '', college: '', department: '' })
                                );
                                setMembers([...members, ...added]);
                              }
                            }
                          }
                        }}
                        className="input-field w-full text-xs"
                      >
                        <option value="">Select Tier (Optional)</option>
                        {event.ticketTiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.price !== undefined ? `(₹${t.price})` : ''} {t.teamSize ? `[${t.teamSize} pax]` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={tierName}
                        onChange={(e) => setTierName(e.target.value)}
                        placeholder="e.g. Squad (4 Members) or Custom"
                        className="input-field w-full text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Domain selection if enabled */}
                {Boolean(event.enableDomainSelection && event.participantDomains?.length) && (
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Select Domain / Track
                    </label>
                    <select
                      value={selectedDomainId}
                      onChange={(e) => setSelectedDomainId(e.target.value)}
                      className="input-field w-full text-xs"
                    >
                      <option value="">Choose Domain Track (Optional)</option>
                      {event.participantDomains?.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                        Leader Email
                      </label>
                      <input
                        type="email"
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

                {/* Custom Event Fields from Form Builder */}
                {((event.customFields || []).filter((f) => !f.tierId || f.tierId === selectedTierId).length > 0) && (
                  <div className="p-3.5 rounded-2xl bg-slate-900/40 border space-y-3" style={{ borderColor: 'var(--dash-border)' }}>
                    <span className="text-xs font-bold text-violet-400 block uppercase tracking-wide">
                      Event Custom Fields
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
                      <CreditCard className="w-3.5 h-3.5" /> Payment Details &amp; Verification
                    </span>
                    {/* Payment QR preview button if available */}
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
                      Upload Payment Screenshot / Receipt (Optional for manual backup)
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

                {/* Internal Notes */}
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
