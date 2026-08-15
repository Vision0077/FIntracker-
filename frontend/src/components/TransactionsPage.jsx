import React, { useState, useMemo } from 'react';
import { Search, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp, CATEGORIES, PAYMENT_METHODS } from '../context/AppContext';
import TransactionRow from './TransactionRow';
import { EmptyState, SkeletonTransactions } from './Skeletons';
import { apiUpload, apiUploadPreview } from '../utils/api';
import { formatCurrency, getCategoryIcon, getMethodIcon } from '../utils/helpers';

// Day 18+19: 4-step upload stepper
// Step 1: Drop zone  → Step 2: Parsing (preview call) → Step 3: Review table → Step 4: Done
const STEPS = ['Upload', 'Parsing', 'Review', 'Done'];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                done    ? 'bg-emerald-500 text-white' :
                active  ? 'bg-brand-500 text-white ring-4 ring-brand-500/20' :
                          'bg-slate-200 dark:bg-[#1e1e3a] text-slate-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[9px] font-medium ${active ? 'text-brand-500' : done ? 'text-emerald-500' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded mb-3 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-[#1e1e3a]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function UploadModal({ onClose }) {
  const { token, refreshData } = useApp();
  const [step, setStep] = useState(0);  // 0=upload 1=parsing 2=review 3=done
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);   // UploadPreviewResponse
  const [result, setResult] = useState(null);     // UploadResponse (after confirm)
  const [error, setError] = useState('');

  const handleFile = (f) => {
    const ok = f.name.endsWith('.csv') || f.name.endsWith('.pdf') ||
               f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.txt');
    if (!ok) { setError('Please upload a PDF, CSV, or Excel file.'); return; }
    setError('');
    setFile(f);
  };

  // Step 1 → 2 → 3: preview (dry-run)
  const handlePreview = async () => {
    if (!file) return;
    setStep(1);
    setError('');
    try {
      const data = await apiUploadPreview(file, token);
      setPreview(data);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Preview failed');
      setStep(0);
    }
  };

  // Step 3 → 4: real import
  const handleConfirm = async () => {
    setStep(1);   // reuse parsing spinner
    setError('');
    try {
      const data = await apiUpload(file, token);
      setResult(data);
      setStep(3);
      if (refreshData) await refreshData(token);
    } catch (err) {
      setError(err.message || 'Import failed');
      setStep(2);  // go back to review on error
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 bg-white dark:bg-[#13132b] shadow-2xl border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.2s ease-out' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-display text-slate-800 dark:text-white">📄 Import Bank Statement</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e3a] text-slate-500 transition-colors text-xl leading-none">×</button>
        </div>

        <StepBar current={step} />

        {/* Error banner */}
        {error && (
          <div className="p-3 mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        {/* Step 0: Drop zone */}
        {step === 0 && (
          <>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/10'
                  : 'border-slate-200 dark:border-[#1e1e3a] hover:border-brand-400 dark:hover:border-brand-500/50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('file-upload-v2').click()}
            >
              <input id="file-upload-v2" type="file" accept=".pdf,.csv,.xlsx,.xls,.txt" hidden
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              <div className="text-4xl mb-3">{file ? '📂' : '☁️'}</div>
              {file ? (
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-300">Drop your statement here</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, CSV, or Excel (.xlsx) • HDFC / SBI / ICICI / Axis</p>
                </div>
              )}
            </div>
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0d0d1f] text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">✨ AI Auto-Categorization</span> — transactions will be auto-categorized into Food, Travel, Bills, etc. You'll review before importing.
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d52] text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e1e3a] transition-all">Cancel</button>
              <button onClick={handlePreview} disabled={!file}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all disabled:opacity-50 active:scale-95">
                Preview →
              </button>
            </div>
          </>
        )}

        {/* Step 1: Parsing spinner */}
        {step === 1 && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Parsing your statement…</p>
            <p className="text-xs text-slate-400">Detecting columns, dates, amounts, and categories</p>
          </div>
        )}

        {/* Step 2: Review table */}
        {step === 2 && preview && (
          <>
            {/* Summary chips */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                {preview.new_rows} new
              </span>
              {preview.duplicate_rows > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1e1e3a] text-slate-500 text-xs font-semibold">
                  {preview.duplicate_rows} already imported
                </span>
              )}
              {preview.errors?.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold">
                  {preview.errors.length} rows skipped
                </span>
              )}
            </div>

            {/* Scrollable review table */}
            <div className="rounded-xl border border-slate-100 dark:border-[#1e1e3a] overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#0d0d1f]">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Date</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Description</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Amount</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Cat.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#1e1e3a]">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className={`transition-colors ${row.is_duplicate ? 'opacity-40' : 'hover:bg-slate-50 dark:hover:bg-[#1e1e3a]/50'}`}>
                        <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-3 py-1.5 max-w-[160px]">
                          <p className={`truncate ${row.is_duplicate ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {row.description}
                          </p>
                          {row.is_duplicate && <span className="text-[9px] text-slate-400 font-medium">already imported</span>}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-semibold whitespace-nowrap ${row.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {row.type === 'EXPENSE' ? '-' : '+'}₹{row.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500" title={row.category}>
                          {getCategoryIcon(row.category)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parse errors */}
            {preview.errors?.length > 0 && (
              <details className="mt-2 text-xs text-amber-600">
                <summary className="cursor-pointer font-medium">{preview.errors.length} rows had parse errors — click to expand</summary>
                <ul className="mt-1 space-y-0.5 pl-3 text-slate-500">
                  {preview.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(0)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d52] text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e1e3a] transition-all">← Back</button>
              <button onClick={handleConfirm} disabled={preview.new_rows === 0}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-brand-500/25">
                Import {preview.new_rows} transactions →
              </button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 3 && result && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">✅</div>
            <h4 className="font-bold font-display text-slate-800 dark:text-white mb-1">Import Complete!</h4>
            <p className="text-sm text-slate-500 mb-1">{result.transactions_imported} transactions imported</p>
            {result.transactions_skipped > 0 && (
              <p className="text-xs text-slate-400">{result.transactions_skipped} duplicates skipped</p>
            )}
            <button onClick={onClose} className="mt-5 px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-all active:scale-95">
              View Transactions
            </button>
          </div>
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
          <input id="txn-search" type="text" placeholder="Search… (Ctrl+K)" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="form-input pl-8 text-xs" />
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
