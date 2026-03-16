// components/ItemsTabls.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import { toast } from 'react-toastify';
import { Search, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import axios from 'axios';

const BLINKIT_PAGE_SIZE = 25;

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define type for report data structure
interface ReportItem {
  _id: string;
  sku_code: string;
  item_name: string;
  item_id: number;
}

interface BlinkitItemsTableProps {
  brand?: string;
  brands?: { value: string; label: string }[];
  onBrandChange?: (b: string) => void;
  brandSkus?: Set<string> | null;
}

const BlinkitItemsTable: React.FC<BlinkitItemsTableProps> = ({ brand = '', brands = [], onBrandChange, brandSkus = null }) => {
  // ===== STATE MANAGEMENT =====
  const currentDate = new Date();
  const [selectedDate] = useState<Date>(currentDate);
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [, setSelectedItems] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => { setPage(1); }, [search, brandSkus]);
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();

  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const fetchItems = async () => {
    setLoading(true);
    setReportData([]);
    setSelectedItems([]);

    if (!selectedMonth || !selectedYear) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('api_url environment variable is not set.');
      }

      const response = await fetch(`${apiUrl}/blinkit/get_blinkit_sku_mapping`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      const data: ReportItem[] | { message: string } = await response.json();

      if (Array.isArray(data)) {
        setReportData(data);
      } else {
        console.warn('API returned a message instead of items:', data.message);
        setReportData([]);

        if (data.message.includes('No saved report found')) {
          toast.info(data.message);
        } else {
          toast.error(data.message);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch items:', err);
      toast.error(`Failed to fetch items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== FILTERED + PAGINATED =====
  const q = search.toLowerCase();
  const filtered = reportData.filter((item) => {
    const matchesSearch = !q || (
      item.item_name.toLowerCase().includes(q) ||
      item.sku_code.toLowerCase().includes(q) ||
      String(item.item_id).toLowerCase().includes(q)
    );
    const matchesBrand = !brandSkus || brandSkus.has(item.sku_code);
    return matchesSearch && matchesBrand;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / BLINKIT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * BLINKIT_PAGE_SIZE, safePage * BLINKIT_PAGE_SIZE);

  // ===== COMPONENT RENDERING =====
  return (
    <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
      {/* Card header */}
      <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap'>
        <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>All Mappings</h2>
        <div className='relative flex-1 min-w-[160px] max-w-sm'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500' />
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search by item ID, SKU or name…'
            className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent'
          />
        </div>
        {brands.length > 0 && onBrandChange && (
          <select
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer'
          >
            <option value=''>All Brands</option>
            {brands.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        )}
        {!loading && (
          <span className='text-xs text-black dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full shrink-0'>
            {filtered.length}{filtered.length !== reportData.length ? ` / ${reportData.length}` : ''} items
          </span>
        )}
      </div>

      {loading ? (
        <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
          <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-yellow-400' />
          Loading…
        </div>
      ) : reportData.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
          <Zap className='w-10 h-10 mb-3 opacity-40' />
          <p className='font-medium'>No items found</p>
        </div>
      ) : (
        <>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-12'>#</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item Name</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item ID</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='px-6 py-10 text-center text-sm text-gray-400 dark:text-zinc-500'>
                      {search ? `No results for "${search}"` : 'No items found'}
                    </td>
                  </tr>
                ) : paginated.map((item: any, index) => {
                  const itemIdentifier = `${item.item_id}-${item.city}-${index}`;
                  return (
                    <tr key={itemIdentifier} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                      <td className='px-6 py-3.5 text-sm text-gray-400 dark:text-zinc-500'>{(safePage - 1) * BLINKIT_PAGE_SIZE + index + 1}</td>
                      <td className='px-6 py-3.5 text-gray-800 dark:text-zinc-200'>{item.item_name}</td>
                      <td className='px-6 py-3.5'>
                        <span className='inline-block font-mono text-xs px-2 py-0.5 rounded font-semibold' style={{ backgroundColor: 'rgba(255,211,76,0.2)', color: '#b8860b' }}>
                          {item.sku_code}
                        </span>
                      </td>
                      <td className='px-6 py-3.5 font-mono text-xs text-gray-500 dark:text-zinc-400'>{item.item_id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > BLINKIT_PAGE_SIZE && (
            <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
              <p className='text-xs text-gray-400 dark:text-zinc-500'>
                {(safePage - 1) * BLINKIT_PAGE_SIZE + 1}–{Math.min(safePage * BLINKIT_PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className='flex items-center gap-1'>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                >
                  <ChevronLeft className='w-4 h-4' />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, safePage - 2);
                  const actual = Math.min(totalPages, start + i);
                  return (
                    <button
                      key={actual}
                      onClick={() => setPage(actual)}
                      className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${
                        safePage === actual ? 'text-gray-900 font-bold' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      }`}
                      style={safePage === actual ? { backgroundColor: '#FFD34C' } : {}}
                    >
                      {actual}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                >
                  <ChevronRight className='w-4 h-4' />
                </button>
                <div className='flex items-center gap-1 ml-2 pl-2 border-l border-gray-200 dark:border-zinc-700'>
                  <span className='text-xs text-gray-400 dark:text-zinc-500'>Go to</span>
                  <input
                    type='number'
                    min={1}
                    max={totalPages}
                    placeholder='…'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = parseInt(e.currentTarget.value);
                        if (v >= 1 && v <= totalPages) {
                          setPage(v);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className='w-12 px-1.5 py-1 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-yellow-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                  />
                  <span className='text-xs text-gray-400 dark:text-zinc-500'>of {totalPages}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BlinkitItemsTable;
