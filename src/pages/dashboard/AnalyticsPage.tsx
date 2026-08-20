import { useEffect, useState } from 'react';
import { subscribeEvents } from '../../services/eventService';
import { subscribeAllTasks } from '../../services/taskService';
import { getAllUsers } from '../../services/authService';
import { subscribeTeams } from '../../services/teamService';
import type { EventRecord, TaskRecord, UserProfile, TeamRecord } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Award,
  Users,
  Calendar,
  CheckSquare,
  Layers,
  Zap,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);

  useEffect(() => {
    const unsubEv = subscribeEvents(setEvents);
    const unsubTk = subscribeAllTasks(setTasks);
    const unsubTm = subscribeTeams(setTeams);
    getAllUsers()
      .then((res) => {
        setUsers(res.filter((u) => u.status === 'approved' && u.role !== 'superadmin'));
      })
      .catch(console.error);

    return () => {
      unsubEv();
      unsubTk();
      unsubTm();
    };
  }, []);

  // 1. Leaderboard: Top 6 members by score
  const leaderboardData = users
    .sort((a, b) => (b.taskScore || 0) - (a.taskScore || 0))
    .slice(0, 6)
    .map((u) => ({
      name: u.displayName.split(' ')[0] || u.displayName,
      fullName: u.displayName,
      score: u.taskScore || 0,
      email: u.email,
    }));

  // 2. Task status breakdown
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.filter((t) => t.status !== 'completed').length;
  const taskStatusData = [
    { name: 'Completed Tasks', value: completedCount, color: '#10b981' },
    { name: 'Pending Tasks', value: pendingCount, color: '#3b82f6' },
  ];

  // 3. Event participation counts
  const eventParticipationData = events
    .filter((e) => e.status === 'published' || e.status === 'completed')
    .slice(0, 6)
    .map((e) => ({
      name: e.title.length > 16 ? `${e.title.slice(0, 16)}…` : e.title,
      fullName: e.title,
      Registrations: e.participantIds?.length || 0,
    }));

  // 4. Team sizes
  const teamSizesData = teams.map((t) => ({
    name: t.name.length > 14 ? `${t.name.slice(0, 14)}…` : t.name,
    fullName: t.name,
    Members: t.memberIds?.length || 0,
  }));

  const totalPointsAwarded = tasks
    .filter((t) => t.status === 'completed')
    .reduce((acc, curr) => acc + (curr.points || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Analytics & Intelligence</h1>
          <p className="page-header-sub">
            Real-time club performance metrics, member leaderboard rankings, and engagement telemetry
          </p>
        </div>
      </div>

      {/* ── Overview Metric KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Active Members',
            value: users.length,
            icon: Users,
            accent: '#3b82f6',
            sub: 'Approved contributors',
          },
          {
            label: 'Registered Teams',
            value: teams.length,
            icon: Layers,
            accent: '#8b5cf6',
            sub: 'Operational divisions',
          },
          {
            label: 'Total Events',
            value: events.length,
            icon: Calendar,
            accent: '#f59e0b',
            sub: 'Published & archived',
          },
          {
            label: 'Points Distributed',
            value: totalPointsAwarded,
            icon: Zap,
            accent: '#10b981',
            sub: 'Via completed tasks',
          },
        ].map((c) => (
          <div key={c.label} className="stat-card">
            <div className="stat-card-accent-bar" style={{ background: c.accent }} />
            <div className="flex items-start justify-between mt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                  {c.label}
                </p>
                <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: 'var(--dash-text)' }}>
                  {c.value}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--dash-muted)' }}>
                  {c.sub}
                </p>
              </div>
              <div
                className="w-9 h-9 flex items-center justify-center shrink-0"
                style={{ background: `${c.accent}18`, borderRadius: '6px' }}
              >
                <c.icon className="w-4 h-4" style={{ color: c.accent }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Leaderboard Chart */}
        <div className="dash-card" style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.12)', borderRadius: '4px' }}
              >
                <Award className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Top Member Leaderboard
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Highest cumulative task points
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '4px',
              }}
            >
              Live Ranking
            </span>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboardData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" opacity={0.6} horizontal={false} />
                <XAxis type="number" stroke="var(--dash-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--dash-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={75}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: 'var(--dash-card)',
                    borderColor: 'var(--dash-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    color: 'var(--dash-text)',
                  }}
                  formatter={(value) => [`${value} pts`, 'Score']}
                  labelFormatter={(name, payload) => payload?.[0]?.payload?.fullName || name}
                />
                <Bar dataKey="score" fill="var(--dash-accent)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Completion Status */}
        <div className="dash-card" style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center"
                style={{ background: 'rgba(16, 185, 129, 0.12)', borderRadius: '4px' }}
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Task Operations Status
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Completion ratio and backlog
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5"
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '4px',
              }}
            >
              {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}% Done
            </span>
          </div>

          <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="w-full sm:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--dash-card)',
                      borderColor: 'var(--dash-border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--dash-text)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full sm:w-1/2 flex flex-col gap-2.5">
              {taskStatusData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between p-2.5 border text-xs"
                  style={{
                    borderColor: 'var(--dash-border)',
                    background: 'var(--dash-hover)',
                    borderRadius: '4px',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                    <span style={{ color: 'var(--dash-text)' }}>{entry.name}</span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: 'var(--dash-text)' }}>
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Registrations Audit */}
        <div className="dash-card" style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center"
                style={{ background: 'rgba(139, 92, 246, 0.12)', borderRadius: '4px' }}
              >
                <Calendar className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Event Registrations Audit
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Attendee registrations per scheduled event
                </p>
              </div>
            </div>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventParticipationData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--dash-muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis stroke="var(--dash-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: 'var(--dash-card)',
                    borderColor: 'var(--dash-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--dash-text)',
                  }}
                  formatter={(value) => [`${value} attendees`, 'Registrations']}
                  labelFormatter={(name, payload) => payload?.[0]?.payload?.fullName || name}
                />
                <Bar dataKey="Registrations" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Distribution */}
        <div className="dash-card" style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center"
                style={{ background: 'rgba(59, 130, 246, 0.12)', borderRadius: '4px' }}
              >
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Team Member Distribution
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>
                  Headcount across designated functional wings
                </p>
              </div>
            </div>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamSizesData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--dash-muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis stroke="var(--dash-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: 'var(--dash-card)',
                    borderColor: 'var(--dash-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--dash-text)',
                  }}
                  formatter={(value) => [`${value} members`, 'Headcount']}
                  labelFormatter={(name, payload) => payload?.[0]?.payload?.fullName || name}
                />
                <Bar dataKey="Members" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
