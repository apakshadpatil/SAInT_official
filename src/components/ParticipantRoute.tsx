import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/authService';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function ParticipantRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const [retried, setRetried] = useState(false);

  // Self-heal / refresh if participant profile is momentarily missing or pending
  useEffect(() => {
    if (!loading && user && (!profile || profile.role === 'pending') && !retried) {
      setRetried(true);
      void refreshProfile();
    }
  }, [loading, user, profile, retried, refreshProfile]);

  if (loading) {
    return <div className="participant-loading"><span /></div>;
  }
  if (!user) return <Navigate to="/participant-auth" state={{ from: location }} replace />;

  const isInternalParticipant = Boolean(
    user.email?.toLowerCase().includes('.saint.local') || profile?.participantUsername
  );

  // If still resolving profile for a participant account, show loading briefly
  if (!profile && isInternalParticipant) {
    return <div className="participant-loading"><span /></div>;
  }

  // If user is pending approval on the main club portal (and not a participant account), send to pending-approval
  if (profile?.status === 'pending' && !isInternalParticipant && profile.role !== 'superadmin') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (profile?.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#080811] text-slate-100">
        <div className="w-full max-w-md p-8 rounded-2xl bg-[#0f111c] border border-red-500/30 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center border border-red-500/20">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Participant Access Revoked</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Your participant account access has been revoked by an administrator. You currently do not have permission to view your passes or event details.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            If you believe this is an error or need access restored, please contact the SAInT administrative committee.
          </p>
          <button
            onClick={() => void logoutUser()}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
