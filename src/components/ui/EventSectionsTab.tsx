import { useState, useEffect } from 'react';
import type { EventRecord, EventCustomSection } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
  LayoutList,
  Edit2,
  X
} from 'lucide-react';
import { ICON_OPTIONS, getSectionIcon } from '../../utils/eventSectionIcons';

interface EventSectionsTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

interface SectionPreset {
  title: string;
  icon: string;
  content: string;
  hint: string;
}

const SECTION_PRESETS: SectionPreset[] = [
  {
    title: 'Prizes & Rewards',
    icon: 'trophy',
    content: `🥇 1st Prize: ₹10,000 + Winner Trophy & Merit Certificate\n🥈 2nd Prize: ₹6,000 + Trophy & Certificate\n🥉 3rd Prize: ₹3,000 + Trophy & Certificate\n⭐ Best Innovation Award: Exclusive SAInT Swag Kit & Goodies\n📜 Digital Verified Certificates for all active participants`,
    hint: 'Prize pool breakdown, cash awards, medals, and certificates'
  },
  {
    title: 'Event Rules & Regulations',
    icon: 'scroll',
    content: `1. College ID cards are mandatory at registration and entrance.\n2. Participants must bring their own laptops and necessary peripherals.\n3. Plagiarism or use of pre-built solutions will result in disqualification.\n4. All projects must be committed to the designated GitHub repository.\n5. Decision of the judging panel and organizers will be final and binding.`,
    hint: 'Eligibility constraints, code of conduct, and submission rules'
  },
  {
    title: 'Event Highlights',
    icon: 'sparkles',
    content: `• 24-Hour Intensive Hackathon with real-world industry problem statements.\n• One-on-one mentorship sessions with senior tech architects.\n• Hands-on workshops on AI/ML and Cloud Native development.\n• Networking dinner with startup founders and alumni.\n• Direct interview opportunities with hiring partners for top performers.`,
    hint: 'Key attractions, speakers, and special experiences'
  },
  {
    title: 'Exclusive Benefits & Perks',
    icon: 'gift',
    content: `• Free Cloud credits ($100 API credits per team).\n• Exclusive SAInT Developer T-shirts and sticker packs for all attendees.\n• Access to premium developer tooling and sponsor perks.\n• Direct entry to SAInT Club Core Team recruitment shortlist.\n• Free high-resolution event photographs and digital badges.`,
    hint: 'Swag, goodies, cloud credits, and unique takeaways'
  },
  {
    title: 'What We Provide',
    icon: 'package',
    content: `• Dedicated team workstation with uninterrupted high-speed Wi-Fi (1 Gbps).\n• Continuous power supply and multi-plug extension boards.\n• Complimentary meals: Breakfast, Lunch, Dinner, and midnight coffee/snacks.\n• Hardware test kits, basic sensors, and development boards upon request.\n• 24/7 rest lounge and medical first-aid assistance.`,
    hint: 'Facilities, food, hardware, and internet provided by organizers'
  },
  {
    title: 'Important Instructions',
    icon: 'alert',
    content: `⚠️ Reporting Time: All participants must report at the IT Department by 08:30 AM.\n⚠️ Documents: Carry your digital entry pass (QR code) and College Identity Card.\n⚠️ Equipment: Ensure all necessary software and IDEs are pre-installed on your laptop.\n⚠️ Accommodation: Night stay is permitted only for registered hackathon participants.\n⚠️ Contact: For emergency queries, contact the coordination desk at +91 98765 43210.`,
    hint: 'Reporting timing, mandatory checklist, and critical warnings'
  },
  {
    title: 'Eligibility Criteria',
    icon: 'users',
    content: `• Open to all undergraduate and diploma engineering students (FE, SE, TE, BE).\n• Cross-college and cross-department teams are strictly allowed.\n• Participants can compete solo or form teams of 2 to 4 members.\n• Basic knowledge of web, mobile, or cloud development is recommended.`,
    hint: 'Who can participate, department or year restrictions'
  },
  {
    title: 'Schedule & Timeline',
    icon: 'calendar',
    content: `📅 08:30 AM - 09:30 AM: Check-in, Breakfast & Kit Distribution\n📅 09:30 AM - 10:30 AM: Opening Ceremony & Problem Statement Reveal\n📅 10:30 AM: Hackathon Commences\n📅 01:30 PM - 02:30 PM: Lunch Break\n📅 05:00 PM - 07:00 PM: Mentorship Evaluation Round 1\n📅 08:30 PM - 09:30 PM: Dinner & Refreshments\n📅 Next Day 09:00 AM: Final Code Freeze & Jury Presentations\n📅 Next Day 12:00 PM: Valedictory & Award Ceremony`,
    hint: 'Hour-by-hour event schedule and milestones'
  },
];

