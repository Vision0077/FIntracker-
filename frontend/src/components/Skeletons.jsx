import React from 'react';

/* ─── Skeleton Primitives ─────────────────────────────── */

export function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]">
      <div className="flex items-start justify-between mb-3">
        <div className="skeleton rounded-xl h-10 w-10" />
        <div className="skeleton rounded-full h-6 w-16" />
      </div>
      <div className="skeleton rounded-lg h-8 w-32 mb-1" />
      <div className="skeleton rounded-lg h-4 w-24 mb-1" />
      <div className="skeleton rounded-lg h-3 w-16" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a] h-64">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton rounded-lg h-4 w-36" />
        <div className="flex gap-2">
          <div className="skeleton rounded-full h-6 w-16" />
          <div className="skeleton rounded-full h-6 w-20" />
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-36">
        {[40, 65, 45, 80, 55, 90, 35, 75, 60, 85, 50, 70].map((h, i) => (
          <div key={i} className="skeleton rounded-t flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="skeleton rounded-xl h-10 w-10 flex-shrink-0" />
      <div className="flex-1">
        <div className="skeleton rounded h-4 w-40 mb-2" />
        <div className="skeleton rounded h-3 w-24" />
      </div>
      <div className="text-right">
        <div className="skeleton rounded h-5 w-20 mb-1" />
        <div className="skeleton rounded h-3 w-12 ml-auto" />
      </div>
    </div>
  );
}

/* Day 6: Analytics page full loading skeleton */
export function SkeletonAnalytics() {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header + period tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="skeleton rounded-lg h-7 w-28" />
        <div className="flex gap-2">
          {[60, 52, 80, 60, 76, 72, 50].map((w, i) => (
            <div key={i} className="skeleton rounded-full h-7" style={{ width: w }} />
          ))}
        </div>
      </div>
      {/* Two chart cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]">
          <div className="skeleton rounded-lg h-4 w-36 mb-5" />
          <div className="skeleton rounded-full w-40 h-40 mx-auto mb-4" />
          <div className="flex flex-wrap gap-2">
            {[48, 60, 52, 44, 56].map((w, i) => (
              <div key={i} className="skeleton rounded-full h-5" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]">
          <div className="skeleton rounded-lg h-4 w-44 mb-5" />
          <div className="flex items-end gap-3 h-40">
            {[55, 80, 45, 70, 60].map((h, i) => (
              <div key={i} className="skeleton rounded-t flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
      {/* Wide bar chart */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]">
        <div className="skeleton rounded-lg h-4 w-52 mb-5" />
        <div className="flex items-end gap-1 h-32">
          {[30, 60, 45, 80, 40, 65, 55, 75, 35, 70, 50, 85, 45, 60].map((h, i) => (
            <div key={i} className="skeleton rounded-t flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Day 6: Transactions page loading skeleton */
export function SkeletonTransactions() {
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="skeleton rounded-lg h-7 w-44 mb-2" />
          <div className="skeleton rounded h-4 w-28" />
        </div>
        <div className="skeleton rounded-xl h-9 w-36" />
      </div>
      {/* Filter bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton rounded-xl h-10" />
        ))}
      </div>
      {/* Transaction rows */}
      <div className="rounded-2xl bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a] overflow-hidden divide-y divide-slate-50 dark:divide-[#1e1e3a]">
        {[1, 2, 3, 4, 5, 6, 7].map(i => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}

/* ─── Empty States ────────────────────────────────────── */

/*
  Day 5: Variant-based EmptyState with unique SVG per context.
  Variants: 'transactions' | 'search' | 'analytics' | 'category' | 'budget'
  Falls back to generic if variant not matched.
*/

const EMPTY_CONFIGS = {
  transactions: {
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="10" y="14" width="60" height="52" rx="8" fill="currentColor" className="text-brand-100 dark:text-brand-900/30" />
        <rect x="10" y="14" width="60" height="52" rx="8" fill="url(#eg)" />
        <rect x="20" y="26" width="28" height="4" rx="2" fill="currentColor" className="text-brand-300 dark:text-brand-600" />
        <rect x="20" y="36" width="20" height="4" rx="2" fill="currentColor" className="text-brand-200 dark:text-brand-700" />
        <rect x="20" y="46" width="24" height="4" rx="2" fill="currentColor" className="text-brand-200 dark:text-brand-700" />
        <circle cx="58" cy="26" r="3" fill="currentColor" className="text-brand-400 dark:text-brand-500" />
        <circle cx="58" cy="36" r="3" fill="currentColor" className="text-slate-200 dark:text-slate-700" />
        <circle cx="58" cy="46" r="3" fill="currentColor" className="text-slate-200 dark:text-slate-700" />
        <circle cx="56" cy="60" r="12" fill="currentColor" className="text-brand-500/20" />
        <path d="M52 60h8M56 56v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand-500" />
        <defs>
          <linearGradient id="eg" x1="10" y1="14" x2="70" y2="66" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="1" stopColor="#a855f7" stopOpacity="0.04" />
          </linearGradient>
        </defs>
      </svg>
    ),
    title: 'No transactions yet',
    body: 'Add your first transaction using Quick Add, or import a bank statement to get started.',
  },
  search: {
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="34" cy="34" r="18" stroke="currentColor" strokeWidth="3" fill="none" className="text-brand-300 dark:text-brand-700" />
        <circle cx="34" cy="34" r="18" fill="currentColor" className="text-brand-50 dark:text-brand-900/20" />
        <line x1="47" y1="47" x2="62" y2="62" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-400 dark:text-brand-600" />
        <path d="M29 30 Q34 26 39 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" className="text-brand-300 dark:text-brand-600" />
        <circle cx="34" cy="38" r="2" fill="currentColor" className="text-brand-400 dark:text-brand-500" />
      </svg>
    ),
    title: 'No results found',
    body: 'Try adjusting your search term or clearing the category and type filters.',
  },
  analytics: {
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="12" y="44" width="10" height="22" rx="3" fill="currentColor" className="text-brand-200 dark:text-brand-800" />
        <rect x="26" y="32" width="10" height="34" rx="3" fill="currentColor" className="text-brand-300 dark:text-brand-700" />
        <rect x="40" y="20" width="10" height="46" rx="3" fill="currentColor" className="text-brand-400 dark:text-brand-600" />
        <rect x="54" y="38" width="10" height="28" rx="3" fill="currentColor" className="text-brand-200 dark:text-brand-800" />
        <circle cx="58" cy="18" r="10" fill="currentColor" className="text-amber-400/20" />
        <path d="M55 18h6M58 15v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-500" />
      </svg>
    ),
    title: 'No data to analyze',
    body: 'Once you add transactions, your spending charts and insights will appear here.',
  },
  category: {
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="40" cy="40" r="28" fill="currentColor" className="text-brand-50 dark:text-brand-900/20" />
        <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" fill="none" className="text-brand-200 dark:text-brand-700" />
        <circle cx="40" cy="40" r="10" fill="currentColor" className="text-brand-300 dark:text-brand-700" />
      </svg>
    ),
    title: 'No spending categories',
    body: 'Your category breakdown will show here once you have expenses recorded this month.',
  },
  budget: {
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="14" y="22" width="52" height="36" rx="8" fill="currentColor" className="text-brand-50 dark:text-brand-900/20" />
        <rect x="14" y="22" width="52" height="36" rx="8" stroke="currentColor" strokeWidth="2" fill="none" className="text-brand-200 dark:text-brand-700" />
        <rect x="22" y="34" width="36" height="6" rx="3" fill="currentColor" className="text-brand-100 dark:text-brand-800" />
        <rect x="22" y="34" width="14" height="6" rx="3" fill="currentColor" className="text-brand-400 dark:text-brand-500" />
        <circle cx="40" cy="18" r="6" fill="currentColor" className="text-emerald-400/20" />
        <path d="M37.5 18l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500" />
      </svg>
    ),
    title: 'No budgets set',
    body: 'Add a budget limit in Settings to track your spending per category each month.',
  },
};

export function EmptyState({ variant = 'transactions', message, body }) {
  const cfg = EMPTY_CONFIGS[variant] || EMPTY_CONFIGS.transactions;
  const title = message || cfg.title;
  const desc = body || cfg.body;

  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="mb-5 opacity-90">{cfg.svg}</div>
      <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}
