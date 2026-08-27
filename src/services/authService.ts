
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db, SUPERADMIN_EMAIL } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { UserProfile, UserRole, SidebarPermissions } from '../types';
import {
  DEFAULT_CORE_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  DEFAULT_SUPERADMIN_PERMISSIONS,
} from '../types';

function now() {
  return new Date().toISOString();
}

function getDefaultPermissions(role: UserRole): SidebarPermissions {
  if (role === 'superadmin') return { ...DEFAULT_SUPERADMIN_PERMISSIONS };
  if (role === 'core') return { ...DEFAULT_CORE_PERMISSIONS };
  return { ...DEFAULT_MEMBER_PERMISSIONS };
}

function resolveRole(email: string): UserRole {
  if (SUPERADMIN_EMAIL && email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
    return 'superadmin';
  }
  return 'pending';
}

function participantAuthEmail(username: string) {
  return `participant.${username.toLowerCase()}@accounts.saint.local`;
}

export function normalizeParticipantUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

export function isParticipantProfile(profile: UserProfile | null | undefined) {
  return profile?.role === 'participant';
}

async function getSuperadminProfile(): Promise<UserProfile | null> {
  const users = await getAllUsers();
  return users.find(
    (user) => user.role === 'superadmin' || (SUPERADMIN_EMAIL && user.email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase())
  ) ?? null;
}

async function ensureCurrentUserFollowsSuperadmin(user: UserProfile) {
  const superadmin = await getSuperadminProfile();
  if (!superadmin || user.uid === superadmin.uid) return;

  const updates: Promise<unknown>[] = [];
  if (!user.following.includes(superadmin.uid)) {
    updates.push(updateDoc(doc(db, 'users', user.uid), {
      following: [...user.following, superadmin.uid],
      updatedAt: now(),
    }));
  }

  if (!superadmin.followers.includes(user.uid)) {
    updates.push(updateDoc(doc(db, 'users', superadmin.uid), {
      followers: [...superadmin.followers, user.uid],
      updatedAt: now(),
    }));
  }

  await Promise.allSettled(updates);
}

async function ensureAllUsersFollowSuperadmin() {
  const superadmin = await getSuperadminProfile();
  if (!superadmin) return;

  const users = await getAllUsers();
  const superadminFollowers = new Set(superadmin.followers || []);
  const updates: Promise<unknown>[] = [];

  users.forEach((user) => {
    if (user.uid === superadmin.uid) return;
    if (!user.following.includes(superadmin.uid)) {
      updates.push(updateDoc(doc(db, 'users', user.uid), {
        following: [...user.following, superadmin.uid],
        updatedAt: now(),
      }));
    }
    superadminFollowers.add(user.uid);
  });

  const followerArray = Array.from(superadminFollowers);
  if (followerArray.length !== superadmin.followers.length) {
    updates.push(updateDoc(doc(db, 'users', superadmin.uid), {
      followers: followerArray,
      updatedAt: now(),
    }));
  }

  await Promise.allSettled(updates);
}

import { logActivity } from './activityService';

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const profile = await ensureUserProfile(result.user);
  if (profile.role === 'superadmin') {
    await ensureAllUsersFollowSuperadmin();
  } else if (profile.status === 'approved') {
    await ensureCurrentUserFollowsSuperadmin(profile);
  }
  await logActivity(profile.uid, profile.displayName, profile.email, 'login', 'Logged in via Google OAuth');
  return result.user;
}

export async function signInWithEmail(email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  const profile = await ensureUserProfile(result.user);
  if (profile.role === 'superadmin') {
    await ensureAllUsersFollowSuperadmin();
  } else if (profile.status === 'approved') {
    await ensureCurrentUserFollowsSuperadmin(profile);
  }
  await logActivity(profile.uid, profile.displayName, profile.email, 'login', 'Logged in via Email credentials');
  return result.user;
}

