import React from 'react';
import { Trash2, X } from 'lucide-react';

/*
  Day 14: Reusable slide-in confirmation dialog
  Props:
    message   - string shown above the action buttons
    onConfirm - called when user clicks delete
    onCancel  - called when user clicks cancel
    className - extra classes on the container (for positioning)
*/
export default function ConfirmDialog({ message, onConfirm, onCancel, className = '' }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 shadow-lg ${className}`}
      style={{ animation: 'fadeUp 0.15s ease-out' }}
    >
      {message && (
        <span className="text-xs text-rose-700 dark:text-rose-300 font-medium flex-1 leading-tight">
          {message}
        </span>
      )}
      <button
        type="button"
        onClick={onConfirm}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
      >
        <Trash2 size={11} />
        Delete
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 dark:text-rose-400 transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}
