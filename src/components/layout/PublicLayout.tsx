import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { to: '/#home', label: 'Home' },
    { to: '/#events', label: 'Events' },
    { to: '/about', label: 'About' },
    { to: '/activities', label: 'Activities' },
    { to: '/apply', label: 'Apply' },
  ];

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg-primary)' }}>
      <div className="public-bg-blobs" aria-hidden="true">
        <div className="public-liquid-blob-1" />
        <div className="public-liquid-blob-2" />
        <div className="public-liquid-blob-3" />
      </div>

      <header
        className={`public-header fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''}`}
        style={{ background: 'var(--bg-primary)', borderBottom: scrolled ? '1px solid var(--border-color)' : '1px solid transparent' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18 py-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
                {logoUnavailable ? (
                  <span className="text-xs font-bold text-blue-600">SAInT</span>
                ) : (
                  <img src="/images/saint-logo.jpg" alt="SAInT logo" className="w-full h-full object-contain p-1" onError={() => setLogoUnavailable(true)} />
                )}
              </div>
              <div>
                <span className="text-xl font-bold text-blue-800 block leading-tight">SAInT</span>
                <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">
                  Student Association of IT
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className="btn-ghost">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="btn-outline !py-2 !px-4">
                Login
              </Link>
              <Link to="/login?mode=signup" className="btn-primary !py-2 !px-4">
                Sign Up
              </Link>
            </div>

            <button
              className="md:hidden p-2 rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ color: 'var(--text-primary)' }}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t px-4 py-4 space-y-2" style={{ borderColor: 'var(--border-color)', background: 'var(--nav-bg)' }}>
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="block px-4 py-2.5 rounded-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="btn-outline flex-1 text-center">Login</Link>
              <Link to="/login?mode=signup" className="btn-primary flex-1 text-center">Sign Up</Link>
            </div>
          </div>
        )}
      </header>

      <main className="pt-20 relative z-10">
        <Outlet />
      </main>

      <footer className="public-footer border-t mt-16 relative z-10" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                  {logoUnavailable ? (
                    <span className="text-[10px] font-bold text-blue-600">SAInT</span>
                  ) : (
                    <img src="/images/saint-logo.jpg" alt="SAInT logo" className="w-full h-full object-contain p-1" onError={() => setLogoUnavailable(true)} />
                  )}
                </div>
                <span className="text-lg font-bold text-blue-800">SAInT</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Student Association of Information Technology — JSPM&apos;s Rajarshi Shahu College of Engineering, IT Department.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-blue-800">Quick Links</h4>
              <div className="space-y-2">
                {navLinks.map((l) => (
                  <Link key={l.to} to={l.to} className="block text-sm hover:text-blue-600 transition-colors" style={{ color: 'var(--text-muted)' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-blue-800">Contact</h4>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                JSPM&apos;s RSCOE, IT Department<br />
                Pune, Maharashtra
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} SAInT — Student Association of Information Technology. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
