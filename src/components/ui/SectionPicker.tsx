import { X } from 'lucide-react';
import type { ApplySection } from '../../types';
import { APPLY_SECTIONS } from '../../types';

interface SectionOption {
  value: ApplySection;
  label: string;
}

interface SectionPickerProps {
  selected: ApplySection[];
  onAdd: (section: ApplySection) => void;
  onRemove: (section: ApplySection) => void;
  skills: Record<string, string>;
  onSkillChange: (section: ApplySection, value: string) => void;
  sectionOptions?: SectionOption[];
}

export default function SectionPicker({
  selected,
  onAdd,
  onRemove,
  skills,
  onSkillChange,
  sectionOptions,
}: SectionPickerProps) {
  const options = sectionOptions && sectionOptions.length > 0 ? sectionOptions : APPLY_SECTIONS;
  const available = options.filter((s) => !selected.includes(s.value));

  return (
    <div className="space-y-4">
      {available.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Select Section to Apply
          </label>
          <select
            className="input-field"
            value=""
            onChange={(e) => {
              if (e.target.value) onAdd(e.target.value as ApplySection);
            }}
          >
            <option value="">Choose a section...</option>
            {available.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-3">
          {selected.map((section) => {
            const label = options.find((s) => s.value === section)?.label || section;
            return (
              <div key={section} className="card !p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="capsule-tag">{label}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(section)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Skills for {label}
                  </label>
                  <textarea
                    className="input-field min-h-[80px] resize-y"
                    placeholder={`Describe your skills relevant to ${label}...`}
                    value={skills[section] || ''}
                    onChange={(e) => onSkillChange(section, e.target.value)}
                    required
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
