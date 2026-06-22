import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('fintrack-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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
    try {
      // 1. Dashboard summary (critical)
      const summary = await apiFetch('/analytics/dashboard-summary', { token: authToken });
      setTotalBalance(summary.total_balance);
      setMonthlyIncome(summary.monthly_income);
      setMonthlyExpenses(summary.monthly_expenses);
    } catch (err) {
      console.warn('Dashboard summary failed:', err);
    }

    try {
      // 2. Month-over-month comparison (non-critical)
      const now = new Date();
      const curStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const curEnd = now.toISOString().split('T')[0];
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-01`;
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      const comp = await apiFetch(
        `/analytics/comparison?period_type=monthly&current_start=${curStart}&current_end=${curEnd}&previous_start=${prevStart}&previous_end=${prevEnd}`,
        { token: authToken }
      );
      setLastMonthIncome(comp.previous.total_income);
      setLastMonthExpenses(comp.previous.total_expenses);
    } catch (err) {
      console.warn('Comparison fetch failed (non-critical):', err);
    }

    try {
      // 3. Spending trends (non-critical)
      const trends = await apiFetch('/analytics/spending-trends?period=monthly', { token: authToken });
      const trendPoints = (trends.data || []).map(p => ({
        date: new Date(p.label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        fullDate: p.label,
        income: p.income,
        expense: p.expenses
      }));
      setSpendingTrends(trendPoints);
    } catch (err) {
      console.warn('Spending trends failed (non-critical):', err);
    }

    try {
      // 4. Category breakdown (non-critical)
      const catBreak = await apiFetch('/analytics/category-breakdown', { token: authToken });
      const categoriesList = (catBreak.items || []).map(item => ({
        category: item.category,
        amount: item.total_amount,
        percentage: item.percentage.toFixed(1),
        color: CATEGORY_COLORS[item.category] || '#6366f1'
      }));
      setCategoryBreakdownPct(categoriesList);
    } catch (err) {
      console.warn('Category breakdown failed (non-critical):', err);
    }

    try {
      // 5. Payment breakdown (non-critical)
      const payBreak = await apiFetch('/analytics/payment-method-breakdown', { token: authToken });
      const paymentsList = (payBreak.items || []).map(item => ({
        method: item.payment_method,
        amount: item.total_amount,
        color: PAYMENT_COLORS[item.payment_method] || '#6366f1'
      }));
      setPaymentBreakdown(paymentsList);
    } catch (err) {
      console.warn('Payment breakdown failed (non-critical):', err);
    }

    try {
      // 6. Transactions list (critical)
      const txRes = await apiFetch('/transactions?page=1&page_size=100', { token: authToken });
      setTransactions(txRes.items || []);
    } catch (err) {
      console.warn('Transactions fetch failed:', err);
      if (err.status === 401) logout();
    }

    try {
      // 7. Budgets (non-critical)
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const budRes = await apiFetch(`/budgets?month_year=${monthYear}`, { token: authToken });
      setBudgets(budRes.items || []);
    } catch (err) {
      console.warn('Budgets fetch failed (non-critical):', err);
    }
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
      refreshData, logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
