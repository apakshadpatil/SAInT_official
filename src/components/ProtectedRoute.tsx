import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  requireApproved?: boolean;
}

export default function ProtectedRoute({ children, requireApproved = true }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--dash-bg)' }}>
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireApproved && profile?.status === 'pending' && profile.role !== 'superadmin') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (requireApproved && profile?.status === 'rejected') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
