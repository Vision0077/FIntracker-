import React from 'react';

export function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]">
      <div className="skeleton rounded-lg h-4 w-24 mb-4" />
      <div className="skeleton rounded-lg h-8 w-36 mb-2" />
      <div className="skeleton rounded-lg h-3 w-20" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a] h-64">
      <div className="skeleton rounded-lg h-4 w-40 mb-6" />
      <div className="flex items-end gap-2 h-36">
        {[40,70,50,90,60,80,45,95,55,75,85,65].map((h, i) => (
          <div key={i} className="skeleton rounded-t flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="skeleton rounded-full h-10 w-10 flex-shrink-0" />
      <div className="flex-1">
        <div className="skeleton rounded h-4 w-48 mb-2" />
        <div className="skeleton rounded h-3 w-24" />
      </div>
      <div className="skeleton rounded h-5 w-20" />
    </div>
  );
}

export function EmptyState({ message = 'No transactions yet' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, #6366f120, #a855f720)' }}
      >
        <span className="text-4xl">📭</span>
      </div>
      <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{message}</h3>
      <p className="text-sm text-slate-400 max-w-xs">Add a transaction using the Quick Add form or upload a bank statement.</p>
    </div>
  );
}
