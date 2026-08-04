import React from 'react';
import { LayoutDashboard, ArrowLeftRight, BarChart2, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'transactions', label: 'Txns', Icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function MobileNav() {
  const { activePage, setActivePage } = useApp();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-surface-page border-t border-slate-100 dark:border-surface-border px-2 pb-safe">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActivePage(id)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
              activePage === id
                ? 'text-brand-500 bg-brand-500/8 dark:bg-brand-500/10'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
