import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

/*
  Day 10: Custom styled DatePicker component
  Props:
    value      - ISO date string 'YYYY-MM-DD' (controlled)
    onChange   - (isoString: string) => void
    maxDate    - ISO date string, optional. Dates after this are greyed + unclickable.
                 Defaults to today for forms. Pass null/undefined to allow any date.
    minDate    - ISO date string, optional. Dates before this are greyed + unclickable.
    placeholder - string shown when value is empty
    className  - extra classes on the trigger button
    id         - id on the trigger button
*/

const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Parse 'YYYY-MM-DD' safely without timezone shift
function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Format date to 'YYYY-MM-DD'
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Friendly display: 'Today', 'Yesterday', or 'Fri, 1 Aug'
function formatDisplay(iso) {
  if (!iso) return null;
  const date = parseISO(iso);
  const today = new Date();
  const todayISO = toISO(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (iso === todayISO) return 'Today';
  if (iso === toISO(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Get all days to render for a given month (includes padding from prev/next month)
function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  // Monday = 0 for our grid (JS Sunday=0, so adjust)
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

  const days = [];
  // Padding from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, currentMonth: false });
  }
  // Current month days
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), currentMonth: true });
  }
  // Pad to complete the last row (always 6 rows × 7 = 42)
  while (days.length < 42) {
    const last = days[days.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    days.push({ date: next, currentMonth: false });
  }
  return days;
}

export default function DatePicker({
  value,
  onChange,
  maxDate,
  minDate,
  placeholder = 'Select date',
  className = '',
  id,
}) {
  const today = toISO(new Date());
  const effectiveMax = maxDate !== undefined ? maxDate : today; // default: block future dates

  const parsed = parseISO(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parsed ? parsed.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed ? parsed.getMonth() : new Date().getMonth());

  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]);

  const prevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const selectDay = useCallback((iso) => {
    onChange(iso);
    setOpen(false);
  }, [onChange]);

  const calendarDays = getCalendarDays(viewYear, viewMonth);

  const isDisabled = (iso) => {
    if (effectiveMax && iso > effectiveMax) return true;
    if (minDate && iso < minDate) return true;
    return false;
  };

  const displayText = formatDisplay(value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`form-input w-full flex items-center gap-2 text-left cursor-pointer ${
          open ? 'border-brand-500 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]' : ''
        } ${!value ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}
      >
        <Calendar size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <span className="flex-1 text-sm">{displayText || placeholder}</span>
      </button>

      {/* Dropdown Calendar */}
      {open && (
        <div
          className="absolute z-50 mt-1.5 w-72 rounded-2xl bg-white dark:bg-[#13132b] border border-slate-200 dark:border-[#1e1e3a] shadow-2xl shadow-black/20 dark:shadow-black/50 p-4"
          style={{ animation: 'fadeUp 0.15s ease-out' }}
        >
          {/* Month / Year Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e3a] text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800 dark:text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e3a] text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {calendarDays.map(({ date, currentMonth }, i) => {
              const iso = toISO(date);
              const isSelected = iso === value;
              const isToday = iso === today;
              const disabled = isDisabled(iso);
              const dimmed = !currentMonth;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => !disabled && selectDay(iso)}
                  disabled={disabled}
                  className={`
                    relative w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition-all
                    ${isSelected
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                      : isToday
                        ? 'ring-2 ring-brand-400 ring-offset-1 dark:ring-offset-[#13132b] text-brand-600 dark:text-brand-400'
                        : disabled
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : dimmed
                            ? 'text-slate-300 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-[#1e1e3a]'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e3a]'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick shortcuts */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-[#1e1e3a]">
            {['Today', 'Yesterday'].map(label => {
              const d = new Date();
              if (label === 'Yesterday') d.setDate(d.getDate() - 1);
              const iso = toISO(d);
              const active = value === iso;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => !isDisabled(iso) && selectDay(iso)}
                  disabled={isDisabled(iso)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-50 dark:bg-[#0d0d1f] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e1e3a] disabled:opacity-40'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
