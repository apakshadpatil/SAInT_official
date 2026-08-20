import { useState } from 'react';
import type { EventDomain, EventRecord } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Layers, Pencil, Trash2, Sparkles, CheckCircle2 } from 'lucide-react';

interface DomainsTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function DomainsTab({ event, onUpdate, canEdit }: DomainsTabProps) {
  const { showToast } = useToast();
  const [domainName, setDomainName] = useState('');
  const [domainDescription, setDomainDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleCreateDomain = async () => {
    if (!domainName.trim()) {
      showToast('Please enter a domain name', 'error');
      return;
    }

    setLoading(true);
    try {
      const newDomain: EventDomain = {
        id: `domain-${Date.now()}`,
        eventId: event.id,
        name: domainName.trim(),
        description: domainDescription.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onUpdate({
        participantDomains: [...(event.participantDomains || []), newDomain],
      });
      setDomainName('');
      setDomainDescription('');
      showToast('Domain created successfully', 'success');
    } catch {
      showToast('Failed to create domain', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (domain: EventDomain) => {
    setEditingDomainId(domain.id);
    setEditName(domain.name);
    setEditDescription(domain.description || '');
  };

  const cancelEdit = () => {
    setEditingDomainId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdateDomain = async (domainId: string) => {
    if (!editName.trim()) {
      showToast('Please enter a domain name', 'error');
      return;
    }

    const nextDomains = (event.participantDomains || []).map((domain) =>
      domain.id === domainId
        ? { ...domain, name: editName.trim(), description: editDescription.trim() || undefined, updatedAt: new Date().toISOString() }
        : domain
    );

    try {
      await onUpdate({ participantDomains: nextDomains });
      cancelEdit();
      showToast('Domain updated', 'success');
    } catch {
      showToast('Failed to update domain', 'error');
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      const nextDomains = (event.participantDomains || []).filter((domain) => domain.id !== domainId);
      await onUpdate({ participantDomains: nextDomains });
      if (editingDomainId === domainId) cancelEdit();
      showToast('Domain removed', 'success');
    } catch {
      showToast('Failed to remove domain', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--dash-border)', background: 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(14,165,233,0.02))' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-2xl p-2.5" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <Layers className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Participant Domains</h4>
            <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>Create and manage domain-based registration groups.</p>
          </div>
        </div>

        {canEdit && (
          <div className="rounded-2xl border p-4 mb-5" style={{ borderColor: 'var(--dash-border)', background: 'rgba(255,255,255,0.5)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Create a new domain</p>
            </div>
            <div className="space-y-3">
              <input
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                className="input-field w-full"
                placeholder="e.g. Core Team"
              />
              <textarea
                value={domainDescription}
                onChange={(e) => setDomainDescription(e.target.value)}
                className="input-field w-full min-h-24"
                placeholder="Short description"
              />
              <button onClick={handleCreateDomain} disabled={loading} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Domain'}
              </button>
            </div>
          </div>
        )}

        {(event.participantDomains || []).length > 0 ? (
          <div className="grid gap-3">
            {event.participantDomains?.map((domain) => (
              <div key={domain.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
                {editingDomainId === domain.id ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field w-full"
                      placeholder="Domain name"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="input-field w-full min-h-24"
                      placeholder="Domain description"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleUpdateDomain(domain.id)} className="btn-primary flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Save
                      </button>
                      <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl p-2" style={{ background: 'rgba(16,185,129,0.12)' }}>
                        <Layers className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>{domain.name}</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>{domain.description || 'No description provided.'}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(domain)} className="rounded-xl border p-2" style={{ borderColor: 'var(--dash-border)' }} title="Edit domain">
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </button>
                        <button onClick={() => handleDeleteDomain(domain.id)} className="rounded-xl border p-2" style={{ borderColor: 'var(--dash-border)' }} title="Delete domain">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--dash-border)' }}>
            <p style={{ color: 'var(--dash-muted)' }}>No domains created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