export async function signUpWithEmail(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const profile = await ensureUserProfile(result.user);
  await logActivity(profile.uid, profile.displayName, profile.email, 'register', 'Registered a new account');
  return result.user;
}

/**
 * Participant credentials intentionally use a private Firebase email derived from
 * the username. The contact email is stored in the profile and matched to tickets.
 */
export async function signUpParticipant(data: {
  username: string;
  password: string;
  name: string;
  registrationEmail: string;
}) {
  const username = normalizeParticipantUsername(data.username);
  if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username)) {
    throw new Error('Choose 3–30 characters: letters, numbers, dots, underscores, or hyphens.');
  }
  const registrationEmail = data.registrationEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(registrationEmail)) {
    throw new Error('Enter the email address used for your event registration.');
  }

  await setPersistence(auth, browserLocalPersistence);
  const result = await createUserWithEmailAndPassword(auth, participantAuthEmail(username), data.password);
  const baseProfile = await ensureUserProfile(result.user);
  const [firstName, ...rest] = data.name.trim().split(/\s+/);
  const profile: UserProfile = {
    ...baseProfile,
    email: participantAuthEmail(username),
    firstName: firstName || username,
    lastName: rest.join(' '),
    displayName: data.name.trim() || username,
    role: 'participant',
    status: 'approved',
    participantUsername: username,
    participantEmail: registrationEmail,
    permissions: getDefaultPermissions('participant'),
    updatedAt: now(),
  };
  await setDoc(doc(db, 'users', result.user.uid), profile);
  setCachedData(`user:${result.user.uid}`, profile);
  invalidateCache('users:');
  await logActivity(profile.uid, profile.displayName, registrationEmail, 'register', 'Registered a participant account');
  return result.user;
}

export async function signInParticipant(username: string, password: string) {
  const normalized = normalizeParticipantUsername(username);
  if (!normalized) throw new Error('Enter your participant username.');
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, participantAuthEmail(normalized), password);
  const profile = await ensureUserProfile(result.user);
  if (profile.role !== 'participant') {
    await signOut(auth);
    throw new Error('This is not a participant account. Please use your email on the main login.');
  }
  await logActivity(profile.uid, profile.displayName, profile.participantEmail || profile.email, 'login', 'Logged in to participant portal');
  return result.user;
}

export async function logoutUser() {
  const user = auth.currentUser;
  if (user) {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      await logActivity(profile.uid, profile.displayName, profile.email, 'logout', 'Logged out of session');
      await updateUserPresenceStatus(user.uid, false);
    }
  }
  await signOut(auth);
}

export async function getUserProfile(uid: string, forceRefresh = false): Promise<UserProfile | null> {
  return cachedFetch<UserProfile | null>(
    `user:${uid}`,
    async () => {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      return snap.data() as UserProfile;
    },
    {
      ttlMs: 120 * 1000,
      resource: 'users',
      action: 'get_user_profile',
      forceRefresh,
    }
  );
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const email = user.email || '';
  const role = resolveRole(email);
  const isSuper = role === 'superadmin';

  const profile: UserProfile = {
    uid: user.uid,
    email,
    firstName: user.displayName?.split(' ')[0] || '',
    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
    displayName: user.displayName || email.split('@')[0],
    photoURL: user.photoURL || null,
    role,
    status: isSuper ? 'approved' : 'pending',
    teamIds: [],
    teamNames: [],
    hasFinanceAccess: isSuper,
    permissions: getDefaultPermissions(role),
    taskScore: 0,
    completedTaskCount: 0,
    following: [],
    followers: [],
    isOnline: false,
    lastSeen: now(),
    createdAt: now(),
    updatedAt: now(),
  };

  await setDoc(doc(db, 'users', user.uid), profile);
  setCachedData(`user:${user.uid}`, profile);
  invalidateCache('users:');
  trackDBOperation({ operation: 'write', action: 'create_user_profile', resource: 'users', documentCount: 1 });
  return profile;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: now() });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'update_user_profile', resource: 'users', documentCount: 1 });
}

