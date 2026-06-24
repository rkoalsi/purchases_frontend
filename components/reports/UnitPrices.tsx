'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Upload,
  Download,
  Search,
  Tag,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/context/AuthContext';
import { TABLE_CLASSES, LoadingState, ErrorState } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const CURRENCIES = ['INR', 'USD', 'CNY', 'EUR', 'GBP'];

interface Row {
  sku_code: string;
  item_name: string;
  brand: string;
  purchase_status: string;
  zoho_status: string;
  unit_price: number | null;
  currency: string;
  updated_by: string;
  updated_at: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Editable row ───────────────────────────────────────────────────────────────

function PriceRow({
  row,
  onSaved,
  defaultCurrency,
}: {
  row: Row;
  onSaved: (sku: string, updated: Partial<Row>) => void;
  defaultCurrency: string;
}) {
  const { email } = useAuth();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState<string>(row.unit_price != null ? String(row.unit_price) : '');
  const [currency, setCurrency] = useState<string>(row.currency || defaultCurrency);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(row.unit_price != null ? String(row.unit_price) : '');
    setCurrency(row.currency || defaultCurrency);
  }, [row.unit_price, row.currency, defaultCurrency]);

  const isSet = row.unit_price != null;

  async function save() {
    const trimmed = price.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed != null && (isNaN(parsed) || parsed < 0)) {
      toast.warn('Enter a valid non-negative price');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/unit_prices/${encodeURIComponent(row.sku_code)}`, {
        unit_price: parsed,
        currency: parsed == null ? '' : currency,
        updated_by: email || '',
      });
      onSaved(row.sku_code, {
        unit_price: res.data.unit_price ?? null,
        currency: res.data.currency || '',
        updated_by: res.data.updated_by || email || '',
        updated_at: res.data.updated_at || new Date().toISOString(),
      });
      setEditing(false);
      toast.success(parsed == null ? 'Price cleared' : 'Price saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setPrice(row.unit_price != null ? String(row.unit_price) : '');
    setCurrency(row.currency || defaultCurrency);
    setEditing(false);
  }

  return (
    <tr className={TABLE_CLASSES.tr}>
      <td className={TABLE_CLASSES.td + ' font-mono whitespace-nowrap'}>{row.sku_code}</td>
      <td className={TABLE_CLASSES.td + ' max-w-xs truncate'} title={row.item_name}>{row.item_name || '—'}</td>
      <td className={TABLE_CLASSES.td + ' whitespace-nowrap'}>{row.brand || '—'}</td>
      <td className={TABLE_CLASSES.td}><StatusBadge value={row.purchase_status} /></td>
      <td className={TABLE_CLASSES.td}><StatusBadge value={row.zoho_status} /></td>
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <div className='flex items-center gap-1'>
            <input
              type='number'
              min={0}
              step='0.01'
              value={price}
              autoFocus
              onChange={e => setPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              placeholder='blank = clear'
              className='w-28 px-2 py-1 text-sm rounded border border-blue-400 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className='px-1 py-1 text-sm rounded border border-blue-400 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={`text-left text-sm font-medium ${
              isSet ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'
            } hover:underline`}
          >
            {isSet ? `${row.currency || ''} ${row.unit_price?.toLocaleString()}` : 'Set price'}
          </button>
        )}
      </td>
      <td className={TABLE_CLASSES.td + ' whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400'}>
        {row.updated_by ? <span title={row.updated_by}>{fmtDate(row.updated_at)}</span> : '—'}
      </td>
      <td className={TABLE_CLASSES.td + ' text-center'}>
        {editing ? (
          <div className='flex items-center justify-center gap-1'>
            <button
              onClick={save}
              disabled={saving}
              className='p-1 text-green-600 hover:text-green-700 disabled:opacity-40'
              title='Save'
            >
              {saving ? <span className='animate-spin inline-block w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full' /> : <Check size={16} />}
            </button>
            <button onClick={cancel} disabled={saving} className='p-1 text-zinc-500 hover:text-zinc-700 disabled:opacity-40' title='Cancel'>
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className='text-xs text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline'
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  if (!value) return <span className='text-zinc-400 dark:text-zinc-500'>—</span>;
  const active = value.toLowerCase() === 'active';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
      active
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
    }`}>
      {value}
    </span>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function UnitPrices() {
  const { email } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [onlySet, setOnlySet] = useState(false);
  const [page, setPage] = useState(1);
  const [defaultCurrency, setDefaultCurrency] = useState('INR');

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/unit_prices/`, {
        params: { page, limit: 50, search: search || undefined, only_set: onlySet },
      });
      setRows(res.data.data);
      setPagination(res.data.pagination);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load unit prices');
    } finally {
      setLoading(false);
    }
  }, [page, search, onlySet]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function onSaved(sku: string, updated: Partial<Row>) {
    setRows(prev => prev.map(r => (r.sku_code === sku ? { ...r, ...updated } : r)));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleTemplate(prefill: boolean) {
    try {
      const res = await axios.get(`${API_URL}/unit_prices/template`, {
        params: { prefill },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = prefill ? 'unit_prices_export.xlsx' : 'unit_prices_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(prefill ? 'Failed to export' : 'Failed to download template');
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.warn('Select a file first'); return; }
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await axios.post(`${API_URL}/unit_prices/upload`, fd, {
        params: { updated_by: email || '' },
      });
      const { updated, cleared, skipped } = res.data;
      toast.success(`Updated ${updated}${cleared ? `, cleared ${cleared}` : ''}${skipped?.length ? `, skipped ${skipped.length}` : ''}`);
      if (fileRef.current) fileRef.current.value = '';
      fetchRows();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className='p-4 sm:p-6 space-y-6'>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Tag size={20} className='text-blue-600 dark:text-blue-400' />
          <div>
            <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>Unit Prices</h1>
            <p className='text-xs text-zinc-400 dark:text-zinc-500'>Source of truth for the master report Unit Price column. Not derived from purchase orders.</p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <button
            onClick={() => handleTemplate(false)}
            className='flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          >
            <Download size={14} /> Template
          </button>
          <button
            onClick={() => handleTemplate(true)}
            className='flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          >
            <Download size={14} /> Export current
          </button>
        </div>
      </div>

      {/* Upload card */}
      <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3'>
        <h2 className='text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide'>Bulk Upload</h2>
        <div className='flex flex-wrap gap-3 items-end'>
          <div className='flex flex-col gap-1'>
            <label className='text-xs text-zinc-500 dark:text-zinc-400'>File (XLSX) — columns: SKU Code, Unit Price, Currency</label>
            <input
              ref={fileRef}
              type='file'
              accept='.xlsx,.xls'
              className='text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-zinc-300 dark:file:border-zinc-600 file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 file:cursor-pointer hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700'
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className='flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
          >
            {uploading ? <span className='animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full' /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        <p className='text-xs text-zinc-400 dark:text-zinc-500'>Rows with a blank Unit Price clear that SKU's managed price.</p>
      </div>

      {/* Controls */}
      <div className='flex flex-wrap items-center gap-3'>
        <form onSubmit={submitSearch} className='flex items-center gap-2'>
          <div className='relative'>
            <Search size={14} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400' />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder='Search SKU, name, brand…'
              className='pl-8 pr-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]'
            />
          </div>
          <button type='submit' className='px-3 py-1.5 text-sm rounded-md bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700'>Search</button>
        </form>
        <label className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300'>
          <input type='checkbox' checked={onlySet} onChange={e => { setPage(1); setOnlySet(e.target.checked); }} className='rounded' />
          Only priced SKUs
        </label>
        <label className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 ml-auto'>
          Default currency
          <select
            value={defaultCurrency}
            onChange={e => setDefaultCurrency(e.target.value)}
            className='px-2 py-1 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {/* Table */}
      <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'>
        {loading ? (
          <div className='p-6'><LoadingState /></div>
        ) : error ? (
          <div className='p-6'><ErrorState error={error} onRetry={fetchRows} /></div>
        ) : rows.length === 0 ? (
          <div className='p-8 text-center text-sm text-zinc-400 dark:text-zinc-500'>No products match.</div>
        ) : (
          <div className='overflow-x-auto'>
            <table className={TABLE_CLASSES.table}>
              <thead>
                <tr>
                  <th className={TABLE_CLASSES.th}>SKU Code</th>
                  <th className={TABLE_CLASSES.th}>Item Name</th>
                  <th className={TABLE_CLASSES.th}>Brand</th>
                  <th className={TABLE_CLASSES.th}>Purchase Status</th>
                  <th className={TABLE_CLASSES.th}>Zoho Status</th>
                  <th className={TABLE_CLASSES.th}>Unit Price</th>
                  <th className={TABLE_CLASSES.th}>Last Updated</th>
                  <th className={TABLE_CLASSES.th + ' text-center'}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <PriceRow key={r.sku_code} row={r} onSaved={onSaved} defaultCurrency={defaultCurrency} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && pagination.total > 0 && (
          <div className='flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-700'>
            <span className='text-xs text-zinc-500 dark:text-zinc-400'>
              Page {pagination.page} of {pagination.total_pages} · {pagination.total.toLocaleString()} products
            </span>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className='p-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={pagination.page >= pagination.total_pages}
                className='p-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
