import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import SectionPicker from '../../components/ui/SectionPicker';
import { submitApplication, getSiteSettings } from '../../services/applicationService';
import { getSections } from '../../services/interviewService';
import type { ApplySection } from '../../types';

interface SectionOption {
  value: ApplySection;
  label: string;
}

export default function ApplyPage() {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');

  const [rbtNumber, setRbtNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('Information Technology');
  const [sections, setSections] = useState<ApplySection[]>([]);
  const [sectionSkills, setSectionSkills] = useState<Record<string, string>>({});
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    getSiteSettings()
      .then((s) => {
        setOpen(s.applicationsOpen !== false);
        setWhatsappGroupLink(typeof s.whatsappGroupLink === 'string' ? s.whatsappGroupLink : '');
      })
      .catch(() => {});

    getSections()
      .then((sections) => setSectionOptions(sections.map((section) => ({ value: section.value, label: section.label }))))
      .catch(() => {});
  }, []);

  const handleAddSection = (section: ApplySection) => {
    if (!sections.includes(section)) setSections([...sections, section]);
  };

  const handleRemoveSection = (section: ApplySection) => {
    setSections(sections.filter((s) => s !== section));
    const skills = { ...sectionSkills };
    delete skills[section];
    setSectionSkills(skills);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (sections.length === 0) {
      setError('Please select at least one section to apply for.');
      return;
    }

    for (const s of sections) {
      if (!sectionSkills[s]?.trim()) {
        setError(`Please describe your skills for the selected section.`);
        return;
      }
    }

    setLoading(true);
    try {
      await submitApplication({
        rbtNumber,
        firstName,
        lastName,
        department,
        sections,
        sectionSkills,
        reason,
        phone,
        email,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="card max-w-md text-center !p-10">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
          <p className="text-slate-600 mb-6">Your application has been received. We will contact you for the interview process.</p>
          {whatsappGroupLink.trim() && (
            <a
              href={whatsappGroupLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full mb-3 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <MessageCircle className="w-4 h-4" /> Join the recruitment WhatsApp group
            </a>
          )}
          <Link to="/" className="btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4" style={{ background: 'var(--bg-secondary)' }}>
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="card !p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Apply to SAInT</h1>
          <p className="text-slate-500 mb-8">Fill in your details to apply for an interview. Only one application per email is allowed.</p>

          {!open && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">Applications are currently closed. Please check back later.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="apply-form space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">RBT Number *</label>
                <input className="input-field" placeholder="e.g. 1234567890" value={rbtNumber} onChange={(e) => setRbtNumber(e.target.value)} required disabled={!open} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Department *</label>
                <input className="input-field" placeholder="e.g. Information Technology" value={department} onChange={(e) => setDepartment(e.target.value)} required disabled={!open} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">First Name *</label>
                <input className="input-field" placeholder="Your first name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={!open} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Last Name *</label>
                <input className="input-field" placeholder="Your last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={!open} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Phone Number *</label>
                <input className="input-field" type="tel" placeholder="10-digit phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={!open} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Email Address *</label>
                <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!open} />
              </div>
            </div>

            <SectionPicker
              selected={sections}
              onAdd={handleAddSection}
              onRemove={handleRemoveSection}
              skills={sectionSkills}
              onSkillChange={(section, value) => setSectionSkills({ ...sectionSkills, [section]: value })}
              sectionOptions={sectionOptions}
            />

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700">Reason to Join SAInT *</label>
              <textarea className="input-field min-h-[100px] resize-y" value={reason} onChange={(e) => setReason(e.target.value)} required disabled={!open} placeholder="Tell us why you want to be part of SAInT..." />
            </div>

            <button type="submit" className="btn-primary w-full !py-3.5" disabled={!open || loading}>
              {loading ? 'Submitting...' : <><Send className="w-4 h-4" /> Apply for Interview</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
