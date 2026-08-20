import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types';
import { subscribeToAuth, getUserProfile, ensureUserProfile, updateUserPresenceStatus } from '../services/authService';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (firebaseUser: User) => {
    try {
      let p = await getUserProfile(firebaseUser.uid);
      if (!p) p = await ensureUserProfile(firebaseUser);
      setProfile(p);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user);
  };

  useEffect(() => {
    const unsub = subscribeToAuth(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const syncPresence = async (isOnline: boolean) => {
      try {
        await updateUserPresenceStatus(uid, isOnline);
        setProfile((current) => (current ? { ...current, isOnline, lastSeen: new Date().toISOString() } : current));
      } catch (err) {
        console.error('Failed to update presence', err);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void syncPresence(false);
      } else {
        void syncPresence(true);
      }
    };

    const handleBeforeUnload = () => {
      void syncPresence(false);
    };

    void syncPresence(true);
    heartbeat = setInterval(() => {
      void syncPresence(true);
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void syncPresence(false);
    };
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
