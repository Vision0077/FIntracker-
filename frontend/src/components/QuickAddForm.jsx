import React, { useState, useCallback } from 'react';
import { Plus, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp, CATEGORIES, PAYMENT_METHODS } from '../context/AppContext';
import { getCategoryIcon, getMethodIcon } from '../utils/helpers';

/*
  Day 8: Real-time inline validation
  - Each field validates onChange, not just onSubmit
  - 'touched' tracks which fields the user has interacted with
    so we don't show errors on pristine (never-touched) fields
  - Green border + CheckCircle2 icon when valid + has value
  - Red border + AlertCircle icon + helper text when invalid + touched
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
  const { addTransaction } = useApp();
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

  const set = useCallback((k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setTouched(t => ({ ...t, [k]: true })); // mark touched on any change
  }, []);

  // Validators — return true = valid
  const validators = {
    amount:      v => v !== '' && !isNaN(v) && Number(v) > 0,
    description: v => v.trim().length > 0,
    transaction_date: v => Boolean(v),
  };

  const amountState  = getFieldState(form.amount, touched.amount, validators.amount);
  const descState    = getFieldState(form.description, touched.description, validators.description);
  const dateState    = getFieldState(form.transaction_date, touched.transaction_date, validators.transaction_date);

  const isFormValid = validators.amount(form.amount) && validators.description(form.description) && validators.transaction_date(form.transaction_date);

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    // Touch all fields on submit attempt to reveal any hidden errors
    setTouched({ amount: true, description: true, transaction_date: true });
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      const ok = await addTransaction({ ...form, amount: Number(form.amount) });
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

        {/* Amount — Day 8: real-time validation */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
            <input
              id="quick-amount"
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
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

        {/* Description — Day 8: real-time validation */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
          <div className="relative">
            <input
              id="quick-description"
              type="text"
              placeholder="e.g. Zomato lunch order"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, description: true }))}
              className={`${fieldClass(descState)} pr-8`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <FieldIcon state={descState} />
            </span>
          </div>
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

        {/* Date — Day 8: validation icon */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <div className="relative">
            <input
              type="date"
              value={form.transaction_date}
              onChange={e => set('transaction_date', e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, transaction_date: true }))}
              className={`${fieldClass(dateState)} pr-8`}
              max={new Date().toISOString().split('T')[0]}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <FieldIcon state={dateState} />
            </span>
          </div>
        </div>

        {/* Submit — Day 8: disabled until form valid */}
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
