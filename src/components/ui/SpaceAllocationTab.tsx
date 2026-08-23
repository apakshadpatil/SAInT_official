import { useState, useEffect } from 'react';
import type { EventRecord, EventParticipant, SpaceAllocation, EventSpace } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Grid3x3, Users, Zap, Plus, Trash2, Edit2, Check, X,
  Download, Sparkles, Building, Layers, RotateCcw, Search
} from 'lucide-react';

interface SpaceAllocationTabProps {
  event: EventRecord;
  canEdit: boolean;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
}

export default function SpaceAllocationTab({ event, canEdit, onUpdate }: SpaceAllocationTabProps) {
  const { showToast } = useToast();
  const participants = event.participants || [];
  const [allocations, setAllocations] = useState<Record<string, SpaceAllocation[]>>(event.spaceAllocations || {});
  const [spacesList, setSpacesList] = useState<EventSpace[]>(event.spaces || []);
  const [unallocated, setUnallocated] = useState<EventParticipant[]>(participants);
  const [spacesUsage, setSpacesUsage] = useState<Record<string, { capacity: number; current: number; domainName?: string }>>({});

  // Search & filter state
  const [searchUnallocated, setSearchUnallocated] = useState('');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');

  // Space Creation / Editing State
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [spaceCapacity, setSpaceCapacity] = useState<number>(40);
  const [spaceDomainId, setSpaceDomainId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAllocations(event.spaceAllocations || {});
  }, [event.spaceAllocations]);

  useEffect(() => {
    setSpacesList(event.spaces || []);
  }, [event.spaces]);

  useEffect(() => {
    const usage: Record<string, { capacity: number; current: number; domainName?: string }> = {};
    (event.spaces || []).forEach((space) => {
      usage[space.name] = {
        capacity: space.capacity,
        current: (allocations[space.name] || []).length,
        domainName: space.domainName,
      };
    });

    setSpacesUsage(usage);

    const allocatedIds = new Set(
      Object.values(allocations).flatMap((allocs) => allocs.map((entry) => entry.participantId))
    );
    setUnallocated(participants.filter((p) => !allocatedIds.has(p.id)));
  }, [allocations, participants, event.spaces]);

  // Create or Update Space
  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName.trim() || spaceCapacity <= 0) {
      showToast('Please provide a valid space name and capacity (> 0)', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const selectedDomain = (event.participantDomains || []).find((d) => d.id === spaceDomainId);
      let nextSpaces: EventSpace[] = [...spacesList];

      if (editingSpaceId) {
        // Edit existing space
        const oldSpace = nextSpaces.find((s) => s.id === editingSpaceId);
        const oldName = oldSpace?.name;
        nextSpaces = nextSpaces.map((s) =>
          s.id === editingSpaceId
            ? {
                ...s,
                name: spaceName.trim(),
                capacity: spaceCapacity,
                domainId: spaceDomainId || undefined,
                domainName: selectedDomain?.name || undefined,
                updatedAt: new Date().toISOString(),
              }
            : s
        );

        // If name changed, migrate existing allocations
        let nextAllocations = { ...allocations };
        if (oldName && oldName !== spaceName.trim() && nextAllocations[oldName]) {
          nextAllocations[spaceName.trim()] = nextAllocations[oldName];
          delete nextAllocations[oldName];
          await onUpdate({ spaces: nextSpaces, spaceAllocations: nextAllocations });
          setAllocations(nextAllocations);
        } else {
          await onUpdate({ spaces: nextSpaces });
        }
        showToast(`Space "${spaceName.trim()}" updated successfully`, 'success');
      } else {
        // Check for duplicate names
        if (nextSpaces.some((s) => s.name.toLowerCase() === spaceName.trim().toLowerCase())) {
          showToast(`A space named "${spaceName.trim()}" already exists.`, 'error');
          setIsSaving(false);
          return;
        }

        const newSpace: EventSpace = {
          id: `space-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: spaceName.trim(),
          capacity: spaceCapacity,
          domainId: spaceDomainId || undefined,
          domainName: selectedDomain?.name || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        nextSpaces = [...nextSpaces, newSpace];
        await onUpdate({ spaces: nextSpaces });
        showToast(`Space "${newSpace.name}" created with capacity ${newSpace.capacity}`, 'success');
      }

      setSpacesList(nextSpaces);
      setSpaceName('');
      setSpaceCapacity(40);
      setSpaceDomainId('');
      setEditingSpaceId(null);
      setIsCreatingSpace(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to save space', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSpace = (space: EventSpace) => {
    setEditingSpaceId(space.id);
    setSpaceName(space.name);
    setSpaceCapacity(space.capacity);
    setSpaceDomainId(space.domainId || '');
    setIsCreatingSpace(true);
  };

  const handleDeleteSpace = async (spaceId: string, spaceNameVal: string) => {
    if (!window.confirm(`Delete space "${spaceNameVal}"? Any allocated participants will be unallocated.`)) return;

    try {
      const nextSpaces = spacesList.filter((s) => s.id !== spaceId);
      const nextAllocations = { ...allocations };
      delete nextAllocations[spaceNameVal];

      await onUpdate({ spaces: nextSpaces, spaceAllocations: nextAllocations });
      setSpacesList(nextSpaces);
      setAllocations(nextAllocations);
      showToast(`Space "${spaceNameVal}" removed`, 'info');
    } catch (err) {
      showToast('Failed to delete space', 'error');
    }
  };

  // Quick preset space generators
  const handleAddPreset = async (presetType: 'labs' | 'auditoriums' | 'domains') => {
    let newPresets: EventSpace[] = [];
    const now = new Date().toISOString();

    if (presetType === 'labs') {
      newPresets = [
        { id: `lab-1-${Date.now()}`, name: 'IT Lab 101 (Advanced Computing)', capacity: 40, createdAt: now, updatedAt: now },
        { id: `lab-2-${Date.now()}`, name: 'IT Lab 102 (AI & Web Arena)', capacity: 40, createdAt: now, updatedAt: now },
        { id: `lab-3-${Date.now()}`, name: 'IT Lab 103 (Systems & Cyber)', capacity: 35, createdAt: now, updatedAt: now },
      ];
    } else if (presetType === 'auditoriums') {
      newPresets = [
        { id: `aud-1-${Date.now()}`, name: 'Main College Auditorium', capacity: 250, createdAt: now, updatedAt: now },
        { id: `sem-1-${Date.now()}`, name: 'IT Seminar Hall (Floor 2)', capacity: 80, createdAt: now, updatedAt: now },
      ];
    } else if (presetType === 'domains' && event.participantDomains?.length) {
      newPresets = event.participantDomains.map((d, i) => ({
        id: `domain-space-${d.id}-${Date.now()}`,
        name: `${d.name} Zone (Lab ${201 + i})`,
        capacity: 45,
        domainId: d.id,
        domainName: d.name,
        createdAt: now,
        updatedAt: now,
      }));
    }

    if (newPresets.length === 0) {
      showToast('No preset spaces to add.', 'info');
      return;
    }

    // Filter out duplicates by name
    const existingNames = new Set(spacesList.map((s) => s.name.toLowerCase()));
    const filtered = newPresets.filter((p) => !existingNames.has(p.name.toLowerCase()));

    if (filtered.length === 0) {
      showToast('These preset spaces already exist.', 'info');
      return;
    }

    const nextSpaces = [...spacesList, ...filtered];
    try {
      await onUpdate({ spaces: nextSpaces });
      setSpacesList(nextSpaces);
      showToast(`Added ${filtered.length} preset spaces!`, 'success');
    } catch {
      showToast('Failed to add preset spaces', 'error');
    }
  };

  const allocateParticipant = async (participantId: string, targetSpace: string) => {
    const participant = participants.find((entry) => entry.id === participantId);
    if (!participant) return;

    const targetCapacity = spacesUsage[targetSpace]?.capacity || 0;
    const currentAllocated = (allocations[targetSpace] || []).length;

    if (currentAllocated >= targetCapacity) {
      showToast(`"${targetSpace}" is at maximum capacity (${targetCapacity})`, 'error');
      return;
    }

    // Remove from other spaces if already allocated anywhere
    const nextAllocations: Record<string, SpaceAllocation[]> = {};
    Object.entries(allocations).forEach(([sName, list]) => {
      nextAllocations[sName] = list.filter((a) => a.participantId !== participantId);
    });

    if (!nextAllocations[targetSpace]) {
      nextAllocations[targetSpace] = [];
    }

    const allocation: SpaceAllocation = {
      id: `alloc-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      eventId: event.id,
      participantId,
      participantName: participant.name,
      department: participant.department,
      domain: participant.domain,
      domainId: participant.domainId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    nextAllocations[targetSpace] = [...nextAllocations[targetSpace], allocation];
    try {
      await onUpdate({ spaceAllocations: nextAllocations });
      setAllocations(nextAllocations);
      showToast(`${participant.name} allocated to ${targetSpace}`, 'success');
    } catch {
      showToast('Failed to save allocation', 'error');
    }
  };

  const deallocateParticipant = async (participantId: string, space: string) => {
    const nextAllocations = {
      ...allocations,
      [space]: (allocations[space] || []).filter((a) => a.participantId !== participantId),
    };
    try {
      await onUpdate({ spaceAllocations: nextAllocations });
      setAllocations(nextAllocations);
      showToast('Participant unallocated', 'info');
    } catch {
      showToast('Failed to save deallocation', 'error');
    }
  };

  const handleResetAllAllocations = async () => {
    if (!window.confirm('Are you sure you want to reset all space allocations?')) return;
    try {
      await onUpdate({ spaceAllocations: {} });
      setAllocations({});
      showToast('All allocations have been cleared', 'info');
    } catch {
      showToast('Failed to clear allocations', 'error');
    }
  };

  const autoAllocateParticipants = async () => {
    if (unallocated.length === 0) {
      showToast('All participants are already allocated.', 'info');
      return;
    }

    if (spacesList.length === 0) {
      showToast('Please create at least one space before auto-allocating.', 'error');
      return;
    }

    const newAllocations: Record<string, SpaceAllocation[]> = { ...allocations };
    spacesList.forEach((space) => {
      if (!newAllocations[space.name]) {
        newAllocations[space.name] = [];
      }
    });

    let allocatedCount = 0;
    const remainingToAllocate = [...unallocated];

    // Pass 1: Allocate by domain match if domain-linking is enabled
    if (event.enableDomainSelection) {
      for (let i = remainingToAllocate.length - 1; i >= 0; i--) {
        const p = remainingToAllocate[i];
        if (!p.domainId) continue;

        const matchingSpace = spacesList.find(
          (s) => s.domainId === p.domainId && (newAllocations[s.name]?.length || 0) < s.capacity
        );

        if (matchingSpace) {
          newAllocations[matchingSpace.name].push({
            id: `alloc-${Date.now()}-${allocatedCount}`,
            eventId: event.id,
            participantId: p.id,
            participantName: p.name,
            department: p.department,
            domain: p.domain,
            domainId: p.domainId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          remainingToAllocate.splice(i, 1);
          allocatedCount++;
        }
      }
    }

    // Pass 2: Round-robin fill remaining spaces
    for (const p of remainingToAllocate) {
      // Find space with most available capacity
      const availableSpaces = spacesList
        .filter((s) => (newAllocations[s.name]?.length || 0) < s.capacity)
        .sort(
          (a, b) =>
            (b.capacity - (newAllocations[b.name]?.length || 0)) -
            (a.capacity - (newAllocations[a.name]?.length || 0))
        );

      if (availableSpaces.length === 0) break; // All spaces full

      const targetSpace = availableSpaces[0];
      newAllocations[targetSpace.name].push({
        id: `alloc-${Date.now()}-${allocatedCount}`,
        eventId: event.id,
        participantId: p.id,
        participantName: p.name,
        department: p.department,
        domain: p.domain,
        domainId: p.domainId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      allocatedCount++;
    }

    try {
      await onUpdate({ spaceAllocations: newAllocations });
      setAllocations(newAllocations);
      showToast(`Auto-allocated ${allocatedCount} participants across spaces!`, 'success');
    } catch {
      showToast('Failed to save auto-allocation', 'error');
    }
  };

  const handleExportCSV = () => {
    const rows: string[] = ['Space,Participant Name,Department,Domain,Allocation Date'];
    Object.entries(allocations).forEach(([sName, allocs]) => {
      allocs.forEach((a) => {
        rows.push(`"${sName}","${a.participantName}","${a.department || 'N/A'}","${a.domain || 'N/A'}","${a.createdAt || ''}"`);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_Space_Allocations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Space allocation report downloaded', 'success');
  };

  const getUtilization = (spaceName: string) => {
    const capacity = spacesUsage[spaceName]?.capacity || 0;
    if (capacity <= 0) return 0;
    const current = (allocations[spaceName] || []).length;
    return Math.min(100, Math.round((current / capacity) * 100));
  };

  const filteredUnallocated = unallocated.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchUnallocated.toLowerCase()) ||
      (p.department && p.department.toLowerCase().includes(searchUnallocated.toLowerCase())) ||
      (p.domain && p.domain.toLowerCase().includes(searchUnallocated.toLowerCase()));
    const matchesDomain = selectedDomainFilter === 'all' || p.domainId === selectedDomainFilter;
    return matchesSearch && matchesDomain;
  });

  const totalSpaceCapacity = spacesList.reduce((acc, s) => acc + s.capacity, 0);
  const totalAllocated = Object.values(allocations).reduce((acc, list) => acc + list.length, 0);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── TOP STATS BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-500 mb-1">
            <Building className="w-4 h-4" /> Total Spaces
          </div>
          <p className="text-2xl font-black" style={{ color: 'var(--dash-text)' }}>
            {spacesList.length}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
            {totalSpaceCapacity} total capacity
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-500 mb-1">
            <Users className="w-4 h-4" /> Registered
          </div>
          <p className="text-2xl font-black" style={{ color: 'var(--dash-text)' }}>
            {participants.length}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
            Total event attendees
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-1">
            <Check className="w-4 h-4" /> Allocated
          </div>
          <p className="text-2xl font-black text-emerald-500">
            {totalAllocated}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
            Assigned to a space
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">
            <RotateCcw className="w-4 h-4" /> Unallocated
          </div>
          <p className="text-2xl font-black text-amber-500">
            {unallocated.length}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
            Need space assignment
          </p>
        </div>
      </div>

      {/* ── SPACE CREATOR & MANAGEMENT ACTION BAR ── */}
      <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Grid3x3 className="w-5 h-5 text-blue-500" />
              Event Spaces & Labs Management
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Create rooms, labs, and auditoriums for this event, set seat capacities, and allocate attendees.
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingSpaceId(null);
                  setSpaceName('');
                  setSpaceCapacity(40);
                  setSpaceDomainId('');
                  setIsCreatingSpace(!isCreatingSpace);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all shadow-sm hover:opacity-90 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              >
                <Plus className="w-4 h-4" />
                {isCreatingSpace ? 'Close Form' : 'Create New Space'}
              </button>
            </div>
          )}
        </div>

        {/* Quick Preset Buttons */}
        {canEdit && spacesList.length === 0 && (
          <div className="p-4 rounded-xl border mb-5 space-y-2" style={{ borderColor: 'rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.04)' }}>
            <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Quick Setup Presets (1-Click Space Creation):
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleAddPreset('labs')}
                className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all hover:border-blue-400 cursor-pointer"
                style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
              >
                + Add Standard IT Labs (101, 102, 103)
              </button>
              <button
                type="button"
                onClick={() => handleAddPreset('auditoriums')}
                className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all hover:border-blue-400 cursor-pointer"
                style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
              >
                + Add Auditoriums & Halls
              </button>
              {event.participantDomains && event.participantDomains.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleAddPreset('domains')}
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all hover:border-purple-400 text-purple-400 cursor-pointer"
                  style={{ background: 'rgba(147,51,234,0.06)', borderColor: 'rgba(147,51,234,0.3)' }}
                >
                  + Generate 1 Space Per Domain ({event.participantDomains.length} domains)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Create / Edit Space Form */}
        {isCreatingSpace && canEdit && (
          <form onSubmit={handleSaveSpace} className="p-5 rounded-2xl border mb-6 space-y-4 animate-fade-in-up" style={{ borderColor: 'var(--dash-border)', background: 'rgba(0,0,0,0.03)' }}>
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <Building className="w-4 h-4 text-blue-500" />
                {editingSpaceId ? 'Edit Space Details' : 'Create New Space / Room'}
              </h4>
              <button
                type="button"
                onClick={() => { setIsCreatingSpace(false); setEditingSpaceId(null); }}
                className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Space / Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT Lab 101, Main Auditorium..."
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none focus:border-blue-500"
                  style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Max Seat Capacity *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={5000}
                  value={spaceCapacity}
                  onChange={(e) => setSpaceCapacity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none focus:border-blue-500"
                  style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                  Associated Domain (Optional)
                </label>
                <select
                  value={spaceDomainId}
                  onChange={(e) => setSpaceDomainId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none focus:border-blue-500"
                  style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                >
                  <option value="">General / All Domains</option>
                  {(event.participantDomains || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsCreatingSpace(false); setEditingSpaceId(null); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              >
                <Check className="w-4 h-4" />
                {editingSpaceId ? 'Save Changes' : 'Create Space'}
              </button>
            </div>
          </form>
        )}

        {/* ── SPACES CARDS GRID ── */}
        {spacesList.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--dash-border)' }}>
            <Building className="w-10 h-10 mx-auto mb-2 text-slate-400" />
            <p className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>No spaces created yet</p>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--dash-muted)' }}>
              Add labs, classrooms, or auditoriums above to begin allocating registered attendees.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {spacesList.map((space) => {
              const allocatedList = allocations[space.name] || [];
              const util = getUtilization(space.name);

              return (
                <div
                  key={space.id}
                  className="rounded-2xl border p-4 flex flex-col justify-between transition-all hover:shadow-md"
                  style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate" style={{ color: 'var(--dash-text)' }}>
                          {space.name}
                        </h4>
                        {space.domainName && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 bg-purple-500/15 text-purple-400">
                            <Layers className="w-2.5 h-2.5" /> {space.domainName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{
                            background: util >= 100 ? 'rgba(239,68,68,0.15)' : util > 70 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                            color: util >= 100 ? '#ef4444' : util > 70 ? '#f59e0b' : '#10b981',
                          }}
                        >
                          {allocatedList.length}/{space.capacity} ({util}%)
                        </span>

                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditSpace(space)}
                              title="Edit Space"
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSpace(space.id, space.name)}
                              title="Delete Space"
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Capacity Progress Bar */}
                    <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.08)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${util}%`,
                          background: util >= 100 ? '#ef4444' : util > 75 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>

                    {/* Allocated Participants list */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {allocatedList.length === 0 ? (
                        <p className="text-xs py-2 text-center" style={{ color: 'var(--dash-muted)' }}>
                          No participants assigned yet
                        </p>
                      ) : (
                        allocatedList.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs"
                            style={{ background: 'rgba(0,0,0,0.03)' }}
                          >
                            <span className="truncate font-medium" style={{ color: 'var(--dash-text)' }}>
                              {a.participantName}
                              {a.domain && <span className="text-[10px] ml-1.5 text-blue-400 font-normal">({a.domain})</span>}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => deallocateParticipant(a.participantId, space.name)}
                                title="Unallocate"
                                className="text-red-400 hover:text-red-600 font-bold ml-2 shrink-0 cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ALLOCATION CONTROLS & UNALLOCATED ATTENDEES ── */}
      {spacesList.length > 0 && (
        <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <Users className="w-5 h-5 text-amber-500" />
                Unallocated Attendees ({unallocated.length})
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                Assign individual participants to spaces or use 1-click Auto-Allocation to balance capacities.
              </p>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={autoAllocateParticipants}
                  disabled={unallocated.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Zap className="w-4 h-4" />
                  Auto-Allocate All
                </button>

                {totalAllocated > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllAllocations}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border text-red-400 hover:bg-red-500/10 cursor-pointer"
                    style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All
                  </button>
                )}

                {totalAllocated > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                    style={{ borderColor: 'rgba(59,130,246,0.3)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search & Domain Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search unallocated by name, department, or domain..."
                value={searchUnallocated}
                onChange={(e) => setSearchUnallocated(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border outline-none focus:border-blue-500"
                style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
              />
            </div>

            {event.participantDomains && event.participantDomains.length > 0 && (
              <select
                value={selectedDomainFilter}
                onChange={(e) => setSelectedDomainFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs border outline-none w-full sm:w-auto"
                style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
              >
                <option value="all">All Domains</option>
                {event.participantDomains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Unallocated list */}
          {unallocated.length === 0 ? (
            <div className="p-6 rounded-xl border text-center" style={{ borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.05)' }}>
              <Check className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="font-bold text-sm text-emerald-400">All registered attendees have been allocated to spaces!</p>
              <p className="text-xs text-slate-400 mt-1">Download the CSV report above for room-by-room charts.</p>
            </div>
          ) : filteredUnallocated.length === 0 ? (
            <div className="p-6 rounded-xl border text-center text-xs" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)' }}>
              No unallocated attendees match your search.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredUnallocated.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-3 rounded-xl border transition-all"
                  style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--dash-text)' }}>
                      {participant.name}
                    </p>
                    <p className="text-xs flex items-center gap-2 mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                      <span>{participant.department || 'General'}</span>
                      {participant.domain && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400">
                          {participant.domain}
                        </span>
                      )}
                    </p>
                  </div>

                  {canEdit && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          allocateParticipant(participant.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border outline-none cursor-pointer shrink-0"
                      style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                    >
                      <option value="">Allocate to space...</option>
                      {spacesList.map((space) => {
                        const current = (allocations[space.name] || []).length;
                        const isFull = current >= space.capacity;
                        return (
                          <option key={space.id} value={space.name} disabled={isFull}>
                            {space.name} ({current}/{space.capacity}){isFull ? ' [FULL]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

