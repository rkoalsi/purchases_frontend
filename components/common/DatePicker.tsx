import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  format,
  isAfter,
  isBefore,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

// Custom Modern DatePicker Component
const DatePicker = ({
  selected,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  label,
}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());
  const datePickerRef: any = useRef(null);

  // Close datepicker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDateSelect = (date: any) => {
    onChange(date);
    setIsOpen(false);
  };

  const isDateDisabled = (date: any) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  const navigateMonth = (direction: any) => {
    setCurrentMonth((prev: any) => addMonths(prev, direction));
  };

  return (
    <div ref={datePickerRef} className='relative'>
      {label && (
        <label className='block text-xs font-medium text-gray-600 mb-1 ml-1'>
          {label}
        </label>
      )}

      {/* Input Field */}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='w-full text-left text-gray-800 text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white hover:border-gray-300 flex items-center justify-between'
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? format(selected, 'dd MMM yyyy') : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className='absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-4 min-w-[320px] animate-in fade-in slide-in-from-top-2 duration-200'>
          {/* Header */}
          <div className='flex items-center justify-between mb-4'>
            <button
              type='button'
              onClick={() => navigateMonth(-1)}
              className='p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200 group'
            >
              <svg
                className='w-4 h-4 text-gray-600 group-hover:text-gray-800'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 19l-7-7 7-7'
                />
              </svg>
            </button>

            <h3 className='text-sm font-semibold text-gray-800'>
              {format(currentMonth, 'MMMM yyyy')}
            </h3>

            <button
              type='button'
              onClick={() => navigateMonth(1)}
              className='p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200 group'
            >
              <svg
                className='w-4 h-4 text-gray-600 group-hover:text-gray-800'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 5l7 7-7 7'
                />
              </svg>
            </button>
          </div>

          {/* Week Days */}
          <div className='grid grid-cols-7 gap-1 mb-2'>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div
                key={day}
                className='p-2 text-center text-xs font-medium text-gray-500'
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className='grid grid-cols-7 gap-1'>
            {calendarDays.map((day) => {
              const isSelected = selected && isSameDay(day, selected);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDisabled = isDateDisabled(day);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toString()}
                  type='button'
                  onClick={() => !isDisabled && handleDateSelect(day)}
                  disabled={isDisabled}
                  className={`
                    p-2 text-sm rounded-lg transition-all duration-200 relative
                    ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                        : isToday && isCurrentMonth
                        ? 'bg-blue-50 text-blue-700 font-semibold ring-2 ring-blue-200'
                        : isCurrentMonth
                        ? 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                        : 'text-gray-300'
                    }
                    ${
                      isDisabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:scale-105'
                    }
                  `}
                >
                  {format(day, 'd')}
                  {isToday && isCurrentMonth && !isSelected && (
                    <div className='absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full'></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className='mt-4 pt-3 border-t border-gray-100 flex gap-2'>
            <button
              type='button'
              onClick={() => handleDateSelect(new Date())}
              className='text-xs px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 font-medium'
            >
              Today
            </button>
            {selected && (
              <button
                type='button'
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
                className='text-xs px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors duration-200'
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
