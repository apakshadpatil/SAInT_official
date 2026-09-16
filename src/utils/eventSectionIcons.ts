import {
  Trophy,
  ScrollText,
  Sparkles,
  Gift,
  Package,
  AlertTriangle,
  Users,
  Calendar,
  Clock,
  MapPin,
  Info,
  Star,
  Flame,
  Shield,
  Target
} from 'lucide-react';

export interface IconOption {
  id: string;
  label: string;
  icon: any;
  color: string;
}

export const ICON_OPTIONS: IconOption[] = [
  { id: 'trophy', label: 'Trophy / Prizes', icon: Trophy, color: '#f59e0b' },
  { id: 'scroll', label: 'Rules / Guidelines', icon: ScrollText, color: '#3b82f6' },
  { id: 'sparkles', label: 'Highlights', icon: Sparkles, color: '#8b5cf6' },
  { id: 'gift', label: 'Benefits / Perks', icon: Gift, color: '#ec4899' },
  { id: 'package', label: 'What We Provide', icon: Package, color: '#10b981' },
  { id: 'alert', label: 'Important Notice', icon: AlertTriangle, color: '#ef4444' },
  { id: 'users', label: 'Eligibility', icon: Users, color: '#06b6d4' },
  { id: 'calendar', label: 'Schedule / Dates', icon: Calendar, color: '#6366f1' },
  { id: 'clock', label: 'Timings', icon: Clock, color: '#14b8a6' },
  { id: 'mapPin', label: 'Venue / Hall', icon: MapPin, color: '#f97316' },
  { id: 'star', label: 'Featured Info', icon: Star, color: '#eab308' },
  { id: 'flame', label: 'Hot / Special', icon: Flame, color: '#f43f5e' },
  { id: 'shield', label: 'Security / Safety', icon: Shield, color: '#10b981' },
  { id: 'target', label: 'Objectives', icon: Target, color: '#0284c7' },
  { id: 'info', label: 'General Info', icon: Info, color: '#64748b' },
];

export function getSectionIcon(iconId?: string): IconOption {
  const found = ICON_OPTIONS.find((opt) => opt.id === iconId);
  return found || ICON_OPTIONS[0];
}
