import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        localStorage.setItem('fintrack-token', res.access_token);
        onLoginSuccess(res.access_token, res.user);
      } else {
        const res = await apiFetch('/auth/register', {
          method: 'POST',
          body: { email, password, full_name: fullName || null },
        });
        localStorage.setItem('fintrack-token', res.access_token);
        onLoginSuccess(res.access_token, res.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070714] px-4 py-12 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="glass max-w-md w-full p-8 rounded-3xl shadow-2xl relative z-10 border border-slate-800/50 text-white">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl font-bold mb-4 shadow-lg shadow-brand-500/20"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          >
            ₹
          </div>
          <h2 className="text-3xl font-extrabold font-display gradient-text">FinTrack</h2>
          <p className="text-slate-400 text-sm mt-2">Take control of your money in plain language</p>
        </div>

        <div className="flex p-1 mb-6 bg-slate-800/60 rounded-xl border border-slate-700/30">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isLogin ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isLogin ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Arjun Sharma"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="form-input w-full bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="arjun@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="form-input w-full bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={isLogin ? 1 : 8}
              className="form-input w-full bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-brand-500"
            />
            {!isLogin && <p className="text-[10px] text-slate-500 mt-1">Password must be at least 8 characters long.</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6 shadow-lg shadow-brand-500/25"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
