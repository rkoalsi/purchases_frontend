'use client';

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  SortIcon,
  TABLE_CLASSES,
  CONTROLS_CLASSES,
  LoadingState,
  SearchBar,
} from './TableStyles';
import DateRangeComponent from '@/components/reports/DateRange';

interface FbaReturn {
  return_date: string | null;
  amazon_order_id: string | null;
  sku_code: string | null;
  asin: string | null;
  fnsku: string | null;
  product_name: string | null;
  quantity: number | null;
  fulfillment_center_id: string | null;
  detailed_disposition: string | null;
  reason: string | null;
  license_plate_number: string | null;
  customer_comments: string | null;
}

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .split('T')[0];

const COLUMNS: { key: keyof FbaReturn; label: string; minW?: string }[] = [
  { key: 'return_date', label: 'Return Date', minW: '110px' },
  { key: 'amazon_order_id', label: 'Order ID', minW: '160px' },
  { key: 'sku_code', label: 'SKU', minW: '120px' },
  { key: 'asin', label: 'ASIN', minW: '120px' },
  { key: 'fnsku', label: 'FNSKU', minW: '120px' },
  { key: 'product_name', label: 'Product Name', minW: '200px' },
  { key: 'quantity', label: 'Qty', minW: '60px' },
  { key: 'fulfillment_center_id', label: 'FC ID', minW: '80px' },
  { key: 'detailed_disposition', label: 'Disposition', minW: '140px' },
  { key: 'reason', label: 'Reason', minW: '140px' },
  { key: 'license_plate_number', label: 'LPN', minW: '120px' },
  { key: 'customer_comments', label: 'Customer Comments', minW: '180px' },
];

const FbaReturnsReport = () => {
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [records, setRecords] = useState<FbaReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof FbaReturn | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const fetchRecords = async (s = startDate, e = endDate) => {
    setLoading(true);
    setRecords([]);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/amazon/fba-returns`, {
        params: { start_date: s, end_date: e },
      });
      setRecords(res.data.records || []);
    } catch (err: any) {
      toast.error(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/fba-returns/download`,
        { params: { start_date: startDate, end_date: endDate }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fba_returns_${startDate}_to_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleSort = (key: keyof FbaReturn) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredData = useMemo(() => {
    let data = records.filter(r => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.sku_code?.toLowerCase().includes(q) ||
        r.asin?.toLowerCase().includes(q) ||
        r.amazon_order_id?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        r.detailed_disposition?.toLowerCase().includes(q) ||
        r.product_name?.toLowerCase().includes(q)
      );
    });

    if (sortConfig.key) {
      const k = sortConfig.key;
      data = [...data].sort((a, b) => {
        const av = a[k] ?? '';
        const bv = b[k] ?? '';
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [records, searchTerm, sortConfig]);

  return (
    <div className='container mx-auto p-4 bg-gray-50 dark:bg-zinc-950'>
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:shadow-none dark:border dark:border-zinc-800'>
        <h1 className='text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-6'>
          FBA Returns
        </h1>

        <div className={CONTROLS_CLASSES.container}>
          <div className={CONTROLS_CLASSES.inner}>
            <div className={CONTROLS_CLASSES.grid}>
              <div className={CONTROLS_CLASSES.section}>
                <h3 className={CONTROLS_CLASSES.sectionTitle}>Date Range & Actions</h3>
                <DateRangeComponent
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onGenerate={() => fetchRecords()}
                  loading={loading}
                  downloadReport={handleDownload as any}
                  downloadDisabledCondition={downloading || records.length === 0}
                  downloadLoading={downloading}
                />
              </div>
              <div className={CONTROLS_CLASSES.section}>
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder='Search by SKU, ASIN, order ID, reason…'
                />
              </div>
            </div>
          </div>
        </div>

        {records.length > 0 && (
          <div className='mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800'>
            <div className='flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg dark:bg-green-900/20 dark:text-green-400'>
              <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
              </svg>
              {records.length} records loaded
            </div>
          </div>
        )}

        {loading && <LoadingState message='Loading FBA returns data…' />}

        {!loading && records.length === 0 && (
          <div className='bg-gray-50 rounded-lg p-6 text-center dark:bg-zinc-800 mt-4'>
            <p className='text-gray-600 dark:text-zinc-400'>
              No records found for this date range. Select a range and click Generate Report.
            </p>
          </div>
        )}
      </div>

      {!loading && records.length > 0 && (
        <div className='bg-white rounded-lg shadow-md overflow-hidden dark:bg-zinc-900 dark:border dark:border-zinc-800'>
          <div className='p-6 bg-gray-50 border-b border-gray-200 dark:bg-zinc-800/50 dark:border-zinc-800'>
            <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
              <div>
                <h2 className='text-lg font-semibold text-gray-800 dark:text-zinc-100'>Return Records</h2>
                <p className='text-sm text-gray-600 dark:text-zinc-400'>
                  Showing {filteredData.length} of {records.length} records
                </p>
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder='Search by SKU, ASIN, order ID…'
                className='flex-1 max-w-md'
              />
            </div>
          </div>

          <div className='relative max-h-[70vh] overflow-auto'>
            <table className='min-w-full divide-y divide-gray-200 dark:divide-zinc-700'>
              <thead className='bg-gray-50 sticky top-0 z-30 shadow-sm dark:bg-zinc-800'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider border-r border-gray-200 dark:border-zinc-700 w-10'>
                    #
                  </th>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      style={{ minWidth: col.minW }}
                      className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider border-r border-gray-200 dark:border-zinc-700'
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        className='flex items-center gap-1 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors'
                      >
                        {col.label}
                        <SortIcon column={col.key} sortConfig={sortConfig} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200 dark:bg-zinc-900 dark:divide-zinc-700'>
                {filteredData.map((row, idx) => (
                  <tr key={idx} className='hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors'>
                    <td className='px-4 py-3 text-xs text-gray-400 dark:text-zinc-500 border-r border-gray-100 dark:border-zinc-800'>
                      {idx + 1}
                    </td>
                    {COLUMNS.map(col => (
                      <td
                        key={col.key}
                        className='px-4 py-3 text-sm text-gray-800 dark:text-zinc-200 border-r border-gray-100 dark:border-zinc-800 whitespace-nowrap'
                      >
                        {row[col.key] != null ? String(row[col.key]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FbaReturnsReport;
