import { useState, type FormEvent, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, PRESET_ACCENTS } from '../../contexts/ThemeContext';
import RightPanel from '../../components/ui/RightPanel';
import { getAllUsers, updateUserProfile } from '../../services/authService';
import type { UserProfile } from '../../types';
import { fileToDataUrl } from '../../utils/fileUtils';
import { uploadFileToSupabase } from '../../utils/supabase';
import { getRoleBadge } from '../../utils/permissions';
import {
  User,
  Phone,
  Mail,
  Award,
  CheckSquare,
  Users,
  ChevronRight,
  Palette,
  RotateCcw,
  Check,
  Eye,
} from 'lucide-react';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { useToast } from '../../contexts/ToastContext';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { accentColor, setAccentColor, resetAccentColor } = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [directoryUsers, setDirectoryUsers] = useState<UserProfile[]>([]);
  const [selectedRelationUser, setSelectedRelationUser] = useState<UserProfile | null>(null);
  const [activeRelationTab, setActiveRelationTab] = useState<'followers' | 'following'>('followers');

  // Custom color state
  const currentAccent = accentColor || (profile?.role === 'superadmin' ? '#7c3aed' : '#2563eb');
  const [customHex, setCustomHex] = useState(currentAccent);

  useEffect(() => {
    setCustomHex(currentAccent);
  }, [currentAccent]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhone(profile.phone || '');
      setBatchYear(profile.batchYear || '');
      setDescription(profile.description || '');
      setPhotoURL(profile.photoURL || '');
    }
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    const loadDirectory = async () => {
      try {
        const allUsers = await getAllUsers();
        if (!cancelled) {
          setDirectoryUsers(allUsers.filter((user) => user.status === 'approved'));
        }
      } catch (err) {
        console.error('Failed to load member directory:', err);
      }
    };

    loadDirectory();
    return () => {
      cancelled = true;
    };
  }, []);

  const getRelationProfiles = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids || []));
    return uniqueIds
      .map((uid) => directoryUsers.find((user) => user.uid === uid))
      .filter((user): user is UserProfile => Boolean(user));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const dest = `avatars/${profile.uid}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const url = await uploadFileToSupabase(file, dest, 'banners');
      setPhotoURL(url);
      setError('');
      showToast('Avatar uploaded successfully.', 'success');
    } catch (err) {
      console.warn('Supabase avatar upload failed, falling back to data URL:', err);
      try {
        const { dataUrl } = await fileToDataUrl(file);
        setPhotoURL(dataUrl);
        setError('');
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to read image');
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateUserProfile(profile.uid, {
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
        phone,
        batchYear,
        description,
        photoURL: photoURL || undefined,
      });
      await refreshProfile();
      setSuccess('Profile updated successfully!');
      showToast('Profile updated.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      showToast('Failed to update profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomHex(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setAccentColor(hex);
    }
  };

  if (!profile) return null;

  const followers = getRelationProfiles(profile.followers || []);
  const following = getRelationProfiles(profile.following || []);
  const activeRelations = activeRelationTab === 'followers' ? followers : following;

  return (
    <>
      <div className="space-y-6 animate-fade-in-up">
        {/* ── Page Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Personal Profile & Appearance</h1>
            <p className="page-header-sub">
              Manage your credentials, club achievements, personal network, and dynamic UI theme color
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── Left column: Overview stats & UI Theme Accent ── */}
          <div className="lg:col-span-1 space-y-5">
            {/* Profile Avatar Card */}
            <div className="dash-card flex flex-col items-center text-center p-6" style={{ borderRadius: '6px' }}>
              <div className="relative group mb-4">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-2"
                    style={{ borderColor: 'var(--dash-accent)' }}
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl border-2"
                    style={{
                      background: 'var(--dash-accent-soft)',
                      color: 'var(--dash-accent)',
                      borderColor: 'var(--dash-accent)',
                    }}
                  >
                    {profile.firstName?.[0] || profile.displayName?.[0] || '?'}
                  </div>
                )}
                <label
                  className="absolute bottom-0 right-0 p-2 rounded-full cursor-pointer shadow-md transition-all hover:scale-110"
                  style={{ background: 'var(--dash-accent)', color: '#ffffff' }}
                  title="Upload profile image"
                >
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </label>
              </div>

              <h2 className="text-lg font-bold flex items-center justify-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                <span>{profile.displayName}</span>
                <VerifiedBadge user={profile} />
              </h2>
              <div
                className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold mt-2 mb-3"
                style={{
                  background: 'var(--dash-accent-soft)',
                  color: 'var(--dash-accent)',
                  border: '1px solid var(--dash-accent-soft)',
                  borderRadius: '4px',
                }}
              >
                {getRoleBadge(profile)}
              </div>
              <p className="text-xs leading-relaxed px-2 line-clamp-3" style={{ color: 'var(--dash-muted)' }}>
                {description || 'No bio or description added yet.'}
              </p>

              {profile.teamNames.length > 0 && (
                <div className="mt-4 w-full pt-4 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-left mb-2" style={{ color: 'var(--dash-muted)' }}>
                    Assigned Teams
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-start">
                    {profile.teamNames.map((team) => (
                      <span
                        key={team}
                        className="text-[10px] font-semibold px-2 py-0.5"
                        style={{
                          background: 'var(--dash-hover)',
                          color: 'var(--dash-text)',
                          border: '1px solid var(--dash-border)',
                          borderRadius: '4px',
                        }}
                      >
                        {team}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── UI Theme & Dynamic Accent Color Picker Card ── */}
            <div className="dash-card p-5 space-y-4" style={{ borderRadius: '6px' }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 flex items-center justify-center"
                    style={{ background: 'var(--dash-accent-soft)', borderRadius: '4px' }}
                  >
                    <Palette className="w-3.5 h-3.5" style={{ color: 'var(--dash-accent)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                      UI Accent Color
                    </h3>
                    <p className="text-[10px]" style={{ color: 'var(--dash-muted)' }}>
                      Real-time dynamic website color hint
                    </p>
                  </div>
                </div>

                {accentColor && (
                  <button
                    onClick={resetAccentColor}
                    className="text-[11px] font-medium flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--dash-muted)' }}
                    title="Reset to role default"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {/* Preset Color Swatches */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--dash-muted)' }}>
                  Curated Color Palettes
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_ACCENTS.map((preset) => {
                    const isSelected = (accentColor || currentAccent).toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => {
                          setAccentColor(preset.hex);
                          setCustomHex(preset.hex);
                          showToast(`Theme accent changed to ${preset.name}.`, 'info');
                        }}
                        className="group relative flex flex-col items-center justify-center p-2 border transition-all duration-150"
                        style={{
                          background: isSelected ? 'var(--dash-hover)' : 'transparent',
                          borderColor: isSelected ? preset.hex : 'var(--dash-border)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                        title={preset.name}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                          style={{ background: preset.hex }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        </div>
                        <span className="text-[9px] font-semibold mt-1 truncate max-w-full" style={{ color: 'var(--dash-muted)' }}>
                          {preset.name.split(' ')[1] || preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Input & HTML5 Color Picker */}
              <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--dash-border)' }}>
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--dash-muted)' }}>
                  Custom Hex / Color Picker
                </label>

                <div className="flex items-center gap-2">
                  {/* Native HTML5 Color Picker */}
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(customHex) ? customHex : currentAccent}
                      onChange={(e) => handleCustomColorChange(e.target.value)}
                      className="w-9 h-9 p-0.5 border cursor-pointer"
                      style={{
                        background: 'var(--dash-input-bg)',
                        borderColor: 'var(--dash-input-border)',
                        borderRadius: '4px',
                      }}
                      title="Choose custom color from picker"
                    />
                  </div>

                  {/* Hex Text Input */}
                  <input
                    type="text"
                    value={customHex}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    placeholder="#7c3aed"
                    maxLength={7}
                    className="dash-input font-mono text-xs uppercase"
                    style={{ borderRadius: '4px' }}
                  />
                </div>
              </div>

              {/* Live Preview Strip */}
              <div
                className="p-3 border flex items-center justify-between text-xs"
                style={{
                  background: 'var(--dash-hover)',
                  borderColor: 'var(--dash-border)',
                  borderRadius: '4px',
                }}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" style={{ color: 'var(--dash-accent)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--dash-text)' }}>
                    Live Preview:
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5"
                    style={{
                      background: 'var(--dash-accent-soft)',
                      color: 'var(--dash-accent)',
                      borderRadius: '3px',
                    }}
                  >
                    Active Tag
                  </span>
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: 'var(--dash-accent)' }}
                  />
                </div>
              </div>
            </div>

            {/* Achievements Card */}
            <div className="dash-card p-5" style={{ borderRadius: '6px' }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--dash-text)' }}>
                SAInT Achievements
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 border flex flex-col items-center justify-center text-center"
                  style={{ borderColor: 'var(--dash-border)', borderRadius: '4px', background: 'var(--dash-hover)' }}
                >
                  <Award className="w-5 h-5 text-emerald-500 mb-1" />
                  <span className="text-xl font-black tabular-nums" style={{ color: 'var(--dash-text)' }}>
                    {profile.taskScore}
                  </span>
                  <span className="text-[10px] uppercase font-semibold mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                    Task Score
                  </span>
                </div>
                <div
                  className="p-3 border flex flex-col items-center justify-center text-center"
                  style={{ borderColor: 'var(--dash-border)', borderRadius: '4px', background: 'var(--dash-hover)' }}
                >
                  <CheckSquare className="w-5 h-5 text-blue-500 mb-1" />
                  <span className="text-xl font-black tabular-nums" style={{ color: 'var(--dash-text)' }}>
                    {profile.completedTaskCount}
                  </span>
                  <span className="text-[10px] uppercase font-semibold mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                    Completed
                  </span>
                </div>
              </div>

              <div
                className="flex items-center justify-around mt-4 pt-4 border-t"
                style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
              >
                <div className="text-center">
                  <p className="text-base font-bold tabular-nums">{profile.followers?.length || 0}</p>
                  <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>Followers</p>
                </div>
                <div className="w-px h-6" style={{ backgroundColor: 'var(--dash-border)' }} />
                <div className="text-center">
                  <p className="text-base font-bold tabular-nums">{profile.following?.length || 0}</p>
                  <p className="text-[11px]" style={{ color: 'var(--dash-muted)' }}>Following</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Middle column: Edit Form ── */}
          <div className="lg:col-span-1">
            <div className="dash-card p-6" style={{ borderRadius: '6px' }}>
              <h3 className="text-base font-bold mb-4" style={{ color: 'var(--dash-text)' }}>
                Account Information
              </h3>

              {error && (
                <div
                  className="p-2.5 text-xs text-red-400 border border-red-500/20 mb-4"
                  style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="p-2.5 text-xs text-emerald-400 border border-emerald-500/20 mb-4"
                  style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px' }}
                >
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                      First Name *
                    </label>
                    <input
                      className="dash-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Last Name *
                    </label>
                    <input
                      className="dash-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                    Email (Read-only)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                    <input
                      className="dash-input !pl-8 opacity-60 cursor-not-allowed font-mono text-xs"
                      value={profile.email}
                      disabled
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                      <input
                        className="dash-input !pl-8 font-mono text-xs"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                      Batch / Academic Year *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                      <input
                        className="dash-input !pl-8 font-mono text-xs"
                        value={batchYear}
                        onChange={(e) => setBatchYear(e.target.value)}
                        placeholder="e.g. 2024-28"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                    Bio / Personal Summary
                  </label>
                  <textarea
                    className="dash-input min-h-[90px] resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Share details about your roles, skills, or studies..."
                  />
                </div>

                {profile.role === 'core' && (
                  <div
                    className="p-3.5 border space-y-3"
                    style={{
                      borderColor: 'var(--dash-border)',
                      background: 'var(--dash-hover)',
                      borderRadius: '4px',
                    }}
                  >
                    <h4 className="font-bold text-xs" style={{ color: 'var(--dash-text)' }}>
                      Core Team Affiliation
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                          Team Name
                        </label>
                        <input className="dash-input opacity-70 !text-xs" value={profile.coreTeamName || ''} disabled />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--dash-muted)' }}>
                          Team Description
                        </label>
                        <textarea
                          className="dash-input min-h-[50px] opacity-70 !text-xs resize-none"
                          value={profile.coreTeamDescription || ''}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" className="btn-primary w-full !py-2.5 !text-xs font-bold" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ── Right column: Social connections ── */}
          <div className="lg:col-span-1">
            <div className="dash-card p-5 h-full flex flex-col" style={{ borderRadius: '6px' }}>
              <div className="mb-3">
                <h3 className="text-base font-bold" style={{ color: 'var(--dash-text)' }}>
                  Connections
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                  Association peers and network directory
                </p>
              </div>

              <div
                className="flex border p-0.5 mb-3"
                style={{
                  borderColor: 'var(--dash-border)',
                  background: 'var(--dash-card)',
                  borderRadius: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveRelationTab('followers')}
                  className="flex-1 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: activeRelationTab === 'followers' ? 'var(--dash-accent)' : 'transparent',
                    color: activeRelationTab === 'followers' ? '#ffffff' : 'var(--dash-muted)',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Followers ({profile.followers?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRelationTab('following')}
                  className="flex-1 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: activeRelationTab === 'following' ? 'var(--dash-accent)' : 'transparent',
                    color: activeRelationTab === 'following' ? '#ffffff' : 'var(--dash-muted)',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Following ({profile.following?.length || 0})
                </button>
              </div>

              <div className="flex items-center justify-between mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-muted)' }}>
                <span>{activeRelationTab === 'followers' ? 'Followers' : 'Following'}</span>
                <span>{activeRelations.length} members</span>
              </div>

              <div className="overflow-y-auto pr-1 space-y-1.5 flex-1" style={{ maxHeight: '440px' }}>
                {activeRelations.length > 0 ? (
                  activeRelations.map((user) => (
                    <button
                      key={user.uid}
                      type="button"
                      onClick={() => setSelectedRelationUser(user)}
                      className="w-full flex items-center justify-between border px-3 py-2 text-left transition hover:bg-white/5"
                      style={{
                        borderColor: 'var(--dash-border)',
                        background: 'var(--dash-hover)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: 'var(--dash-accent-soft)',
                              color: 'var(--dash-accent)',
                            }}
                          >
                            {user.firstName?.[0] || user.displayName?.[0] || '?'}
                          </div>
                        )}
                        <span className="text-xs font-medium truncate flex items-center gap-1" style={{ color: 'var(--dash-text)' }}>
                          <span className="truncate">{user.displayName}</span>
                          <VerifiedBadge user={user} />
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
                    </button>
                  ))
                ) : (
                  <div
                    className="border border-dashed px-3 py-8 text-center text-xs"
                    style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-muted)', borderRadius: '4px' }}
                  >
                    {activeRelationTab === 'followers' ? 'No followers recorded yet.' : 'Not following anyone yet.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Relation User Details Drawer ── */}
      <RightPanel
        open={!!selectedRelationUser}
        onClose={() => setSelectedRelationUser(null)}
        title={selectedRelationUser?.displayName || 'Member Profile'}
        width="440px"
      >
        {selectedRelationUser && (
          <div className="flex flex-col items-center text-center space-y-4">
            {selectedRelationUser.photoURL ? (
              <img
                src={selectedRelationUser.photoURL}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-2"
                style={{ borderColor: 'var(--dash-accent)' }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl border-2"
                style={{
                  background: 'var(--dash-accent-soft)',
                  color: 'var(--dash-accent)',
                  borderColor: 'var(--dash-accent)',
                }}
              >
                {selectedRelationUser.firstName?.[0] || selectedRelationUser.displayName?.[0] || '?'}
              </div>
            )}

            <div>
              <h2 className="text-base font-bold flex items-center justify-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                <span>{selectedRelationUser.displayName}</span>
                <VerifiedBadge user={selectedRelationUser} />
              </h2>
              <div
                className="inline-flex items-center px-2 py-0.5 text-xs font-semibold mt-1"
                style={{
                  background: 'var(--dash-accent-soft)',
                  color: 'var(--dash-accent)',
                  borderRadius: '4px',
                }}
              >
                {getRoleBadge(selectedRelationUser)}
              </div>
            </div>

            <div className="w-full text-left space-y-3 pt-3 border-t" style={{ borderColor: 'var(--dash-border)' }}>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-2.5 border"
                  style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)', borderRadius: '4px' }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--dash-muted)' }}>
                    Followers
                  </span>
                  <span className="text-base font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>
                    {selectedRelationUser.followers?.length || 0}
                  </span>
                </div>
                <div
                  className="p-2.5 border"
                  style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)', borderRadius: '4px' }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--dash-muted)' }}>
                    Following
                  </span>
                  <span className="text-base font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>
                    {selectedRelationUser.following?.length || 0}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
                  <User className="w-3.5 h-3.5 opacity-60" />
                  <span>
                    Batch Year: <strong className="font-semibold">{selectedRelationUser.batchYear || 'N/A'}</strong>
                  </span>
                </div>
                {selectedRelationUser.teamNames && selectedRelationUser.teamNames.length > 0 ? (
                  <div className="flex items-start gap-2 pt-1">
                    <Users className="w-3.5 h-3.5 opacity-60 shrink-0 mt-0.5" />
                    <div>
                      <span style={{ color: 'var(--dash-text)' }}>Teams:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedRelationUser.teamNames.map((team) => (
                          <span
                            key={team}
                            className="text-[10px] font-medium px-2 py-0.5"
                            style={{
                              background: 'var(--dash-hover)',
                              color: 'var(--dash-text)',
                              border: '1px solid var(--dash-border)',
                              borderRadius: '3px',
                            }}
                          >
                            {team}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: 'var(--dash-muted)' }}>
                    No teams assigned.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </RightPanel>
    </>
  );
}
