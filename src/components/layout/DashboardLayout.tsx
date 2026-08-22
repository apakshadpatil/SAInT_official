import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, ListTodo, Users, QrCode,
  User, LogOut, Moon, Sun, BarChart3, FileText, Wallet, PieChart,
  Settings, Shield, UserCheck, KeyRound, Menu, X, ClipboardList,
  Upload, Activity, FileCheck, Briefcase, Trophy, Archive, ImagePlus,
  ChevronRight, Zap, Database, Server, Globe,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { logoutUser } from '../../services/authService';
import { getApplications, subscribeSiteSettings, setDoomsdayMode } from '../../services/applicationService';
import { getPublishedUpcomingEvents } from '../../services/eventService';
import { getTasksForUser } from '../../services/taskService';
import { getPendingUsers } from '../../services/authService';
import { trackVisitorPageView } from '../../services/visitorTrackingService';
import {
  hasTabAccess, hasFinanceAccess, isCoreMember, isSuperAdmin, getRoleBadge,
} from '../../utils/permissions';
import type { SidebarPermissions } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  tab: keyof SidebarPermissions;
  financeOnly?: boolean;
  superOnly?: boolean;
  coreOnly?: boolean;
  settingsGroup?: boolean;
  group?: 'main' | 'management' | 'finance' | 'settings';
}

