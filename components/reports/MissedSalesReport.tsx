'use client';
import React, { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Download, RefreshCw, TrendingDown } from 'lucide-react';
import DatePicker from '../common/DatePicker';
import {
  SortIcon,
  TABLE_CLASSES,
  LoadingState,
} from './TableStyles';

interface MissedSalesRecord {
  date: string;
  data_source: string | null;
  item_status: string | null;
  asin: string | null;
  item_code: string | null;
  item_name: string | null;
  estimate_no: string | null;
  customer_name: string | null;
  po_no: string | null;
  quantity_ordered: number;
  quantity_cancelled: number;
  missed_sales_quantity: number;
  uploaded_at?: string;
}

type SortKey = keyof MissedSalesRecord;
type SortDir = 'asc' | 'desc';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MissedSalesReport: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [data, setData] = useState<MissedSalesRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDir } | null>(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildDateParams = () => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = format(startDate, 'yyyy-MM-dd');
    if (endDate) params.end_date = format(endDate, 'yyyy-MM-dd');
    return params;
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = buildDateParams();
      const res = await axios.get(`${API_URL}/missed_sales`, { params });
      setData(res.data.data || []);
      if ((res.data.data || []).length === 0) {
        toast.info('No records found for the selected date range.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to fetch missed sales data.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = buildDateParams();
      const res = await axios.get(`${API_URL}/missed_sales/download`, {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename=([^;]+)/);
      link.setAttribute('download', match ? match[1] : 'missed_sales.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to download report.');
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls).');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_URL}/missed_sales/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { total_records_inserted, records_deleted, date_range_processed } = res.data;
      toast.success(
        `Uploaded ${total_records_inserted} records` +
          (records_deleted ? ` (replaced ${records_deleted} existing)` : '') +
          (date_range_processed?.start_date
            ? ` for ${date_range_processed.start_date} → ${date_range_processed.end_date}`
            : '') +
          '.'
      );
      // Refresh data if a report is already loaded
      if (data.length > 0) {
        await fetchReport();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to upload file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return data.filter(
      (r) =>
        !term ||
        r.item_code?.toLowerCase().includes(term) ||
        r.item_name?.toLowerCase().includes(term) ||
        r.asin?.toLowerCase().includes(term) ||
        r.data_source?.toLowerCase().includes(term) ||
        r.estimate_no?.toLowerCase().includes(term) ||
        r.customer_name?.toLowerCase().includes(term) ||
        r.po_no?.toLowerCase().includes(term)
    );
  }, [data, search]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = a[sortConfig.key] ?? '';
      const bv = b[sortConfig.key] ?? '';
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const totalMissed = useMemo(
    () => filteredData.reduce((s, r) => s + (r.missed_sales_quantity || 0), 0),
    [filteredData]
  );
  const totalOrdered = useMemo(
    () => filteredData.reduce((s, r) => s + (r.quantity_ordered || 0), 0),
    [filteredData]
  );
  const totalCancelled = useMemo(
    () => filteredData.reduce((s, r) => s + (r.quantity_cancelled || 0), 0),
    [filteredData]
  );

  const columns: { key: SortKey; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'data_source', label: 'Data Source' },
    { key: 'item_status', label: 'Item Status' },
    { key: 'asin', label: 'ASIN' },
    { key: 'item_code', label: 'Item Code' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'estimate_no', label: 'Estimate No.' },
    { key: 'customer_name', label: 'Customer Name' },
    { key: 'po_no', label: 'PO No.' },
    { key: 'quantity_ordered', label: 'Qty Ordered' },
    { key: 'quantity_cancelled', label: 'Qty Cancelled' },
    { key: 'missed_sales_quantity', label: 'Missed Sales Qty' },
  ];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <div className='w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center'>
            <TrendingDown className='w-5 h-5 text-red-600 dark:text-red-400' />
          </div>
          <div>
            <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>
              Missed Sales
            </h1>
            <p className='text-sm text-zinc-500 dark:text-zinc-400'>
              Upload and view missed sales data
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-5'>
        <div className='flex flex-wrap items-end gap-4'>
          {/* Date Range */}
          <div className='flex items-end gap-3'>
            <div className='w-44'>
              <DatePicker
                label='Start Date'
                selected={startDate}
                onChange={setStartDate}
                maxDate={endDate || undefined}
                placeholder='Select start date'
              />
            </div>
            <div className='w-44'>
              <DatePicker
                label='End Date'
                selected={endDate}
                onChange={setEndDate}
                minDate={startDate || undefined}
                placeholder='Select end date'
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className='flex items-center gap-2 ml-auto'>
            {/* Upload */}
            <input
              ref={fileInputRef}
              type='file'
              accept='.xlsx,.xls'
              className='hidden'
              onChange={handleFileChange}
            />
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className='flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-60 transition-colors'
            >
              {uploading ? (
                <RefreshCw className='w-4 h-4 animate-spin' />
              ) : (
                <Upload className='w-4 h-4' />
              )}
              {uploading ? 'Uploading…' : 'Upload Report'}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={downloading || data.length === 0}
              className='flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-60 transition-colors'
            >
              {downloading ? (
                <RefreshCw className='w-4 h-4 animate-spin' />
              ) : (
                <Download className='w-4 h-4' />
              )}
              {downloading ? 'Downloading…' : 'Download Report'}
            </button>

            {/* Generate */}
            <button
              onClick={fetchReport}
              disabled={loading}
              className='flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 transition-colors'
            >
              {loading ? (
                <RefreshCw className='w-4 h-4 animate-spin' />
              ) : (
                <RefreshCw className='w-4 h-4' />
              )}
              {loading ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data.length > 0 && (
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          {[
            { label: 'Total Records', value: filteredData.length.toLocaleString(), color: 'blue' },
            { label: 'Qty Ordered', value: totalOrdered.toLocaleString(), color: 'green' },
            { label: 'Qty Cancelled', value: totalCancelled.toLocaleString(), color: 'orange' },
            { label: 'Missed Sales Qty', value: totalMissed.toLocaleString(), color: 'red' },
          ].map((card) => (
            <div
              key={card.label}
              className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4'
            >
              <p className='text-xs text-zinc-500 dark:text-zinc-400 mb-1'>{card.label}</p>
              <p className='text-2xl font-semibold text-zinc-900 dark:text-zinc-100'>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState message='Loading missed sales data…' />
      ) : data.length > 0 ? (
        <div className={TABLE_CLASSES.container}>
          {/* Search */}
          <div className={TABLE_CLASSES.headerSection}>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-zinc-500 dark:text-zinc-400'>
                {filteredData.length} of {data.length} records
              </span>
              <input
                type='text'
                placeholder='Search by item, ASIN, code…'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64'
              />
            </div>
          </div>

          <div className={TABLE_CLASSES.overflow}>
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={TABLE_CLASSES.th}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className={TABLE_CLASSES.thContent}>
                        <span>{col.label}</span>
                        <SortIcon column={col.key} sortConfig={sortConfig} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {sortedData.map((row, idx) => (
                  <tr key={idx} className={TABLE_CLASSES.tr}>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>
                        {row.date ? row.date.slice(0, 10) : '—'}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>{row.data_source || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>{row.item_status || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>{row.asin || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={`${TABLE_CLASSES.tdText} font-mono text-xs`}>
                        {row.item_code || '—'}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdTextMedium}>{row.item_name || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>{row.estimate_no || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>{row.customer_name || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>{row.po_no || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>
                        {row.quantity_ordered.toLocaleString()}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={TABLE_CLASSES.tdText}>
                        {row.quantity_cancelled.toLocaleString()}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className='text-sm font-medium text-red-600 dark:text-red-400'>
                        {row.missed_sales_quantity.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 py-16 text-center'>
          <TrendingDown className='w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3' />
          <p className='text-zinc-500 dark:text-zinc-400 text-sm'>
            Select a date range and click <strong>Generate Report</strong>, or upload a file to get
            started.
          </p>
        </div>
      )}
    </div>
  );
};

export default MissedSalesReport;
