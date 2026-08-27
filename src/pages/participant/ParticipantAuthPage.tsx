import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Sparkles, UserRound, Mail } from 'lucide-react';
import { signInParticipant, signUpParticipant } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

type Flow = 'login' | 'signup';

export default function ParticipantAuthPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [flow, setFlow] = useState<Flow>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const registration = sessionStorage.getItem('saint-participant-registration');
    if (!registration) return;
    try {
      const saved = JSON.parse(registration) as { name?: string; email?: string };
      setName((current) => current || saved.name || '');
      setRegistrationEmail((current) => current || saved.email || '');
    } catch {
      /* optional registration handoff */
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && profile?.role === 'participant') {
      navigate('/participant', { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      if (flow === 'signup') {
        await signUpParticipant({ username, password, name, registrationEmail });
        sessionStorage.removeItem('saint-participant-registration');
        await refreshProfile();
      } else {
        await signInParticipant(username, password);
      }
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from?.startsWith('/participant') ? from : '/participant', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not complete that request.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="participant-auth-shell">
      <div className="participant-auth-noise" aria-hidden="true" />
      <section className="participant-auth-intro">
        <Link to="/" className="participant-back">
          <ArrowLeft size={16} /> SAInT
        </Link>
        <div className="participant-brand-mark">
          <Sparkles size={28} />
        </div>
        <p className="participant-kicker">PARTICIPANT SPACE</p>
        <h1>
          Your event world,<br />
          <em>all in one pass.</em>
        </h1>
        <p>Tickets, live QR codes, team rosters, and certificates — designed exclusively for people taking part.</p>
        <div className="participant-auth-points">
          <span>01 / YOUR PASSES</span>
          <span>02 / YOUR TEAM</span>
          <span>03 / DIGITAL CERTS</span>
        </div>
      </section>

      <section className="participant-auth-card-wrap">
        <div className="participant-auth-card">
          <div className="participant-auth-switch" aria-label="Account action">
            <button
              className={flow === 'login' ? 'active' : ''}
              onClick={() => {
                setFlow('login');
                setError('');
              }}
            >
              Log in
            </button>
            <button
              className={flow === 'signup' ? 'active' : ''}
              onClick={() => {
                setFlow('signup');
                setError('');
              }}
            >
              Sign up
            </button>
          </div>

          <div className="participant-form-heading">
            <p>{flow === 'login' ? 'WELCOME BACK' : 'FIRST TIME HERE'}</p>
            <h2>{flow === 'login' ? 'Pick up where you left off.' : 'Create your participant pass.'}</h2>
          </div>

          {error && <div className="participant-form-error">{error}</div>}

          <form onSubmit={submit} className="participant-form">
            {flow === 'signup' && (
              <>
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
                <label>
                  Registration email
                  <div className="participant-input-icon">
                    <Mail size={16} />
                    <input
                      value={registrationEmail}
                      onChange={(e) => setRegistrationEmail(e.target.value)}
                      required
                      type="email"
                      placeholder="Email used when registering"
                      autoComplete="email"
                    />
                  </div>
                </label>
              </>
            )}

            <label>
              Username
              <div className="participant-input-icon">
                <UserRound size={16} />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. arya.codes"
                  autoCapitalize="none"
                  autoComplete="username"
                />
              </div>
            </label>

            <label>
              Password
              <div className="participant-input-icon">
                <Lock size={16} />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  placeholder="At least 6 characters"
                  autoComplete={flow === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label="Show password"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {flow === 'signup' && (
              <p className="participant-form-note">
                <KeyRound size={14} /> No Google account needed. Your username is your sign-in ID.
              </p>
            )}

            <button className="participant-submit" disabled={pending} type="submit">
              {pending
                ? 'Preparing your space…'
                : flow === 'login'
                ? 'Enter participant space'
                : 'Create my participant account'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="participant-main-login">
            Committee member? <Link to="/login">Use the main login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
