import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CATEGORY_COLORS } from '../context/AppContext';
import { formatCurrency, formatDate, getCategoryIcon, getMethodIcon } from '../utils/helpers';

export default function TransactionRow({ txn, onDelete, delay = 0 }) {
  const [showActions, setShowActions] = useState(false);
  const catColor = CATEGORY_COLORS[txn.category] || '#6366f1';

  return (
    <div
      className="table-row flex items-center gap-3 p-3 rounded-xl group relative"
      style={{ animation: `fadeUp 0.4s ease-out ${delay}s both` }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: `${catColor}18` }}
      >
        {getCategoryIcon(txn.category)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{txn.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: `${catColor}18`, color: catColor }}
          >
            {txn.category}
          </span>
          <span className="text-xs text-slate-400">{getMethodIcon(txn.payment_method)} {txn.payment_method}</span>
          <span className="text-xs text-slate-400">{formatDate(txn.transaction_date)}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p className={`text-sm font-bold ${txn.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
          {txn.type === 'INCOME' ? '+' : '-'}{formatCurrency(txn.amount)}
        </p>
        <span className={`badge ${txn.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
          {txn.type}
        </span>
      </div>

      {/* Delete button */}
      {showActions && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(txn.id); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 transition-all"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
