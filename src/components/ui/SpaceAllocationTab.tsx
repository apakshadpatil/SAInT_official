import { useState, useEffect } from 'react';
import type { EventRecord, EventParticipant, SpaceAllocation } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Grid3x3, MapPin, Users, Zap } from 'lucide-react';

interface SpaceAllocationTabProps {
  event: EventRecord;
  canEdit: boolean;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
}

export default function SpaceAllocationTab({ event, canEdit, onUpdate }: SpaceAllocationTabProps) {
  const { showToast } = useToast();
  const participants = event.participants || [];
  const [allocations, setAllocations] = useState<Record<string, SpaceAllocation[]>>(event.spaceAllocations || {});
  const [unallocated, setUnallocated] = useState<EventParticipant[]>(participants);
  const [spaces, setSpaces] = useState<Record<string, { capacity: number; current: number }>>({});

  useEffect(() => {
    setAllocations(event.spaceAllocations || {});
  }, [event.spaceAllocations]);

  useEffect(() => {
    const baseSpaces = (event.spaces || []).reduce<Record<string, { capacity: number; current: number }>>((acc, space) => {
      acc[space.name] = { capacity: space.capacity, current: 0 };
      return acc;
    }, {});

    Object.entries(allocations).forEach(([spaceName, allocs]) => {
      if (baseSpaces[spaceName]) {
        baseSpaces[spaceName].current = allocs.length;
      }
    });

    setSpaces(baseSpaces);

    const allocatedIds = new Set(Object.values(allocations).flatMap((allocs) => allocs.map((entry) => entry.participantId)));
    setUnallocated(participants.filter((participant) => !allocatedIds.has(participant.id)));
  }, [allocations, participants, event.spaces]);

  const allocateParticipant = async (participantId: string, spaceName: string) => {
    const participant = participants.find((entry) => entry.id === participantId);
    if (!participant) return;

    const nextAllocations = { ...allocations };
    if (!nextAllocations[spaceName]) {
      nextAllocations[spaceName] = [];
    }

    if (nextAllocations[spaceName].length >= (spaces[spaceName]?.capacity || 0)) {
      showToast(`${spaceName} is at full capacity`, 'error');
      return;
    }

    if (nextAllocations[spaceName].some((allocation) => allocation.participantId === participantId)) {
      showToast('Participant already allocated to this space', 'error');
      return;
    }

    const allocation: SpaceAllocation = {
      id: `alloc-${Date.now()}`,
      eventId: event.id,
      participantId,
      participantName: participant.name,
      department: participant.department,
      domain: participant.domain,
      domainId: participant.domainId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    nextAllocations[spaceName] = [...nextAllocations[spaceName], allocation];
    try {
      await onUpdate({ spaceAllocations: nextAllocations });
      setAllocations(nextAllocations);
      showToast(`${participant.name} allocated to ${spaceName}`, 'success');
    } catch (err) {
      showToast('Failed to save allocation', 'error');
    }
  };

  const deallocateParticipant = async (participantId: string, space: string) => {
    const nextAllocations = {
      ...allocations,
      [space]: allocations[space].filter((a) => a.participantId !== participantId),
    };
    try {
      await onUpdate({ spaceAllocations: nextAllocations });
      setAllocations(nextAllocations);
      showToast('Participant deallocated', 'success');
    } catch (err) {
      showToast('Failed to save deallocation', 'error');
    }
  };

  const autoAllocateParticipants = async () => {
    if (unallocated.length === 0) {
      showToast('All participants are already allocated', 'info');
      return;
    }

    const newAllocations = { ...allocations };
    const spaceEntries = Object.entries(spaces);
    let participantIndex = 0;

    spaceEntries.forEach(([spaceName, info]) => {
      if (!newAllocations[spaceName]) {
        newAllocations[spaceName] = [];
      }

      while (participantIndex < unallocated.length && newAllocations[spaceName].length < info.capacity) {
        const participant = unallocated[participantIndex];
        const shouldUseDomainSpace = event.enableDomainSelection && event.autoAllocateByDomain && participant.domainId;
        const matchingSpace = shouldUseDomainSpace
          ? (event.spaces || []).find((space) => space.domainId === participant.domainId && space.name === spaceName)
          : undefined;

        if (shouldUseDomainSpace && !matchingSpace) {
          participantIndex++;
          continue;
        }

        const allocation: SpaceAllocation = {
          id: `alloc-${Date.now()}-${participantIndex}`,
          eventId: event.id,
          participantId: participant.id,
          participantName: participant.name,
          department: participant.department,
          domain: participant.domain,
          domainId: participant.domainId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newAllocations[spaceName].push(allocation);
        participantIndex++;
      }
    });

    try {
      await onUpdate({ spaceAllocations: newAllocations });
      setAllocations(newAllocations);
      showToast('Auto-allocation complete', 'success');
    } catch (err) {
      showToast('Failed to save auto-allocation', 'error');
    }
  };

  const getUtilization = (space: string) => {
    const capacity = spaces[space].capacity;
    const current = allocations[space]?.length || 0;
    return Math.round((current / capacity) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Total Participants</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>
            {participants.length}
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)' }}>
          <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Allocated</p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {participants.length - unallocated.length}
          </p>
        </div>
      </div>

      {/* Unallocated Participants */}
      {unallocated.length > 0 && (
        <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Users className="w-5 h-5" />
              Not Allocated ({unallocated.length})
            </h4>
            {canEdit && (
              <button
                onClick={autoAllocateParticipants}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(59,130,246,0.26))' }}
              >
                <Zap className="w-4 h-4" />
                Auto
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {unallocated.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)' }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>
                    {participant.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                    {participant.domain || participant.department || 'No department'}
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
                    className="input-field text-sm py-1 px-2 w-36 md:w-40 shrink-0"
                  >
                    <option value="">Allocate to...</option>
                    {Object.entries(spaces).map(([space, info]) => (
                      <option
                        key={space}
                        value={space}
                        disabled={info.current >= info.capacity}
                      >
                        {space} ({info.current}/{info.capacity})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spaces Grid */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
          <Grid3x3 className="w-5 h-5" />
          Space Allocation
        </h4>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(spaces).map(([space, info]) => (
            <div
              key={space}
              className="rounded-2xl border p-4 space-y-3"
              style={{ borderColor: 'var(--dash-border)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>
                    {space}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                    {allocations[space]?.length || 0} / {info.capacity}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{
                    background: `rgba(59, 130, 246, 0.1)`,
                    color: '#3b82f6',
                  }}>
                  {getUtilization(space)}%
                </span>
              </div>

              {/* Capacity Bar */}
              <div className="h-2 rounded-full" style={{ background: 'var(--dash-border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${getUtilization(space)}%`,
                    background: getUtilization(space) > 90 ? '#ef4444' : 
                               getUtilization(space) > 70 ? '#f59e0b' : 
                               '#10b981',
                  }}
                />
              </div>

              {/* Participants List */}
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {(allocations[space] || []).map((allocation) => (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between p-2 rounded text-xs"
                    style={{ background: 'rgba(0,0,0,0.05)' }}
                  >
                    <p style={{ color: 'var(--dash-text)' }}>{allocation.participantName}</p>
                    {canEdit && (
                      <button
                        onClick={() => deallocateParticipant(allocation.participantId, space)}
                        className="text-red-500 hover:text-red-600 font-semibold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Allocation */}
      {Object.keys(allocations).length > 0 && canEdit && (
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
            <MapPin className="w-4 h-4" />
            Export Allocation Report
          </button>
        </div>
      )}
    </div>
  );
}
