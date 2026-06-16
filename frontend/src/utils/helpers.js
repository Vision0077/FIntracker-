export const formatCurrency = (amount, compact = false) => {
  if (compact && amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (compact && amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

export const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const CATEGORY_EMOJIS = { FOOD:'🍜', TRAVEL:'🚗', MISCELLANEOUS:'📦', SUBSCRIPTION:'🔄', SALARY:'💼', RENT:'🏠', BILLS:'⚡', SERVICE:'🔧', PAYROLL:'💰' };
export const getCategoryIcon = (cat) => CATEGORY_EMOJIS[cat] || '💳';

const METHOD_EMOJIS = { UPI:'📱', CARD:'💳', WALLET:'👛', SUBSCRIPTION:'🔄', CASH:'💵' };
export const getMethodIcon = (method) => METHOD_EMOJIS[method] || '💳';
