// Standardized table styling components for all report pages

import React from 'react';

// Standardized sort icon component
export const SortIcon = ({
  column,
  sortConfig
}: {
  column: string;
  sortConfig: { key: string | null; direction: 'asc' | 'desc' } | null;
}) => {
  if (!sortConfig || sortConfig.key !== column) {
    return (
      <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    );
  }

  return sortConfig.direction === 'asc' ? (
    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
};

// Standardized table header class names
export const TABLE_CLASSES = {
  container: 'bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800',
  headerSection: 'px-6 py-4 border-b border-zinc-200 dark:border-zinc-800',
  table: 'w-full',
  thead: 'bg-zinc-50 dark:bg-zinc-800/50',
  th: 'px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800',
  thContent: 'flex items-center space-x-1',
  tbody: 'bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800',
  tr: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
  td: 'px-6 py-4 whitespace-nowrap',
  tdText: 'text-sm text-zinc-900 dark:text-zinc-100',
  tdTextMedium: 'text-sm font-medium text-zinc-900 dark:text-zinc-100',
  overflow: 'overflow-x-auto',
};

// Standardized controls container class names
export const CONTROLS_CLASSES = {
  container: 'bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 mb-6',
  inner: 'px-6 py-4',
  grid: 'grid grid-cols-1 lg:grid-cols-2 gap-6',
  section: 'flex flex-col',
  sectionTitle: 'text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4',
};

// Standardized loading state
export const LoadingState = ({ message = 'Loading report data...' }: { message?: string }) => (
  <div className='flex items-center justify-center py-12'>
    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
    <span className='ml-2 text-gray-600'>{message}</span>
  </div>
);

// Standardized error state
export const ErrorState = ({
  error,
  onRetry
}: {
  error: string;
  onRetry?: () => void;
}) => (
  <div className='flex items-center justify-center py-12'>
    <div className='text-center'>
      <div className='w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center'>
        <svg
          className='w-8 h-8 text-red-400'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
      </div>
      <p className='text-red-600 mb-4'>{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

// Standardized empty state
export const EmptyState = ({
  message = 'Select a date range and click "Generate Report" to view data',
  icon = 'document'
}: {
  message?: string;
  icon?: 'document' | 'lock';
}) => (
  <div className='flex items-center justify-center py-12'>
    <div className='text-center'>
      <div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
        {icon === 'lock' ? (
          <svg
            className='w-8 h-8 text-gray-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
            />
          </svg>
        ) : (
          <svg
            className='w-8 h-8 text-gray-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
        )}
      </div>
      <p className='text-gray-600'>{message}</p>
    </div>
  </div>
);

// Standardized search bar
export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search by product name or SKU...',
  className = ''
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <div className={`relative max-w-md ${className}`}>
    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
      <svg
        className='h-5 w-5 text-gray-400'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
        />
      </svg>
    </div>
    <input
      type='text'
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className='block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-black'
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className='absolute inset-y-0 right-0 pr-3 flex items-center'
      >
        <svg
          className='h-4 w-4 text-gray-400 hover:text-gray-600'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M6 18L18 6M6 6l12 12'
          />
        </svg>
      </button>
    )}
  </div>
);

// Format utilities (can be imported and used consistently)
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number | null | undefined): string => {
  if (num == null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};
