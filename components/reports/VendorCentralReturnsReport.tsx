'use client';

import React, { useRef, useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  SortIcon,
  CONTROLS_CLASSES,
  LoadingState,
  SearchBar,
} from './TableStyles';
import DateRangeComponent from '@/components/reports/DateRange';

interface VcReturn {
  shipment_id: string | null;
  return_id: string | null;
  vendor_code: string | null;
  return_date: string | null;
  purchase_order: string | null;
  warehouse: string | null;
  asin: string | null;
  product: string | null;
  quantity: number | null;
  price_per_unit: number | null;
  net_amount: number | null;
  currency_code: string | null;
  ship_to_state: string | null;
  ship_from_state: string | null;
  system_ref_no: string | null;
  document_number: string | null;
  document_date: string | null;
  document_type: string | null;
  original_document_number: string | null;
  original_document_date: string | null;
  hsn: string | null;
  vendor_invoice: string | null;
  vendor_invoice_date: string | null;
  igst_tax_rate: number | null;
  igst_tax_amount: number | null;
  cess_tax_rate: number | null;
  cess_tax_amount: number | null;
  cgst_tax_rate: number | null;
  cgst_tax_amount: number | null;
  sgst_tax_rate: number | null;
  sgst_tax_amount: number | null;
  total_amount: number | null;
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

const COLUMNS: { key: keyof VcReturn; label: string; minW?: string }[] = [
  { key: 'return_date', label: 'Return Date', minW: '110px' },
  { key: 'shipment_id', label: 'Shipment ID', minW: '150px' },
  { key: 'return_id', label: 'Return ID', minW: '150px' },
  { key: 'vendor_code', label: 'Vendor', minW: '80px' },
  { key: 'purchase_order', label: 'PO', minW: '100px' },
  { key: 'warehouse', label: 'Warehouse', minW: '90px' },
  { key: 'asin', label: 'ASIN', minW: '120px' },
  { key: 'product', label: 'Product', minW: '200px' },
  { key: 'quantity', label: 'Qty', minW: '60px' },
  { key: 'price_per_unit', label: 'Price/Unit', minW: '90px' },
  { key: 'net_amount', label: 'Net Amount', minW: '100px' },
  { key: 'total_amount', label: 'Total Amount', minW: '110px' },
  { key: 'currency_code', label: 'Currency', minW: '80px' },
  { key: 'ship_to_state', label: 'Ship To', minW: '90px' },
  { key: 'ship_from_state', label: 'Ship From', minW: '90px' },
  { key: 'document_number', label: 'Document No.', minW: '140px' },
  { key: 'document_date', label: 'Doc Date', minW: '100px' },
  { key: 'document_type', label: 'Doc Type', minW: '100px' },
  { key: 'hsn', label: 'HSN', minW: '90px' },
  { key: 'vendor_invoice', label: 'Vendor Invoice', minW: '130px' },
  { key: 'vendor_invoice_date', label: 'Invoice Date', minW: '110px' },
  { key: 'igst_tax_rate', label: 'IGST %', minW: '80px' },
  { key: 'igst_tax_amount', label: 'IGST Amt', minW: '90px' },
  { key: 'cgst_tax_rate', label: 'CGST %', minW: '80px' },
  { key: 'cgst_tax_amount', label: 'CGST Amt', minW: '90px' },
  { key: 'sgst_tax_rate', label: 'SGST %', minW: '80px' },
  { key: 'sgst_tax_amount', label: 'SGST Amt', minW: '90px' },
  { key: 'cess_tax_rate', label: 'CESS %', minW: '80px' },
  { key: 'cess_tax_amount', label: 'CESS Amt', minW: '90px' },
  { key: 'system_ref_no', label: 'System Ref', minW: '120px' },
  { key: 'original_document_number', label: 'Orig Doc No.', minW: '130px' },
  { key: 'original_document_date', label: 'Orig Doc Date', minW: '110px' },
];

const VendorCentralReturnsReport = () => {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [records, setRecords] = useState<VcReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof VcReturn | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const acceptFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setUploadError('Please upload an Excel file (.xlsx or .xls)');
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
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/upload/vendor-central-returns`,
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

  const fetchRecords = async (s = startDate, e = endDate) => {
    setLoading(true);
    setRecords([]);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/amazon/vendor-central-returns`, {
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
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/vendor-central-returns/download`,
        { params: { start_date: startDate, end_date: endDate }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor_central_returns_${startDate}_to_${endDate}.xlsx`;
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

  const handleSort = (key: keyof VcReturn) => {
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
        r.asin?.toLowerCase().includes(q) ||
        r.product?.toLowerCase().includes(q) ||
        r.shipment_id?.toLowerCase().includes(q) ||
        r.return_id?.toLowerCase().includes(q) ||
        r.purchase_order?.toLowerCase().includes(q) ||
        r.vendor_invoice?.toLowerCase().includes(q)
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
          Upload Vendor Central Returns XLSX
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
                Drop Vendor Central Returns XLSX or <span className='text-blue-600'>browse</span>
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

        <input type='file' accept='.xlsx,.xls' ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} className='hidden' />
      </div>

      {/* Report Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:shadow-none dark:border dark:border-zinc-800'>
        <h1 className='text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-6'>
          Vendor Central Returns
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
                  placeholder='Search by ASIN, product, PO, shipment ID…'
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

        {loading && <LoadingState message='Loading Vendor Central returns data…' />}

        {!loading && records.length === 0 && (
          <div className='bg-gray-50 rounded-lg p-6 text-center dark:bg-zinc-800 mt-4'>
            <p className='text-gray-600 dark:text-zinc-400'>
              No records found for this date range. Select a range and click Generate Report, or upload an XLSX above.
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
                placeholder='Search by ASIN, product, PO…'
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

export default VendorCentralReturnsReport;
