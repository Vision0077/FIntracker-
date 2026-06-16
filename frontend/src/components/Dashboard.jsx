import React from 'react';
import { useApp } from '../context/AppContext';
import { SkeletonCard, SkeletonChart, SkeletonRow } from './Skeletons';
import KPICard from './KPICard';
import SpendingChart from './SpendingChart';
import QuickAddForm from './QuickAddForm';
import TransactionRow from './TransactionRow';
import { EmptyState } from './Skeletons';
import { ChevronRight } from 'lucide-react';
import { getCategoryIcon, formatCurrency } from '../utils/helpers';

export default function Dashboard() {
  const {
    transactions, deleteTransaction, isLoading,
    monthlyIncome, monthlyExpenses, totalBalance,
    lastMonthIncome, lastMonthExpenses,
    categoryBreakdownPct, setActivePage,
  } = useApp();

  const incomeChange = lastMonthIncome
    ? Math.round(((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100)
    : 0;
  const expenseChange = lastMonthExpenses
    ? Math.round(((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100)
    : 0;

  const recentTxns = transactions.slice(0, 5);

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3"><SkeletonChart /></div>
        <div className="lg:col-span-2"><SkeletonCard /></div>
      </div>
      <div className="space-y-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Balance" amount={totalBalance} icon="💰" color="#6366f1" change={null} delay={0} />
        <KPICard title="Monthly Income" amount={monthlyIncome} icon="📈" color="#10b981" change={incomeChange} changeLabel="vs last month" delay={0.05} />
        <KPICard title="Monthly Expenses" amount={monthlyExpenses} icon="📉" color="#f43f5e" change={expenseChange} changeLabel="vs last month" delay={0.1} />
      </div>

      {/* Chart + Quick Add */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3"><SpendingChart /></div>
        <div className="lg:col-span-2"><QuickAddForm /></div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.5s ease-out 0.25s both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-3">Spending by Category — This Month</h3>
        <div className="space-y-2">
          {categoryBreakdownPct.slice(0, 5).map(cat => (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: cat.color }} />
                  {getCategoryIcon(cat.category)} {cat.category}
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formatCurrency(cat.amount, true)} ({cat.percentage}%)
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${cat.percentage}%`, background: cat.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.5s ease-out 0.3s both' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold font-display text-slate-800 dark:text-white">Recent Transactions</h3>
          <button
            onClick={() => setActivePage('transactions')}
            className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>
        {recentTxns.length === 0
          ? <EmptyState />
          : <div className="space-y-1">
              {recentTxns.map((t, i) => <TransactionRow key={t.id} txn={t} onDelete={deleteTransaction} delay={i * 0.05} />)}
            </div>
        }
      </div>
    </div>
  );
}
