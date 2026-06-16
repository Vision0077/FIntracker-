import React from 'react';
import { LayoutDashboard, ArrowLeftRight, BarChart2, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const { activePage, setActivePage, theme, toggleTheme, monthlyIncome, monthlyExpenses, logout } = useApp();
  const netSavings = monthlyIncome - monthlyExpenses;

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white dark:bg-[#0a0a1e] border-r border-slate-100 dark:border-[#1e1e3a] fixed top-0 left-0 z-40">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100 dark:border-[#1e1e3a]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>₹</div>
          <div>
            <p className="font-bold font-display text-slate-800 dark:text-white">FinTrack</p>
            <p className="text-[10px] text-slate-400">Smart Expense Tracker</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActivePage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activePage === id ? 'nav-active' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#13132b] hover:text-slate-800 dark:hover:text-white'}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      {/* Net savings summary */}
      <div className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-brand-500/10 to-purple-500/5 border border-brand-200/30 dark:border-brand-500/20">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Net Savings — June</p>
        <p className={`text-lg font-bold font-display ${netSavings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings, true)}
        </p>
        <div className="progress-bar mt-2">
          <div className="progress-fill" style={{ width: `${Math.min(100, monthlyIncome > 0 ? (netSavings / monthlyIncome) * 100 : 0)}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)' }} />
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-slate-100 dark:border-[#1e1e3a] space-y-1">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#13132b] transition-colors">
          {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-brand-400" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