export default function EventSectionsTab({ event, onUpdate, canEdit }: EventSectionsTabProps) {
  const { showToast } = useToast();
  const [sections, setSections] = useState<EventCustomSection[]>(() => {
    return (event.customSections || []).slice().sort((a, b) => a.order - b.order);
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setSections((event.customSections || []).slice().sort((a, b) => a.order - b.order));
  }, [event.customSections]);

  const handleAddPreset = (preset: SectionPreset) => {
    const newSection: EventCustomSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: preset.title,
      icon: preset.icon,
      content: preset.content,
      visible: true,
      order: sections.length + 1,
    };
    setSections((prev) => [...prev, newSection]);
    setShowPresetsModal(false);
    setEditingId(newSection.id);
    showToast(`Added "${preset.title}" section`, 'success');
  };

  const handleAddCustom = () => {
    const newSection: EventCustomSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: 'New Event Section',
      icon: 'sparkles',
      content: 'Add your custom details, bullet points, or guidelines here...',
      visible: true,
      order: sections.length + 1,
    };
    setSections((prev) => [...prev, newSection]);
    setEditingId(newSection.id);
    showToast('New section added. Customize its title and content below.', 'info');
  };

  const handleUpdateSection = (id: string, updates: Partial<EventCustomSection>) => {
    setSections((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, ...updates } : sec))
    );
  };

  const handleDeleteSection = (id: string, title: string) => {
    if (!window.confirm(`Delete section "${title}"?`)) return;
    setSections((prev) => {
      const filtered = prev.filter((sec) => sec.id !== id);
      return filtered.map((sec, idx) => ({ ...sec, order: idx + 1 }));
    });
    if (editingId === id) setEditingId(null);
    showToast(`Deleted "${title}"`, 'info');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setSections((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((sec, idx) => ({ ...sec, order: idx + 1 }));
    });
  };

  const handleToggleVisible = (id: string) => {
    setSections((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, visible: !sec.visible } : sec))
    );
  };

  const handleSaveAll = async () => {
    if (!canEdit) {
      showToast('You do not have permission to edit this event', 'error');
      return;
    }
    setSaving(true);
    try {
      const reindexed = sections.map((sec, index) => ({
        ...sec,
        order: index + 1,
        title: sec.title.trim(),
        content: sec.content.trim(),
      }));
      await onUpdate({
        customSections: reindexed,
      });
      setSections(reindexed);
      showToast('Event sections saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save sections', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                <LayoutList className="w-5 h-5 text-blue-500" />
                Event Content &amp; Custom Sections
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {sections.length} {sections.length === 1 ? 'Section' : 'Sections'}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Organize Prizes, Rules, Highlights, Benefits, Provided items, Instructions, Schedule, and custom event information.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{
                borderColor: showPreview ? '#3b82f6' : 'var(--dash-border)',
                background: showPreview ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: showPreview ? '#60a5fa' : 'var(--dash-text)',
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
            </button>

            <button
              type="button"
              onClick={() => setShowPresetsModal(true)}
              disabled={!canEdit}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Preset Templates
            </button>

            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!canEdit}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Custom Section
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || !canEdit}
              className="btn-primary !text-xs !py-2 !px-4 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save All Sections'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Preset Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border" style={{ borderColor: 'var(--dash-border)', background: 'rgba(15, 23, 42, 0.2)' }}>
        <span className="text-[11px] font-bold uppercase tracking-wider px-2" style={{ color: 'var(--dash-muted)' }}>
          Quick Add:
        </span>
        {SECTION_PRESETS.slice(0, 5).map((preset) => {
          const IconComp = getSectionIcon(preset.icon).icon;
          const isAlreadyAdded = sections.some(
            (s) => s.title.toLowerCase() === preset.title.toLowerCase()
          );
          return (
            <button
              key={preset.title}
              type="button"
              onClick={() => handleAddPreset(preset)}
              disabled={!canEdit}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                isAlreadyAdded
                  ? 'opacity-50 border-slate-700 bg-slate-800/40 text-slate-400'
                  : 'border-slate-700/80 bg-slate-800/70 hover:border-blue-500/50 hover:bg-blue-500/10 text-slate-200'
              }`}
              title={preset.hint}
            >
              <IconComp className="w-3.5 h-3.5" style={{ color: getSectionIcon(preset.icon).color }} />
              <span>{preset.title}</span>
              {isAlreadyAdded && <span className="text-[10px] text-slate-500">(added)</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowPresetsModal(true)}
          className="text-xs px-2.5 py-1.5 rounded-lg text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline ml-auto"
        >
          More Presets ({SECTION_PRESETS.length}) →
        </button>
      </div>

      {/* Live Preview Bar if enabled */}
      {showPreview && (
        <div
          className="rounded-2xl border p-5 space-y-4 animate-fade-in-up"
          style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(10,15,28,0.7)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Live Public Page Preview Simulation
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Showing {sections.filter((s) => s.visible).length} visible sections
            </span>
          </div>

          {sections.filter((s) => s.visible).length === 0 ? (
            <p className="text-center text-xs py-8 text-slate-500">
              No visible sections configured yet. Add or toggle sections above.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {sections
                .filter((s) => s.visible)
                .map((sec) => {
                  const iconObj = getSectionIcon(sec.icon);
                  const IconComp = iconObj.icon;
                  return (
                    <div
                      key={sec.id}
                      className="rounded-xl border p-4 space-y-2.5 transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: `${iconObj.color}20`,
                            border: `1px solid ${iconObj.color}40`,
                          }}
                        >
                          <IconComp className="w-4 h-4" style={{ color: iconObj.color }} />
                        </div>
                        <h4 className="text-sm font-bold text-white">{sec.title}</h4>
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-9">
                        {sec.content || <em className="text-slate-500">No content provided</em>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Sections List */}
      {sections.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center space-y-4"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <LayoutList className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
              No Custom Sections Created Yet
            </h4>
            <p className="text-xs max-w-md mx-auto mt-1" style={{ color: 'var(--dash-muted)' }}>
              Add structured sections like Prizes, Rules, Event Highlights, and What We Provide to make your public event page stand out.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPresetsModal(true)}
              className="btn-primary !text-xs !py-2 !px-4 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Choose from Templates
            </button>
            <button
              type="button"
              onClick={handleAddCustom}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              + Blank Section
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => {
            const iconObj = getSectionIcon(section.icon);
            const IconComp = iconObj.icon;
            const isEditing = editingId === section.id;

            return (
              <div
                key={section.id}
                className={`rounded-2xl border transition-all ${
                  isEditing
                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
                    : 'hover:border-slate-700'
                }`}
                style={{
                  borderColor: isEditing ? 'rgba(59,130,246,0.5)' : 'var(--dash-border)',
                  background: 'var(--dash-card)',
                }}
              >
                {/* Section Header Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || !canEdit}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === sections.length - 1 || !canEdit}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Order & Icon */}
                    <span className="w-6 text-center text-xs font-mono font-bold text-slate-500 shrink-0">
                      #{index + 1}
                    </span>

                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{
                        background: `${iconObj.color}18`,
                        border: `1px solid ${iconObj.color}35`,
                      }}
                    >
                      <IconComp className="w-4 h-4" style={{ color: iconObj.color }} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm truncate" style={{ color: 'var(--dash-text)' }}>
                          {section.title || 'Untitled Section'}
                        </h4>
                        {!section.visible && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 flex items-center gap-1">
                            <EyeOff className="w-2.5 h-2.5" /> Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate max-w-md mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                        {section.content
                          ? section.content.slice(0, 90) + (section.content.length > 90 ? '...' : '')
                          : 'No content added yet.'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleVisible(section.id)}
                      disabled={!canEdit}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        section.visible
                          ? 'border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      }`}
                      title={section.visible ? 'Hide from public page' : 'Make visible'}
                    >
                      {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : section.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isEditing
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      {isEditing ? 'Collapse' : 'Edit'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSection(section.id, section.title)}
                      disabled={!canEdit}
                      className="p-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                      title="Delete section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Editing Form */}
                {isEditing && (
                  <div className="p-4 sm:p-5 border-t space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'rgba(0,0,0,0.1)' }}>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Section Title */}
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                          Section Title *
                        </label>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                          placeholder="e.g. Prizes & Rewards"
                          className="input-field w-full text-xs font-bold"
                        />
                      </div>

                      {/* Icon Picker */}
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                          Section Icon
                        </label>
                        <select
                          value={section.icon || 'trophy'}
                          onChange={(e) => handleUpdateSection(section.id, { icon: e.target.value })}
                          className="input-field w-full text-xs"
                        >
                          {ICON_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Section Content */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
                          Section Content &amp; Details *
                        </label>
                        <span className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                          Supports bullet points, emojis, and new lines
                        </span>
                      </div>
                      <textarea
                        value={section.content}
                        onChange={(e) => handleUpdateSection(section.id, { content: e.target.value })}
                        rows={6}
                        placeholder="Write detailed event information, requirements, or bullet points here..."
                        className="input-field w-full text-xs leading-relaxed font-sans"
                      />
                    </div>

                    {/* Bottom Controls */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`visible_toggle_${section.id}`}
                          checked={section.visible}
                          onChange={(e) => handleUpdateSection(section.id, { visible: e.target.checked })}
                          className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`visible_toggle_${section.id}`}
                          className="text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--dash-text)' }}
                        >
                          Visible on Public Event Page
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        Done Editing
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preset Selection Modal */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  Choose an Event Section Template
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                  Pre-configured with standard titles, matching icons, and recommended formats.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              {SECTION_PRESETS.map((preset) => {
                const iconObj = getSectionIcon(preset.icon);
                const IconComp = iconObj.icon;
                const isAlreadyAdded = sections.some(
                  (s) => s.title.toLowerCase() === preset.title.toLowerCase()
                );

                return (
                  <div
                    key={preset.title}
                    onClick={() => handleAddPreset(preset)}
                    className="rounded-xl border p-4 transition-all hover:border-blue-500/60 hover:bg-blue-500/5 cursor-pointer space-y-2 group"
                    style={{ borderColor: 'var(--dash-border)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: `${iconObj.color}20`,
                            border: `1px solid ${iconObj.color}40`,
                          }}
                        >
                          <IconComp className="w-4 h-4" style={{ color: iconObj.color }} />
                        </div>
                        <h4 className="text-xs font-bold group-hover:text-blue-400 transition-colors" style={{ color: 'var(--dash-text)' }}>
                          {preset.title}
                        </h4>
                      </div>
                      {isAlreadyAdded && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          Added
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'var(--dash-muted)' }}>
                      {preset.hint}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
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
