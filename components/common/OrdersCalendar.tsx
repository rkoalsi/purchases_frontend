'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarDateStage =
  | 'neutral' | 'teal' | 'sky' | 'blue' | 'amber'
  | 'orange' | 'indigo' | 'purple' | 'emerald' | 'red';

export interface CalendarEvent {
  date: string;           // YYYY-MM-DD
  label: string;          // e.g. "ETD", "PO Due"
  brand: string;
  poNumber?: string | null;
  orderName: string;
  orderId: string;
  stage: CalendarDateStage;
}

export interface CalendarLegendItem {
  label: string;
  stage: CalendarDateStage;
}

const STAGE_DOT: Record<CalendarDateStage, string> = {
  neutral: 'bg-zinc-400',
  teal:    'bg-teal-500',
  sky:     'bg-sky-400',
  blue:    'bg-blue-400',
  amber:   'bg-amber-500',
  orange:  'bg-orange-400',
  indigo:  'bg-indigo-400',
  purple:  'bg-purple-400',
  emerald: 'bg-emerald-500',
  red:     'bg-red-500',
};

const STAGE_PILL: Record<CalendarDateStage, string> = {
  neutral: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700',
  teal:    'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  sky:     'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
  blue:    'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  amber:   'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700',
  orange:  'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700',
  indigo:  'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  purple:  'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',
  red:     'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700',
};

const STAGE_SWATCH: Record<CalendarDateStage, string> = {
  neutral: 'bg-zinc-400',
  teal:    'bg-teal-500',
  sky:     'bg-sky-400',
  blue:    'bg-blue-400',
  amber:   'bg-amber-500',
  orange:  'bg-orange-400',
  indigo:  'bg-indigo-400',
  purple:  'bg-purple-500',
  emerald: 'bg-emerald-500',
  red:     'bg-red-500',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysInGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // Convert JS Sunday=0 to Monday=0 offset
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

const MAX_VISIBLE = 3;

interface OrdersCalendarProps {
  events: CalendarEvent[];
  legend?: CalendarLegendItem[];
  onEventClick?: (orderId: string) => void;
  accentColor?: 'emerald' | 'violet';
}

export default function OrdersCalendar({
  events,
  legend,
  onEventClick,
  accentColor = 'emerald',
}: OrdersCalendarProps) {
  const now = new Date();
  const todayYMD = toYMD(now);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const days = useMemo(() => getDaysInGrid(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!ev.date) continue;
      const d = ev.date.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(ev);
    }
    return map;
  }, [events]);

  const prevMonth = () => {
    setExpandedCells(new Set());
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    setExpandedCells(new Set());
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    setExpandedCells(new Set());
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const toggleCell = (ymd: string) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd); else next.add(ymd);
      return next;
    });
  };

  const todayBg = accentColor === 'violet'
    ? 'bg-violet-600 text-white'
    : 'bg-emerald-600 text-white';

  const todayBtn = accentColor === 'violet'
    ? 'bg-violet-600 hover:bg-violet-700 text-white'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

      {/* Month navigation */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {MONTHS[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={goToToday}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${todayBtn}`}
        >
          Today
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 divide-x divide-zinc-100 dark:divide-zinc-800">
        {days.map((day, idx) => {
          const ymd = toYMD(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = ymd === todayYMD;
          const dayEvents = eventsByDate[ymd] || [];
          const isExpanded = expandedCells.has(ymd);
          const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - MAX_VISIBLE;
          const isWeekStart = idx % 7 === 0;

          return (
            <div
              key={ymd}
              className={`min-h-[90px] p-1.5 flex flex-col gap-0.5 ${
                !isWeekStart ? 'border-t border-zinc-100 dark:border-zinc-800' : 'border-t border-zinc-100 dark:border-zinc-800'
              } ${
                isCurrentMonth
                  ? 'bg-white dark:bg-zinc-900'
                  : 'bg-zinc-50/60 dark:bg-zinc-950/40'
              }`}
            >
              {/* Date number */}
              <div className="flex justify-end mb-0.5">
                <span className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full leading-none ${
                  isToday
                    ? todayBg
                    : isCurrentMonth
                      ? 'text-zinc-700 dark:text-zinc-300'
                      : 'text-zinc-300 dark:text-zinc-700'
                }`}>
                  {day.getDate()}
                </span>
              </div>

              {/* Events */}
              {visibleEvents.map((ev, i) => {
                const suffix = ev.orderName.startsWith(ev.brand)
                  ? ev.orderName.slice(ev.brand.length).trim()
                  : ev.orderName;
                return (
                  <button
                    key={`${ev.orderId}-${ev.label}-${i}`}
                    onClick={() => onEventClick?.(ev.orderId)}
                    title={`${ev.brand}${suffix ? ` ${suffix}` : ''} · ${ev.label}`}
                    className={`w-full text-left px-1 py-0.5 rounded text-[9px] font-medium leading-tight transition-opacity hover:opacity-75 ${STAGE_PILL[ev.stage]}`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-0.5 align-middle flex-shrink-0 ${STAGE_DOT[ev.stage]}`} />
                    <span className="font-semibold">{ev.brand}</span>
                    {suffix && <span className="opacity-60"> {suffix}</span>}
                    <span className="opacity-50"> · {ev.label}</span>
                  </button>
                );
              })}

              {!isExpanded && overflow > 0 && (
                <button
                  onClick={() => toggleCell(ymd)}
                  className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium px-1 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                >
                  +{overflow} more
                </button>
              )}
              {isExpanded && dayEvents.length > MAX_VISIBLE && (
                <button
                  onClick={() => toggleCell(ymd)}
                  className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium px-1 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                >
                  show less
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {legend && legend.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/20">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {legend.map(item => (
              <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_SWATCH[item.stage]}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
