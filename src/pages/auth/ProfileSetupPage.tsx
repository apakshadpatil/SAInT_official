import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { completeProfileSetup } from '../../services/authService';
import { fileToDataUrl } from '../../utils/fileUtils';
import { isCoreMember } from '../../utils/permissions';

export default function ProfileSetupPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [description, setDescription] = useState(profile?.description || '');
  const [batchYear, setBatchYear] = useState(profile?.batchYear || '');
  const [coreTeamName, setCoreTeamName] = useState(profile?.coreTeamName || '');
  const [coreTeamDescription, setCoreTeamDescription] = useState(profile?.coreTeamDescription || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await fileToDataUrl(file);
      setPhotoURL(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await completeProfileSetup(user.uid, {
        firstName,
        lastName,
        phone,
        description,
        batchYear,
        photoURL: photoURL || undefined,
        ...(isCoreMember(profile) ? { coreTeamName, coreTeamDescription } : {}),
      });
      await refreshProfile();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--dash-bg)' }}>
      <div className="dash-card w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--dash-text)' }}>Complete Your Profile</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--dash-muted)' }}>Set up your profile to get started on SAInT Dashboard</p>

        {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            {photoURL ? (
              <img src={photoURL} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-blue-400" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-600 font-bold text-2xl">?</div>
            )}
            <label className="btn-outline !py-2 !px-4 cursor-pointer">
              Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>First Name</label>
              <input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Last Name</label>
              <input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Email</label>
            <input className="input-field opacity-60" value={profile?.email || ''} disabled />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Phone</label>
              <input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Batch / Academic Year</label>
              <input className="input-field" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="e.g. 2024-28" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Description</label>
            <textarea className="input-field min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us about yourself..." />
          </div>

          {isCoreMember(profile) && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Team Name</label>
                <input className="input-field" value={coreTeamName} onChange={(e) => setCoreTeamName(e.target.value)} placeholder="e.g. Media Team" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Team Description</label>
                <textarea className="input-field min-h-[60px]" value={coreTeamDescription} onChange={(e) => setCoreTeamDescription(e.target.value)} />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>
            {loading ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
