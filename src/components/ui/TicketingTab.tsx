import { useEffect, useState } from 'react';
import type { EventRecord, TicketTier, TicketSize } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Upload, Check, Copy, ToggleLeft, ToggleRight, QrCode, Plus, Trash2, Edit3, Users, Layers, Maximize2 } from 'lucide-react';
import { uploadDataUrlToSupabase, SUPABASE_BUCKET } from '../../utils/supabase';

interface TicketingTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function TicketingTab({ event, onUpdate, canEdit }: TicketingTabProps) {
  const { showToast } = useToast();
  const [paymentQRPreview, setPaymentQRPreview] = useState<string>(event.paymentQRUrl || '');
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [ticketingEnabled, setTicketingEnabled] = useState(Boolean(event.ticketingEnabled));
  const [enableTieredTicketing, setEnableTieredTicketing] = useState(Boolean(event.enableTieredTicketing));
  const [tiers, setTiers] = useState<TicketTier[]>(event.ticketTiers || []);
  const [ticketSize, setTicketSize] = useState<TicketSize>(event.ticketSize || 'standard');
  const [customWidth, setCustomWidth] = useState<number>(event.customTicketWidth || 800);
  const [customHeight, setCustomHeight] = useState<number>(event.customTicketHeight || 460);

  // Tier modal / drawer state
  const [isAddingTier, setIsAddingTier] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [tierName, setTierName] = useState('');
  const [tierTeamSize, setTierTeamSize] = useState('1');
  const [tierPrice, setTierPrice] = useState('');
  const [tierDesc, setTierDesc] = useState('');
  const [tierQRPreview, setTierQRPreview] = useState('');

  const registrationLink = `${window.location.origin}/events/${event.id}/register`;

  useEffect(() => {
    setPaymentQRPreview(event.paymentQRUrl || '');
    setTicketingEnabled(Boolean(event.ticketingEnabled));
    setEnableTieredTicketing(Boolean(event.enableTieredTicketing));
    setTiers(event.ticketTiers || []);
    setTicketSize(event.ticketSize || 'standard');
    setCustomWidth(event.customTicketWidth || 800);
    setCustomHeight(event.customTicketHeight || 460);
  }, [event]);

