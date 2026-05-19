'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, RefreshCw, Edit2, Check, X, Download } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState, SearchBar } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanningRow {
  asin: string;
  sku_code: string;
  fnsku: string;
  item_name: string;
  mrp: number;
  sp: number;
  current_fba_inventory: number;
  open_shipment_qty: number;
  open_shipment_qty_auto: number;
  total_inventory: number;
  drr: number;
  net_total_days: number;
  lead_time: number;
  coverage_days: number;
  total_target_days: number;
  target_stock: number;
  final_units_to_send: number;
  zoho_stock: number;
  status: string;
  platform: string;
  current_inventory_etrade: number;
  open_po: number;
  total_qty: number;
  monthly_sales: Record<string, number>;
  month_labels: string[];
  open_shipment_overridden: boolean;
  final_units_overridden: boolean;
}

interface PlanningMeta {
  fba_inv_date: string;
  zoho_date: string;
  etrade_date: string;
  drr_period: string;
}

const EMPTY_META: PlanningMeta = { fba_inv_date: '', zoho_date: '', etrade_date: '', drr_period: '' };
const PAGE_SIZE = 50;

type EditState = {
  asin: string;
  field: string;
  value: string;
};

// ─── Inline editable cell ────────────────────────────────────────────────────

const EditableCell: React.FC<{
  value: number | string;
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
          onChange={(e) => onChangeEdit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
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
      onClick={() => onStartEdit(asin, field, String(value))}
    >
      <span className={`text-sm ${overridden ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <Edit2 size={10} className='text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity' />
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AmazonFBAPlanning() {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [meta, setMeta] = useState<PlanningMeta>(EMPTY_META);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthLabels: string[] = rows[0]?.month_labels ?? [];

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/amazon_fba_shipment/planning`);
      setRows(res.data.rows ?? []);
      setMeta({
        fba_inv_date: res.data.fba_inv_date ?? '',
        zoho_date: res.data.zoho_date ?? '',
        etrade_date: res.data.etrade_date ?? '',
        drr_period: res.data.drr_period ?? '',
      });
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

    const fieldMap: Record<string, string> = {
      open_shipment_qty: 'open_shipment_qty_override',
      lead_time: 'lead_time',
      coverage_days: 'coverage_days',
      final_units_to_send: 'final_units_override',
    };
    const apiField = fieldMap[field] ?? field;

    try {
      await axios.put(`${API_URL}/amazon_fba_shipment/planning/${asin}`, { asin, [apiField]: Math.round(numVal) });
      setRows(prev => prev.map(r => {
        if (r.asin !== asin) return r;
        const updated = { ...r, [field]: Math.round(numVal) };
        if (field === 'open_shipment_qty') updated.open_shipment_overridden = true;
        if (field === 'final_units_to_send') updated.final_units_overridden = true;
        // Recompute derived fields
        const totalInv = (field === 'open_shipment_qty' ? Math.round(numVal) : updated.open_shipment_qty) + updated.current_fba_inventory;
        const lt = field === 'lead_time' ? Math.round(numVal) : updated.lead_time;
        const cd = field === 'coverage_days' ? Math.round(numVal) : updated.coverage_days;
        updated.total_inventory = totalInv;
        updated.net_total_days = updated.drr > 0 ? Math.round((totalInv / updated.drr) * 10) / 10 : 0;
        updated.total_target_days = lt + cd;
        updated.target_stock = Math.round(updated.drr * (lt + cd) * 10) / 10;
        if (field !== 'final_units_to_send') {
          const netDays = updated.net_total_days;
          const ttd = lt + cd;
          if (netDays < lt) updated.final_units_to_send = Math.max(0, Math.round(updated.drr * ttd));
          else if (netDays > ttd) updated.final_units_to_send = 0;
          else updated.final_units_to_send = Math.max(0, Math.round((ttd - netDays) * updated.drr));
        }
        return updated;
      }));
      toast.success('Updated');
    } catch {
      toast.error('Failed to save');
    }
    setEditState(null);
  }, [editState]);

  // ─── Download Excel ───────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API_URL}/amazon_fba_shipment/planning/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `fba_shipment_planning_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  }, []);

  // ─── File upload ──────────────────────────────────────────────────────────

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_URL}/amazon_fba_shipment/planning/upload`, formData);
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

  // ─── Filtered + paginated rows ────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.item_name?.toLowerCase().includes(q) ||
      r.sku_code?.toLowerCase().includes(q) ||
      r.asin?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection}>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div>
              <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>FBA Shipment Planning</h2>
              <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
                Calculate quantities to send to FBA warehouse based on DRR.
                <span className='ml-2 text-blue-600 dark:text-blue-400'>Click any blue value to edit overrides inline.</span>
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
                onClick={handleDownload}
                disabled={downloading}
                className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50'
              >
                <Download size={14} />
                {downloading ? 'Downloading…' : 'Download Excel'}
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
              Showing {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} rows (page {page} of {totalPages})
            </p>
          )}
        </div>
      </div>

      {/* Upload hint */}
      {rows.length === 0 && !loading && !error && (
        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300'>
          Click <strong>Refresh</strong> to load planning data from the portal. Use <strong>Upload Overrides</strong> to update editable fields (Open Shipment Qty, Lead Time, Coverage Days, Final Units) via Excel.
          Expected columns: <code className='font-mono'>ASIN, Open Shipment Qty, Lead Time, Coverage Days, Final Units to Send, FNSKU, Platform</code>
        </div>
      )}

      {loading && <LoadingState message='Computing FBA planning data…' />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className={TABLE_CLASSES.container}>
          <div className={TABLE_CLASSES.overflow}>
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  {[
                    'ASIN', 'SKU Code', 'Item Name', 'MRP', 'SP',
                    meta.fba_inv_date ? `FBA Inv (${meta.fba_inv_date})` : 'FBA Inv',
                    'Open Shipment ✎', 'Total Inv',
                    meta.drr_period ? `DRR (${meta.drr_period})` : 'DRR',
                    'Net Days', 'Lead Time ✎', 'Cover Days ✎', 'Target Days', 'Target Stock',
                    'Final Units ✎',
                    meta.zoho_date ? `Zoho Stock (${meta.zoho_date})` : 'Zoho Stock',
                    'Status', 'Platform',
                    meta.etrade_date ? `Etrade Inv (${meta.etrade_date})` : 'Etrade Inv',
                    'Open PO', 'Total Qty',
                    ...monthLabels,
                  ].map(h => (
                    <th key={h} className={TABLE_CLASSES.th} style={{ whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {paginated.map(row => (
                  <tr key={row.asin} className={TABLE_CLASSES.tr}>
                    <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.asin}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.sku_code}</span></td>
                    <td className={TABLE_CLASSES.td} style={{ minWidth: 180, maxWidth: 260 }}>
                      <span className='text-sm text-zinc-900 dark:text-zinc-100' style={{ whiteSpace: 'normal', lineHeight: '1.3' }} title={row.item_name}>{row.item_name || '—'}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>₹{row.mrp?.toLocaleString() ?? '—'}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>₹{row.sp?.toLocaleString() ?? '—'}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.current_fba_inventory.toLocaleString()}</span></td>

                    {/* Open Shipment — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.open_shipment_qty}
                        asin={row.asin}
                        field='open_shipment_qty'
                        overridden={row.open_shipment_overridden}
                        editState={editState}
                        onStartEdit={startEdit}
                        onChangeEdit={v => setEditState(prev => prev ? { ...prev, value: v } : null)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditState(null)}
                      />
                    </td>

                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.total_inventory.toLocaleString()}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.drr}</span></td>
                    <td className={TABLE_CLASSES.td}>
                      <span className={`text-sm font-medium ${row.net_total_days < row.lead_time ? 'text-red-600 dark:text-red-400' : row.net_total_days > row.total_target_days ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {row.net_total_days}
                      </span>
                    </td>

                    {/* Lead Time — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.lead_time}
                        asin={row.asin}
                        field='lead_time'
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
                        editState={editState}
                        onStartEdit={startEdit}
                        onChangeEdit={v => setEditState(prev => prev ? { ...prev, value: v } : null)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditState(null)}
                      />
                    </td>

                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.total_target_days}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.target_stock}</span></td>

                    {/* Final Units — editable */}
                    <td className={TABLE_CLASSES.td}>
                      <EditableCell
                        value={row.final_units_to_send}
                        asin={row.asin}
                        field='final_units_to_send'
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
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${row.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.platform || '—'}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.current_inventory_etrade.toLocaleString()}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.open_po.toLocaleString()}</span></td>
                    <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.total_qty.toLocaleString()}</span></td>

                    {/* Monthly sales */}
                    {monthLabels.map(label => (
                      <td key={label} className={TABLE_CLASSES.td}>
                        <span className={TABLE_CLASSES.tdText}>{(row.monthly_sales?.[label] ?? 0).toLocaleString()}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-2'>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className='px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40'
          >
            ← Prev
          </button>
          <span className='text-sm text-zinc-500 dark:text-zinc-400'>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className='px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40'
          >
            Next →
          </button>
        </div>
      )}

      {/* Legend */}
      {rows.length > 0 && (
        <div className='flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400'>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-red-500 inline-block' /> Net Days &lt; Lead Time → Send now</span>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-yellow-500 inline-block' /> Net Days between Lead &amp; Target → Partial send</span>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-green-500 inline-block' /> Net Days &gt; Target → No send needed</span>
          <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-full bg-blue-500 inline-block' /> Blue value = manually overridden</span>
        </div>
      )}
    </div>
  );
}
