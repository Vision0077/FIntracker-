import React from 'react';
import { useApp } from '../context/AppContext';
import { Check } from 'lucide-react';

export default function Toast() {
  const { notification } = useApp();
  
  if (!notification) return null;
  
  const colors = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-brand-500',
  };
  
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-2xl ${colors[notification.type] || colors.info}`}
      style={{ animation: 'fadeUp 0.3s ease-out' }}
    >
      <Check size={16} />
      {notification.message}
    </div>
  );
}
