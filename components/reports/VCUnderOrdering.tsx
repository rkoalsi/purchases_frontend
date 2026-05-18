'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Download, Upload, RefreshCw, Edit2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState, SearchBar } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAGE_SIZE = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Row {
  asin: string;
  sku_code: string;
  item_name: string;
  current_inv: number;
  open_po: number;
  open_po_auto: number;
  open_po_overridden: boolean;
  total_inv: number;
  drr: number;
  drr_flag: string;
  net_total_days: number | null;
  lead_time: number;
  lead_time_overridden: boolean;
  coverage_days: number;
  coverage_days_overridden: boolean;
  total_target_days: number;
  target_stock: number;
  final_units: number | null;
  final_units_overridden: boolean;
  zoho_stock: number;
  status: string;
  etrade_asp: number | null;
  monthly_sales: Record<string, number>;
  month_labels: string[];
}

type EditState = { asin: string; field: string; value: string };

// ─── Editable cell ────────────────────────────────────────────────────────────

const EditableCell: React.FC<{
  value: number | string | null;
  asin: string;
  field: string;
  overridden?: boolean;
  editState: EditState | null;
  onStartEdit: (asin: string, field: string, value: string) => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}> = ({ value, asin, field, overridden, editState, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit }) => {
  const isEditing = editState?.asin === asin && editState?.field === field;

  if (isEditing) {
    return (
      <div className='flex items-center gap-1 min-w-[80px]'>
        <input
          autoFocus
          type='number'
          value={editState.value}
          onChange={e => onChangeEdit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
          className='w-16 px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100'
        />
        <button onClick={onSaveEdit} className='text-green-600 hover:text-green-700'><Check size={12} /></button>
        <button onClick={onCancelEdit} className='text-red-500 hover:text-red-600'><X size={12} /></button>
      </div>
    );
  }

  return (
    <div
      className='flex items-center gap-1 group cursor-pointer'
      onClick={() => onStartEdit(asin, field, String(value ?? ''))}
    >
      <span className={`text-sm ${overridden ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {value !== null && value !== undefined ? (typeof value === 'number' ? value.toLocaleString() : value) : '—'}
      </span>
      <Edit2 size={10} className='text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity' />
    </div>
  );
};

// ─── Net Days badge ───────────────────────────────────────────────────────────

function NetDaysBadge({ value, leadTime, targetDays }: { value: number | null; leadTime: number; targetDays: number }) {
  if (value === null) return <span className='text-zinc-400'>—</span>;
  const cls = value < leadTime
    ? 'text-red-600 dark:text-red-400 font-medium'
    : value > targetDays
      ? 'text-green-600 dark:text-green-400 font-medium'
      : 'text-yellow-600 dark:text-yellow-400 font-medium';
  return <span className={`text-sm ${cls}`}>{value}</span>;
}

// ─── Pagination controls ──────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className='flex items-center justify-center gap-3 py-3'>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className='inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
      >
        <ChevronLeft size={14} /> Prev
      </button>
      <span className='text-sm text-zinc-500 dark:text-zinc-400'>
        Page <span className='font-semibold text-zinc-800 dark:text-zinc-100'>{page}</span> of <span className='font-semibold text-zinc-800 dark:text-zinc-100'>{totalPages}</span>
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className='inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
      >
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VCUnderOrdering() {
  const [rows, setRows] = useState<Row[]>([]);
  const [inventoryDate, setInventoryDate] = useState('');
  const [drrPeriod, setDrrPeriod] = useState('');
  const [zohoDate, setZohoDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthLabels: string[] = rows[0]?.month_labels ?? [];

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/vc_under_ordering/data`);
      setRows(res.data.rows ?? []);
      setInventoryDate(res.data.inventory_date ?? '');
      setDrrPeriod(res.data.drr_period ?? '');
      setZohoDate(res.data.zoho_date ?? '');
      setPage(1);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail ?? e.message : 'Failed to load';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Inline edit ──────────────────────────────────────────────────────────

  const startEdit = useCallback((asin: string, field: string, value: string) => {
    setEditState({ asin, field, value });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editState) return;
    const { asin, field, value } = editState;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) { setEditState(null); return; }
    const rounded = Math.round(numVal);

    const fieldMap: Record<string, string> = {
      open_po: 'open_po_override',
      lead_time: 'lead_time_override',
      coverage_days: 'coverage_days_override',
      final_units: 'final_units_override',
    };
    const apiField = fieldMap[field] ?? field;

    try {
      await axios.put(`${API_URL}/vc_under_ordering/overrides/${asin}`, { [apiField]: rounded });
      setRows(prev => prev.map(r => {
        if (r.asin !== asin) return r;
        const updated = { ...r };

        if (field === 'open_po') { updated.open_po = rounded; updated.open_po_overridden = true; }
        if (field === 'lead_time') { updated.lead_time = rounded; updated.lead_time_overridden = true; }
        if (field === 'coverage_days') { updated.coverage_days = rounded; updated.coverage_days_overridden = true; }
        if (field === 'final_units') { updated.final_units = rounded; updated.final_units_overridden = true; }

        // Recompute derived fields
        updated.total_inv = updated.current_inv + updated.open_po;
        updated.net_total_days = updated.drr > 0 ? Math.round((updated.total_inv / updated.drr) * 100) / 100 : null;
        updated.total_target_days = updated.lead_time + updated.coverage_days;
        updated.target_stock = updated.drr > 0 ? Math.round(updated.drr * updated.total_target_days) : 0;

        if (field !== 'final_units') {
          const ntd = updated.net_total_days;
          const ttd = updated.total_target_days;
          const lt = updated.lead_time;
          if (updated.drr > 0 && ntd !== null) {
            if (ntd < lt) updated.final_units = Math.round(updated.drr * ttd);
            else if (ntd > ttd) updated.final_units = 0;
            else updated.final_units = Math.max(0, Math.round((ttd - ntd) * updated.drr));
          }
          updated.final_units_overridden = false;
        }

        return updated;
      }));
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    }
    setEditState(null);
  }, [editState]);

  // ─── Download ─────────────────────────────────────────────────────────────

  const downloadXlsx = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API_URL}/vc_under_ordering/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vc_under_ordering.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  }, []);

  // ─── Upload overrides ─────────────────────────────────────────────────────

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_URL}/vc_under_ordering/upload`, formData);
      toast.success(`Updated ${res.data.updated} rows`);
      await loadData();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail ?? e.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [loadData]);

  // ─── Filter + pagination ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.item_name?.toLowerCase().includes(q) ||
      r.sku_code?.toLowerCase().includes(q) ||
      r.asin?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIndex = (safePage - 1) * PAGE_SIZE;

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  // ─── Column headers ────────────────────────────────────────────────────────

  const invHeader = inventoryDate ? `Current Inv Etrade (${inventoryDate})` : 'Current Inv (Etrade)';
  const drrHeader = drrPeriod ? `DRR (${drrPeriod})` : 'DRR';
  const zohoHeader = zohoDate ? `Zoho Stock (${zohoDate})` : 'Zoho Stock';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection}>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div>
              <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>VC Under Ordering</h2>
              <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
                Under-ordering analysis for all VC ASINs with eTrade ASP.
                <span className='ml-2 text-blue-600 dark:text-blue-400'>Click any value with ✎ to edit inline.</span>
              </p>
            </div>
            <div className='flex items-center gap-2 flex-wrap'>
              <button
                onClick={loadData}
                disabled={loading}
                className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50'
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={downloadXlsx}
                disabled={downloading || rows.length === 0}
                className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50'
              >
                <Download size={14} />
                {downloading ? 'Downloading…' : 'Download XLSX'}
              </button>
              <input ref={fileRef} type='file' accept='.xlsx,.xls' className='hidden' onChange={handleUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50'
              >
                <Upload size={14} />
                {uploading ? 'Uploading…' : 'Upload Overrides'}
              </button>
            </div>
          </div>
          <div className='mt-4'>
            <SearchBar value={search} onChange={handleSearch} placeholder='Search by item name, SKU or ASIN…' />
          </div>
          {rows.length > 0 && (
            <p className='mt-2 text-xs text-zinc-400'>
              Showing {filtered.length === rows.length ? rows.length : `${filtered.length} of ${rows.length}`} rows
              {totalPages > 1 && ` · Page ${safePage} of ${totalPages}`}
            </p>
          )}
        </div>
      </div>

      {rows.length === 0 && !loading && !error && (
        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300'>
          Click <strong>Refresh</strong> to load data. Use <strong>Upload Overrides</strong> to bulk-update Open PO Qty, Lead Time, Coverage Days, or Final Units via Excel (columns: <code className='font-mono'>ASIN, Open PO Qty, Lead Time, Coverage Days, Final Units</code>).
        </div>
      )}

      {loading && <LoadingState message='Computing VC under-ordering data…' />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className={TABLE_CLASSES.container}>
          <div className={TABLE_CLASSES.overflow}>
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  {[
                    '#', 'ASIN', 'SKU Code', 'Item Name',
                    invHeader, 'Open PO Qty ✎',
                    'Total Inv', drrHeader, 'Net Total Days',
                    'Lead Time ✎', 'Coverage Days ✎',
                    'Total Target Days', 'Target Stock',
                    'Final Units ✎',
                    zohoHeader, 'Status',
                    ...monthLabels,
                  ].map((h, i) => (
                    <th key={i} className={TABLE_CLASSES.th} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {pageRows.map((row, idx) => (
                  <tr key={row.asin} className={TABLE_CLASSES.tr}>
                    {/* Row number */}
                    <td className={TABLE_CLASSES.td}>
                      <span className='text-xs text-zinc-400 tabular-nums'>{startIndex + idx + 1}</span>
                    </td>

                    <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.asin}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.sku_code}</span></td>

                    {/* Item name — full multi-line wrap */}
                    <td className={TABLE_CLASSES.td} style={{ minWidth: 200, maxWidth: 280 }}>
                      <span className='text-sm text-zinc-900 dark:text-zinc-100 break-words whitespace-normal leading-snug'>
                        {row.item_name || '—'}
                      </span>
                    </td>

                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.current_inv.toLocaleString()}</span></td>

                    {/* Open PO — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.open_po}
                        asin={row.asin}
                        field='open_po'
                        overridden={row.open_po_overridden}
                        editState={editState}
                        onStartEdit={startEdit}
                        onChangeEdit={v => setEditState(prev => prev ? { ...prev, value: v } : null)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditState(null)}
                      />
                    </td>

                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.total_inv.toLocaleString()}</span></td>

                    <td className={TABLE_CLASSES.td}>
                      {row.drr > 0
                        ? <span className={TABLE_CLASSES.tdText}>{row.drr}</span>
                        : <span className='text-xs text-zinc-400 italic'>{row.drr_flag || '—'}</span>
                      }
                    </td>

                    <td className={TABLE_CLASSES.td}>
                      <NetDaysBadge value={row.net_total_days} leadTime={row.lead_time} targetDays={row.total_target_days} />
                    </td>

                    {/* Lead Time — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.lead_time}
                        asin={row.asin}
                        field='lead_time'
                        overridden={row.lead_time_overridden}
                        editState={editState}
                        onStartEdit={startEdit}
                        onChangeEdit={v => setEditState(prev => prev ? { ...prev, value: v } : null)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditState(null)}
                      />
                    </td>

                    {/* Coverage Days — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.coverage_days}
                        asin={row.asin}
                        field='coverage_days'
                        overridden={row.coverage_days_overridden}
                        editState={editState}
                        onStartEdit={startEdit}
                        onChangeEdit={v => setEditState(prev => prev ? { ...prev, value: v } : null)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditState(null)}
                      />
                    </td>

                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.total_target_days}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.target_stock.toLocaleString()}</span></td>

                    {/* Final Units — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.final_units}
                        asin={row.asin}
                        field='final_units'
                        overridden={row.final_units_overridden}
                        editState={editState}
                        onStartEdit={startEdit}
                        onChangeEdit={v => setEditState(prev => prev ? { ...prev, value: v } : null)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditState(null)}
                      />
                    </td>

                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.zoho_stock.toLocaleString()}</span></td>

                    <td className={TABLE_CLASSES.td}>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        row.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        row.status ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
                        'bg-zinc-50 text-zinc-400'
                      }`}>
                        {row.status || '—'}
                      </span>
                    </td>

                    {monthLabels.map(lbl => (
                      <td key={lbl} className={TABLE_CLASSES.td}>
                        <span className={TABLE_CLASSES.tdText}>{(row.monthly_sales?.[lbl] ?? 0).toLocaleString()}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {/* Legend */}
      {rows.length > 0 && (
        <div className='flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400'>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-red-500 inline-block' /> Net Days &lt; Lead Time → Order urgently</span>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-yellow-500 inline-block' /> Net Days between Lead &amp; Target → Partial order</span>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-green-500 inline-block' /> Net Days &gt; Target → No order needed</span>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-blue-500 inline-block' /> Blue value = manually overridden</span>
        </div>
      )}
    </div>
  );
}
