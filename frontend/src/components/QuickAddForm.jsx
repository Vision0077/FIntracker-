import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useApp, CATEGORIES, PAYMENT_METHODS } from '../context/AppContext';
import { getCategoryIcon, getMethodIcon } from '../utils/helpers';

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
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = 'Description required';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (!form.transaction_date) e.transaction_date = 'Date required';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const ok = await addTransaction({ ...form, amount: Number(form.amount) });
      if (ok !== false) {
        setForm(f => ({ ...f, description: '', amount: '' }));
        setErrors({});
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `form-input ${errors[field] ? 'border-rose-400 focus:border-rose-400' : ''}`;

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

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Amount */}
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
              className={`${inputClass('amount')} pl-8`}
            />
          </div>
          {errors.amount && <p className="text-rose-500 text-xs mt-1">{errors.amount}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
          <input
            id="quick-description"
            type="text"
            placeholder="e.g. Zomato lunch order"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className={inputClass('description')}
          />
          {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description}</p>}
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

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <input
            type="date"
            value={form.transaction_date}
            onChange={e => set('transaction_date', e.target.value)}
            className={inputClass('transaction_date')}
            max={new Date().toISOString().split('T')[0]}
          />
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
