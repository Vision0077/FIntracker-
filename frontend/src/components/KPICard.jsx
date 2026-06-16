import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function KPICard({ title, amount, change, changeLabel, icon, color, delay = 0 }) {
  const isPositive = change >= 0;
  return (
    <div
      className="card-hover rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a] relative overflow-hidden"
      style={{ animation: `fadeUp 0.5s ease-out ${delay}s both` }}
    >
      {/* Decorative circle */}
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10" style={{ background: color }} />

      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}20` }}>
          <span className="text-xl">{icon}</span>
        </div>
        {change !== null && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div className="text-2xl font-bold font-display mb-1 text-slate-800 dark:text-white">
        {formatCurrency(amount, true)}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      {changeLabel && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{changeLabel}</div>}
    </div>
  );
}
