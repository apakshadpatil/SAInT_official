import { useEffect, useState } from 'react';
import { subscribeTransactions, computeFinancialAnalytics } from '../../services/financeService';
import { subscribeEvents } from '../../services/eventService';
import type { FinanceTransaction, EventRecord } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Wallet, PiggyBank, Receipt, DollarSign } from 'lucide-react';

export default function FinancialAnalyticsPage() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => {
    const unsubTx = subscribeTransactions(setTransactions);
    const unsubEv = subscribeEvents(setEvents);
    return () => {
      unsubTx();
      unsubEv();
    };
  }, []);

  const analytics = computeFinancialAnalytics(transactions);

  // 1. Data for Income vs Expense Bar Chart
  const incomeVsExpenseData = [
    { name: 'Income / Sponsorships', value: analytics.income },
    { name: 'Expenditures', value: Math.abs(analytics.expenses) },
  ];

  // 2. Data for Category Breakdown (Pie Chart of purposes)
  // Group transactions by simple category key derived from purpose description keywords
  const getCategory = (purpose: string) => {
    const p = purpose.toLowerCase();
    if (p.includes('food') || p.includes('snack') || p.includes('refreshment') || p.includes('lunch')) return 'Refreshments';
    if (p.includes('banner') || p.includes('poster') || p.includes('print') || p.includes('deco') || p.includes('stage')) return 'Decoration & Prints';
    if (p.includes('prize') || p.includes('memento') || p.includes('trophy') || p.includes('gift')) return 'Prizes & Awards';
    if (p.includes('speaker') || p.includes('honorarium') || p.includes('guest')) return 'Guest Speakers';
    return 'Miscellaneous';
  };

  const categoryMap: Record<string, number> = {};
  transactions
    .filter((t) => t.amount < 0) // only expenses
    .forEach((t) => {
      const cat = getCategory(t.purpose);
      categoryMap[cat] = (categoryMap[cat] || 0) + Math.abs(t.amount);
    });

  const categoryData = Object.keys(categoryMap).map((name) => ({
    name,
    value: categoryMap[name],
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // 3. Data for Budget vs Actual Event Spends
  const budgetVsActualData = events
    .filter((e) => e.budget !== undefined)
    .map((e) => {
      // Spent is calculated by summing negative transactions for this eventId
      const actualSpend = transactions
        .filter((t) => t.eventId === e.id && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        name: e.title,
        Budget: e.budget || 0,
        Actual: actualSpend,
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>Financial Analytics</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>Overview of club accounts, sponsorships, and event spending audits</p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Current Balance', value: `₹${analytics.total}`, icon: Wallet, color: 'text-blue-500' },
          { label: 'Sponsorship Inflow', value: `₹${analytics.sponsorships}`, icon: PiggyBank, color: 'text-emerald-500' },
          { label: 'Expenses Outflow', value: `₹${Math.abs(analytics.expenses)}`, icon: Receipt, color: 'text-red-500' },
          { label: 'Transactions count', value: analytics.count, icon: DollarSign, color: 'text-purple-500' },
        ].map((card) => (
          <div key={card.label} className="dash-card !p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--dash-text)' }}>{card.value}</p>
              </div>
              <card.icon className={`w-8 h-8 ${card.color} opacity-80`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart 1: Income vs Expenses */}
        <div className="dash-card p-5">
          <h3 className="font-bold text-sm mb-6" style={{ color: 'var(--dash-text)' }}>Income vs Expenses Audit</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenseData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" stroke="var(--dash-muted)" fontSize={11} />
                <YAxis stroke="var(--dash-muted)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                  {incomeVsExpenseData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div className="dash-card p-5">
          <h3 className="font-bold text-sm mb-6" style={{ color: 'var(--dash-text)' }}>Expense Breakdown by Category</h3>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="w-full sm:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-full sm:w-1/2 flex flex-col gap-2">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate max-w-[120px]" style={{ color: 'var(--dash-text)' }}>{entry.name}</span>
                  <span className="ml-auto font-semibold" style={{ color: 'var(--dash-muted)' }}>₹{entry.value}</span>
                </div>
              ))}
              {categoryData.length === 0 && (
                <p className="text-xs text-center py-10" style={{ color: 'var(--dash-muted)' }}>No expense data logged.</p>
              )}
            </div>
          </div>
        </div>

        {/* Chart 3: Budget vs Actual Event Spends */}
        {budgetVsActualData.length > 0 && (
          <div className="dash-card p-5 lg:col-span-2">
            <h3 className="font-bold text-sm mb-6" style={{ color: 'var(--dash-text)' }}>Event Budgets vs Actual Spendings</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetVsActualData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="var(--dash-muted)" fontSize={11} />
                  <YAxis stroke="var(--dash-muted)" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'var(--dash-card)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