export async function updateUserPresenceStatus(uid: string, isOnline: boolean) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), { isOnline, lastSeen: now(), updatedAt: now() });
  } catch {}
}

export async function completeProfileSetup(
  uid: string,
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    description: string;
    batchYear: string;
    photoURL?: string;
    coreTeamName?: string;
    coreTeamDescription?: string;
  }
) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    displayName: `${data.firstName} ${data.lastName}`.trim(),
    updatedAt: now(),
  });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'complete_profile_setup', resource: 'users', documentCount: 1 });
}

export async function approveUser(uid: string, role: 'member' | 'core', approverUid: string) {
  const permissions = role === 'core' ? getDefaultPermissions('core') : getDefaultPermissions('member');
  await updateDoc(doc(db, 'users', uid), {
    role,
    status: 'approved',
    permissions,
    updatedAt: now(),
    approvedBy: approverUid,
    approvedAt: now(),
  });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'approve_user', resource: 'users', documentCount: 1 });

  const userProfile = await getUserProfile(uid);
  if (userProfile) {
    await ensureCurrentUserFollowsSuperadmin(userProfile);
  }
}

export async function rejectUser(uid: string) {
  await updateDoc(doc(db, 'users', uid), {
    status: 'rejected',
    updatedAt: now(),
  });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'reject_user', resource: 'users', documentCount: 1 });
}

export async function removeUser(uid: string) {
  await updateDoc(doc(db, 'users', uid), {
    status: 'rejected',
    role: 'pending',
    updatedAt: now(),
  });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'remove_user', resource: 'users', documentCount: 1 });
}

export async function updateUserRole(uid: string, role: Exclude<UserRole, 'pending'>) {
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error('User not found');

  const permissions = getDefaultPermissions(role);
  const updates: Partial<UserProfile> = {
    role,
    permissions,
    hasFinanceAccess: role === 'superadmin' ? true : profile.hasFinanceAccess,
    updatedAt: now(),
  };

  await updateDoc(doc(db, 'users', uid), updates);
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'update_user_role', resource: 'users', documentCount: 1 });
}

export async function updateUserPermissions(
  uid: string,
  permissions: Partial<SidebarPermissions>,
  extras?: Partial<UserProfile>
) {
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error('User not found');
  await updateDoc(doc(db, 'users', uid), {
    permissions: { ...profile.permissions, ...permissions },
    ...extras,
    updatedAt: now(),
  });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'update_user_permissions', resource: 'users', documentCount: 1 });
}

