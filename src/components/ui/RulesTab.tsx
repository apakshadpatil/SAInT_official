import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, ExternalLink, Loader2, Plus, Save, Trash2, Users } from 'lucide-react';
import type { EventRecord, EventRuleAgreement } from '../../types';
import { subscribeRuleAgreements } from '../../services/eventService';

interface RulesTabProps {
  event: EventRecord;
  canEdit: boolean;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
}

const DEFAULT_RULES = [
  'Provide accurate registration details and carry your QR pass to the event.',
  'Follow the event schedule, venue instructions, and directions from the organizing team.',
  'Maintain respectful conduct. The organizers may cancel a registration for misconduct.',
];

export default function RulesTab({ event, canEdit, onUpdate }: RulesTabProps) {
  const [rules, setRules] = useState<string[]>(event.rules?.length ? event.rules : DEFAULT_RULES);
  const [rulebookUrl, setRulebookUrl] = useState(event.rulebookUrl || '');
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState(event.whatsappGroupUrl || '');
  const [agreements, setAgreements] = useState<EventRuleAgreement[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRules(event.rules?.length ? event.rules : DEFAULT_RULES);
    setRulebookUrl(event.rulebookUrl || '');
    setWhatsappGroupUrl(event.whatsappGroupUrl || '');
  }, [event.id, event.rules, event.rulebookUrl, event.whatsappGroupUrl]);

  useEffect(() => subscribeRuleAgreements(event.id, setAgreements), [event.id]);

  const updateRule = (index: number, value: string) => {
    setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? value : rule));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({
        rules: rules.map((rule) => rule.trim()).filter(Boolean),
        rulebookUrl: rulebookUrl.trim() || undefined,
        whatsappGroupUrl: whatsappGroupUrl.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>Rules & Rulebook</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
            Every visitor accepts these terms before the registration form opens.
          </p>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save rules
          </button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-hover)' }}>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Registration terms</h4>
            </div>
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-bold text-blue-600">{index + 1}.</span>
                  <textarea
                    value={rule}
                    disabled={!canEdit}
                    onChange={(item) => updateRule(index, item.target.value)}
                    rows={2}
                    className="input-field flex-1 text-sm resize-y"
                  />
                  {canEdit && (
                    <button onClick={() => setRules((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-2 text-red-500" aria-label="Remove rule">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <button onClick={() => setRules((current) => [...current, ''])} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                <Plus className="w-4 h-4" /> Add rule
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border p-4 sm:p-5 space-y-4" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
          <div className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Participant links</h4>
          </div>
          <label className="block text-sm font-medium" style={{ color: 'var(--dash-text)' }}>
            Rulebook URL
            <input value={rulebookUrl} disabled={!canEdit} onChange={(item) => setRulebookUrl(item.target.value)} placeholder="https://..." className="input-field mt-1.5" />
          </label>
          <label className="block text-sm font-medium" style={{ color: 'var(--dash-text)' }}>
            WhatsApp group URL
            <input value={whatsappGroupUrl} disabled={!canEdit} onChange={(item) => setWhatsappGroupUrl(item.target.value)} placeholder="https://chat.whatsapp.com/..." className="input-field mt-1.5" />
          </label>
          <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>These buttons appear on the registration confirmation and QR pass page for this event only.</p>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="px-4 sm:px-5 py-4 flex items-center gap-2" style={{ background: 'var(--dash-hover)' }}>
          <Users className="w-5 h-5 text-emerald-600" />
          <div><h4 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Agreement audit</h4><p className="text-xs" style={{ color: 'var(--dash-muted)' }}>{agreements.length} visitor{agreements.length === 1 ? '' : 's'} accepted the terms</p></div>
        </div>
        {agreements.length === 0 ? <p className="p-6 text-sm" style={{ color: 'var(--dash-muted)' }}>No agreements recorded yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr style={{ color: 'var(--dash-muted)', borderBottom: '1px solid var(--dash-border)' }}><th className="text-left p-4 font-semibold">Visitor</th><th className="text-left p-4 font-semibold">Email</th><th className="text-left p-4 font-semibold">Accepted at</th></tr></thead><tbody>{agreements.map((agreement) => <tr key={agreement.id} style={{ borderBottom: '1px solid var(--dash-border)' }}><td className="p-4 font-medium" style={{ color: 'var(--dash-text)' }}><CheckCircle2 className="inline w-4 h-4 mr-1.5 text-emerald-500" />{agreement.attendeeName}</td><td className="p-4" style={{ color: 'var(--dash-muted)' }}>{agreement.attendeeEmail}</td><td className="p-4 whitespace-nowrap" style={{ color: 'var(--dash-muted)' }}>{new Date(agreement.agreedAt).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
