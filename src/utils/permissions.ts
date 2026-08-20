import type { UserProfile, SidebarPermissions } from '../types';

export function isSuperAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'superadmin';
}

export function isCoreMember(profile: UserProfile | null): boolean {
  return profile?.role === 'core' || isSuperAdmin(profile);
}

export function isApprovedMember(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.status === 'approved' && profile.role !== 'pending';
}

export function hasFinanceAccess(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return isSuperAdmin(profile) || (isCoreMember(profile) && profile.hasFinanceAccess);
}

export function canCreateEvents(profile: UserProfile | null): boolean {
  return !!profile && profile.status === 'approved' && (profile.role === 'core' || profile.role === 'superadmin');
}

export function canEditEvents(profile: UserProfile | null): boolean {
  return !!profile && profile.status === 'approved' && (profile.role === 'core' || profile.role === 'superadmin');
}

export function canManageUsers(profile: UserProfile | null): boolean {
  return isSuperAdmin(profile);
}

export function canAssignTasks(profile: UserProfile | null): boolean {
  return isCoreMember(profile);
}

export function hasTabAccess(profile: UserProfile | null, tab: keyof SidebarPermissions): boolean {
  if (!profile) return false;
  if (isSuperAdmin(profile)) return true;
  return profile.permissions[tab] ?? false;
}

export const ROLE_LABELS: Record<string, string> = {
  pending: 'Pending Approval',
  member: 'Club Member',
  core: 'Core Team',
  superadmin: 'Super Admin',
};

export function getRoleBadge(profile: UserProfile | null): string {
  if (!profile) return '';
  if (profile.role === 'superadmin') return 'Super Admin';
  if (profile.positionTitle) return profile.positionTitle;
  if (profile.role === 'core') return profile.coreTeamName || 'Core Team';
  return 'Club Member';
}
