import React, { useState, useMemo } from 'react';
import { Search, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp, CATEGORIES, PAYMENT_METHODS } from '../context/AppContext';
import { apiUpload } from '../utils/api';
import TransactionRow from './TransactionRow';
import { EmptyState, SkeletonTransactions } from './Skeletons';
import { getCategoryIcon, getMethodIcon } from '../utils/helpers';

function UploadModal({ onClose }) {
  const { token, refreshData } = useApp();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [error, setError] = useState('');

  const handleFile = (f) => {
    const allowed = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(f.type) && !f.name.endsWith('.csv') && !f.name.endsWith('.xlsx') && !f.name.endsWith('.pdf')) {
      alert('Please upload a PDF, CSV, or Excel file.');
      return;
    }
    setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setError('');
    try {
      const res = await apiUpload(file, token);
      setParsedCount(res.transactions_parsed || 0);
      setDone(true);
      if (refreshData) await refreshData(token);
    } catch (err) {
      setError(err.message || 'Statement upload failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop bg-slate-900/60 dark:bg-black/75 backdrop-blur"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content w-full max-w-md rounded-2xl p-6 bg-white dark:bg-[#13132b] shadow-2xl border border-slate-100 dark:border-[#1e1e3a]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold font-display text-slate-800 dark:text-white">📄 Import Bank Statement</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e3a] text-slate-500 transition-colors text-xl">×</button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">✅</div>
            <h4 className="font-semibold text-slate-800 dark:text-white mb-2">Statement Processed!</h4>
            <p className="text-sm text-slate-500">{parsedCount} transactions found and categorized.</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-all">View Transactions</button>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/10'
                  : 'border-slate-200 dark:border-surface-muted hover:border-brand-400 dark:hover:border-brand-500/50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input id="file-upload" type="file" accept=".pdf,.csv,.xlsx,.xls" hidden onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              <div className="text-4xl mb-3">{file ? '📂' : '☁️'}</div>
              {file ? (
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-300">Drop your statement here</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, CSV, or Excel • UPI / Bank / Credit Card</p>
                </div>
              )}
            </div>
            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-[#0d0d1f] text-xs text-slate-500 dark:text-slate-400">
              <p className="font-medium mb-1">✨ AI Auto-Categorization</p>
              <p>Transactions will be automatically categorized into Food, Travel, Bills, etc.</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d52] text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e1e3a] transition-all">Cancel</button>
              <button onClick={handleProcess} disabled={!file || processing} className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</> : <>⚡ Process with AI</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { transactions, deleteTransaction, isLoading } = useApp();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterMethod, setFilterMethod] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [uploadModal, setUploadModal] = useState(false);
  const pageSize = 15;

  // Day 6: show skeleton while data loads
  if (isLoading) return <SkeletonTransactions />;

  // ponytail: was recalculated on every render; memoize on exact deps
  const filtered = useMemo(() => transactions
    .filter(t => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
      if (filterMethod !== 'ALL' && t.payment_method !== filterMethod) return false;
      if (filterType !== 'ALL' && t.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.transaction_date) - new Date(a.transaction_date);
      if (sortBy === 'date_asc') return new Date(a.transaction_date) - new Date(b.transaction_date);
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return 0;
    }),
  [transactions, search, filterCategory, filterMethod, filterType, sortBy]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const SortBtn = ({ field, label }) => {
    const active = sortBy.startsWith(field);
    const isDesc = sortBy === `${field}_desc`;
    return (
      <button
        onClick={() => setSortBy(active && isDesc ? `${field}_asc` : `${field}_desc`)}
        className={`flex items-center gap-1 text-xs font-medium ${active ? 'text-brand-500' : 'text-slate-500 dark:text-slate-400'} hover:text-brand-500 transition-colors`}
      >
        {label}
        {active && (isDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-slate-800 dark:text-white">All Transactions</h2>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} transactions found</p>
        </div>
        <button
          onClick={() => setUploadModal(true)}
          id="upload-statement-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-brand-500/25"
        >
          <Upload size={16} /> Import Statement
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></span>
          <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="form-input pl-8 text-xs" />
        </div>
        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }} className="form-input text-xs">
          <option value="ALL">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setPage(1); }} className="form-input text-xs">
          <option value="ALL">All Methods</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="form-input text-xs">
          <option value="ALL">All Types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-4 mb-3 px-3">
        <span className="text-xs text-slate-400">Sort:</span>
        <SortBtn field="date" label="Date" />
        <SortBtn field="amount" label="Amount" />
      </div>

      {/* Transaction list */}
      <div className="rounded-2xl bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a] overflow-hidden">
        {paginated.length === 0
          ? (
            // Day 5: context-aware empty state
            search || filterCategory !== 'ALL' || filterMethod !== 'ALL' || filterType !== 'ALL'
              ? <EmptyState variant="search" />
              : <EmptyState variant="transactions" />
          )
          : <div className="divide-y divide-slate-50 dark:divide-[#1e1e3a]">
              {paginated.map((t, i) => <TransactionRow key={t.id} txn={t} onDelete={deleteTransaction} delay={i * 0.02} />)}
            </div>
        }
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-surface-muted/30 transition-colors"
          >← Prev</button>
          <span className="text-xs text-slate-500 dark:text-slate-400">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-card text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-surface-muted/30 transition-colors"
          >Next →</button>
        </div>
      )}

      {uploadModal && <UploadModal onClose={() => setUploadModal(false)} />}
    </div>
  );
}
