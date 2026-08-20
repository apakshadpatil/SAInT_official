import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  reorderAgenda,
  getUpcomingMeetings,
  getPastMeetings,
} from '../../services/meetingService';
import type { MeetingRecord, AgendaItem } from '../../types';
import { isCoreMember } from '../../utils/permissions';
import { Calendar, Clock, Link, Plus, Trash2, ArrowUp, ArrowDown, Video, Eye } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';

export default function AgendaPage() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  
  // Tab selector
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Meeting Form State
  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formLink, setFormLink] = useState('');

  // Agenda Form inside Detail Panel
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDesc, setAgendaDesc] = useState('');
  const [agendaDuration, setAgendaDuration] = useState(15);

  useEffect(() => {
    const unsub = subscribeMeetings(setMeetings);
    return unsub;
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await createMeeting({
        title: formTitle,
        date: formDate,
        time: formTime,
        link: formLink,
        agenda: [],
        createdBy: profile.uid,
        createdByName: profile.displayName,
      });
      setIsCreating(false);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!window.confirm('Delete this meeting?')) return;
    try {
      await deleteMeeting(id);
      setSelectedMeeting(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAgendaItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !agendaTitle) return;
    
    const newItem: AgendaItem = {
      id: `ag-${Date.now()}`,
      title: agendaTitle,
      description: agendaDesc || undefined,
      duration: agendaDuration || undefined,
      order: selectedMeeting.agenda?.length || 0,
    };

    const updatedAgenda = [...(selectedMeeting.agenda || []), newItem];
    try {
      await updateMeeting(selectedMeeting.id, { agenda: updatedAgenda });
      setSelectedMeeting({ ...selectedMeeting, agenda: updatedAgenda });
      setAgendaTitle('');
      setAgendaDesc('');
      setAgendaDuration(15);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveAgendaItem = async (agendaId: string) => {
    if (!selectedMeeting) return;
    const updatedAgenda = selectedMeeting.agenda
      .filter((item) => item.id !== agendaId)
      .map((item, idx) => ({ ...item, order: idx }));
    try {
      await updateMeeting(selectedMeeting.id, { agenda: updatedAgenda });
      setSelectedMeeting({ ...selectedMeeting, agenda: updatedAgenda });
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (!selectedMeeting) return;
    const newAgenda = [...(selectedMeeting.agenda || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newAgenda.length) return;

    // Swap items
    const temp = newAgenda[index];
    newAgenda[index] = newAgenda[targetIndex];
    newAgenda[targetIndex] = temp;

    try {
      await reorderAgenda(selectedMeeting.id, newAgenda);
      setSelectedMeeting({ ...selectedMeeting, agenda: newAgenda.map((item, i) => ({ ...item, order: i })) });
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDate('');
    setFormTime('');
    setFormLink('');
  };

  const upcoming = getUpcomingMeetings(meetings);
  const past = getPastMeetings(meetings);
  const filtered = activeTab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Meeting Agendas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>View and schedule club meetings and discussion items</p>
        </div>

        {isCoreMember(profile) && (
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--dash-border)' }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'upcoming' ? 'border-blue-600 text-blue-600' : 'border-transparent'
          }`}
          style={{
            borderColor: activeTab === 'upcoming' ? 'var(--dash-accent)' : 'transparent',
            color: activeTab === 'upcoming' ? 'var(--dash-accent)' : 'var(--dash-muted)',
          }}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'past' ? 'border-blue-600 text-blue-600' : 'border-transparent'
          }`}
          style={{
            borderColor: activeTab === 'past' ? 'var(--dash-accent)' : 'transparent',
            color: activeTab === 'past' ? 'var(--dash-accent)' : 'var(--dash-muted)',
          }}
        >
          Past Meetings ({past.length})
        </button>
      </div>

      {/* Agenda list */}
      <div className="space-y-4">
        {filtered.map((meeting) => (
          <div
            key={meeting.id}
            className="dash-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border hover:border-blue-500/20 transition-all"
            style={{ borderColor: 'var(--dash-border)' }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <Video className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>{meeting.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs mt-1.5" style={{ color: 'var(--dash-muted)' }}>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" /> {meeting.date}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {meeting.time}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              {meeting.link && (
                <a
                  href={meeting.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline !py-2 !px-3.5 !text-xs"
                >
                  <Link className="w-3.5 h-3.5" /> Join Link
                </a>
              )}
              <button
                onClick={() => setSelectedMeeting(meeting)}
                className="btn-primary !py-2 !px-3.5 !text-xs"
              >
                <Eye className="w-3.5 h-3.5" /> View Agenda ({meeting.agenda?.length || 0})
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center dash-card border-dashed">
            <p style={{ color: 'var(--dash-muted)' }}>No meetings scheduled in this list</p>
          </div>
        )}
      </div>

      {/* Schedule Meeting Drawer */}
      {isCreating && (
        <RightPanel open={isCreating} onClose={() => setIsCreating(false)} title="Schedule Meeting" width="440px">
          <form onSubmit={handleCreateMeeting} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600 dark:text-slate-400">Meeting Topic *</label>
              <input className="input-field" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-600 dark:text-slate-400">Date *</label>
                <input className="input-field" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-600 dark:text-slate-400">Time *</label>
                <input className="input-field" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600 dark:text-slate-400">Meeting URL / Link *</label>
              <input className="input-field" type="url" value={formLink} onChange={(e) => setFormLink(e.target.value)} placeholder="e.g. https://meet.google.com/..." required />
            </div>

            <button type="submit" className="btn-primary w-full !py-3">Schedule Meeting</button>
          </form>
        </RightPanel>
      )}

      {/* Meeting detail and agenda manager */}
      {selectedMeeting && (
        <RightPanel
          open={!!selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          title="Meeting Agenda Board"
          width="500px"
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{selectedMeeting.title}</h2>
              <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--dash-muted)' }}>
                <span>Date: {selectedMeeting.date}</span>
                <span>Time: {selectedMeeting.time}</span>
              </div>
              {selectedMeeting.link && (
                <a
                  href={selectedMeeting.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-2.5"
                >
                  <Video className="w-3.5 h-3.5" /> Direct Meeting Link
                </a>
              )}
            </div>

            {/* Agenda list with sorting/reordering capability */}
            <div className="space-y-3 pt-6 border-t" style={{ borderColor: 'var(--dash-border)' }}>
              <h4 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                Agenda Items ({selectedMeeting.agenda?.length || 0})
              </h4>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selectedMeeting.agenda
                  ?.sort((a, b) => a.order - b.order)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-xl flex items-center justify-between gap-3 bg-slate-500/5 text-xs"
                      style={{ borderColor: 'var(--dash-border)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-tight" style={{ color: 'var(--dash-text)' }}>
                          {idx + 1}. {item.title}
                        </p>
                        {item.description && (
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--dash-muted)' }}>
                            {item.description}
                          </p>
                        )}
                        {item.duration && (
                          <span className="text-[9px] mt-1 block font-semibold text-purple-600">
                            {item.duration} mins
                          </span>
                        )}
                      </div>

                      {isCoreMember(profile) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReorder(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-40"
                          >
                            <ArrowUp className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorder(idx, 'down')}
                            disabled={idx === (selectedMeeting.agenda?.length || 0) - 1}
                            className="p-1 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-40"
                          >
                            <ArrowDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAgendaItem(item.id)}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                {(!selectedMeeting.agenda || selectedMeeting.agenda.length === 0) && (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--dash-muted)' }}>No agenda items defined yet.</p>
                )}
              </div>
            </div>

            {/* Add Agenda Item form for Core members */}
            {isCoreMember(profile) && (
              <form onSubmit={handleAddAgendaItem} className="p-4 border rounded-xl space-y-3 bg-slate-500/5" style={{ borderColor: 'var(--dash-border)' }}>
                <h4 className="font-semibold text-xs text-slate-600 dark:text-slate-400">Add Agenda Item</h4>
                <div className="space-y-2">
                  <input
                    className="input-field !py-2 !px-3 !text-xs"
                    placeholder="Topic Title *"
                    value={agendaTitle}
                    onChange={(e) => setAgendaTitle(e.target.value)}
                    required
                  />
                  <input
                    className="input-field !py-2 !px-3 !text-xs"
                    placeholder="Brief description (Optional)"
                    value={agendaDesc}
                    onChange={(e) => setAgendaDesc(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 shrink-0">Duration:</span>
                    <input
                      className="input-field !py-2 !px-3 !text-xs w-24"
                      type="number"
                      value={agendaDuration}
                      onChange={(e) => setAgendaDuration(Number(e.target.value))}
                      placeholder="Minutes"
                      required
                    />
                    <span className="text-[10px] text-slate-500">minutes</span>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full !py-2 !text-xs">Add Item</button>
              </form>
            )}

            {isCoreMember(profile) && (
              <button
                onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                className="w-full btn-outline border-red-500 text-red-500 hover:bg-red-500/10 !py-2.5 !text-xs mt-4"
              >
                Delete Meeting
              </button>
            )}
          </div>
        </RightPanel>
      )}
    </div>
  );
}
