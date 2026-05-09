'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
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

interface FbaWarehouseReturn {
  _id: string;
  request_date: string | null;
  order_id: string | null;
  order_source: string | null;
  order_type: string | null;
  service_speed: string | null;
  order_status: string | null;
  last_updated_date: string | null;
  sku: string | null;
  fnsku: string | null;
  product_name: string | null;
  disposition: string | null;
  requested_quantity: number | null;
  cancelled_quantity: number | null;
  disposed_quantity: number | null;
  shipped_quantity: number | null;
  in_process_quantity: number | null;
  removal_fee: number | null;
  currency: string | null;
  // editable
  received_date: string | null;
  condition: string | null;
  qty_received_wh: number | null;
  gdrive_link: string | null;
  entry_in_zoho: string | null;
  transfer_orders_inventory_adj: string | null;
  safe_t_claim_raise: string | null;
}

type EditableField =
  | 'received_date'
  | 'condition'
  | 'qty_received_wh'
  | 'gdrive_link'
  | 'entry_in_zoho'
  | 'transfer_orders_inventory_adj'
  | 'safe_t_claim_raise';

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

const READ_ONLY_COLUMNS: { key: keyof FbaWarehouseReturn; label: string; minW?: string }[] = [
  { key: 'request_date', label: 'Request Date', minW: '110px' },
  { key: 'order_id', label: 'Order ID', minW: '160px' },
  { key: 'sku', label: 'SKU', minW: '120px' },
  { key: 'fnsku', label: 'FNSKU', minW: '120px' },
  { key: 'product_name', label: 'Product Name', minW: '180px' },
  { key: 'disposition', label: 'Disposition', minW: '110px' },
  { key: 'requested_quantity', label: 'Req Qty', minW: '80px' },
  { key: 'cancelled_quantity', label: 'Cancelled Qty', minW: '100px' },
  { key: 'disposed_quantity', label: 'Disposed Qty', minW: '100px' },
  { key: 'shipped_quantity', label: 'Shipped Qty', minW: '90px' },
  { key: 'in_process_quantity', label: 'In-Process Qty', minW: '110px' },
  { key: 'removal_fee', label: 'Removal Fee', minW: '100px' },
  { key: 'currency', label: 'Currency', minW: '80px' },
  { key: 'order_source', label: 'Order Source', minW: '180px' },
  { key: 'order_type', label: 'Order Type', minW: '100px' },
  { key: 'service_speed', label: 'Service Speed', minW: '110px' },
  { key: 'order_status', label: 'Order Status', minW: '110px' },
  { key: 'last_updated_date', label: 'Last Updated', minW: '110px' },
];

const EDITABLE_COLUMNS: { key: EditableField; label: string; minW: string; type: 'text' | 'date' | 'number' | 'url' }[] = [
  { key: 'received_date', label: 'Received Date of Return', minW: '160px', type: 'date' },
  { key: 'condition', label: 'Condition of Product', minW: '140px', type: 'text' },
  { key: 'qty_received_wh', label: 'Qty Received in WH', minW: '140px', type: 'number' },
  { key: 'gdrive_link', label: 'GDrive Link (Images/CCTV)', minW: '180px', type: 'url' },
  { key: 'entry_in_zoho', label: 'Entry in Zoho', minW: '120px', type: 'text' },
  { key: 'transfer_orders_inventory_adj', label: 'Transfer Orders / Inv. Adj.', minW: '200px', type: 'text' },
  { key: 'safe_t_claim_raise', label: 'Safe-t Claim', minW: '130px', type: 'text' },
];

type SortKey = keyof FbaWarehouseReturn;

