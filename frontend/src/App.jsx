import React, { useMemo, useEffect } from 'react';
import { useApp } from './context/AppContext';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Dashboard from './components/Dashboard';
import TransactionsPage from './components/TransactionsPage';
import AnalyticsPage from './components/AnalyticsPage';
import SettingsPage from './components/SettingsPage';
import Toast from './components/Toast';

export default function App() {
  const { token, setToken, setUser, activePage, setActivePage, isLoading } = useApp();

  const handleLoginSuccess = (newToken, user) => {
    setToken(newToken);
    setUser(user);
  };

  /*
    Day 12: Global keyboard shortcuts
    Ctrl+N  — navigate to dashboard and focus the Quick Add amount field
    Ctrl+K  — navigate to transactions and focus the search input
    Shortcut hint badges are shown in Sidebar nav items (see Sidebar.jsx)
  */
  useEffect(() => {
    if (!token) return; // no shortcuts before login
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey; // support Cmd on Mac

      // Ctrl+N: focus Quick Add amount field
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        setActivePage('dashboard');
        // Small delay to let the page render before focusing
        setTimeout(() => {
          const el = document.getElementById('quick-amount');
          if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }, 80);
      }

      // Ctrl+K: focus search on transactions page
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setActivePage('transactions');
        setTimeout(() => {
          const el = document.getElementById('txn-search');
          if (el) { el.focus(); el.select(); }
        }, 80);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [token, setActivePage]);

  // Still initializing
  if (isLoading && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1f]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-2xl font-bold text-white mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>₹</div>
          <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <>
        <AuthPage onLoginSuccess={handleLoginSuccess} />
        <Toast />
      </>
    );
  }

  // ponytail: was re-creating all 4 JSX components on every render
  const page = useMemo(() => {
    const map = {
      dashboard: <Dashboard />,
      transactions: <TransactionsPage />,
      analytics: <AnalyticsPage />,
      settings: <SettingsPage />,
    };
    return map[activePage] || <Dashboard />;
  }, [activePage]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0d0d1f]">
      <Sidebar />
      <main className="flex-1 lg:ml-60 pb-20 lg:pb-0">
        {page}
      </main>
      <MobileNav />
      <Toast />
    </div>
  );
}
