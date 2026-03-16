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
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  search?: string;
}

const BlinkitItemsTable: React.FC<BlinkitItemsTableProps> = ({ search = '' }) => {
  // ===== STATE MANAGEMENT =====
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [, setSelectedItems] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search]);
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();

  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchItems();
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

  const deleteItem = async (item: any) => {
    try {
      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/blinkit/delete_item/${item._id}`
      );
      if (response.status == 200) {
        toast.success(`Item Deleted Successfully`);
        fetchItems();
      }
    } catch (error: any) {
      console.log(error);
      toast.error(`Error Deleting Item: `, error.message);
    }
  };
  // ===== COMPONENT RENDERING =====
  return (
    <div className='container mx-auto p-4 bg-gray-50 dark:bg-transparent'>
      {/* Loading State */}
      {loading && (
        <div className='flex justify-center items-center py-12'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
          <span className='ml-3 text-blue-600'>
            Loading Blinkit Products...
          </span>
        </div>
      )}

      {/* Report Table */}
      {!loading && reportData.length > 0 && (() => {
        const q = search.toLowerCase();
        const filtered = q
          ? reportData.filter(
              (item) =>
                item.item_name.toLowerCase().includes(q) ||
                item.sku_code.toLowerCase().includes(q) ||
                String(item.item_id).toLowerCase().includes(q)
            )
          : reportData;
        const totalPages = Math.max(1, Math.ceil(filtered.length / BLINKIT_PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const paginated = filtered.slice((safePage - 1) * BLINKIT_PAGE_SIZE, safePage * BLINKIT_PAGE_SIZE);
        return (
          <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-12'>#</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item Name</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item ID</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-16'></th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className='px-6 py-10 text-center text-sm text-gray-400 dark:text-zinc-500'>
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
                        <td className='px-6 py-3.5'>
                          <button
                            onClick={() => deleteItem(item)}
                            className='p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        </td>
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
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default BlinkitItemsTable;
