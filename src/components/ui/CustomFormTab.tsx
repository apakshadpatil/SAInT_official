import { useState } from 'react';
import type { EventRecord, CustomFormField } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Trash2, Edit3, MoveUp, MoveDown, FormInput, ListFilter } from 'lucide-react';

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

  const resetBuilderForm = () => {
    setLabel('');
    setType('text');
    setRequired(false);
    setPlaceholder('');
    setOptionsStr('');
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
    setIsAdding(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      showToast('Field label is required', 'error');
      return;
    }

    const options = type === 'select' ? optionsStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    if (editingId) {
      // Update existing field
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingId
            ? {
                ...f,
                label: label.trim(),
                type,
                required,
                placeholder: placeholder.trim() || undefined,
                options,
              }
            : f
        )
      );
      showToast('Field updated', 'info');
    } else {
      // Add new field
      const newField: CustomFormField = {
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        label: label.trim(),
        type,
        required,
        placeholder: placeholder.trim() || undefined,
        options,
      };
      setFields((prev) => [...prev, newField]);
      showToast('Custom field added', 'info');
    }

    resetBuilderForm();
  };

  const handleDeleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    showToast('Field removed', 'info');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextFields.length) return;

    const temp = nextFields[index];
    nextFields[index] = nextFields[targetIndex];
    nextFields[targetIndex] = temp;
    setFields(nextFields);
  };

  const handleSaveFormLayout = async () => {
    setLoading(true);
    try {
      await onUpdate({
        customFields: fields,
      });
      showToast('Registration form layout saved successfully!', 'success');
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
            Create custom fields (e.g. Year of Study, T-shirt size, GitHub Link, Food Preference) required for registering for this event.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              resetBuilderForm();
              setIsAdding(true);
            }}
            className="btn-primary flex items-center gap-2 !py-2.5 !px-4 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Form Field
          </button>
        )}
      </div>

      {/* Field Builder Drawer / Modal */}
      {isAdding && (
        <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
            {editingId ? 'Edit Form Field' : 'Add New Registration Field'}
          </h4>

          <form onSubmit={handleSaveField} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Field Label *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Year of Study, T-Shirt Size, GitHub URL"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Input Type *
                </label>
                <select
                  className="input-field"
                  value={type}
                  onChange={(e) => setType(e.target.value as CustomFormField['type'])}
                >
                  <option value="text">Short Text</option>
                  <option value="textarea">Paragraph Text</option>
                  <option value="number">Number</option>
                  <option value="email">Email Address</option>
                  <option value="select">Dropdown Select</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Placeholder Hint (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Enter your GitHub profile link"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                    Mark as Required Field
                  </span>
                </label>
              </div>
            </div>

            {type === 'select' && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>
                  Dropdown Select Options (Comma Separated) *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. First Year, Second Year, Third Year, Final Year"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button type="submit" className="btn-primary !py-2 !px-4">
                {editingId ? 'Save Field Changes' : 'Add Field'}
              </button>
              <button type="button" onClick={resetBuilderForm} className="btn-secondary !py-2 !px-4">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Field List & Layout Preview */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
              Configured Custom Registration Fields ({fields.length})
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              These fields will be rendered on the public event registration form.
            </p>
          </div>
          {canEdit && fields.length > 0 && (
            <button
              onClick={handleSaveFormLayout}
              disabled={loading}
              className="btn-primary !py-2 !px-4 text-xs font-semibold"
            >
              {loading ? 'Saving...' : 'Save Registration Form'}
            </button>
          )}
        </div>

        {fields.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--dash-border)' }}>
            <ListFilter className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>No custom fields added yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Click &quot;Add Form Field&quot; to build custom registration fields for this event.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="p-4 border rounded-xl flex items-center justify-between gap-4"
                style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-sm truncate" style={{ color: 'var(--dash-text)' }}>
                        {field.label}
                      </h5>
                      {field.required ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-500/10 text-red-500">
                          REQUIRED
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-500/10 text-slate-400">
                          OPTIONAL
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-purple-500/10 text-purple-600 uppercase font-mono">
                        {field.type}
                      </span>
                    </div>
                    {field.placeholder && (
                      <p className="text-xs truncate mt-0.5 text-slate-400">
                        Placeholder: &quot;{field.placeholder}&quot;
                      </p>
                    )}
                    {field.options && field.options.length > 0 && (
                      <p className="text-xs truncate mt-0.5 text-slate-400">
                        Options: {field.options.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 disabled:opacity-30"
                      title="Move Up"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === fields.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 disabled:opacity-30"
                      title="Move Down"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditClick(field)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10"
                      title="Edit Field"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
