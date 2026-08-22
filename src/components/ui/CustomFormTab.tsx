import { useState, useEffect } from 'react';
import type { EventRecord, CustomFormField } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Trash2, Edit3, MoveUp, MoveDown, FormInput, CheckCircle2, Eye, HelpCircle, Layers } from 'lucide-react';

interface CustomFormTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function CustomFormTab({ event, onUpdate, canEdit }: CustomFormTabProps) {
  const { showToast } = useToast();
  const [fields, setFields] = useState<CustomFormField[]>(event.customFields || []);
  const [loading, setLoading] = useState(false);

  // Form field builder modal state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFormField['type']>('text');
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const [optionsStr, setOptionsStr] = useState('');
  const [assignedTierId, setAssignedTierId] = useState('');

  // Sync state with event.customFields when event changes
  useEffect(() => {
    setFields(event.customFields || []);
  }, [event.customFields]);

  const resetBuilderForm = () => {
    setLabel('');
    setType('text');
    setRequired(false);
    setPlaceholder('');
    setOptionsStr('');
    setAssignedTierId('');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEditClick = (field: CustomFormField) => {
    setEditingId(field.id);
    setLabel(field.label);
    setType(field.type);
    setRequired(field.required);
    setPlaceholder(field.placeholder || '');
    setOptionsStr(field.options ? field.options.join(', ') : '');
    setAssignedTierId(field.tierId || '');
    setIsAdding(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      showToast('Field label is required', 'error');
      return;
    }

    const options = type === 'select' ? optionsStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    let updatedFields: CustomFormField[];
    if (editingId) {
      // Update existing field
      updatedFields = fields.map((f) =>
        f.id === editingId
          ? {
              ...f,
              label: label.trim(),
              type,
              required,
              placeholder: placeholder.trim() || undefined,
              options,
              tierId: assignedTierId || undefined,
            }
          : f
      );
    } else {
      // Add new field
      const newField: CustomFormField = {
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        label: label.trim(),
        type,
        required,
        placeholder: placeholder.trim() || undefined,
        options,
        tierId: assignedTierId || undefined,
      };
      updatedFields = [...fields, newField];
    }

    setFields(updatedFields);
    resetBuilderForm();

    // Auto-save to Firestore
    try {
      await onUpdate({ customFields: updatedFields });
      showToast(editingId ? 'Field updated & saved!' : 'Custom field added & saved!', 'success');
    } catch (err) {
      showToast('Failed to save form field to database', 'error');
    }
  };

  const handleDeleteField = async (id: string) => {
    const nextFields = fields.filter((f) => f.id !== id);
    setFields(nextFields);
    try {
      await onUpdate({ customFields: nextFields });
      showToast('Field removed & layout saved', 'info');
    } catch (err) {
      showToast('Failed to update form layout', 'error');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const nextFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextFields.length) return;

    const temp = nextFields[index];
    nextFields[index] = nextFields[targetIndex];
    nextFields[targetIndex] = temp;
    setFields(nextFields);

    try {
      await onUpdate({ customFields: nextFields });
    } catch (err) {
      console.error('Failed to update field order:', err);
    }
  };

  const handleExplicitSave = async () => {
    setLoading(true);
    try {
      await onUpdate({
        customFields: fields,
      });
      showToast('Registration form layout verified & saved!', 'success');
    } catch (err) {
      showToast('Failed to save form layout', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--dash-border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <FormInput className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
              Custom Event Registration Form Builder
            </h3>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Create custom fields (e.g. Year of Study, T-shirt size, GitHub Link, Food Preference) that are asked during registration.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                resetBuilderForm();
                setIsAdding(true);
              }}
              className="btn-primary flex items-center gap-2 !py-2.5 !px-4 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Form Field
            </button>
            <button
              onClick={handleExplicitSave}
              disabled={loading}
              className="btn-secondary flex items-center gap-2 !py-2.5 !px-4 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {loading ? 'Saving...' : 'Save Layout'}
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Form Fields List / Builder */}
        <div className="lg:col-span-7 space-y-4">
          {/* Field Builder Drawer / Modal */}
          {isAdding && (
            <form onSubmit={handleSaveField} className="rounded-2xl border p-5 space-y-4 bg-slate-900/40" style={{ borderColor: 'rgba(59,130,246,0.4)' }}>
              <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                {editingId ? 'Edit Custom Field' : 'Configure New Custom Field'}
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Field Label / Question *
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                    placeholder="e.g. What is your GitHub profile or Portfolio URL?"
                    className="input-field w-full text-xs"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Input Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as CustomFormField['type'])}
                      className="input-field w-full text-xs"
                    >
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Paragraph / Description</option>
                      <option value="select">Dropdown Choice (Select)</option>
                      <option value="number">Number</option>
                      <option value="email">Email</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Applicable Ticket Tier (Optional)
                    </label>
                    <select
                      value={assignedTierId}
                      onChange={(e) => setAssignedTierId(e.target.value)}
                      className="input-field w-full text-xs"
                    >
                      <option value="">All Tiers / General</option>
                      {event.ticketTiers?.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name} ({tier.teamSize} Members)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {type === 'select' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Dropdown Options (comma-separated) *
                    </label>
                    <input
                      type="text"
                      value={optionsStr}
                      onChange={(e) => setOptionsStr(e.target.value)}
                      placeholder="e.g. First Year, Second Year, Third Year, Final Year"
                      className="input-field w-full text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Placeholder Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="e.g. https://github.com/your-name"
                    className="input-field w-full text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
                    <input
                      type="checkbox"
                      checked={required}
                      onChange={(e) => setRequired(e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                    Mark as Required Field (*)
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" className="btn-primary !text-xs !py-2 !px-4 cursor-pointer">
                    {editingId ? 'Save Changes' : 'Add to Form'}
                  </button>
                  <button type="button" onClick={resetBuilderForm} className="btn-secondary !text-xs !py-2 !px-4 cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Fields List */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <h4 className="font-bold text-sm flex items-center justify-between" style={{ color: 'var(--dash-text)' }}>
              <span>Event Custom Fields ({fields.length})</span>
              <span className="text-[11px] font-normal text-emerald-400">✓ Auto-saved &amp; Active</span>
            </h4>

            {fields.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
                <HelpCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>No Custom Fields Added</p>
                <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                  Click &quot;Add Form Field&quot; above to create extra questions for attendees.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((f, idx) => {
                  const assignedTier = event.ticketTiers?.find((t) => t.id === f.tierId);
                  return (
                    <div
                      key={f.id}
                      className="rounded-xl border p-3.5 flex items-center justify-between gap-3 transition-colors"
                      style={{ borderColor: 'var(--dash-border)', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs truncate" style={{ color: 'var(--dash-text)' }}>
                              {f.label}
                            </span>
                            {f.required && (
                              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                                Required
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-mono uppercase">
                              {f.type}
                            </span>
                            {assignedTier && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" /> {assignedTier.name}
                              </span>
                            )}
                          </div>
                          {f.options && (
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--dash-muted)' }}>
                              Options: {f.options.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === fields.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClick(f)}
                            className="p-1 rounded text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                            title="Edit Field"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteField(f.id)}
                            className="p-1 rounded text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Delete Field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Interactive Registration Form Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
            <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <Eye className="w-4 h-4 text-blue-400" />
              <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                Live Registration Page Form Preview
              </h4>
            </div>

            <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
              This is how your custom questions appear to participants when registering on the public event page.
            </p>

            <div className="p-4 rounded-xl border space-y-3 bg-black/20" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400 pb-1 border-b border-white/10">
                Custom Event Information
              </div>

              {fields.length === 0 ? (
                <p className="text-xs italic py-4 text-center" style={{ color: 'var(--dash-muted)' }}>
                  No custom fields configured. Standard basic fields (Name, Email, Phone, College, Dept) will be asked.
                </p>
              ) : (
                fields.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <label className="block text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {f.label} {f.required ? <span className="text-red-400">*</span> : <span className="text-slate-500 font-normal">(Optional)</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        disabled
                        placeholder={f.placeholder || `Enter ${f.label}`}
                        rows={2}
                        className="input-field w-full text-xs opacity-80"
                      />
                    ) : f.type === 'select' ? (
                      <select disabled className="input-field w-full text-xs opacity-80">
                        <option>Choose {f.label}...</option>
                        {f.options?.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        placeholder={f.placeholder || `Enter ${f.label}`}
                        className="input-field w-full text-xs opacity-80"
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
