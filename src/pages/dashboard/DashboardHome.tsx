import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, ListTodo, TrendingUp, ArrowUpRight, ClipboardList,
  Users, Clock, Zap, CheckCircle2, AlertCircle, CircleDot,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeEvents, getUpcomingEvents } from '../../services/eventService';
import { subscribeUserTasks } from '../../services/taskService';
import { subscribeMeetings, getUpcomingMeetings } from '../../services/meetingService';
import type { EventRecord, TaskRecord, MeetingRecord } from '../../types';
import { isCoreMember } from '../../utils/permissions';
import { StatGridSkeleton, TaskItemSkeleton, CardSkeleton, DataStateWrapper } from '../../components/ui/skeleton';

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  high:   { label: 'High',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  medium: { label: 'Medium', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  low:    { label: 'Low',    color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
};

export default function DashboardHome() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2) setLoading(false);
    };

    const u1 = subscribeEvents((evts) => {
      setEvents(evts);
      checkLoaded();
    });
    const u2 = profile
      ? subscribeUserTasks(profile.uid, (tsks) => {
          setTasks(tsks);
          checkLoaded();
        })
      : () => { checkLoaded(); };
    const u3 = subscribeMeetings((mts) => {
      setMeetings(mts);
      checkLoaded();
    });

    return () => { u1(); u2(); u3(); };
  }, [profile]);

  const upcomingEvents   = getUpcomingEvents(events).slice(0, 3);
  const pendingTasks     = tasks.filter((t) => t.status !== 'completed').slice(0, 5);
  const upcomingMeetings = getUpcomingMeetings(meetings).slice(0, 3);
  const completedTasks   = tasks.filter((t) => t.status === 'completed').length;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const stats = [
    {
      label: 'Task Score',
      value: profile?.taskScore ?? 0,
      icon: Zap,
      accentColor: '#f59e0b',
      sub: 'Cumulative score',
    },
    {
      label: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      accentColor: '#10b981',
      sub: 'Tasks done',
    },
    {
      label: 'Pending',
      value: pendingTasks.length,
      icon: ClipboardList,
      accentColor: '#3b82f6',
      sub: 'Tasks remaining',
    },
    {
      label: 'Events',
      value: upcomingEvents.length,
      icon: Calendar,
      accentColor: '#8b5cf6',
      sub: 'Upcoming',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--dash-muted)' }}>
            {isCoreMember(profile) ? 'Core Member' : 'Member'} · Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--dash-text)' }}>
            Welcome back, {profile?.firstName || profile?.displayName?.split(' ')[0]}
          </h1>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>{timeStr}</p>
          <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>{dateStr}</p>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <DataStateWrapper
        loading={loading}
        skeleton={<StatGridSkeleton count={4} columns="grid-cols-2 lg:grid-cols-4" />}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              {/* Colored top accent line */}
              <div className="stat-card-accent-bar" style={{ background: stat.accentColor }} />
              <div className="flex items-start justify-between mt-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                    {stat.label}
                  </p>
                  <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: 'var(--dash-text)' }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>{stat.sub}</p>
                </div>
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ background: stat.accentColor + '14', borderRadius: '8px' }}
                >
                  <stat.icon className="w-4.5 h-4.5" style={{ color: stat.accentColor, width: 18, height: 18 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </DataStateWrapper>

      {/* ── Content Grid ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Events Panel */}
        <div className="dash-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)', borderRadius: '6px' }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
              </div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Upcoming Events</h2>
            </div>
            <Link
              to="/dashboard/events"
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ color: 'var(--dash-accent)', textDecoration: 'none' }}
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <DataStateWrapper
            loading={loading}
            skeleton={<TaskItemSkeleton count={3} />}
          >
            {upcomingEvents.length === 0 ? (
              <div className="py-8 text-center">
                <CircleDot className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--dash-border)' }} />
                <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>No upcoming events</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-3 px-3 py-3 transition-all"
                    style={{ border: '1px solid var(--dash-border)', borderRadius: '6px', background: 'var(--dash-bg)' }}
                  >
                    <div
                      className="w-1 h-full min-h-[32px] shrink-0 mt-0.5"
                      style={{ borderRadius: '2px', background: '#8b5cf6', width: 3 }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--dash-text)' }}>{e.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3 shrink-0" style={{ color: 'var(--dash-muted)' }} />
                        <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>{e.date} · {e.startTime}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DataStateWrapper>
        </div>

        {/* Tasks Panel */}
        <div className="dash-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)', borderRadius: '6px' }}>
                <ListTodo className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
              </div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Pending Tasks</h2>
            </div>
            <Link
              to="/dashboard/tasks"
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ color: 'var(--dash-accent)', textDecoration: 'none' }}
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <DataStateWrapper
            loading={loading}
            skeleton={<TaskItemSkeleton count={3} />}
          >
            {pendingTasks.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#10b981' }} />
                <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>All caught up!</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {pendingTasks.map((t) => {
                  const pri = PRIORITY_CONFIG[t.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2.5 transition-all"
                      style={{ border: '1px solid var(--dash-border)', borderRadius: '6px', background: 'var(--dash-bg)' }}
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: pri.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--dash-text)' }}>{t.title}</p>
                        <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>Due: {t.deadline}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide shrink-0"
                        style={{ color: pri.color, background: pri.bg, border: `1px solid ${pri.border}`, borderRadius: '4px' }}
                      >
                        {pri.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DataStateWrapper>
        </div>
      </div>

      {/* ── Meetings Panel ── */}
      {upcomingMeetings.length > 0 && (
        <div className="dash-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', borderRadius: '6px' }}>
              <Users className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Upcoming Meetings</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {upcomingMeetings.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 p-3"
                style={{ border: '1px solid var(--dash-border)', borderRadius: '6px', background: 'var(--dash-bg)' }}
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>{m.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3" style={{ color: 'var(--dash-muted)' }} />
                    <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>{m.date} · {m.time}</p>
                  </div>
                </div>
                {m.link && (
                  <a
                    href={m.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold px-3 py-1.5 text-center transition-all"
                    style={{
                      color: '#10b981',
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: '5px',
                      textDecoration: 'none',
                    }}
                  >
                    Join Meeting →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Progress Summary ── */}
      {tasks.length > 0 && (
        <div className="dash-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '6px' }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
              </div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>Task Completion</h2>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--dash-muted)' }}>
              {completedTasks} / {tasks.length}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--dash-border)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%`,
                background: 'var(--dash-accent)',
                borderRadius: '999px',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--dash-muted)' }}>
            {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}% complete
          </p>
        </div>
      )}
    </div>
  );
}
