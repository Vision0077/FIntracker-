import React from 'react';
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
  const { token, setToken, setUser, activePage, isLoading } = useApp();

  const handleLoginSuccess = (newToken, user) => {
    setToken(newToken);
    setUser(user);
  };

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

  const PAGE_MAP = {
    dashboard: <Dashboard />,
    transactions: <TransactionsPage />,
    analytics: <AnalyticsPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0d0d1f]">
      <Sidebar />
      <main className="flex-1 lg:ml-60 pb-20 lg:pb-0">
        {PAGE_MAP[activePage] || <Dashboard />}
      </main>
      <MobileNav />
      <Toast />
    </div>
  );
}
