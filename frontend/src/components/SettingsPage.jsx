import React, { useState } from 'react';
import { Sun, Moon, User, Target, LogOut, Plus, Edit2, Trash2 } from 'lucide-react';
import { useApp, CATEGORIES } from '../context/AppContext';
import { getCategoryIcon, formatCurrency } from '../utils/helpers';

function CashForm() {
  const { addTransaction } = useApp();
  const [form, setForm] = useState({
    description: '', amount: '', category: 'MISCELLANEOUS',
    transaction_date: new Date(2026, 5, 9).toISOString().split('T')[0],
    type: 'EXPENSE', notes: '', location: 'Auto-detected',
  });
  const [success, setSuccess] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    addTransaction({ ...form, amount: Number(form.amount), payment_method: 'CASH' });
    setForm(f => ({ ...f, amount: '', description: '', notes: '' }));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
            <input type="number" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} className="form-input pl-7" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} className="form-input" />
        </div>
      </div>
      <input type="text" placeholder="What did you spend on?" value={form.description} onChange={e => set('description', e.target.value)} className="form-input" />
      <div className="grid grid-cols-2 gap-2">
        <select value={form.category} onChange={e => set('category', e.target.value)} className="form-input text-xs">
          {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-[#2d2d52]">
          {['EXPENSE', 'INCOME'].map(t => (
            <button key={t} type="button" onClick={() => set('type', t)} className={`flex-1 py-2 text-xs font-semibold transition-all ${form.type === t ? (t === 'EXPENSE' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white') : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1e1e3a]'}`}>{t}</button>
          ))}
        </div>
      </div>
      <input type="text" placeholder="Location (auto-detected)" value={form.location} onChange={e => set('location', e.target.value)} className="form-input text-xs" />
      <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} className="form-input resize-none text-sm" rows={2} />
      <button type="submit" className={`w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all ${success ? 'bg-emerald-500' : 'bg-brand-500 hover:bg-brand-600 active:scale-95'}`}>
        {success ? '✓ Cash Entry Added!' : '💵 Log Cash Transaction'}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme, budgets, addBudget, updateBudgetLimit, deleteBudget, user, logout } = useApp();
  const [editBudget, setEditBudget] = useState(null);
  const [newBudget, setNewBudget] = useState({ category: 'FOOD', payment_method: '', limit_amount: '' });
  const [profile, setProfile] = useState({
    name: user?.full_name || 'Guest User',
    email: user?.email || '',
    currency: user?.currency || 'INR',
  });

  const handleUpdateLimit = (id, limit) => { updateBudgetLimit(id, limit); setEditBudget(null); };
  const handleAddBudget = () => {
    if (!newBudget.limit_amount || isNaN(newBudget.limit_amount)) return;
    addBudget(newBudget);
    setNewBudget({ category: 'FOOD', payment_method: '', limit_amount: '' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">
      <h2 className="text-xl font-bold font-display text-slate-800 dark:text-white">Settings</h2>

      {/* Profile */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.4s ease-out both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-4 flex items-center gap-2"><User size={16} /> Profile</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
            {profile.name[0]}
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white">{profile.name}</p>
            <p className="text-sm text-slate-400">{profile.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
            <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className="form-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
            <select value={profile.currency} onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))} className="form-input">
              <option value="INR">₹ INR — Indian Rupee</option>
              <option value="USD">$ USD — US Dollar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.4s ease-out 0.05s both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Sun size={16} /> Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark Mode</p>
            <p className="text-xs text-slate-400 mt-0.5">Toggle between light and dark theme</p>
          </div>
          <div className="flex items-center gap-3">
            <Sun size={16} className="text-amber-500" />
            <label className="toggle-switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
              <span className="toggle-slider" />
            </label>
            <Moon size={16} className="text-brand-400" />
          </div>
        </div>
      </div>

      {/* Budget Limits */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.4s ease-out 0.1s both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Target size={16} /> Budget Limits — June 2026</h3>
        <div className="space-y-3 mb-4">
          {budgets.map(b => {
            const pct = b.limit_amount > 0 ? Math.min(100, (b.current_spent / b.limit_amount) * 100) : 0;
            const isOver = b.current_spent >= b.limit_amount;
            return (
              <div key={b.id} className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d0d1f]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">{getCategoryIcon(b.category)} {b.category}</span>
                  <div className="flex items-center gap-2">
                    {editBudget === b.id
                      ? <input type="number" defaultValue={b.limit_amount} autoFocus onBlur={e => handleUpdateLimit(b.id, e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdateLimit(b.id, e.target.value)} className="form-input w-24 text-xs py-1 px-2" />
                      : <span className={`text-xs font-semibold ${isOver ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>{formatCurrency(b.current_spent, true)} / {formatCurrency(b.limit_amount, true)}</span>
                    }
                    <button onClick={() => setEditBudget(editBudget === b.id ? null : b.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1e1e3a] text-slate-400 transition-colors"><Edit2 size={12} /></button>
                    <button onClick={() => deleteBudget(b.id)} className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>
                <div className="progress-bar mt-1">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: isOver ? '#ef4444' : pct > 80 ? '#f59e0b' : '#6366f1' }} />
                </div>
                {isOver && <p className="text-xs text-rose-500 mt-1 font-medium">⚠️ Budget exceeded!</p>}
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-100 dark:border-[#1e1e3a] pt-3 mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Add New Budget</p>
          <div className="flex gap-2">
            <select value={newBudget.category} onChange={e => setNewBudget(b => ({ ...b, category: e.target.value }))} className="form-input flex-1 text-xs">
              {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>)}
            </select>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input type="number" placeholder="Limit" value={newBudget.limit_amount} onChange={e => setNewBudget(b => ({ ...b, limit_amount: e.target.value }))} className="form-input w-28 pl-6 text-xs" />
            </div>
            <button onClick={handleAddBudget} className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-all"><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {/* Cash Entry */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#13132b] border border-slate-100 dark:border-[#1e1e3a]" style={{ animation: 'fadeUp 0.4s ease-out 0.15s both' }}>
        <h3 className="font-semibold font-display text-slate-800 dark:text-white mb-3 flex items-center gap-2"><span>💵</span> Cash Transaction Entry</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Track cash withdrawals and spending manually.</p>
        <CashForm />
      </div>

      {/* Logout */}
      <button onClick={logout} className="w-full py-3 rounded-xl border border-rose-500/20 text-rose-500 font-semibold text-sm hover:bg-rose-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm">
        <LogOut size={16} /> Log Out of Account
      </button>
    </div>
  );
}
