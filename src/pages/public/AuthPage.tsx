import { useState, type CSSProperties, type FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Sparkles, AlertCircle } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, logoutUser } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get('mode') === 'signup';
  const [mode, setMode] = useState<'login' | 'signup'>(isSignup ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [pointer, setPointer] = useState({ x: 50, y: 24 });
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) return;

    // Revoked users — log them out and show error
    if (profile.status === 'rejected') {
      logoutUser();
      setError('Your access has been revoked by an administrator. Please contact the admin.');
      return;
    }

    if (profile.status === 'pending' && profile.role !== 'superadmin') {
      navigate('/pending-approval');
      return;
    }

    if (!profile.firstName || !profile.batchYear) {
      navigate('/profile-setup');
      return;
    }

    navigate('/dashboard');
  }, [user, profile, authLoading, navigate]);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  };

  if (authLoading) {
    return (
      <div className="auth-page min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="auth-grid" aria-hidden="true" />
        <div className="auth-orb auth-orb-one" aria-hidden="true" />
        <div className="auth-orb auth-orb-two" aria-hidden="true" />
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin relative z-10" />
      </div>
    );
  }

  return (
    <div
      className="auth-page min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      onPointerMove={handlePointerMove}
      style={{ '--auth-x': `${pointer.x}%`, '--auth-y': `${pointer.y}%` } as CSSProperties}
    >
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

      <div className="w-full max-w-md animate-fade-in-up relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div
          className="rounded-3xl p-7 sm:p-8"
          style={{
            background: 'rgba(7, 17, 39, 0.97)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 28px 80px rgba(0, 0, 0, 0.46), 0 0 0 1px rgba(59, 130, 246, 0.08) inset',
          }}
        >
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
            >
              {logoUnavailable ? (
                <span className="text-white font-black text-xl">S</span>
              ) : (
                <img src="/images/saint-logo.jpg" alt="SAInT logo" className="w-full h-full object-contain p-1.5" onError={() => setLogoUnavailable(true)} />
              )}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-blue-300 mb-3"><Sparkles className="w-3 h-3" /> SAInT Portal</div>
            <h1 className="text-2xl font-bold text-white">
              {mode === 'login' ? 'Welcome Back' : 'Join SAInT'}
            </h1>
          </div>

          {error && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold mb-5 transition-all duration-200"
            style={{
              background: '#14203a',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: 'white',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>or use email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: '#0b1730',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    color: 'white',
                  }}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input
                  className="w-full pl-10 pr-12 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: '#0b1730',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    color: 'white',
                  }}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 10px 24px rgba(37, 99, 235, 0.24)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8, #1e3a8a)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)')}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {mode === 'login' ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
