import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

export interface PresetAccent {
  name: string;
  hex: string;
  border: string;
}

export const PRESET_ACCENTS: PresetAccent[] = [
  { name: 'Royal Purple', hex: '#7c3aed', border: '#6d28d9' },
  { name: 'Electric Indigo', hex: '#6366f1', border: '#4f46e5' },
  { name: 'Cyber Blue', hex: '#2563eb', border: '#1d4ed8' },
  { name: 'Sky Cyan', hex: '#0284c7', border: '#0369a1' },
  { name: 'Emerald Green', hex: '#10b981', border: '#059669' },
  { name: 'Crimson Red', hex: '#ef4444', border: '#dc2626' },
  { name: 'Sunset Amber', hex: '#f59e0b', border: '#d97706' },
  { name: 'Vibrant Rose', hex: '#ec4899', border: '#db2777' },
];

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num) || c.length !== 6) return `rgba(124, 58, 237, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyAccentToDOM(color: string | null) {
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
    document.documentElement.style.setProperty('--dash-accent', color);
    document.documentElement.style.setProperty('--dash-accent-soft', hexToRgba(color, 0.12));
    document.documentElement.style.setProperty('--dash-active', hexToRgba(color, 0.14));
    document.documentElement.style.setProperty('--dash-active-text', color);
    document.documentElement.style.setProperty('--blue-500', color);
    document.documentElement.style.setProperty('--blue-600', color);
  } else {
    document.documentElement.style.removeProperty('--dash-accent');
    document.documentElement.style.removeProperty('--dash-accent-soft');
    document.documentElement.style.removeProperty('--dash-active');
    document.documentElement.style.removeProperty('--dash-active-text');
    document.documentElement.style.removeProperty('--blue-500');
    document.documentElement.style.removeProperty('--blue-600');
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  accentColor: string | null;
  setAccentColor: (color: string) => void;
  resetAccentColor: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  accentColor: null,
  setAccentColor: () => {},
  resetAccentColor: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('saint-theme');
    return (saved as Theme) || 'light';
  });

  const [accentColor, setAccentState] = useState<string | null>(() => {
    return localStorage.getItem('saint-accent-color') || null;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.removeAttribute('data-dashboard-theme');
    document.documentElement.removeAttribute('data-superadmin');
    localStorage.setItem('saint-theme', theme);
  }, [theme]);

  useEffect(() => {
    applyAccentToDOM(accentColor);
    if (accentColor) {
      localStorage.setItem('saint-accent-color', accentColor);
    } else {
      localStorage.removeItem('saint-accent-color');
    }
  }, [accentColor]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  const setAccentColor = (color: string) => setAccentState(color);
  const resetAccentColor = () => setAccentState(null);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor, resetAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('saint-dashboard-theme');
    return (saved as Theme) || 'dark';
  });

  const [accentColor, setAccentState] = useState<string | null>(() => {
    return localStorage.getItem('saint-accent-color') || null;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-dashboard-theme', theme);
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('saint-dashboard-theme', theme);

    return () => {
      document.documentElement.removeAttribute('data-dashboard-theme');
    };
  }, [theme]);

  useEffect(() => {
    applyAccentToDOM(accentColor);
    if (accentColor) {
      localStorage.setItem('saint-accent-color', accentColor);
    } else {
      localStorage.removeItem('saint-accent-color');
    }
  }, [accentColor]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  const setAccentColor = (color: string) => setAccentState(color);
  const resetAccentColor = () => setAccentState(null);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor, resetAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