  const handlePaymentQRUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setPaymentQRPreview(preview);
    };
    reader.readAsDataURL(file);
  };

  const handleTierQRUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setTierQRPreview(preview);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleTicketing = async () => {
    setLoading(true);
    try {
      const nextValue = !ticketingEnabled;
      await onUpdate({
        ticketingEnabled: nextValue,
        paymentQRUrl: nextValue ? event.paymentQRUrl || paymentQRPreview || undefined : undefined,
      });
      setTicketingEnabled(nextValue);
      showToast(nextValue ? 'Ticketing enabled for this event' : 'Ticketing disabled for this event', 'success');
    } catch (err) {
      showToast('Failed to update ticketing setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTiered = async () => {
    setLoading(true);
    try {
      const nextValue = !enableTieredTicketing;
      await onUpdate({
        enableTieredTicketing: nextValue,
      });
      setEnableTieredTicketing(nextValue);
      showToast(nextValue ? 'Multi-Tier & Team Size ticketing enabled' : 'Switched to standard single-tier ticketing', 'info');
    } catch (err) {
      showToast('Failed to update tiered ticketing setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentQR = async () => {
    setLoading(true);
    try {
      let finalUrl = paymentQRPreview;
      if (paymentQRPreview && paymentQRPreview.startsWith('data:')) {
        const dest = `tickets/payment_qr/${event.id}_${Date.now()}.png`;
        finalUrl = await uploadDataUrlToSupabase(paymentQRPreview, dest, 'payment_qr.png', SUPABASE_BUCKET);
      }

      await onUpdate({
        paymentQRUrl: finalUrl || undefined,
        ticketingEnabled: true,
      });

      setPaymentQRPreview(finalUrl || '');
      setTicketingEnabled(true);
      showToast('Payment QR code saved & Ticketing enabled!', 'success');
    } catch (err) {
      console.error('Failed to save payment QR code:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save payment QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetTierForm = () => {
    setTierName('');
    setTierTeamSize('1');
    setTierPrice('');
    setTierDesc('');
    setTierQRPreview('');
    setEditingTierId(null);
    setIsAddingTier(false);
  };

  const handleEditTier = (tier: TicketTier) => {
    setEditingTierId(tier.id);
    setTierName(tier.name);
    setTierTeamSize(String(tier.teamSize || 1));
    setTierPrice(tier.price ? String(tier.price) : '');
    setTierDesc(tier.description || '');
    setTierQRPreview(tier.paymentQRUrl || '');
    setIsAddingTier(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierName.trim()) {
      showToast('Please enter tier/team size name', 'error');
      return;
    }

    setLoading(true);
    try {
      let finalQRUrl = tierQRPreview;
      if (tierQRPreview && tierQRPreview.startsWith('data:')) {
        const dest = `tickets/tier_qr/${event.id}_${Date.now()}.png`;
        finalQRUrl = await uploadDataUrlToSupabase(tierQRPreview, dest, 'tier_qr.png', SUPABASE_BUCKET);
      }

      let updatedTiers: TicketTier[];
      if (editingTierId) {
        updatedTiers = tiers.map((t) =>
          t.id === editingTierId
            ? {
                ...t,
                name: tierName.trim(),
                teamSize: Number(tierTeamSize) || 1,
                price: tierPrice ? Number(tierPrice) : undefined,
                description: tierDesc.trim() || undefined,
                paymentQRUrl: finalQRUrl || undefined,
              }
            : t
        );
      } else {
        const newTier: TicketTier = {
          id: `tier_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: tierName.trim(),
          teamSize: Number(tierTeamSize) || 1,
          price: tierPrice ? Number(tierPrice) : undefined,
          description: tierDesc.trim() || undefined,
          paymentQRUrl: finalQRUrl || undefined,
        };
        updatedTiers = [...tiers, newTier];
      }

      await onUpdate({
        ticketTiers: updatedTiers,
        enableTieredTicketing: true,
        ticketingEnabled: true,
      });

      setTiers(updatedTiers);
      setTicketingEnabled(true);
      setEnableTieredTicketing(true);
      resetTierForm();
      showToast(editingTierId ? 'Ticket tier updated!' : 'New ticket tier added!', 'success');
    } catch (err) {
      showToast('Failed to save ticket tier', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!window.confirm('Delete this ticket tier?')) return;
    const updated = tiers.filter((t) => t.id !== id);
    setTiers(updated);
    await onUpdate({ ticketTiers: updated });
    showToast('Tier removed', 'info');
  };

  const handleSaveTicketSize = async () => {
    setLoading(true);
    try {
      await onUpdate({
        ticketSize,
        customTicketWidth: ticketSize === 'custom' ? Number(customWidth) : undefined,
        customTicketHeight: ticketSize === 'custom' ? Number(customHeight) : undefined,
      });
      showToast('Ticket dimensions and size updated!', 'success');
    } catch (err) {
      showToast('Failed to update ticket size', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(registrationLink);
    setLinkCopied(true);
    showToast('Registration link copied!', 'success');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Ticketing Status & Mode Bar */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>
                Event Ticketing &amp; Registration Modes
              </h3>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
              {ticketingEnabled
                ? 'Ticketing is ACTIVE. Participants can register and generate digital QR tickets.'
                : 'Ticketing is INACTIVE. Participants cannot register for tickets until enabled.'}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleTicketing}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all shrink-0 cursor-pointer"
                style={{
                  borderColor: ticketingEnabled ? 'rgba(16,185,129,0.3)' : 'var(--dash-border)',
                  background: ticketingEnabled ? 'rgba(16,185,129,0.1)' : 'var(--dash-card)',
                  color: ticketingEnabled ? '#10b981' : 'var(--dash-text)',
                }}
              >
                {ticketingEnabled ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                {ticketingEnabled ? 'Ticketing Enabled' : 'Enable Ticketing'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Registration Link Section */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
          Public Registration &amp; Ticket Link
        </h4>
        <p className="text-sm" style={{ color: 'var(--dash-muted)' }}>
          Share this direct registration link with students and attendees to let them register and receive their pass.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={registrationLink}
            readOnly
            className="input-field flex-1 font-mono text-xs"
          />
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            style={{
              background: linkCopied ? 'rgba(16,185,129,0.15)' : 'var(--dash-card)',
              color: linkCopied ? '#10b981' : 'var(--dash-text)',
              border: '1px solid ' + (linkCopied ? 'rgba(16,185,129,0.3)' : 'var(--dash-border)'),
            }}
          >
            <Copy className="w-4 h-4" />
            {linkCopied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Custom Ticket Size & Layout Selection */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <h4 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Maximize2 className="w-4 h-4 text-indigo-500" />
              Custom Ticket Sizes &amp; Dimensions
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
              Choose predefined ticket formats or enter custom pixel dimensions for generated download passes.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleSaveTicketSize}
              disabled={loading}
              className="btn-primary !text-xs !py-1.5 !px-3 shrink-0 cursor-pointer"
            >
              Save Ticket Size
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'standard', label: 'Standard Pass', dims: '800 × 460 px', icon: '🎫' },
            { id: 'badge', label: 'ID Badge / Lanyard', dims: '600 × 900 px (Portrait)', icon: '🪪' },
            { id: 'compact', label: 'Compact Pass', dims: '640 × 340 px', icon: '📱' },
            { id: 'wide', label: 'Wide VIP Pass', dims: '1000 × 480 px', icon: '🎟️' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTicketSize(item.id as TicketSize)}
              className="p-3.5 rounded-xl border text-left transition-all cursor-pointer"
              style={{
                borderColor: ticketSize === item.id ? '#3b82f6' : 'var(--dash-border)',
                background: ticketSize === item.id ? 'rgba(59,130,246,0.1)' : 'var(--dash-card)',
              }}
            >
              <span className="text-lg block mb-1">{item.icon}</span>
              <p className="text-xs font-bold" style={{ color: 'var(--dash-text)' }}>{item.label}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--dash-muted)' }}>{item.dims}</p>
            </button>
          ))}
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="radio"
              checked={ticketSize === 'custom'}
              onChange={() => setTicketSize('custom')}
              className="accent-blue-600"
            />
            <span className="text-xs font-semibold" style={{ color: 'var(--dash-text)' }}>
              Or Enter Custom Pixel Dimensions
            </span>
          </label>

          {ticketSize === 'custom' && (
            <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>Width (px):</span>
                <input
                  type="number"
                  min="400"
                  max="2400"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="input-field !py-1 !px-2 w-28 text-xs font-mono"
                />
              </div>
              <span style={{ color: 'var(--dash-muted)' }}>×</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--dash-muted)' }}>Height (px):</span>
                <input
                  type="number"
                  min="300"
                  max="2400"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="input-field !py-1 !px-2 w-28 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticketing Tier Mode Toggle */}
      <div className="rounded-2xl border p-6 space-y-5" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
                Multi-Tier &amp; Team Size Payment QRs
              </h4>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
              Enable different pricing, payment QR codes, and team member input forms based on team size (e.g. Solo, Duo, Squad of 4).
            </p>
          </div>

          {canEdit && (
            <button
              onClick={handleToggleTiered}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0"
              style={{
                borderColor: enableTieredTicketing ? 'rgba(99,102,241,0.4)' : 'var(--dash-border)',
                background: enableTieredTicketing ? 'rgba(99,102,241,0.12)' : 'var(--dash-card)',
                color: enableTieredTicketing ? '#818cf8' : 'var(--dash-text)',
              }}
            >
              {enableTieredTicketing ? <ToggleRight className="w-5 h-5 text-indigo-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
              {enableTieredTicketing ? 'Multi-Tier Active' : 'Single General QR'}
            </button>
          )}
        </div>

        {/* --- MULTI-TIER MANAGEMENT SECTION --- */}
        {enableTieredTicketing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Configured Team Sizes &amp; Tiers ({tiers.length})
              </span>
              {canEdit && !isAddingTier && (
                <button
                  onClick={() => {
                    resetTierForm();
                    setIsAddingTier(true);
                  }}
                  className="btn-primary !text-xs !py-1.5 !px-3 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Team Tier / QR
                </button>
              )}
            </div>

            {/* Tier Add/Edit Form Drawer */}
            {isAddingTier && (
              <form onSubmit={handleSaveTier} className="p-4 rounded-xl border space-y-4 bg-slate-900/30" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
                <h5 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  {editingTierId ? 'Edit Ticket Tier' : 'Add New Team Size / Tier'}
                </h5>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Tier Name *
                    </label>
                    <input
                      type="text"
                      value={tierName}
                      onChange={(e) => setTierName(e.target.value)}
                      required
                      placeholder="e.g. Squad Pass (4 Members)"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Number of Team Members *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tierTeamSize}
                      onChange={(e) => setTierTeamSize(e.target.value)}
                      required
                      placeholder="e.g. 4"
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                      Price (₹) (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tierPrice}
                      onChange={(e) => setTierPrice(e.target.value)}
                      placeholder="e.g. 350"
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Description / Included Perks
                  </label>
                  <input
                    type="text"
                    value={tierDesc}
                    onChange={(e) => setTierDesc(e.target.value)}
                    placeholder="e.g. Team registration pass. All 4 members receive entry & certificates."
                    className="input-field w-full text-xs"
                  />
                </div>

                {/* Specific Payment QR Code for this Tier */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>
                    Specific Payment QR for this Tier (Optional)
                  </label>
                  <div className="flex items-center gap-4">
                    {tierQRPreview && (
                      <div className="w-20 h-20 rounded-lg border bg-white p-1 shrink-0">
                        <img src={tierQRPreview} alt="QR Preview" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <label className="btn-secondary !text-xs !py-2 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      {tierQRPreview ? 'Replace QR' : 'Upload Tier Payment QR'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleTierQRUpload(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                    {tierQRPreview && (
                      <button
                        type="button"
                        onClick={() => setTierQRPreview('')}
                        className="text-xs text-red-400 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" disabled={loading} className="btn-primary !text-xs !py-2 !px-4 cursor-pointer">
                    {loading ? 'Saving...' : editingTierId ? 'Update Tier' : 'Add Tier'}
                  </button>
                  <button type="button" onClick={resetTierForm} className="btn-secondary !text-xs !py-2 !px-4 cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* List of Tiers */}
            {tiers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--dash-border)' }}>
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>No Team Tiers Configured Yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                  Add different options like Solo (1 Member), Duo (2 Members), Squad (4 Members) with individual QR codes.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border p-4 flex flex-col justify-between space-y-3"
                    style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-card)' }}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {t.teamSize} {t.teamSize === 1 ? 'Member' : 'Members'}
                        </span>
                        {t.price !== undefined && (
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            ₹{t.price}
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-sm mt-2" style={{ color: 'var(--dash-text)' }}>
                        {t.name}
                      </h5>

                      {t.description && (
                        <p className="text-xs mt-1" style={{ color: 'var(--dash-muted)' }}>
                          {t.description}
                        </p>
                      )}
                    </div>

                    {t.paymentQRUrl && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/40 border border-slate-700/40">
                        <img src={t.paymentQRUrl} alt="Tier QR" className="w-10 h-10 rounded bg-white object-contain p-0.5" />
                        <span className="text-[11px] text-emerald-400">Custom QR active</span>
                      </div>
                    )}

                    {canEdit && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--dash-border)' }}>
                        <button
                          onClick={() => handleEditTier(t)}
                          className="p-1.5 text-xs text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit tier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTier(t.id)}
                          className="p-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete tier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- SINGLE STANDARD PAYMENT QR SECTION --- */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>
                  Standard General Payment QR Code (UPI / Banking)
                </h5>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-muted)' }}>
                  Upload your UPI/Payment QR code if this is a paid event. Leave blank for free events.
                </p>
              </div>
              {paymentQRPreview && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Active Payment QR
                </span>
              )}
            </div>

            {paymentQRPreview ? (
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="w-40 h-40 rounded-xl border p-2 bg-white shrink-0">
                  <img src={paymentQRPreview} alt="Payment QR" className="w-full h-full object-contain" />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Payment QR Code Active</p>
                  <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>
                    This QR image is displayed to attendees on the registration form so they can pay and provide transaction ID.
                  </p>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <label className="btn-secondary !text-xs !py-2 cursor-pointer">
                        Replace QR Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handlePaymentQRUpload(e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={() => {
                          setPaymentQRPreview('');
                          void onUpdate({ paymentQRUrl: undefined });
                          showToast('Payment QR removed', 'info');
                        }}
                        className="px-3 py-2 text-xs font-semibold rounded-xl text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer"
                      >
                        Remove QR
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition hover:bg-blue-500/5 text-center"
                  style={{ borderColor: 'var(--dash-border)' }}
                >
                  <Upload className="w-8 h-8 text-blue-500" />
                  <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Click to upload Payment QR image</p>
                  <p className="text-xs" style={{ color: 'var(--dash-muted)' }}>PNG, JPG, WEBP up to 5MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handlePaymentQRUpload(e.target.files[0])}
                    className="hidden"
                    disabled={!canEdit}
                  />
                </label>
              </div>
            )}

            {canEdit && paymentQRPreview && paymentQRPreview.startsWith('data:') && (
              <button
                onClick={handleSavePaymentQR}
                disabled={loading}
                className="btn-primary w-full !py-3 font-semibold cursor-pointer"
              >
                {loading ? 'Uploading & Saving to Supabase...' : 'Save Payment QR Code'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ticketing Features & Verification */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
        <h4 className="font-bold text-base" style={{ color: 'var(--dash-text)' }}>
          Included Ticketing Features
        </h4>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Automatic digital ticket pass generation (Custom sizes)</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Team-size based QRs &amp; member collection</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Real-time QR camera scanner check-in</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--dash-border)' }}>
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Manual ticket number verification (ST-XXXXXX)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
