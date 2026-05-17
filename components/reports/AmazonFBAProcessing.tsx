'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, RefreshCw, Trash2, Edit2, Check, X, Search } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState, SearchBar } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingRow {
  shipment_id: string;
  date: string | null;
  location: string;
  sku_code: string;
  asin: string;
  fnsku: string;
  item_name: string;
  mrp: number | null;
  sp: number | null;
  requested_qty: number;
  packed_qty: number;
  cost_price: number | null;
  hsn_code: string;
  gst: number | null;
}

interface SummaryRow {
  shipment_id: string;
  location: string;
  shipment_date: string | null;
  requested_qty: number;
  dispatched_qty: number;
  short_supply_qty: number;
  short_supply_pct: number;
  reason_for_short_supply: string;
  appointment_initiated_date: string;
  appointment_date: string;
  dispatched_date: string;
  status: string;
}

const STATUS_OPTIONS = ['Pending', 'Processing', 'Packed', 'Dispatch', 'Delivered'];

// ─── Summary row edit ────────────────────────────────────────────────────────

const SummaryEditRow: React.FC<{
  row: SummaryRow;
  onSave: (key: string, updates: Partial<SummaryRow>) => Promise<void>;
}> = ({ row, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<SummaryRow>>({});
  const key = `${row.shipment_id}|||${row.location}`;

  const startEdit = () => {
    setDraft({
      reason_for_short_supply: row.reason_for_short_supply,
      appointment_initiated_date: row.appointment_initiated_date,
      appointment_date: row.appointment_date,
      dispatched_date: row.dispatched_date,
      status: row.status,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await onSave(key, draft);
    setEditing(false);
  };

  const shortPct = row.short_supply_pct != null
    ? `${(row.short_supply_pct * 100).toFixed(1)}%`
    : '—';

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <tr className={TABLE_CLASSES.tr}>
      <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.shipment_id}</span></td>
      <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{formatDate(row.shipment_date)}</span></td>
      <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.location || '—'}</span></td>
      <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.requested_qty.toLocaleString()}</span></td>
      <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.dispatched_qty.toLocaleString()}</span></td>
      <td className={TABLE_CLASSES.td}>
        <span className={`text-sm font-medium ${row.short_supply_qty > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {row.short_supply_qty.toLocaleString()}
        </span>
      </td>
      <td className={TABLE_CLASSES.td}>
        <span className={`text-sm ${row.short_supply_qty > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {shortPct}
        </span>
      </td>

      {/* Editable: Reason */}
      <td className={TABLE_CLASSES.td} style={{ minWidth: 180 }}>
        {editing ? (
          <input
            type='text'
            value={draft.reason_for_short_supply ?? ''}
            onChange={e => setDraft(d => ({ ...d, reason_for_short_supply: e.target.value }))}
            className='w-full px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100'
          />
        ) : (
          <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.reason_for_short_supply || '—'}</span>
        )}
      </td>

      {/* Editable: Appointment Initiated Date */}
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <input
            type='date'
            value={draft.appointment_initiated_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, appointment_initiated_date: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100'
          />
        ) : (
          <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.appointment_initiated_date || '—'}</span>
        )}
      </td>

      {/* Editable: Appointment Date */}
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <input
            type='date'
            value={draft.appointment_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, appointment_date: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100'
          />
        ) : (
          <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.appointment_date || '—'}</span>
        )}
      </td>

      {/* Editable: Dispatched Date */}
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <input
            type='date'
            value={draft.dispatched_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, dispatched_date: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100'
          />
        ) : (
          <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.dispatched_date || '—'}</span>
        )}
      </td>

      {/* Editable: Status */}
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <select
            value={draft.status ?? row.status}
            onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100'
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
            row.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            row.status === 'Dispatch' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            row.status === 'Packed' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
            row.status === 'Processing' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
          }`}>
            {row.status || 'Pending'}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <div className='flex items-center gap-1'>
            <button onClick={handleSave} className='p-1 text-green-600 hover:text-green-700'><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className='p-1 text-red-500 hover:text-red-600'><X size={14} /></button>
          </div>
        ) : (
          <button onClick={startEdit} className='p-1 text-zinc-400 hover:text-blue-600 transition-colors'>
            <Edit2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AmazonFBAProcessing() {
  const [activeTab, setActiveTab] = useState<'processing' | 'summary'>('processing');

  // Processing tab state
  const [processing, setProcessing] = useState<ProcessingRow[]>([]);
  const [loadingProc, setLoadingProc] = useState(false);
  const [errorProc, setErrorProc] = useState<string | null>(null);
  const [uploadingProc, setUploadingProc] = useState(false);
  const procFileRef = useRef<HTMLInputElement>(null);
  const [searchProc, setSearchProc] = useState('');

  // Summary tab state
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loadingSum, setLoadingSum] = useState(false);
  const [errorSum, setErrorSum] = useState<string | null>(null);
  const [searchSum, setSearchSum] = useState('');

  // ─── Processing loaders ──────────────────────────────────────────────────

  const loadProcessing = useCallback(async () => {
    setLoadingProc(true);
    setErrorProc(null);
    try {
      const res = await axios.get(`${API_URL}/amazon_fba_shipment/processing`);
      setProcessing(res.data.rows ?? []);
    } catch (e: unknown) {
      setErrorProc(axios.isAxiosError(e) ? e.response?.data?.detail ?? e.message : 'Failed to load');
    } finally {
      setLoadingProc(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSum(true);
    setErrorSum(null);
    try {
      const res = await axios.get(`${API_URL}/amazon_fba_shipment/summary`);
      setSummary(res.data.rows ?? []);
    } catch (e: unknown) {
      setErrorSum(axios.isAxiosError(e) ? e.response?.data?.detail ?? e.message : 'Failed to load');
    } finally {
      setLoadingSum(false);
    }
  }, []);

  const handleTabChange = useCallback((tab: 'processing' | 'summary') => {
    setActiveTab(tab);
    if (tab === 'processing' && processing.length === 0) loadProcessing();
    if (tab === 'summary' && summary.length === 0) loadSummary();
  }, [processing.length, summary.length, loadProcessing, loadSummary]);

  // ─── Upload processing sheet ─────────────────────────────────────────────

  const handleUploadProc = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API_URL}/amazon_fba_shipment/processing/upload`, fd);
      toast.success(`Uploaded ${res.data.rows_uploaded} rows`);
      await loadProcessing();
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? e.message : 'Upload failed');
    } finally {
      setUploadingProc(false);
      if (procFileRef.current) procFileRef.current.value = '';
    }
  }, [loadProcessing]);

  const handleClearProc = useCallback(async () => {
    if (!confirm('Clear all processing records? This cannot be undone.')) return;
    try {
      const res = await axios.delete(`${API_URL}/amazon_fba_shipment/processing`);
      toast.success(`Cleared ${res.data.deleted} records`);
      setProcessing([]);
      setSummary([]);
    } catch {
      toast.error('Failed to clear records');
    }
  }, []);

  // ─── Save summary edits ──────────────────────────────────────────────────

  const saveSummaryEdit = useCallback(async (key: string, updates: Partial<SummaryRow>) => {
    const [shipmentId, location] = key.split('|||');
    try {
      await axios.put(`${API_URL}/amazon_fba_shipment/summary/${encodeURIComponent(shipmentId)}`, updates, {
        params: { location },
      });
      setSummary(prev => prev.map(r =>
        `${r.shipment_id}|||${r.location}` === key ? { ...r, ...updates } : r
      ));
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    }
  }, []);

  // ─── Filtered rows ────────────────────────────────────────────────────────

  const filteredProc = useMemo(() => {
    const q = searchProc.toLowerCase();
    if (!q) return processing;
    return processing.filter(r =>
      r.shipment_id?.toLowerCase().includes(q) ||
      r.sku_code?.toLowerCase().includes(q) ||
      r.item_name?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q)
    );
  }, [processing, searchProc]);

  const filteredSum = useMemo(() => {
    const q = searchSum.toLowerCase();
    if (!q) return summary;
    return summary.filter(r =>
      r.shipment_id?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q)
    );
  }, [summary, searchSum]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d || '—'; }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection}>
          <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>FBA Shipment Processing</h2>
          <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
            Upload your FBA shipment plan and track shipment progress.
          </p>
        </div>

        {/* Tabs */}
        <div className='border-b border-zinc-200 dark:border-zinc-800 px-6'>
          <nav className='flex gap-6 -mb-px'>
            {(['processing', 'summary'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {tab === 'processing' ? 'Shipment Processing' : 'Shipment Summary'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Processing Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'processing' && (
        <div className='space-y-4'>
          {/* Toolbar */}
          <div className={TABLE_CLASSES.container}>
            <div className={TABLE_CLASSES.headerSection}>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div>
                  <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                    Upload your downloaded FBA shipment plan. Editable fields after upload: <strong>Shipment ID, Date, Location, Packed Qty</strong>.
                  </p>
                  <p className='text-xs text-zinc-400 mt-1'>
                    Expected columns: Shipment ID, Date, Location, SKU Code, ASIN, FNSKU, Item Name, MRP, SP, Requested Qty, Packed Qty, Cost Price, HSN Code, GST
                  </p>
                </div>
                <div className='flex items-center gap-2 flex-wrap'>
                  <button
                    onClick={loadProcessing}
                    disabled={loadingProc}
                    className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-50'
                  >
                    <RefreshCw size={14} className={loadingProc ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                  <input ref={procFileRef} type='file' accept='.xlsx,.xls' className='hidden' onChange={handleUploadProc} />
                  <button
                    onClick={() => procFileRef.current?.click()}
                    disabled={uploadingProc}
                    className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50'
                  >
                    <Upload size={14} />
                    {uploadingProc ? 'Uploading…' : 'Upload Sheet'}
                  </button>
                  {processing.length > 0 && (
                    <button
                      onClick={handleClearProc}
                      className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-zinc-800 border border-red-300 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20'
                    >
                      <Trash2 size={14} />
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              <div className='mt-4'>
                <SearchBar value={searchProc} onChange={setSearchProc} placeholder='Search by Shipment ID, SKU, item or location…' />
              </div>
              {processing.length > 0 && (
                <p className='mt-2 text-xs text-zinc-400'>Showing {filteredProc.length} of {processing.length} rows</p>
              )}
            </div>
          </div>

          {loadingProc && <LoadingState message='Loading processing data…' />}
          {errorProc && <ErrorState error={errorProc} onRetry={loadProcessing} />}

          {!loadingProc && !errorProc && processing.length === 0 && (
            <div className='bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-8 text-center text-sm text-zinc-500 dark:text-zinc-400'>
              No processing data yet. Upload a FBA shipment plan sheet to get started.
            </div>
          )}

          {!loadingProc && !errorProc && filteredProc.length > 0 && (
            <div className={TABLE_CLASSES.container}>
              <div className={TABLE_CLASSES.overflow}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.thead}>
                    <tr>
                      {['Shipment ID', 'Date', 'Location', 'SKU Code', 'ASIN', 'FNSKU', 'Item Name', 'MRP', 'SP', 'Requested Qty', 'Packed Qty', 'Cost Price', 'HSN Code', 'GST'].map(h => (
                        <th key={h} className={TABLE_CLASSES.th} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={TABLE_CLASSES.tbody}>
                    {filteredProc.map((row, idx) => (
                      <tr key={`${row.shipment_id}-${row.sku_code}-${idx}`} className={TABLE_CLASSES.tr}>
                        <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.shipment_id}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{formatDate(row.date)}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.location || '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.sku_code}</span></td>
                        <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.asin}</span></td>
                        <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.fnsku || '—'}</span></td>
                        <td className={TABLE_CLASSES.td} style={{ minWidth: 160, maxWidth: 240 }}>
                          <span className='text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2' title={row.item_name}>{row.item_name || '—'}</span>
                        </td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.mrp != null ? `₹${row.mrp.toLocaleString()}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.sp != null ? `₹${row.sp.toLocaleString()}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.requested_qty.toLocaleString()}</span></td>
                        <td className={TABLE_CLASSES.td}><span className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>{row.packed_qty.toLocaleString()}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.cost_price != null ? `₹${row.cost_price.toLocaleString()}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.hsn_code || '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.gst != null ? `${row.gst}%` : '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Summary Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className='space-y-4'>
          {/* Toolbar */}
          <div className={TABLE_CLASSES.container}>
            <div className={TABLE_CLASSES.headerSection}>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div>
                  <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                    Summary aggregated from the Processing tab. Edit <strong>Reason, Appointment dates, Dispatched date, Status</strong> inline.
                  </p>
                </div>
                <button
                  onClick={loadSummary}
                  disabled={loadingSum}
                  className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-50'
                >
                  <RefreshCw size={14} className={loadingSum ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
              <div className='mt-4'>
                <SearchBar value={searchSum} onChange={setSearchSum} placeholder='Search by Shipment ID or location…' />
              </div>
              {summary.length > 0 && (
                <p className='mt-2 text-xs text-zinc-400'>Showing {filteredSum.length} of {summary.length} shipments</p>
              )}
            </div>
          </div>

          {loadingSum && <LoadingState message='Loading summary data…' />}
          {errorSum && <ErrorState error={errorSum} onRetry={loadSummary} />}

          {!loadingSum && !errorSum && summary.length === 0 && (
            <div className='bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-8 text-center text-sm text-zinc-500 dark:text-zinc-400'>
              No summary data yet. Upload data in the Processing tab first.
            </div>
          )}

          {!loadingSum && !errorSum && filteredSum.length > 0 && (
            <div className={TABLE_CLASSES.container}>
              <div className={TABLE_CLASSES.overflow}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.thead}>
                    <tr>
                      {[
                        'Shipment ID', 'Shipment Date', 'Location',
                        'Requested Qty', 'Dispatched Qty',
                        'Short Supply (Qty)', 'Short Supply (%)',
                        'Reason for Short Supply ✎',
                        'Appt. Initiated ✎', 'Appointment Date ✎',
                        'Dispatched Date ✎', 'Status ✎', 'Actions',
                      ].map(h => (
                        <th key={h} className={TABLE_CLASSES.th} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={TABLE_CLASSES.tbody}>
                    {filteredSum.map(row => (
                      <SummaryEditRow
                        key={`${row.shipment_id}|||${row.location}`}
                        row={row}
                        onSave={saveSummaryEdit}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
