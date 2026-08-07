import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp, CATEGORIES, PAYMENT_METHODS } from '../context/AppContext';
import { getCategoryIcon, getMethodIcon, formatAmountDisplay, parseAmountRaw } from '../utils/helpers';
import DatePicker from './DatePicker';

/*
  Day 8: Real-time inline validation
  Day 9: Amount input formatter (Indian locale commas)
  Day 10: DatePicker (custom calendar dropdown)
  Day 11: Description autocomplete (from transaction history)
*/

// Returns: 'idle' | 'valid' | 'invalid'
function getFieldState(value, touched, validator) {
  if (!touched) return 'idle';
  return validator(value) ? 'valid' : 'invalid';
}

function FieldIcon({ state }) {
  if (state === 'valid')   return <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />;
  if (state === 'invalid') return <AlertCircle  size={15} className="text-rose-400 flex-shrink-0" />;
  return null;
}

function fieldClass(state) {
  if (state === 'valid')   return 'form-input border-emerald-400 dark:border-emerald-500/60 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]';
  if (state === 'invalid') return 'form-input border-rose-400 dark:border-rose-500/60 focus:border-rose-400 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.15)]';
  return 'form-input';
}

export default function QuickAddForm() {
  const { addTransaction, transactions } = useApp();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'FOOD',
    payment_method: 'UPI',
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'EXPENSE',
  });

  // touched: tracks which fields the user has focused & left (or typed in)
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Day 11: Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);     // keyboard nav index
  const blurTimerRef = useRef(null);                      // delay close so click fires first

  const set = useCallback((k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setTouched(t => ({ ...t, [k]: true })); // mark touched on any change
  }, []);

  // Day 11: Unique past descriptions, deduplicated and sorted by frequency
  // useMemo so we don't re-scan transactions array on every keystroke
  const pastDescriptions = useMemo(() => {
    const freq = {};
    transactions.forEach(t => {
      const d = t.description?.trim();
      if (d) freq[d] = (freq[d] || 0) + 1;
    });
    // Sort by frequency desc → most-used descriptions appear first
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d);
  }, [transactions]);

  // Day 11: Filter suggestions matching current input (case insensitive, max 5)
  const suggestions = useMemo(() => {
    const q = form.description.trim().toLowerCase();
    if (!q) return [];
    return pastDescriptions
      .filter(d => d.toLowerCase().includes(q) && d.toLowerCase() !== q)
      .slice(0, 5);
  }, [form.description, pastDescriptions]);

  // Validators — return true = valid
  // Day 9: amount stored as formatted display string; parseAmountRaw strips commas before checking
  const validators = {
    amount:      v => { const n = Number(parseAmountRaw(v)); return v !== '' && !isNaN(n) && n > 0; },
    description: v => v.trim().length > 0,
    transaction_date: v => Boolean(v),
  };

  const amountState  = getFieldState(form.amount, touched.amount, validators.amount);
  const descState    = getFieldState(form.description, touched.description, validators.description);
  const dateState    = getFieldState(form.transaction_date, touched.transaction_date, validators.transaction_date);

  const isFormValid = validators.amount(form.amount) && validators.description(form.description) && validators.transaction_date(form.transaction_date);

  // Day 11: Select a suggestion
  const selectSuggestion = useCallback((desc) => {
    setForm(f => ({ ...f, description: desc }));
    setTouched(t => ({ ...t, description: true }));
    setShowSuggestions(false);
    setActiveIndex(-1);
  }, []);

  // Day 11: Keyboard handler on description input
  const handleDescKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const handleDescFocus = () => {
    clearTimeout(blurTimerRef.current);
    if (suggestions.length > 0) setShowSuggestions(true);
  };

  const handleDescBlur = () => {
    // Delay close so mousedown on a suggestion fires before blur hides the list
    blurTimerRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setActiveIndex(-1);
      setTouched(t => ({ ...t, description: true }));
    }, 150);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    // Touch all fields on submit attempt to reveal any hidden errors
    setTouched({ amount: true, description: true, transaction_date: true });
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      const ok = await addTransaction({ ...form, amount: Number(parseAmountRaw(form.amount)) });
      if (ok !== false) {
        setForm(f => ({ ...f, description: '', amount: '' }));
        setTouched({});
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]"
      style={{ animation: 'fadeUp 0.5s ease-out 0.2s both' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold font-display text-slate-800 dark:text-white">Quick Add</h3>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-[#2d2d52]">
          {['EXPENSE', 'INCOME'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                form.type === t
                  ? t === 'EXPENSE' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e1e3a]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>

        {/* Amount — Day 8: real-time validation | Day 9: amount formatter */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
            <input
              id="quick-amount"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1,250"
              value={form.amount}
              onChange={e => set('amount', formatAmountDisplay(e.target.value))}
              onBlur={() => setTouched(t => ({ ...t, amount: true }))}
              className={`${fieldClass(amountState)} pl-8 pr-8`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <FieldIcon state={amountState} />
            </span>
          </div>
          {amountState === 'invalid' && (
            <p className="text-rose-500 dark:text-rose-400 text-xs mt-1 flex items-center gap-1">
              Enter a valid amount greater than ₹0
            </p>
          )}
        </div>

        {/* Description — Day 8: validation | Day 11: autocomplete dropdown */}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
          <div className="relative">
            <input
              id="quick-description"
              type="text"
              placeholder="e.g. Zomato lunch order"
              value={form.description}
              onChange={e => {
                set('description', e.target.value);
                setShowSuggestions(true);
                setActiveIndex(-1);
              }}
              onFocus={handleDescFocus}
              onBlur={handleDescBlur}
              onKeyDown={handleDescKeyDown}
              className={`${fieldClass(descState)} pr-8`}
              autoComplete="off"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <FieldIcon state={descState} />
            </span>
          </div>

          {/* Day 11: Suggestion dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="absolute z-40 left-0 right-0 mt-1 rounded-xl bg-white dark:bg-[#13132b] border border-slate-200 dark:border-[#1e1e3a] shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden"
              style={{ animation: 'fadeUp 0.12s ease-out' }}
            >
              {suggestions.map((s, i) => {
                const q = form.description.trim().toLowerCase();
                const matchIdx = s.toLowerCase().indexOf(q);
                // Bold the matching substring
                const before = s.slice(0, matchIdx);
                const match  = s.slice(matchIdx, matchIdx + q.length);
                const after  = s.slice(matchIdx + q.length);
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${
                        i === activeIndex
                          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1e1e3a]'
                      }`}
                    >
                      <span className="text-slate-400 dark:text-slate-500 text-xs">↑</span>
                      <span>
                        {before}
                        <strong className="font-semibold text-brand-600 dark:text-brand-400">{match}</strong>
                        {after}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {descState === 'invalid' && (
            <p className="text-rose-500 dark:text-rose-400 text-xs mt-1">
              Description is required
            </p>
          )}
        </div>

        {/* Category + Method */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="form-input"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Method</label>
            <select
              value={form.payment_method}
              onChange={e => set('payment_method', e.target.value)}
              className="form-input"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{getMethodIcon(m)} {m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date — Day 10: custom DatePicker */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <DatePicker
            id="quick-date"
            value={form.transaction_date}
            onChange={v => { set('transaction_date', v); setTouched(t => ({ ...t, transaction_date: true })); }}
            maxDate={new Date().toISOString().split('T')[0]}
          />
          {dateState === 'invalid' && (
            <p className="text-rose-500 dark:text-rose-400 text-xs mt-1">Date is required</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || success}
          id="quick-add-submit"
          className={`w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 ${
            success
              ? 'bg-emerald-500'
              : form.type === 'EXPENSE'
                ? 'bg-rose-500 hover:bg-rose-600 active:scale-95 shadow-lg shadow-rose-500/25'
                : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 shadow-lg shadow-emerald-500/25'
          } disabled:opacity-60`}
        >
          {submitting
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : success
              ? <><Check size={16} /> Added!</>
              : <><Plus size={16} /> Add {form.type === 'EXPENSE' ? 'Expense' : 'Income'}</>
          }
        </button>
      </form>
    </div>
  );
}