const FbaReturnsReport = () => {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkUpdateInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ records_updated: number } | null>(null);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [records, setRecords] = useState<FbaWarehouseReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableField } | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');
  const [savingCell, setSavingCell] = useState(false);

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
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/upload/fba-warehouse-returns`,
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

  const acceptBulkFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an XLSX file.');
      return;
    }
    setBulkResult(null);
    setBulkFile(file);
  };

  const handleBulkDragOver = (e: React.DragEvent) => { e.preventDefault(); setBulkDragOver(true); };
  const handleBulkDragLeave = (e: React.DragEvent) => { e.preventDefault(); setBulkDragOver(false); };
  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault(); setBulkDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) acceptBulkFile(file);
  };

  const handleBulkUpdate = async () => {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkResult(null);

    const formData = new FormData();
    formData.append('file', bulkFile);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/fba-warehouse-returns/bulk-update`,
        {
          method: 'POST',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setBulkResult(data);
      toast.success(`Updated ${data.records_updated} records`, { autoClose: 3000 });
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Bulk update failed.');
    } finally {
      setBulkUploading(false);
    }
  };

  const fetchRecords = useCallback(async (s = startDate, e = endDate) => {
    setLoading(true);
    setRecords([]);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/amazon/fba-warehouse-returns`, {
        params: { start_date: s, end_date: e },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      setRecords(res.data.records || []);
    } catch (err: any) {
      toast.error(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, accessToken]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/fba-warehouse-returns/download`,
        {
          params: { start_date: startDate, end_date: endDate },
          responseType: 'blob',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'];
      let filename = `fba_warehouse_returns_${startDate}_to_${endDate}.xlsx`;
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

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const startEdit = (id: string, field: EditableField, currentVal: any) => {
    setEditingCell({ id, field });
    setCellDraft(currentVal != null ? String(currentVal) : '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setCellDraft('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    setSavingCell(true);
    try {
      const payload: any = {};
      const { field } = editingCell;
      let val: any = cellDraft.trim();
      if (val === '') val = null;
      else if (field === 'qty_received_wh') val = parseInt(val, 10);
      payload[field] = val;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/amazon/fba-warehouse-returns/${editingCell.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);

      setRecords(prev =>
        prev.map(r =>
          r._id === editingCell.id ? { ...r, [field]: val } : r
        )
      );
      toast.success('Saved', { autoClose: 1500 });
      setEditingCell(null);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSavingCell(false);
    }
  };

  const filteredData = useMemo(() => {
    let data = records.filter(r => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.sku?.toLowerCase().includes(q) ||
        r.fnsku?.toLowerCase().includes(q) ||
        r.order_id?.toLowerCase().includes(q) ||
        r.order_status?.toLowerCase().includes(q) ||
        r.disposition?.toLowerCase().includes(q) ||
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

  const renderEditableCell = (row: FbaWarehouseReturn, col: typeof EDITABLE_COLUMNS[number]) => {
    const isEditing = editingCell?.id === row._id && editingCell?.field === col.key;
    const val = row[col.key];

    if (isEditing) {
      return (
        <div className='flex items-center gap-1 min-w-0'>
          <input
            autoFocus
            type={col.type === 'url' ? 'text' : col.type}
            value={cellDraft}
            onChange={e => setCellDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className='w-full min-w-0 px-1 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500'
          />
          <button
            onClick={saveEdit}
            disabled={savingCell}
            className='flex-shrink-0 text-green-600 hover:text-green-800 disabled:opacity-50'
            title='Save'
          >
            {savingCell ? (
              <div className='animate-spin h-3 w-3 border-b border-green-600 rounded-full' />
            ) : (
              <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
              </svg>
            )}
          </button>
          <button
            onClick={cancelEdit}
            className='flex-shrink-0 text-gray-400 hover:text-gray-600'
            title='Cancel'
          >
            <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
      );
    }

    const display = val != null && val !== '' ? String(val) : null;

    return (
      <button
        onClick={() => startEdit(row._id, col.key, val)}
        className={`w-full text-left px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group ${
          display ? 'text-gray-800 dark:text-zinc-200' : 'text-gray-300 dark:text-zinc-600 italic'
        }`}
        title='Click to edit'
      >
        {col.key === 'gdrive_link' && display ? (
          <a
            href={display}
            target='_blank'
            rel='noopener noreferrer'
            onClick={e => e.stopPropagation()}
            className='text-blue-600 underline hover:text-blue-800 dark:text-blue-400'
          >
            Link
          </a>
        ) : (
          <span>{display ?? '—'}</span>
        )}
        <svg
          className='inline-block ml-1 h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity'
          fill='none' stroke='currentColor' viewBox='0 0 24 24'
        >
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
            d='M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z' />
        </svg>
      </button>
    );
  };

  return (
    <div className='container mx-auto p-4 bg-gray-50 dark:bg-zinc-950'>

      {/* CSV Upload Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:border dark:border-zinc-800'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-zinc-100 mb-4'>
          Upload FBA Returns CSV
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
                Drop Amazon FBA Returns CSV or <span className='text-blue-600'>browse</span>
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

      {/* Bulk Update Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:border dark:border-zinc-800'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-zinc-100 mb-1'>
          Bulk Update Editable Columns
        </h2>
        <p className='text-sm text-gray-500 dark:text-zinc-400 mb-4'>
          Download the report, fill in the editable columns (Received Date, Condition, Qty Received, GDrive Link,
          Entry in Zoho, Transfer Orders, Safe-t Claim), then re-upload here. Rows are matched by Order ID + SKU.
        </p>

        {bulkResult && (
          <div className='mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg'>
            <p className='text-emerald-800 font-semibold'>Bulk update complete · Updated: <strong>{bulkResult.records_updated}</strong> records</p>
          </div>
        )}

        <div className='flex flex-col sm:flex-row gap-4 items-start'>
          <div
            className={`flex-1 relative rounded-xl border-2 border-dashed transition-all duration-200 p-6 text-center cursor-pointer
              ${bulkDragOver ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-purple-300 hover:bg-gray-50 dark:border-zinc-600 dark:hover:border-zinc-400'}`}
            onDragOver={handleBulkDragOver}
            onDragLeave={handleBulkDragLeave}
            onDrop={handleBulkDrop}
            onClick={() => bulkUpdateInputRef.current?.click()}
          >
            <svg className='w-8 h-8 mx-auto mb-2 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5}
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
            </svg>
            {bulkFile ? (
              <p className='text-sm font-medium text-gray-700 dark:text-zinc-200'>{bulkFile.name}</p>
            ) : (
              <p className='text-sm text-gray-500 dark:text-zinc-400'>
                Drop updated XLSX or <span className='text-purple-600'>browse</span>
              </p>
            )}
          </div>

          <div className='flex flex-col gap-2 justify-start pt-1'>
            <button
              onClick={handleBulkUpdate}
              disabled={!bulkFile || bulkUploading}
              className='px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
            >
              {bulkUploading ? (
                <><div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />Updating...</>
              ) : 'Bulk Update'}
            </button>
            <button
              onClick={() => { setBulkFile(null); setBulkResult(null); if (bulkUpdateInputRef.current) bulkUpdateInputRef.current.value = ''; }}
              disabled={bulkUploading}
              className='px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200
                disabled:opacity-50 border border-gray-200 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
            >
              Reset
            </button>
          </div>
        </div>

        <input type='file' accept='.xlsx,.xls' ref={bulkUpdateInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) acceptBulkFile(f); }} className='hidden' />
      </div>

      {/* Report Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-zinc-900 dark:shadow-none dark:border dark:border-zinc-800'>
        <h1 className='text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-2'>
          FBA Returns
        </h1>
        <p className='text-sm text-gray-500 dark:text-zinc-400 mb-6'>Filtered by Request Date</p>

        <div className={CONTROLS_CLASSES.container}>
          <div className={CONTROLS_CLASSES.inner}>
            <div className={CONTROLS_CLASSES.grid}>
              <div className={CONTROLS_CLASSES.section}>
                <h3 className={CONTROLS_CLASSES.sectionTitle}>Request Date Range & Actions</h3>
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
                  placeholder='Search by SKU, order ID, disposition, product…'
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
              {records.length} records loaded · Click any editable cell (highlighted blue on hover) to edit inline
            </div>
          </div>
        )}

        {loading && <LoadingState message='Loading FBA returns data…' />}

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
                placeholder='Search by SKU, order ID…'
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
                  {READ_ONLY_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      style={{ minWidth: col.minW }}
                      className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider border-r border-gray-200 dark:border-zinc-700'
                    >
                      <button
                        onClick={() => handleSort(col.key as SortKey)}
                        className='flex items-center gap-1 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors'
                      >
                        {col.label}
                        <SortIcon column={col.key} sortConfig={sortConfig} />
                      </button>
                    </th>
                  ))}
                  {EDITABLE_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      style={{ minWidth: col.minW }}
                      className='px-4 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider border-r border-gray-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-900/10'
                    >
                      <button
                        onClick={() => handleSort(col.key as SortKey)}
                        className='flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300 transition-colors'
                      >
                        {col.label}
                        <svg className='h-2.5 w-2.5 text-blue-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
                            d='M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z' />
                        </svg>
                        <SortIcon column={col.key} sortConfig={sortConfig} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200 dark:bg-zinc-900 dark:divide-zinc-700'>
                {filteredData.map((row, idx) => (
                  <tr key={row._id || idx} className='hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors'>
                    <td className='px-4 py-3 text-xs text-gray-400 dark:text-zinc-500 border-r border-gray-100 dark:border-zinc-800'>
                      {idx + 1}
                    </td>
                    {READ_ONLY_COLUMNS.map(col => (
                      <td
                        key={col.key}
                        className='px-4 py-3 text-sm text-gray-800 dark:text-zinc-200 border-r border-gray-100 dark:border-zinc-800 whitespace-nowrap'
                      >
                        {row[col.key] != null ? String(row[col.key]) : '—'}
                      </td>
                    ))}
                    {EDITABLE_COLUMNS.map(col => (
                      <td
                        key={col.key}
                        className='px-2 py-2 text-sm border-r border-gray-100 dark:border-zinc-800 bg-blue-50/30 dark:bg-blue-900/5 whitespace-nowrap'
                        style={{ minWidth: col.minW }}
                      >
                        {renderEditableCell(row, col)}
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
