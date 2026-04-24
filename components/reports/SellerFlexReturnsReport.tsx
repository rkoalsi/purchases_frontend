'use client';

import React, { useRef, useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  SortIcon,
  TABLE_CLASSES,
  CONTROLS_CLASSES,
  LoadingState,
  SearchBar,
} from './TableStyles';
import DateRangeComponent from '@/components/reports/DateRange';

interface ReturnRecord {
  return_type: string | null;
  customer_order_id: string | null;
  shipment_id: string | null;
  sku: string | null;
  msku: string | null;
  asin: string | null;
  external_id1: string | null;
  external_id2: string | null;
  external_id3: string | null;
  units: number | null;
  forward_leg_tracking_id: string | null;
  reverse_leg_tracking_id: string | null;
  rma_id: string | null;
  return_status: string | null;
  carrier: string | null;
  pickup_date: string | null;
  last_updated_on: string | null;
  returned_with_otp: string | null;
  days_in_transit: string | null;
  days_since_return_complete: string | null;
  return_reason: string | null;
  lpn: string | null;
}

interface UploadResult {
  message: string;
  date_range: { start: string; end: string };
  existing_deleted: number;
  records_inserted: number;
}

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .split('T')[0];

const COLUMNS: { key: keyof ReturnRecord; label: string; minW?: string }[] = [
  { key: 'return_type', label: 'Return Type', minW: '120px' },
  { key: 'customer_order_id', label: 'Order ID', minW: '160px' },
  { key: 'shipment_id', label: 'Shipment ID', minW: '120px' },
  { key: 'sku', label: 'SKU', minW: '120px' },
  { key: 'msku', label: 'mSKU', minW: '120px' },
  { key: 'asin', label: 'ASIN', minW: '120px' },
  { key: 'units', label: 'Units', minW: '70px' },
  { key: 'return_status', label: 'Return Status', minW: '140px' },
  { key: 'carrier', label: 'Carrier', minW: '100px' },
  { key: 'pickup_date', label: 'Pick-up Date', minW: '110px' },
  { key: 'last_updated_on', label: 'Last Updated', minW: '110px' },
  { key: 'return_reason', label: 'Return Reason', minW: '140px' },
  { key: 'returned_with_otp', label: 'OTP', minW: '70px' },
  { key: 'days_in_transit', label: 'Days In-transit', minW: '110px' },
  { key: 'days_since_return_complete', label: 'Days Since Complete', minW: '140px' },
  { key: 'rma_id', label: 'RMA ID', minW: '120px' },
  { key: 'forward_leg_tracking_id', label: 'Fwd Tracking ID', minW: '150px' },
  { key: 'reverse_leg_tracking_id', label: 'Rev Tracking ID', minW: '150px' },
  { key: 'external_id1', label: 'Ext ID1', minW: '100px' },
  { key: 'external_id2', label: 'Ext ID2', minW: '100px' },
  { key: 'external_id3', label: 'Ext ID3', minW: '100px' },
  { key: 'lpn', label: 'LPN', minW: '100px' },
];

const SellerFlexReturnsReport = () => {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Table state
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ReturnRecord | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  // Upload handlers
  const acceptFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadError('Please upload a CSV file (.csv)');
      return;
    }
    setUploadError('');
    setUploadResult(null);
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/upload/seller-flex-returns`,
        {
          method: 'POST',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setUploadResult(data);
      toast.success(`Inserted ${data.records_inserted} records`, { autoClose: 3000 });
      // Refresh table if the uploaded range overlaps current filter
      fetchRecords();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Table handlers
  const fetchRecords = async (s = startDate, e = endDate) => {
    setLoading(true);
    setRecords([]);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/amazon/seller-flex-returns`, {
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
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/seller-flex-returns/download`,
        { params: { start_date: startDate, end_date: endDate }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'];
      let filename = `seller_flex_returns_${startDate}_to_${endDate}.xlsx`;
      if (cd) {
        const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (m?.[1]) filename = m[1].replace(/['"]/g, '');
      }
      a.download = filename;
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

  const handleSort = (key: keyof ReturnRecord) => {
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
        r.sku?.toLowerCase().includes(q) ||
        r.msku?.toLowerCase().includes(q) ||
        r.asin?.toLowerCase().includes(q) ||
        r.customer_order_id?.toLowerCase().includes(q) ||
        r.return_status?.toLowerCase().includes(q) ||
        r.return_reason?.toLowerCase().includes(q)
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

      {/* Upload Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:border dark:border-zinc-800'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-zinc-100 mb-4'>
          Upload Returns Reconciliation CSV
        </h2>

        {uploadError && (
          <div className='mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg'>
            <p className='text-sm font-medium text-red-800'>{uploadError}</p>
          </div>
        )}

        {uploadResult && (
          <div className='mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg'>
            <p className='text-emerald-800 font-semibold mb-1'>{uploadResult.message}</p>
            <p className='text-sm text-emerald-700'>
              Range: <strong>{uploadResult.date_range.start}</strong> → <strong>{uploadResult.date_range.end}</strong>
              &nbsp;·&nbsp; Inserted: <strong>{uploadResult.records_inserted}</strong>
              {uploadResult.existing_deleted > 0 && (
                <>&nbsp;·&nbsp; Replaced: <strong>{uploadResult.existing_deleted}</strong></>
              )}
            </p>
          </div>
        )}

        <div className='flex flex-col sm:flex-row gap-4 items-start'>
          <div
            className={`flex-1 relative rounded-xl border-2 border-dashed transition-all duration-200 p-6 text-center cursor-pointer
              ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50 dark:border-zinc-600 dark:hover:border-zinc-400'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className='w-8 h-8 mx-auto mb-2 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5}
                d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' />
            </svg>
            {selectedFile ? (
              <p className='text-sm font-medium text-gray-700 dark:text-zinc-200'>{selectedFile.name}</p>
            ) : (
              <p className='text-sm text-gray-500 dark:text-zinc-400'>
                Drop VKSX-RETURNS_RECONCILIATION CSV or <span className='text-blue-600'>browse</span>
              </p>
            )}
          </div>

          <div className='flex flex-col gap-2 justify-start pt-1'>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className='px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
            >
              {uploading ? (
                <><div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />Uploading...</>
              ) : 'Upload & Import'}
            </button>
            <button
              onClick={resetUpload}
              disabled={uploading}
              className='px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200
                disabled:opacity-50 border border-gray-200 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
            >
              Reset
            </button>
          </div>
        </div>

        <input type='file' accept='.csv' ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} className='hidden' />
      </div>

      {/* Report Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:shadow-none dark:border dark:border-zinc-800'>
        <h1 className='text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-6'>
          Seller Flex Returns
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
                  placeholder='Search by SKU, ASIN, order ID, status…'
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

        {loading && <LoadingState message='Loading returns data…' />}

        {!loading && records.length === 0 && (
          <div className='bg-gray-50 rounded-lg p-6 text-center dark:bg-zinc-800 mt-4'>
            <p className='text-gray-600 dark:text-zinc-400'>
              No records found for this date range. Select a range and click Generate Report, or upload a CSV above.
            </p>
          </div>
        )}
      </div>

      {/* Table */}
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

export default SellerFlexReturnsReport;
