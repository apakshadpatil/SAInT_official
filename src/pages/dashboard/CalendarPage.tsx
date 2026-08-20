import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeEvents } from '../../services/eventService';
import { subscribeUserTasks, subscribeAllTasks } from '../../services/taskService';
import { subscribeMeetings } from '../../services/meetingService';
import type { EventRecord, TaskRecord, MeetingRecord } from '../../types';
import { isCoreMember } from '../../utils/permissions';
import { ChevronLeft, ChevronRight, Calendar, Users, ListTodo } from 'lucide-react';

interface CalendarDayItem {
  type: 'event' | 'meeting' | 'task-deadline' | 'task-completed';
  id: string;
  title: string;
  time?: string;
  color: string;
}

export default function CalendarPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayItems, setSelectedDayItems] = useState<{ day: number; items: CalendarDayItem[] } | null>(null);

  useEffect(() => {
    const unsubEvents = subscribeEvents(setEvents);
    const unsubMeetings = subscribeMeetings(setMeetings);
    
    // Core/Super Admin can see all tasks on calendar, members see only their assigned tasks
    const unsubTasks = profile
      ? isCoreMember(profile)
        ? subscribeAllTasks(setTasks)
        : subscribeUserTasks(profile.uid, setTasks)
      : () => {};

    return () => {
      unsubEvents();
      unsubMeetings();
      unsubTasks();
    };
  }, [profile]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayItems(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayItems(null);
  };

  // Helper to format date key matching 'YYYY-MM-DD'
  const formatDateKey = (dayNum: number) => {
    const d = String(dayNum).padStart(2, '0');
    const m = String(month + 1).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Get all items scheduled on a specific day
  const getDayItems = (dayNum: number): CalendarDayItem[] => {
    const dateKey = formatDateKey(dayNum);
    const items: CalendarDayItem[] = [];

    // Events
    events
      .filter((e) => e.date === dateKey && e.status === 'published')
      .forEach((e) => {
        items.push({
          type: 'event',
          id: e.id,
          title: e.title,
          time: e.startTime,
          color: 'bg-blue-500 text-blue-50 border-blue-600',
        });
      });

    // Meetings
    meetings
      .filter((m) => m.date === dateKey)
      .forEach((m) => {
        items.push({
          type: 'meeting',
          id: m.id,
          title: m.title,
          time: m.time,
          color: 'bg-purple-500 text-purple-50 border-purple-600',
        });
      });

    // Tasks deadlines
    tasks
      .filter((t) => t.deadline === dateKey && t.status !== 'completed')
      .forEach((t) => {
        items.push({
          type: 'task-deadline',
          id: t.id,
          title: `Task Due: ${t.title}`,
          color: 'bg-amber-500 text-amber-50 border-amber-600',
        });
      });

    // Tasks completed
    tasks
      .filter((t) => t.completedAt?.startsWith(dateKey))
      .forEach((t) => {
        items.push({
          type: 'task-completed',
          id: t.id,
          title: `Completed: ${t.title}`,
          color: 'bg-emerald-500 text-emerald-50 border-emerald-600',
        });
      });

    return items;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Fill in blanks for the calendar grid
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  const handleDayClick = (dayNum: number) => {
    const items = getDayItems(dayNum);
    setSelectedDayItems({ day: dayNum, items });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Calendar</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Keep track of deadlines, events, and meetings</p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 border rounded-xl hover:bg-black/5" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm w-36 text-center" style={{ color: 'var(--dash-text)' }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 border rounded-xl hover:bg-black/5" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <div className="dash-card !p-4">
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold" style={{ color: 'var(--dash-muted)' }}>
              {daysOfWeek.map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((dayNum, cellIndex) => {
                if (dayNum === null) {
                  return <div key={`empty-${cellIndex}`} className="aspect-square bg-slate-500/5 rounded-xl border border-transparent" />;
                }

                const items = getDayItems(dayNum);
                const hasItems = items.length > 0;
                const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString();

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => handleDayClick(dayNum)}
                    className={`aspect-square p-2 border rounded-xl flex flex-col justify-between cursor-pointer transition-all hover:bg-black/5 ${
                      isToday ? 'border-blue-500 border-2' : ''
                    }`}
                    style={{ borderColor: isToday ? '#2563eb' : 'var(--dash-border)' }}
                  >
                    <span className={`text-xs font-bold ${isToday ? 'text-blue-600 font-extrabold' : ''}`} style={{ color: isToday ? undefined : 'var(--dash-text)' }}>
                      {dayNum}
                    </span>

                    {hasItems && (
                      <div className="flex gap-1 overflow-x-hidden mt-1.5">
                        {items.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              item.type === 'event' ? 'bg-blue-500' :
                              item.type === 'meeting' ? 'bg-purple-500' :
                              item.type === 'task-deadline' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        ))}
                        {items.length > 3 && (
                          <span className="text-[8px] font-bold" style={{ color: 'var(--dash-muted)' }}>+{items.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected day items detail panel */}
        <div className="lg:col-span-1">
          <div className="dash-card p-5 min-h-[300px]">
            <h3 className="font-bold text-sm border-b pb-3 mb-4" style={{ color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}>
              Agenda for {selectedDayItems ? `${selectedDayItems.day} ${monthNames[month]}` : 'Selected Date'}
            </h3>

            {!selectedDayItems ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>Click a day on the calendar to inspect schedule details</p>
              </div>
            ) : selectedDayItems.items.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>No activities scheduled for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayItems.items.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-xl flex items-start gap-2.5 shadow-sm bg-slate-500/5"
                    style={{ borderColor: 'var(--dash-border)' }}
                  >
                    {item.type === 'event' && <Calendar className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
                    {item.type === 'meeting' && <Users className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />}
                    {item.type.startsWith('task') && <ListTodo className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--dash-text)' }}>
                        {item.title}
                      </p>
                      {item.time && (
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                          Time: {item.time}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
