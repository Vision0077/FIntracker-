import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';

const AppContext = createContext(null);

// Constants
export const CATEGORY_COLORS = {
  FOOD: '#6366f1',
  TRAVEL: '#a855f7',
  MISCELLANEOUS:'#ec4899',
  SUBSCRIPTION: '#f59e0b',
  SALARY: '#10b981',
  RENT: '#ef4444',
  BILLS: '#14b8a6',
  SERVICE: '#3b82f6',
  PAYROLL: '#8b5cf6',
};

export const PAYMENT_COLORS = {
  UPI: '#6366f1',
  CARD: '#a855f7',
  WALLET: '#f59e0b',
  SUBSCRIPTION: '#ec4899',
  CASH: '#10b981',
};

export const CATEGORIES = ['FOOD', 'TRAVEL', 'MISCELLANEOUS', 'SUBSCRIPTION', 'SALARY', 'RENT', 'BILLS', 'SERVICE', 'PAYROLL'];
export const PAYMENT_METHODS = ['UPI', 'CARD', 'WALLET', 'SUBSCRIPTION', 'CASH'];

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('fintrack-theme');
    return saved || 'dark';
  });
  const [token, setToken] = useState(() => localStorage.getItem('fintrack-token') || null);
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);

  const [lastMonthIncome, setLastMonthIncome] = useState(0);
  const [lastMonthExpenses, setLastMonthExpenses] = useState(0);

  const [spendingTrends, setSpendingTrends] = useState([]);
  const [categoryBreakdownPct, setCategoryBreakdownPct] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  // Day 20: Set of transaction IDs flagged as likely duplicates
  const [duplicateIds, setDuplicateIds] = useState(new Set());

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('fintrack-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const notifTimer = useRef(null);
  const showNotification = (message, type = 'success') => {
    clearTimeout(notifTimer.current);
    setNotification({ message, type });
    notifTimer.current = setTimeout(() => setNotification(null), 3000);
  };

  const logout = () => {
    localStorage.removeItem('fintrack-token');
    setToken(null);
    setUser(null);
    setTransactions([]);
    setBudgets([]);
    setMonthlyIncome(0);
    setMonthlyExpenses(0);
    setTotalBalance(0);
    setLastMonthIncome(0);
    setLastMonthExpenses(0);
    setSpendingTrends([]);
    setCategoryBreakdownPct([]);
    setPaymentBreakdown([]);
  };

  const refreshData = async (authToken) => {
    if (!authToken) return;

    const now = new Date();
    const curStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const curEnd = now.toISOString().split('T')[0];
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-01`;
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const monthYear = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // ponytail: fire all 7 requests in parallel — was 7 serial round-trips
    const [summaryRes, compRes, trendsRes, catRes, payRes, txRes, budRes, dupRes] = await Promise.allSettled([
      apiFetch('/analytics/dashboard-summary', { token: authToken }),
      apiFetch(`/analytics/comparison?period_type=monthly&current_start=${curStart}&current_end=${curEnd}&previous_start=${prevStart}&previous_end=${prevEnd}`, { token: authToken }),
      apiFetch('/analytics/spending-trends?period=monthly', { token: authToken }),
      apiFetch('/analytics/category-breakdown', { token: authToken }),
      apiFetch('/analytics/payment-method-breakdown', { token: authToken }),
      apiFetch('/transactions?page=1&page_size=100', { token: authToken }),
      apiFetch(`/budgets?month_year=${monthYear}`, { token: authToken }),
      apiFetch('/transactions/duplicates', { token: authToken }),
    ]);

    if (summaryRes.status === 'fulfilled') {
      const s = summaryRes.value;
      setTotalBalance(s.total_balance);
      setMonthlyIncome(s.monthly_income);
      setMonthlyExpenses(s.monthly_expenses);
    } else console.warn('Dashboard summary failed:', summaryRes.reason);

    if (compRes.status === 'fulfilled') {
      setLastMonthIncome(compRes.value.previous.total_income);
      setLastMonthExpenses(compRes.value.previous.total_expenses);
    } else console.warn('Comparison fetch failed:', compRes.reason);

    if (trendsRes.status === 'fulfilled') {
      setSpendingTrends((trendsRes.value.data || []).map(p => ({
        date: new Date(p.label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        fullDate: p.label,
        income: p.income,
        expense: p.expenses,
      })));
    } else console.warn('Spending trends failed:', trendsRes.reason);

    if (catRes.status === 'fulfilled') {
      setCategoryBreakdownPct((catRes.value.items || []).map(item => ({
        category: item.category,
        amount: item.total_amount,
        percentage: item.percentage.toFixed(1),
        color: CATEGORY_COLORS[item.category] || '#6366f1',
      })));
    } else console.warn('Category breakdown failed:', catRes.reason);

    if (payRes.status === 'fulfilled') {
      setPaymentBreakdown((payRes.value.items || []).map(item => ({
        method: item.payment_method,
        amount: item.total_amount,
        color: PAYMENT_COLORS[item.payment_method] || '#6366f1',
      })));
    } else console.warn('Payment breakdown failed:', payRes.reason);

    if (txRes.status === 'fulfilled') {
      setTransactions(txRes.value.items || []);
    } else {
      console.warn('Transactions fetch failed:', txRes.reason);
      if (txRes.reason?.status === 401) logout();
    }

    if (budRes.status === 'fulfilled') {
      setBudgets(budRes.value.items || []);
    } else console.warn('Budgets fetch failed:', budRes.reason);

    // Day 20: duplicate IDs — build flat Set from groups
    if (dupRes.status === 'fulfilled') {
      const ids = new Set();
      (dupRes.value.groups || []).forEach(g => g.ids.forEach(id => ids.add(id)));
      setDuplicateIds(ids);
    } else console.warn('Duplicates fetch failed:', dupRes?.reason);
  };

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      apiFetch('/auth/me', { token })
        .then(res => {
          setUser(res.user);
          return refreshData(token);
        })
        .catch(err => {
          console.error('Initial me fetch failed:', err);
          logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const addTransaction = async (txn) => {
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        token,
        body: {
          amount: Number(txn.amount),
          type: txn.type,
          payment_method: txn.payment_method,
          description: txn.description,
          category: txn.category,
          transaction_date: txn.transaction_date,
        }
      });
      showNotification('Transaction added successfully', 'success');
      await refreshData(token);
      return true;
    } catch (err) {
      showNotification(err.message || 'Failed to add transaction', 'error');
      return false;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await apiFetch(`/transactions/${id}`, {
        method: 'DELETE',
        token,
      });
      showNotification('Transaction deleted', 'info');
      await refreshData(token);
    } catch (err) {
      showNotification(err.message || 'Failed to delete transaction', 'error');
    }
  };

  const addBudget = async (b) => {
    try {
      await apiFetch('/budgets', {
        method: 'POST',
        token,
        body: {
          category: b.category,
          payment_method: b.payment_method || null,
          limit_amount: Number(b.limit_amount),
          month_year: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })(),
        }
      });
      showNotification('Budget limit added', 'success');
      await refreshData(token);
    } catch (err) {
      showNotification(err.message || 'Failed to add budget', 'error');
    }
  };

  const updateBudgetLimit = async (id, limit) => {
    try {
      await apiFetch(`/budgets/${id}`, {
        method: 'PUT',
        token,
        body: { limit_amount: Number(limit) }
      });
      showNotification('Budget limit updated', 'success');
      await refreshData(token);
    } catch (err) {
      showNotification(err.message || 'Failed to update budget', 'error');
    }
  };

  const deleteBudget = async (id) => {
    try {
      await apiFetch(`/budgets/${id}`, {
        method: 'DELETE',
        token,
      });
      showNotification('Budget limit deleted', 'info');
      await refreshData(token);
    } catch (err) {
      showNotification(err.message || 'Failed to delete budget', 'error');
    }
  };

  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      token, setToken,
      user, setUser,
      activePage, setActivePage,
      transactions, addTransaction, deleteTransaction,
      budgets, setBudgets,
      addBudget, updateBudgetLimit, deleteBudget,
      isLoading,
      notification, showNotification,
      monthlyIncome, monthlyExpenses, totalBalance,
      lastMonthIncome, lastMonthExpenses,
      spendingTrends,
      categoryBreakdownPct, paymentBreakdown,
      duplicateIds,
      refreshData, logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
