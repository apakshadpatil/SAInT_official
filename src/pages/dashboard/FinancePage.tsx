import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { addTransaction, subscribeTransactions, setEventBudget } from '../../services/financeService';
import { subscribeEvents } from '../../services/eventService';
import type { FinanceTransaction, EventRecord } from '../../types';
import { fileToDataUrl } from '../../utils/fileUtils';
import { uploadFileToSupabase } from '../../utils/supabase';
import { Download } from 'lucide-react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import RightPanel from '../../components/ui/RightPanel';
import Toggle from '../../components/ui/Toggle';

export default function FinancePage() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);

  // Transaction form state
  const [shopName, setShopName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [associatedEventId, setAssociatedEventId] = useState('');
  const [isSponsorship, setIsSponsorship] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);

  // Budget form state
  const [budgetEventId, setBudgetEventId] = useState('');
  const [budgetValue, setBudgetValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoggingTransaction, setIsLoggingTransaction] = useState(false);
  const [isAdjustingBudget, setIsAdjustingBudget] = useState(false);

  useEffect(() => {
    const unsubTxns = subscribeTransactions(setTransactions);
    const unsubEvents = subscribeEvents(setEvents);
    return () => {
      unsubTxns();
      unsubEvents();
    };
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !shopName || !amount) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let billDataUrl: string | undefined;
      let billFileName: string | undefined;

      if (billFile) {
        billFileName = billFile.name;
        const dest = `bills/${Date.now()}_${billFile.name.replace(/\s+/g, '_')}`;
        try {
          billDataUrl = await uploadFileToSupabase(billFile, dest, 'banners');
        } catch (e) {
          console.warn('Supabase bill upload failed, using fallback base64:', e);
          const fileResult = await fileToDataUrl(billFile);
          billDataUrl = fileResult.dataUrl;
        }
      }

      const eventObj = events.find((ev) => ev.id === associatedEventId);

      await addTransaction({
        shopName,
        purpose,
        amount: Number(amount),
        transactionId,
        eventId: associatedEventId || undefined,
        eventTitle: eventObj?.title || undefined,
        billDataUrl,
        billFileName,
        isSponsorship,
        enteredBy: profile.uid,
        enteredByName: profile.displayName,
      });

      setShopName('');
      setPurpose('');
      setAmount('');
      setTransactionId('');
      setAssociatedEventId('');
      setIsSponsorship(false);
      setBillFile(null);
      // Reset input element
      const fileInput = document.getElementById('bill-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      setSuccess('Transaction logged successfully!');
      setIsLoggingTransaction(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetEventId || !budgetValue) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await setEventBudget(budgetEventId, Number(budgetValue));
      setBudgetEventId('');
      setBudgetValue('');
      setSuccess('Event budget threshold updated successfully!');
      setIsAdjustingBudget(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBill = (txn: FinanceTransaction) => {
    if (!txn.billDataUrl || !txn.billFileName) return;
    const link = document.createElement('a');
    link.href = txn.billDataUrl;
    link.download = txn.billFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Financial Operations</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Log expenditures, manage sponsorships, and adjust budgets</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsLoggingTransaction(true)} className="btn-primary !py-2.5 !px-4 !text-xs"><Plus className="w-4 h-4" /> Log Transaction</button>
          <button onClick={() => setIsAdjustingBudget(true)} className="btn-outline !py-2.5 !px-4 !text-xs"><SlidersHorizontal className="w-4 h-4" /> Set Budget Limit</button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-500/10 text-green-600 text-sm">{success}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Log Transaction Column */}
        <div className="hidden lg:col-span-1 space-y-6" aria-hidden="true">
          <div className="dash-card p-6">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--dash-text)' }}>Log Transaction</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Shop / Vendor Name *</label>
                <input className="input-field" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Purpose of Transaction *</label>
                <input className="input-field" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Amount (₹) *</label>
                  <input className="input-field" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Negative for cost" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Transaction Reference ID</label>
                  <input className="input-field" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Link to Event</label>
                <select className="input-field" value={associatedEventId} onChange={(e) => setAssociatedEventId(e.target.value)}>
                  <option value="">None / Club operations</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Attach Invoice Bill (Optional)</label>
                <input
                  type="file"
                  id="bill-upload-input-legacy"
                  className="input-field !py-2 !px-3 !text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setBillFile(file);
                  }}
                />
                <span className="text-[9px] mt-0.5 block text-slate-400">Max size 900KB</span>
              </div>

              <div className="pt-2">
                <Toggle
                  checked={isSponsorship}
                  onChange={setIsSponsorship}
                  label="Is Sponsorship Deposit"
                  description="Toggle on if this represents corporate or college sponsorship"
                />
              </div>

              <button type="submit" className="btn-primary w-full !py-2.5 !text-xs" disabled={loading}>
                {loading ? 'Processing...' : 'Log Transaction'}
              </button>
            </form>
          </div>

          {/* Set Event Budget Card */}
          <div className="dash-card p-6">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--dash-text)' }}>Adjust Event Budget Limits</h3>
            <form onSubmit={handleSetBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Target Event *</label>
                <select className="input-field" value={budgetEventId} onChange={(e) => setBudgetEventId(e.target.value)} required>
                  <option value="">Choose event...</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Max Budget (₹) *</label>
                <input className="input-field" type="number" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} required min={1} />
              </div>

              <button type="submit" className="btn-primary w-full !py-2.5 !text-xs" disabled={loading}>
                Set Budget Limit
              </button>
            </form>
          </div>
        </div>

        {/* Ledger logs */}
        <div className="lg:col-span-3">
          <div className="dash-card p-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm mb-6" style={{ color: 'var(--dash-text)' }}>Financial Ledger Log</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-500/5 text-xs"
                    style={{ borderColor: 'var(--dash-border)' }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: 'var(--dash-text)' }}>{txn.shopName}</span>
                        {txn.isSponsorship && <span className="text-[9px] capsule-tag !py-0.5">Sponsorship</span>}
                      </div>
                      <p className="text-slate-400 mt-1">{txn.purpose}</p>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--dash-muted)' }}>
                        {txn.eventTitle && <span>Event: <strong>{txn.eventTitle}</strong></span>}
                        <span>By: {txn.enteredByName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                      <div className="text-right">
                        <span className={`font-bold text-sm ${txn.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {txn.amount >= 0 ? '+' : ''}₹{txn.amount}
                        </span>
                        <p className="text-[8px] text-slate-400 mt-0.5">Ref: {txn.transactionId || 'None'}</p>
                      </div>

                      {txn.billDataUrl && (
                        <button
                          onClick={() => handleDownloadBill(txn)}
                          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          title="Download invoice bill"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {transactions.length === 0 && (
                  <p className="text-xs text-center py-12" style={{ color: 'var(--dash-muted)' }}>No transactions logged in the club ledger.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <RightPanel open={isLoggingTransaction} onClose={() => setIsLoggingTransaction(false)} title="Log a Transaction" width="560px">
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Shop / Vendor Name *</label>
            <input className="input-field" value={shopName} onChange={(e) => setShopName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Purpose of Transaction *</label>
            <input className="input-field" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Amount (₹) *</label><input className="input-field" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Negative for cost" required /></div>
            <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Reference ID</label><input className="input-field" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} /></div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Link to Event</label>
            <select className="input-field" value={associatedEventId} onChange={(e) => setAssociatedEventId(e.target.value)}><option value="">None / Club operations</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Attach Invoice Bill (optional)</label>
            <input type="file" id="bill-upload-input" className="input-field !py-2 !px-3 !text-xs" onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
            <span className="text-[9px] mt-0.5 block" style={{ color: 'var(--dash-muted)' }}>Max size 900KB</span>
          </div>
          <Toggle checked={isSponsorship} onChange={setIsSponsorship} label="Is Sponsorship Deposit" description="Enable for corporate or college sponsorship" />
          <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>{loading ? 'Processing...' : 'Log Transaction'}</button>
        </form>
      </RightPanel>

      <RightPanel open={isAdjustingBudget} onClose={() => setIsAdjustingBudget(false)} title="Set an Event Budget Limit" width="480px">
        <form onSubmit={handleSetBudget} className="space-y-4">
          <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Target Event *</label><select className="input-field" value={budgetEventId} onChange={(e) => setBudgetEventId(e.target.value)} required><option value="">Choose event...</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--dash-muted)' }}>Maximum Budget (₹) *</label><input className="input-field" type="number" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} required min={1} /></div>
          <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>{loading ? 'Saving...' : 'Set Budget Limit'}</button>
        </form>
      </RightPanel>
    </div>
  );
}
