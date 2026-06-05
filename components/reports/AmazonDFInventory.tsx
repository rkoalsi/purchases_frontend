'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Download, Trash2, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadBatch {
  upload_id: string;
  start_date: string;
  end_date: string;
  filename: string;
  uploaded_at: string;
  row_count: number;
}

interface InventoryRow {
  date: string;
  sku: string;
  asin: string;
  title: string;
  warehouse: string;
  warehouse_name: string;
  available_units: number | null;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Expandable batch row ─────────────────────────────────────────────────────

function BatchRow({
  batch,
  onDelete,
}: {
  batch: UploadBatch;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadRows() {
    if (rows.length > 0) { setExpanded(true); return; }
    setRowsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/amazon_df_inventory/${batch.upload_id}/rows`);
      setRows(res.data);
      setExpanded(true);
    } catch {
      toast.error('Failed to load rows');
    } finally {
      setRowsLoading(false);
    }
  }

  function toggle() {
    if (expanded) { setExpanded(false); return; }
    loadRows();
  }

  async function handleDelete() {
    if (!confirm(`Delete upload "${batch.filename}" (${batch.row_count} rows)?`)) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/amazon_df_inventory/${batch.upload_id}`);
      toast.success('Upload deleted');
      onDelete(batch.upload_id);
    } catch {
      toast.error('Failed to delete upload');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className={TABLE_CLASSES.row}>
        <td className={TABLE_CLASSES.cell}>
          <button
            onClick={toggle}
            className='flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs'
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {batch.filename}
          </button>
        </td>
        <td className={TABLE_CLASSES.cell}>{batch.start_date}</td>
        <td className={TABLE_CLASSES.cell}>{batch.end_date}</td>
        <td className={TABLE_CLASSES.cell}>{fmtDate(batch.uploaded_at)}</td>
        <td className={TABLE_CLASSES.cell + ' text-center'}>{batch.row_count.toLocaleString()}</td>
        <td className={TABLE_CLASSES.cell + ' text-center'}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className='p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40'
            title='Delete upload'
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} className='p-0 bg-zinc-50 dark:bg-zinc-900'>
            {rowsLoading ? (
              <div className='p-4'><LoadingState message='Loading rows…' /></div>
            ) : (
              <div className='overflow-x-auto max-h-[400px] overflow-y-auto'>
                <table className={TABLE_CLASSES.table + ' text-xs'}>
                  <thead>
                    <tr>
                      {['Date', 'SKU', 'ASIN', 'Title', 'Warehouse', 'Warehouse Name', 'Available Units', 'Status'].map(h => (
                        <th key={h} className={TABLE_CLASSES.header}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={TABLE_CLASSES.row}>
                        <td className={TABLE_CLASSES.cell + ' whitespace-nowrap'}>{r.date || '—'}</td>
                        <td className={TABLE_CLASSES.cell + ' font-mono whitespace-nowrap'}>{r.sku || '—'}</td>
                        <td className={TABLE_CLASSES.cell + ' font-mono whitespace-nowrap'}>{r.asin || '—'}</td>
                        <td className={TABLE_CLASSES.cell + ' max-w-xs truncate'} title={r.title}>{r.title || '—'}</td>
                        <td className={TABLE_CLASSES.cell}>{r.warehouse || '—'}</td>
                        <td className={TABLE_CLASSES.cell}>{r.warehouse_name || '—'}</td>
                        <td className={TABLE_CLASSES.cell + ' text-right'}>{r.available_units ?? '—'}</td>
                        <td className={TABLE_CLASSES.cell}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {r.status || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AmazonDFInventory() {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchBatches(); }, []);

  async function fetchBatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/amazon_df_inventory/uploads`);
      setBatches(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.warn('Select a file first'); return; }
    if (!startDate) { toast.warn('Enter start date'); return; }
    if (!endDate) { toast.warn('Enter end date'); return; }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('start_date', startDate);
    fd.append('end_date', endDate);

    setUploading(true);
    try {
      const res = await axios.post(`${API_URL}/amazon_df_inventory/upload`, fd);
      toast.success(`Uploaded ${res.data.rows_inserted} rows`);
      if (fileRef.current) fileRef.current.value = '';
      fetchBatches();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleTemplate() {
    try {
      const res = await axios.get(`${API_URL}/amazon_df_inventory/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'amazon_df_inventory_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  }

  function onDelete(id: string) {
    setBatches(prev => prev.filter(b => b.upload_id !== id));
  }

  return (
    <div className='p-4 sm:p-6 space-y-6'>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <FileSpreadsheet size={20} className='text-blue-600 dark:text-blue-400' />
          <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>Amazon DF Inventory</h1>
        </div>
        <button
          onClick={handleTemplate}
          className='flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        >
          <Download size={14} />
          Download Template
        </button>
      </div>

      {/* Upload card */}
      <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-4'>
        <h2 className='text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide'>Upload Inventory File</h2>
        <div className='flex flex-wrap gap-3 items-end'>
          <div className='flex flex-col gap-1'>
            <label className='text-xs text-zinc-500 dark:text-zinc-400'>Start Date</label>
            <input
              type='date'
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className='px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]'
            />
          </div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs text-zinc-500 dark:text-zinc-400'>End Date</label>
            <input
              type='date'
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className='px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]'
            />
          </div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs text-zinc-500 dark:text-zinc-400'>File (CSV or XLSX)</label>
            <input
              ref={fileRef}
              type='file'
              accept='.csv,.xlsx,.xls'
              className='text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-zinc-300 dark:file:border-zinc-600 file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 file:cursor-pointer hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700'
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className='flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {uploading ? (
              <span className='animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' />
            ) : (
              <Upload size={14} />
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        <p className='text-xs text-zinc-400 dark:text-zinc-500'>
          Accepts the standard Amazon inventory export CSV (Seller Central → Manage Inventory → Download). SKU formula wrappers (<code>="..."</code>) are stripped automatically.
        </p>
      </div>

      {/* Uploads table */}
      <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'>
        <div className='px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>Uploaded Batches</h2>
          <span className='text-xs text-zinc-400'>{batches.length} upload{batches.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className='p-6'><LoadingState /></div>
        ) : error ? (
          <div className='p-6'><ErrorState message={error} onRetry={fetchBatches} /></div>
        ) : batches.length === 0 ? (
          <div className='p-8 text-center text-sm text-zinc-400 dark:text-zinc-500'>No uploads yet. Upload a file above to get started.</div>
        ) : (
          <div className='overflow-x-auto'>
            <table className={TABLE_CLASSES.table}>
              <thead>
                <tr>
                  <th className={TABLE_CLASSES.header}>Filename</th>
                  <th className={TABLE_CLASSES.header}>Start Date</th>
                  <th className={TABLE_CLASSES.header}>End Date</th>
                  <th className={TABLE_CLASSES.header}>Uploaded At</th>
                  <th className={TABLE_CLASSES.header + ' text-center'}>Rows</th>
                  <th className={TABLE_CLASSES.header + ' text-center'}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <BatchRow key={b.upload_id} batch={b} onDelete={onDelete} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
