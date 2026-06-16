import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';
import { formatCurrency, getCategoryIcon } from '../utils/helpers';

const PERIODS = ['Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Half-yearly', 'Yearly'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="glass rounded-xl p-3 shadow-xl text-xs">
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-slate-600 dark:text-slate-300">{p.name || p.payload?.category || p.payload?.method}: </span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { categoryBreakdownPct, paymentBreakdown, spendingTrends, monthlyIncome, monthlyExpenses, lastMonthIncome, lastMonthExpenses } = useApp();
  const [period, setPeriod] = useState('Monthly');
  const [customStart, setCustomStart] = useState('2026-05-01');
  const [customEnd, setCustomEnd] = useState('2026-06-09');

  const comparisons = [
    { label: 'Income', current: monthlyIncome, previous: lastMonthIncome, color: '#10b981' },
    { label: 'Expenses', current: monthlyExpenses, previous: lastMonthExpenses, color: '#f43f5e' },
    { label: 'Net Savings', current: monthlyIncome - monthlyExpenses, previous: lastMonthIncome - lastMonthExpenses, color: '#6366f1' },
  ];

  const CompareBar = ({ item }) => {
    const max = Math.max(item.current, item.previous, 1);
    const change = item.previous ? Math.round(((item.current - item.previous) / item.previous) * 100) : 0;
    const isPositive = item.label === 'Expenses' ? change < 0 : change >= 0;
    return (
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d0d1f]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
          <span className={`badge ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-xl font-bold font-display text-slate-800 dark:text-white">{formatCurrency(item.current, true)}</span>
          <span className="text-xs text-slate-400 mb-1">vs {formatCurrency(item.previous, true)}</span>
        </div>
        <div className="space-y-1.5">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(item.current / max) * 100}%`, background: item.color }} />
          </div>
          <div className="progress-bar">
            <div className="progress-fill opacity-40" style={{ width: `${(item.previous / max) * 100}%`, background: item.color }} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 rounded" style={{ background: item.color }} />Current
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 rounded opacity-40" style={{ background: item.color }} />Previous
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold font-display text-slate-800 dark:text-white">Analytics</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'bg-white dark:bg-[#13132b] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2d2d52] hover:border-brand-400'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">From</label>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="form-input text-xs" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">To</label>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="form-input text-xs" />
        </div>
      </div>

      {/* Period Comparison */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.5s ease-out 0.05s both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-4">📊 Period Comparison — June vs May 2026</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {comparisons.map(item => <CompareBar key={item.label} item={item} />)}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category pie */}
        <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.5s ease-out 0.1s both' }}>
          <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-3">🍕 Category Breakdown</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryBreakdownPct} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="amount" nameKey="category" paddingAngle={3}>
                  {categoryBreakdownPct.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryBreakdownPct.map(c => (
              <div key={c.category} className="flex items-center gap-1 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                <span className="text-slate-600 dark:text-slate-400">{getCategoryIcon(c.category)} {c.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment method breakdown */}
        <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.5s ease-out 0.15s both' }}>
          <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-3">💳 Payment Method Breakdown</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentBreakdown} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="method" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, true)} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]}>
                  {paymentBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily spending bar chart */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.5s ease-out 0.2s both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-3">📅 Daily Spending — Last 30 Days</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendingTrends} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, true)} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="expense" name="Expense" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-brand-500/10 via-purple-500/5 to-pink-500/10 border border-brand-200/30 dark:border-brand-500/20" style={{ animation: 'fadeUp 0.5s ease-out 0.25s both' }}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">🤖</div>
          <div>
            <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-1">AI Money Insights</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Patterns detected from your spending behaviour</p>
            <div className="space-y-2">
              {[
                { icon: '⚠️', text: 'Food spending is ₹5,240 — 65% of your ₹8,000 budget. Consider meal prepping to reduce delivery costs.' },
                { icon: '✅', text: 'Rent & subscriptions are stable. These are not flagged as anomalies — regular recurring expenses detected.' },
                { icon: '💡', text: 'You spent 23% more on Travel this month. Peak cab usage on Fridays — consider sharing rides.' },
                { icon: '🎯', text: 'Net savings this month: ₹34,000. Great job keeping expenses below income!' },
              ].map((ins, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-white/60 dark:bg-[#13132b]/60 backdrop-blur-sm">
                  <span className="text-sm mt-0.5">{ins.icon}</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