const ALL_NAV: NavItem[] = [
  { to: '/dashboard',                        label: 'Dashboard',             icon: LayoutDashboard, tab: 'dashboard',          group: 'main' },
  { to: '/dashboard/events',                 label: 'Events',                icon: Calendar,        tab: 'events',             group: 'main' },
  { to: '/dashboard/calendar',               label: 'Calendar',              icon: CalendarDays,    tab: 'calendar',           group: 'main' },
  { to: '/dashboard/agenda',                 label: 'Agenda',                icon: ClipboardList,   tab: 'agenda',             group: 'main' },
  { to: '/dashboard/tasks',                  label: 'Tasks',                 icon: ListTodo,        tab: 'tasks',              group: 'main' },
  { to: '/dashboard/explore',                label: 'Explore',               icon: Users,           tab: 'explore',            group: 'main' },
  { to: '/dashboard/qr-scanner',            label: 'QR Scanner',            icon: QrCode,          tab: 'qrScanner',          group: 'main' },
  { to: '/dashboard/analytics',             label: 'Analytics Hub',         icon: BarChart3,       tab: 'analytics',          group: 'management' },
  { to: '/dashboard/teams',                 label: 'Manage Teams',          icon: Users,           tab: 'teams',              group: 'management' },
  { to: '/dashboard/files',                 label: 'Upload Files',          icon: Upload,          tab: 'files',              group: 'management' },
  { to: '/dashboard/documentation',         label: 'Documentation',         icon: FileText,        tab: 'documentation',      group: 'management' },
  { to: '/dashboard/manage-applications',   label: 'Applications',          icon: FileCheck,       tab: 'manageApplications', group: 'management' },
  { to: '/dashboard/archived-applications', label: 'Archived Applications', icon: Archive,         tab: 'manageApplications', group: 'management' },
  { to: '/dashboard/interview-panels',      label: 'Interview Panels',      icon: Briefcase,       tab: 'interviewPanels',    group: 'management' },
  { to: '/dashboard/gd-panels',             label: 'GD Panels',             icon: Users,           tab: 'gdPanels',           group: 'management' },
  { to: '/dashboard/winners',               label: 'Winners',               icon: Trophy,          tab: 'events',             coreOnly: true,     group: 'management' },
  { to: '/dashboard/interview-allocations', label: 'Final Allocations',     icon: Trophy,          tab: 'interviewPanels',    group: 'management' },
  { to: '/dashboard/finance',              label: 'Manage Financials',     icon: Wallet,          tab: 'finance',            financeOnly: true, group: 'finance' },
  { to: '/dashboard/financial-analytics',  label: 'Financial Analytics',   icon: PieChart,        tab: 'financialAnalytics', financeOnly: true, group: 'finance' },
  { to: '/dashboard/system-stats',         label: 'System Stats',          icon: Database,        tab: 'systemStats',        superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/deployment-stats',     label: 'Deployment Stats',      icon: Server,          tab: 'deploymentStats',    superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/user-interactions',    label: 'User Interactions',     icon: Globe,           tab: 'userInteractions',   superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/monitor-activity',     label: 'Monitor Activity',      icon: Activity,        tab: 'monitorActivity',    superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/control-centre',       label: 'Control Centre',        icon: Settings,        tab: 'controlCentre',      superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/positions',            label: 'Positions',             icon: Shield,          tab: 'positions',          superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/user-approvals',       label: 'User Approvals',        icon: UserCheck,       tab: 'userApprovals',      superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/access-control',       label: 'Access Control',        icon: KeyRound,        tab: 'accessControl',      superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/home-images',           label: 'Landing Images',        icon: ImagePlus,       tab: 'homeImages',         superOnly: true,   group: 'settings', settingsGroup: true },
  { to: '/dashboard/profile',              label: 'Profile',               icon: User,            tab: 'profile' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   GROUP LABELS
───────────────────────────────────────────────────────────────────────────── */
const GROUP_LABELS: Record<string, string> = {
  main: 'Main',
  management: 'Management',
  finance: 'Finance',
  settings: 'Admin',
};

/* ─────────────────────────────────────────────────────────────────────────────
   SidebarNav — defined OUTSIDE DashboardLayout so React never unmounts/remounts
   it on route changes, preserving scroll position.
───────────────────────────────────────────────────────────────────────────── */
interface SidebarNavProps {
  navItems: NavItem[];
  currentPath: string;
  theme: string;
  profile: ReturnType<typeof useAuth>['profile'];
  isSuperAdminUser?: boolean;
  doomsdayMode?: boolean;
  onToggleDoomsday?: () => void;
  badges?: Record<string, number>;
  onLinkClick?: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
}

function SidebarNav({
  navItems,
  currentPath,
  theme,
  profile,
  isSuperAdminUser = false,
  doomsdayMode = false,
  onToggleDoomsday,
  badges = {},
  onLinkClick,
  onLogout,
  onToggleTheme,
}: SidebarNavProps) {
  const navRef = useRef<HTMLElement>(null);

  const isActive = (path: string) => {
    if (path === '/dashboard') return currentPath === '/dashboard';
    return currentPath.startsWith(path);
  };

  // Group nav items (exclude profile which has no group)
  const itemsWithGroup = navItems.filter((i) => i.group);
  const groupOrder: Array<NavItem['group']> = ['main', 'management', 'finance', 'settings'];
  const grouped = groupOrder.reduce<Record<string, NavItem[]>>((acc, g) => {
    const items = itemsWithGroup.filter((i) => i.group === g);
    if (items.length) acc[g!] = items;
    return acc;
  }, {});

  const accentColor = 'var(--dash-accent)';
  const accentAlt   = 'var(--dash-accent)';

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo / Brand ── */}
      <div className="shrink-0 px-5 py-5" style={{ borderBottom: '1px solid var(--dash-sidebar-border)' }}>
        <Link
          to="/dashboard"
          onClick={onLinkClick}
          className="flex items-center gap-3 group"
          style={{ textDecoration: 'none' }}
        >
          {/* Super admin: no logo image — clean text-only brand mark */}
          {isSuperAdminUser ? (
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: accentColor, borderRadius: '6px' }}
            >
              <span className="text-white text-[10px] font-black tracking-wide">SA</span>
            </div>
          ) : (
            <div
              className="w-8 h-8 flex items-center justify-center relative overflow-hidden shrink-0"
              style={{ background: accentColor, borderRadius: '6px' }}
            >
              <span className="text-white text-xs font-black z-10 relative">S</span>
              <img
                src="/images/saint-logo.jpg"
                alt="SAInT"
                className="absolute inset-0 z-20 w-full h-full object-contain p-0.5"
                onError={(e) => e.currentTarget.remove()}
              />
            </div>
          )}
          <div className="leading-tight">
            <span
              className="font-bold text-sm block"
              style={{ color: 'var(--dash-text)' }}
            >
              {isSuperAdminUser ? 'SAInT Admin' : 'SAInT'}
            </span>
            <span
              className="text-[10px] font-medium uppercase tracking-widest"
              style={{ color: isSuperAdminUser ? accentAlt : 'var(--dash-muted)' }}
            >
              {isSuperAdminUser ? 'Super Admin Panel' : 'Dashboard'}
            </span>
          </div>
        </Link>
      </div>

      {/* ── Scrollable Nav ── */}
      <nav
        ref={navRef}
        className="flex-1 overflow-y-auto min-h-0 px-2 py-3"
        style={{ overflowY: 'auto', scrollbarWidth: 'none' }}
      >
        {Object.entries(grouped).map(([groupKey, items]) => (
          <div key={groupKey} className="mb-1">
            <div className="sidebar-section-label">
              {GROUP_LABELS[groupKey]}
            </div>
            {items.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              const badgeCount = badges[to] || 0;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onLinkClick}
                  className={`sidebar-nav-item${active ? ' active' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: active ? accentColor : 'var(--dash-muted)' }}
                  />
                  <span className="truncate flex-1 text-[13px]">{label}</span>
                  {badgeCount > 0 && (
                    <span
                      className="ml-auto text-[10px] font-bold text-white px-1.5 py-0.5 leading-none"
                      style={{ background: accentColor, borderRadius: '4px' }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom Section ── */}
      <div
        className="shrink-0 px-2 py-3 space-y-1"
        style={{ borderTop: '1px solid var(--dash-sidebar-border)' }}
      >
        {/* Superadmin Doomsday Mode Toggle */}
        {isSuperAdminUser && (
          <button
            onClick={onToggleDoomsday}
            className="sidebar-nav-item w-full flex items-center justify-between transition-all"
            style={{
              background: doomsdayMode ? 'rgba(16,185,129,0.15)' : 'transparent',
              border: doomsdayMode ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
              borderRadius: '8px',
            }}
          >
            <div className="flex items-center gap-2">
              <Zap
                className={`w-4 h-4 shrink-0 ${doomsdayMode ? 'text-emerald-400 animate-pulse' : ''}`}
                style={{ color: doomsdayMode ? '#34d399' : 'var(--dash-muted)' }}
              />
              <span
                className="text-[13px] font-semibold"
                style={{ color: doomsdayMode ? '#34d399' : 'var(--dash-text)' }}
              >
                Doomsday Mode
              </span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                doomsdayMode
                  ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-700/50 text-slate-400'
              }`}
            >
              {doomsdayMode ? 'ON' : 'OFF'}
            </span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="sidebar-nav-item w-full"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 shrink-0" style={{ color: 'var(--dash-muted)' }} />
            : <Moon className="w-4 h-4 shrink-0" style={{ color: 'var(--dash-muted)' }} />
          }
          <span className="text-[13px]">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Sign Out */}
        <button
          onClick={onLogout}
          className="sidebar-nav-item w-full"
        >
          <LogOut className="w-4 h-4 shrink-0 text-red-500" />
          <span className="text-[13px] text-red-500">Sign Out</span>
        </button>

        {/* Profile card */}
        {profile && (
          <Link
            to="/dashboard/profile"
            onClick={onLinkClick}
            className="flex items-center gap-3 px-3 py-2.5 mt-1 transition-all duration-150"
            style={{
              textDecoration: 'none',
              background: 'var(--dash-hover)',
              border: '1px solid var(--dash-sidebar-border)',
              borderRadius: '8px',
            }}
          >
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt=""
                className="w-7 h-7 object-cover flex-shrink-0"
                style={{ borderRadius: '6px', border: `1.5px solid ${accentColor}` }}
              />
            ) : (
              <div
                className="w-7 h-7 flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ borderRadius: '6px', background: accentColor }}
              >
                {profile.firstName?.[0] || profile.displayName[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--dash-text)' }}>
                {profile.displayName}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--dash-muted)' }}>
                {getRoleBadge(profile)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${profile.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--dash-muted)' }} />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DashboardLayout
───────────────────────────────────────────────────────────────────────────── */
export default function DashboardLayout() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const isSuperAdminUser = isSuperAdmin(profile);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [doomsdayMode, setDoomsdayModeState] = useState(false);

  // Subscribe to site settings for real-time Doomsday mode
  useEffect(() => {
    const unsub = subscribeSiteSettings((settings) => {
      setDoomsdayModeState(Boolean(settings?.doomsdayMode));
    });
    return () => unsub();
  }, []);

  const handleToggleDoomsday = async () => {
    try {
      const nextState = !doomsdayMode;
      await setDoomsdayMode(nextState);
      setDoomsdayModeState(nextState);
      showToast(
        nextState ? '⚡ DOOMSDAY MODE ACTIVATED across SAInT site' : 'Doomsday Mode deactivated',
        nextState ? 'info' : 'info'
      );
    } catch (err) {
      showToast('Failed to toggle Doomsday Mode', 'error');
    }
  };

  // Sync super-admin attribute on <html> so CSS variable overrides apply correctly
  useEffect(() => {
    if (isSuperAdminUser) {
      document.documentElement.setAttribute('data-superadmin', 'true');
    } else {
      document.documentElement.removeAttribute('data-superadmin');
    }
    return () => { document.documentElement.removeAttribute('data-superadmin'); };
  }, [isSuperAdminUser]);

  const navItems = ALL_NAV.filter((item) => {
    if (item.to === '/dashboard/profile') return false;
    if (item.coreOnly && !isCoreMember(profile)) return false;
    if (hasTabAccess(profile, item.tab)) return true;
    if (item.superOnly && !isSuperAdmin(profile)) return false;
    if (item.financeOnly && !hasFinanceAccess(profile)) return false;
    if (
      item.tab === 'teams' ||
      item.tab === 'analytics' ||
      item.tab === 'files' ||
      item.tab === 'documentation' ||
      item.tab === 'manageApplications' ||
      item.tab === 'interviewPanels' ||
      item.tab === 'gdPanels'
    ) {
      return isCoreMember(profile);
    }
    return item.tab === 'dashboard';
  });

  useEffect(() => {
    if (!profile?.uid) {
      setNavBadges({});
      return;
    }

    let active = true;
    const isSuper = isSuperAdmin(profile);
    const isCore = isCoreMember(profile);

    const loadBadges = async () => {
      try {
        const promises: Promise<any>[] = [
          getTasksForUser(profile.uid),
          getPublishedUpcomingEvents(),
        ];

        if (isSuper) {
          promises.push(getPendingUsers());
        }
        if (isCore) {
          promises.push(getApplications());
        }

        const results = await Promise.all(promises);
        if (!active) return;

        const userTasks = results[0] || [];
        const upcomingEvents = results[1] || [];
        const pendingUsers = isSuper ? results[2] || [] : [];
        const applications = isCore ? (isSuper ? results[3] : results[2]) || [] : [];

        const nextBadges: Record<string, number> = {};
        if (pendingUsers.length > 0) nextBadges['/dashboard/user-approvals'] = pendingUsers.length;
        const pendingTaskCount = userTasks.filter((task: any) => task.status !== 'completed').length;
        if (pendingTaskCount > 0) nextBadges['/dashboard/tasks'] = pendingTaskCount;
        const submittedApps = applications.filter((app: any) => app.status === 'submitted').length;
        if (submittedApps > 0) nextBadges['/dashboard/manage-applications'] = submittedApps;
        if (upcomingEvents.length > 0) nextBadges['/dashboard/events'] = upcomingEvents.length;
        setNavBadges(nextBadges);
      } catch (err) {
        console.error('Failed to load sidebar badges', err);
      }
    };

    void loadBadges();
    const interval = window.setInterval(() => { void loadBadges(); }, 90000);
    return () => { active = false; window.clearInterval(interval); };
  }, [profile?.uid, profile?.role]);

  useEffect(() => {
    trackVisitorPageView(profile);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const sidebarProps: SidebarNavProps = {
    navItems,
    currentPath: location.pathname,
    theme,
    profile,
    isSuperAdminUser,
    doomsdayMode,
    onToggleDoomsday: handleToggleDoomsday,
    badges: navBadges,
    onLogout: handleLogout,
    onToggleTheme: toggleTheme,
  };

  // Derive a human-readable page title from the current route
  const getPageTitle = () => {
    const found = ALL_NAV.find((item) => {
      if (item.to === '/dashboard') return location.pathname === '/dashboard';
      return location.pathname.startsWith(item.to);
    });
    return found?.label ?? 'Dashboard';
  };

  return (
    <div
      className="h-screen flex overflow-hidden relative dash-scope"
      style={{ background: 'var(--dash-bg)' }}
      data-superadmin={isSuperAdminUser ? 'true' : undefined}
    >
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden lg:flex flex-col w-60 h-full shrink-0 relative z-10"
        style={{
          background: 'var(--dash-sidebar)',
          borderRight: '1px solid var(--dash-sidebar-border)',
        }}
      >
        <SidebarNav {...sidebarProps} />
      </aside>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ── Top Bar ── */}
        <header
          className="shrink-0 flex items-center justify-between px-6 py-3.5"
          style={{
            background: 'var(--dash-sidebar)',
            borderBottom: '1px solid var(--dash-sidebar-border)',
          }}
        >
          {/* Mobile hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden"
              style={{ color: 'var(--dash-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Breadcrumb */}
            <nav className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: 'var(--dash-muted)' }}>
              <span>SAInT</span>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: 'var(--dash-text)', fontWeight: 600 }}>{getPageTitle()}</span>
            </nav>

            {/* Mobile title */}
            <span className="sm:hidden font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
              {getPageTitle()}
            </span>
          </div>

          {/* Right side: role badge + online status */}
          <div className="flex items-center gap-3">
            {isSuperAdminUser && (
              <span className="superadmin-tag hidden sm:inline-flex">
                Super Admin
              </span>
            )}
            {profile && (
              <div className="flex items-center gap-2">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt=""
                    className="w-7 h-7 object-cover"
                    style={{ borderRadius: '6px' }}
                  />
                ) : (
                  <div
                    className="w-7 h-7 flex items-center justify-center text-white font-bold text-xs"
                    style={{
                      borderRadius: '6px',
                      background: isSuperAdminUser ? '#dc2626' : 'var(--dash-accent)',
                    }}
                  >
                    {profile.firstName?.[0] || profile.displayName[0]}
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold leading-none" style={{ color: 'var(--dash-text)' }}>
                    {profile.firstName || profile.displayName.split(' ')[0]}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                    <span className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>
                      {profile.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── Mobile Overlay ── */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <aside
              className="absolute left-0 top-0 bottom-0 w-60 animate-glass-slide"
              style={{
                background: 'var(--dash-sidebar)',
                borderRight: '1px solid var(--dash-sidebar-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarNav
                {...sidebarProps}
                onLinkClick={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-5 lg:p-7 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