export async function followUser(currentUid: string, targetUid: string) {
  const current = await getUserProfile(currentUid);
  const target = await getUserProfile(targetUid);
  if (!current || !target) throw new Error('User not found');
  if (currentUid === targetUid) return;

  const following = current.following.includes(targetUid)
    ? current.following
    : [...current.following, targetUid];
  const followers = target.followers.includes(currentUid)
    ? target.followers
    : [...target.followers, currentUid];
  await updateDoc(doc(db, 'users', currentUid), { following, updatedAt: now() });
  await updateDoc(doc(db, 'users', targetUid), { followers, updatedAt: now() });
  invalidateCache(`user:${currentUid}`);
  invalidateCache(`user:${targetUid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'follow_user', resource: 'users', documentCount: 2 });
}

export async function unfollowUser(currentUid: string, targetUid: string) {
  const current = await getUserProfile(currentUid);
  const target = await getUserProfile(targetUid);
  if (!current || !target) return;

  await updateDoc(doc(db, 'users', currentUid), {
    following: current.following.filter((id) => id !== targetUid),
    updatedAt: now(),
  });
  await updateDoc(doc(db, 'users', targetUid), {
    followers: target.followers.filter((id) => id !== currentUid),
    updatedAt: now(),
  });
  invalidateCache(`user:${currentUid}`);
  invalidateCache(`user:${targetUid}`);
  invalidateCache('users:');
  trackDBOperation({ operation: 'update', action: 'unfollow_user', resource: 'users', documentCount: 2 });
}

export async function getAllUsers(forceRefresh = false): Promise<UserProfile[]> {
  return cachedFetch<UserProfile[]>(
    'users:all',
    async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const users = snap.docs.map((d) => {
          const data = d.data() as UserProfile;
          return { ...data, uid: d.id };
        });
        return users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        console.warn('getAllUsers error:', err);
        return [];
      }
    },
    {
      ttlMs: 30 * 1000,
      resource: 'users',
      action: 'get_all_users',
      forceRefresh,
    }
  );
}

export async function getPendingUsers(forceRefresh = false): Promise<UserProfile[]> {
  return cachedFetch<UserProfile[]>(
    'users:pending',
    async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))
        );
        return snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => u.role !== 'superadmin');
      } catch {
        const users = await getAllUsers(forceRefresh);
        return users.filter((u) => u.status === 'pending' && u.role !== 'superadmin');
      }
    },
    {
      ttlMs: 45 * 1000,
      resource: 'users',
      action: 'get_pending_users',
      forceRefresh,
    }
  );
}

export async function getParticipantUsers(forceRefresh = false): Promise<UserProfile[]> {
  return cachedFetch<UserProfile[]>(
    'users:participants',
    async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'participant'), orderBy('createdAt', 'desc'))
        );
        return snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id }));
      } catch {
        const users = await getAllUsers(forceRefresh);
        return users.filter((u) => u.role === 'participant' || Boolean(u.participantUsername));
      }
    },
    {
      ttlMs: 30 * 1000,
      resource: 'users',
      action: 'get_participant_users',
      forceRefresh,
    }
  );
}

export async function updateParticipantAccount(
  uid: string,
  updates: Partial<UserProfile>
) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    ...updates,
    updatedAt: now(),
  });
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  invalidateCache('users:participants');
  trackDBOperation({ operation: 'update', action: 'update_participant_account', resource: 'users', documentCount: 1 });
}

export async function deleteParticipantAccount(uid: string) {
  const ref = doc(db, 'users', uid);
  await deleteDoc(ref);
  invalidateCache(`user:${uid}`);
  invalidateCache('users:');
  invalidateCache('users:participants');
  trackDBOperation({ operation: 'delete', action: 'delete_participant_account', resource: 'users', documentCount: 1 });
}

export async function createParticipantAccountAdmin(data: {
  username: string;
  name: string;
  registrationEmail: string;
  status?: 'approved' | 'rejected' | 'pending';
}) {
  const username = normalizeParticipantUsername(data.username);
  if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username)) {
    throw new Error('Choose 3–30 characters: letters, numbers, dots, underscores, or hyphens.');
  }
  const email = data.registrationEmail.trim().toLowerCase();
  const [firstName, ...rest] = data.name.trim().split(/\s+/);
  const uid = `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const profile: UserProfile = {
    uid,
    email: participantAuthEmail(username),
    firstName: firstName || username,
    lastName: rest.join(' '),
    displayName: data.name.trim() || username,
    role: 'participant',
    status: data.status || 'approved',
    participantUsername: username,
    participantEmail: email,
    teamIds: [],
    teamNames: [],
    hasFinanceAccess: false,
    taskScore: 0,
    completedTaskCount: 0,
    permissions: getDefaultPermissions('participant'),
    followers: [],
    following: [],
    isOnline: false,
    createdAt: now(),
    updatedAt: now(),
  };

  await setDoc(doc(db, 'users', uid), profile);
  invalidateCache('users:');
  invalidateCache('users:participants');
  trackDBOperation({ operation: 'write', action: 'create_participant_admin', resource: 'users', documentCount: 1 });
  return profile;
}
