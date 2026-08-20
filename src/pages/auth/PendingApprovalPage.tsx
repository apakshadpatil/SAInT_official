import { Link } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { logoutUser } from '../../services/authService';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-secondary)' }}>
      <div className="card max-w-md text-center !p-10">
        <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Awaiting Approval</h2>
        <p className="text-slate-600 mb-6">
          Your account request has been sent to the super admin. You will be able to access the dashboard once approved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn-outline">Back to Home</Link>
          <button onClick={() => logoutUser()} className="btn-ghost text-red-600">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
