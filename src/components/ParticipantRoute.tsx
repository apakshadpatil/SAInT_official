import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ParticipantRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="participant-loading"><span /></div>;
  }
  if (!user) return <Navigate to="/participant-auth" state={{ from: location }} replace />;
  // Firebase's auth listener can run a moment before a new participant profile
  // is upgraded from its default pending shape. Keep the participant shell stable.
  if (!profile || (profile.role === 'pending' && user.email?.endsWith('@accounts.saint.local'))) {
    return <div className="participant-loading"><span /></div>;
  }
  if (profile?.role !== 'participant') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
