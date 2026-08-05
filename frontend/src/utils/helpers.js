export const formatCurrency = (amount, compact = false) => {
  if (compact && amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (compact && amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

// Day 9: Amount input formatter — formats raw string with Indian-locale commas as user types
// '12500' -> '12,500'  |  '1000000' -> '10,00,000'  |  '1250.5' -> '1,250.5'
export const formatAmountDisplay = (raw) => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const intPart = parts[0] || '';
  const decPart = parts.length > 1 ? '.' + (parts[1] || '').slice(0, 2) : '';
  if (!intPart) return decPart || '';
  // Indian numbering: last 3 digits, then groups of 2
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;
  return formatted + decPart;
};

// Day 9: Strip commas for Number() parsing or API submission
// '12,500.50' -> '12500.50'
export const parseAmountRaw = (display) => display.replace(/,/g, '');

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
