'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Download, RefreshCw, FileSpreadsheet, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface POListItem {
  po_number: string;
  vendor: string;
  po_date: string;
  po_status: 'pending' | 'processing' | 'packed' | 'closed' | 'intransit' | 'delivered' | 'completed';
  item_count: number;
  created_at: string;
}

interface POItem {
  asin: string;
  model_number: string;
  title: string;
  ship_to_location: string;
  requested_qty: number;
  supply_qty: number | null;
  accepted_qty: number | null;
  received_qty: number | null;
  etrade_unit_cost: number;
  zoho_mrp: number;
  gst: number;
  mrp_wo_gst: number;
  margin: number | null;
  cost_price_wo_tax: number | null;
  total_cost: number | null;
  total_cost_gst: number | null;
  hsn: string;
  diff: number | null;
  zoho_stock: number;
  purchase_status: string;
  current_stock: number;
  open_po: number;
  total_qty: number;
  last_30_sales: number;
  ads: number;
  coverage_days: number;
  target_stock: number;
  max_allowed_qty: number;
  final_supply_qty: number;
}

interface POReport {
  po_number: string;
  vendor: string;
  po_date: string;
  po_status: string;
  inventory_date: string | null;
  zoho_stock_date: string | null;
  po_update_date: string | null;
  items: POItem[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined, decimals = 2) =>
  v == null ? '—' : v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtInt = (v: number | null | undefined) =>
  v == null ? '—' : Math.round(v).toLocaleString('en-IN');

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    packed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    closed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    intransit: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {s}
    </span>
  );
};


// ─── AcceptedQtyCell ──────────────────────────────────────────────────────────

const AcceptedQtyCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number | null;
  onSaved: (asin: string, qty: number) => void;
}> = ({ poNumber, asin, value, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value != null ? String(value) : '0');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) { toast.error('Accepted qty must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/accepted_qty?accepted_qty=${num}`);
      onSaved(asin, num);
      setEditing(false);
      toast.success('Accepted qty updated');
    } catch {
      toast.error('Failed to save accepted qty');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-center">
        <span className="text-sm text-zinc-900 dark:text-zinc-100">{value ?? 0}</span>
        <button
          onClick={() => { setVal(String(value ?? 0)); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity"
        >
          <Edit2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-center">
      <input
        autoFocus
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-16 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── EtradeUnitCostCell ───────────────────────────────────────────────────────

const EtradeUnitCostCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number;
  onSaved: (asin: string, etrade: number, diff: number | null) => void;
}> = ({ poNumber, asin, value, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) { toast.error('eTrade cost must be ≥ 0'); return; }
    setSaving(true);
    try {
      const { data } = await axios.patch<{ etrade_unit_cost: number; diff: number | null }>(
        `${API_URL}/vendor_po/${poNumber}/items/${asin}/etrade_unit_cost?etrade_unit_cost=${num}`
      );
      onSaved(asin, data.etrade_unit_cost, data.diff);
      setEditing(false);
      toast.success('eTrade cost updated');
    } catch {
      toast.error('Failed to save eTrade cost');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-end">
        <span className="text-sm text-zinc-900 dark:text-zinc-100">₹{value.toFixed(2)}</span>
        <button
          onClick={() => { setVal(String(value)); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity"
        >
          <Edit2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <input
        autoFocus
        type="number"
        min={0}
        step={0.01}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-20 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function VendorPOReport() {
  const [poList, setPoList] = useState<POListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [report, setReport] = useState<POReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // upload form
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [poDate, setPoDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [downloading, setDownloading] = useState(false);

  // ─── fetch list ─────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    setPage(0);
    try {
      const { data } = await axios.get<POListItem[]>(`${API_URL}/vendor_po/`);
      setPoList(data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Unknown error';
      setListError(msg);
    } finally {
      setListLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  // ─── fetch report ────────────────────────────────────────────────────────────

  const fetchReport = useCallback(async (poNumber: string) => {
    setSelectedPO(poNumber);
    setReport(null);
    setReportError(null);
    setReportLoading(true);
    try {
      const { data } = await axios.get<POReport>(`${API_URL}/vendor_po/${poNumber}/report`);
      setReport(data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Unknown error';
      setReportError(msg);
    } finally {
      setReportLoading(false);
    }
  }, []);

  // ─── upload ──────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile || !poDate) {
      toast.error('Please select a file and PO date');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('po_date', poDate);
      const { data } = await axios.post<{ po_number: string; items: POItem[]; inventory_date: string | null }>(
        `${API_URL}/vendor_po/upload`, formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(`PO ${data.po_number} uploaded successfully`);
      setSelectedFile(null);
      setPoDate('');
      setUploadOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchList();
      await fetchReport(data.po_number);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // ─── download ────────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!selectedPO) return;
    setDownloading(true);
    try {
      const res = await axios.get(`${API_URL}/vendor_po/${selectedPO}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO_Report_${selectedPO}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  // ─── status update ───────────────────────────────────────────────────────────

  const FROZEN_STATUSES = new Set(['processing', 'packed', 'closed', 'intransit', 'delivered', 'completed']);

  const handleStatusChange = async (poNumber: string, newStatus: string, currentStatus: string) => {
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/status?po_status=${newStatus}`);
      const isFreeze = FROZEN_STATUSES.has(newStatus) && !FROZEN_STATUSES.has(currentStatus);
      toast.success(isFreeze ? 'Status updated — stock data frozen' : 'Status updated');
      setPoList(prev => prev.map(p => p.po_number === poNumber ? { ...p, po_status: newStatus as POListItem['po_status'] } : p));
      // Reload the report when freezing so the saved snapshot is shown
      if (report && report.po_number === poNumber) {
        if (isFreeze) {
          await fetchReport(poNumber);
        } else {
          setReport(prev => prev ? { ...prev, po_status: newStatus } : prev);
        }
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // ─── margin saved ────────────────────────────────────────────────────────────

  const handleAcceptedQtySaved = useCallback((asin: string, qty: number) => {
    setReport(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(it => it.asin === asin ? { ...it, accepted_qty: qty } : it) };
    });
  }, []);

  const handleEtradeUnitCostSaved = useCallback((asin: string, etrade: number, diff: number | null) => {
    setReport(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(it => it.asin === asin ? { ...it, etrade_unit_cost: etrade, diff } : it) };
    });
  }, []);


  // ─── render ──────────────────────────────────────────────────────────────────

  const invDateLabel = report?.inventory_date ?? 'Latest';
  const zohoDateLabel = report?.zoho_stock_date ?? 'Latest';

  const salesLabel = useMemo(() => {
    if (!report?.po_date) return 'Last 30D Sales';
    const end = new Date(report.po_date + 'T00:00:00');
    end.setDate(end.getDate() - 2);
    const start = new Date(end);
    start.setDate(start.getDate() - 31);
    const f = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `Last 30D Sales (${f(start)}–${f(end)})`;
  }, [report?.po_date]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Vendor Central POs</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Upload and manage Vendor Central purchase orders</p>
        </div>
        <button
          onClick={() => setUploadOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Upload size={16} />
          Upload PO
          {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Upload Form ── */}
      {uploadOpen && (
        <div className={TABLE_CLASSES.container + ' p-6'}>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-600" />
            Upload New Purchase Order
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">PO Excel File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">PO Date</label>
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !poDate}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {uploading ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? 'Uploading…' : 'Upload & Generate Report'}
            </button>
          </div>
        </div>
      )}

      {/* ── Status behaviour info ── */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <p className="font-semibold">Stock &amp; sales data freezes when status changes to <span className="underline">processing</span> (or any later status).</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
          <li><span className="font-medium">Zoho Stock</span> — taken on PO date. <span className="font-medium">Current Stock</span> — taken at T‑2 (2 days before PO date, Amazon lag).</li>
          <li><span className="font-medium">Last 30 Days Sales</span> — 31-day window ending at T‑2 (PO date − 33 to PO date − 2).</li>
          <li><span className="font-medium">Open PO</span> — snapshot at freeze time. Processing POs use supply qty · Packed / Closed / Intransit POs use accepted qty.</li>
        </ul>
        <p className="text-blue-600 dark:text-blue-500 pt-0.5">Pending POs always show live T‑2 data. Once set to processing or beyond, all figures are locked permanently.</p>
      </div>

      {/* ── PO List ── */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection + ' flex items-center justify-between'}>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Purchase Orders</h2>
          <button onClick={fetchList} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors">
            <RefreshCw size={15} className={listLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {listLoading && <LoadingState message="Loading purchase orders…" />}
        {listError && <ErrorState error={listError} onRetry={fetchList} />}
        {!listLoading && !listError && poList.length === 0 && (
          <div className="py-12 text-center text-zinc-400 text-sm">No purchase orders found. Upload your first PO above.</div>
        )}
        {!listLoading && !listError && poList.length > 0 && (() => {
          const totalPages = Math.ceil(poList.length / PAGE_SIZE);
          const pageItems = poList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
          return (
            <>
              <div className={TABLE_CLASSES.overflow}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.thead}>
                    <tr>
                      {['PO Number', 'Vendor', 'PO Date', 'Items', 'Status', 'Uploaded At', 'Actions'].map(h => (
                        <th key={h} className={TABLE_CLASSES.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={TABLE_CLASSES.tbody}>
                    {pageItems.map(po => (
                      <tr
                        key={po.po_number}
                        className={`${TABLE_CLASSES.tr} ${selectedPO === po.po_number ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                      >
                        <td className={TABLE_CLASSES.td}>
                          <span className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-400">{po.po_number}</span>
                        </td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{po.vendor || '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{po.po_date}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{po.item_count}</span></td>
                        <td className={TABLE_CLASSES.td}>
                          <select
                            value={po.po_status}
                            onChange={(e) => handleStatusChange(po.po_number, e.target.value, po.po_status)}
                            className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="pending">pending</option>
                            <option value="processing">processing</option>
                            <option value="packed">packed</option>
                            <option value="closed">closed</option>
                            <option value="intransit">intransit</option>
                            <option value="delivered">delivered</option>
                            <option value="completed">completed</option>
                          </select>
                        </td>
                        <td className={TABLE_CLASSES.td}><span className="text-xs text-zinc-500">{new Date(po.created_at).toLocaleDateString('en-IN')}</span></td>
                        <td className={TABLE_CLASSES.td}>
                          <button
                            onClick={() => selectedPO === po.po_number ? setSelectedPO(null) : fetchReport(po.po_number)}
                            className="px-3 py-1 text-xs font-medium rounded border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            {selectedPO === po.po_number ? 'Hide' : 'View Report'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, poList.length)} of {poList.length} POs
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 0}
                      className="px-3 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Prev
                    </button>
                    <span className="px-2 text-xs text-zinc-600 dark:text-zinc-400">{page + 1} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* ── PO Report ── */}
      {selectedPO && (
        <div className={TABLE_CLASSES.container}>
          <div className={TABLE_CLASSES.headerSection + ' flex items-center justify-between flex-wrap gap-3'}>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Report — <span className="font-mono text-blue-700 dark:text-blue-400">{selectedPO}</span>
              </h2>
              {report && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  PO Date: {report.po_date}
                  {report.po_update_date && <> &nbsp;·&nbsp; Processing date: <strong>{report.po_update_date}</strong></>}
                  &nbsp;·&nbsp; Status: {statusBadge(report.po_status)}
                  &nbsp;·&nbsp; Stock snapshot: <strong>{invDateLabel}</strong>
                  &nbsp;·&nbsp; {report.items.length} items
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchReport(selectedPO)}
                disabled={reportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw size={13} className={reportLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading || !report}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Download size={13} />
                {downloading ? 'Downloading…' : 'Download Excel'}
              </button>
            </div>
          </div>

          {reportLoading && <LoadingState message="Generating report…" />}
          {reportError && <ErrorState error={reportError} onRetry={() => fetchReport(selectedPO)} />}

          {report && !reportLoading && (
            <div className={TABLE_CLASSES.overflow}>
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                  <tr>
                    {/* Yellow = from PO + computed */}
                    {[
                      { label: 'ASIN', yellow: true },
                      { label: 'Model No.', yellow: true },
                      { label: 'Title', yellow: true },
                      { label: 'Ship To', yellow: false },
                      { label: 'Req. Qty', yellow: true },
                      { label: 'Supply Qty', yellow: false },
                      { label: 'Accepted Qty', yellow: false },
                      { label: 'Received Qty', yellow: false },
                      { label: 'Zoho MRP', yellow: true },
                      { label: 'GST %', yellow: true },
                      { label: 'MRP w/o GST', yellow: true },
                      { label: 'Margin %', yellow: true },
                      { label: 'Cost Price w/o Tax', yellow: true },
                      { label: 'Total Cost', yellow: true },
                      { label: 'Total Cost w/ GST', yellow: true },
                      { label: 'HSN', yellow: true },
                      { label: 'Etrade Unit Cost', yellow: true },
                      { label: 'Diff', yellow: true },
                      { label: `Zoho Stock (${zohoDateLabel})`, yellow: true },
                      { label: 'Status', yellow: true },
                      { label: `Current Stock (${invDateLabel})`, yellow: true },
                      { label: 'Open PO', yellow: true },
                      { label: 'Total Qty', yellow: true },
                      { label: salesLabel, yellow: true },
                      { label: 'ADS', yellow: true },
                      { label: 'Coverage Days', yellow: false },
                      { label: 'Target Stock', yellow: true },
                      { label: 'Max Allowed Qty', yellow: true },
                      { label: 'Final Supply Qty', yellow: true },
                    ].map(({ label, yellow }) => (
                      <th
                        key={label}
                        className={`px-3 py-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap border-b border-zinc-200 dark:border-zinc-700 ${yellow ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {report.items.map((item, idx) => {
                    const diffColor = item.diff == null ? '' : item.diff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                    return (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{item.asin}</td>
                        <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{item.model_number}</td>
                        <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200 max-w-xs truncate" title={item.title}>{item.title}</td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{item.ship_to_location}</td>
                        <td className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-zinc-100">{item.requested_qty}</td>
                        <td className="px-3 py-2 text-center text-zinc-600">{item.supply_qty ?? '—'}</td>
                        <td className="px-3 py-2">
                          <AcceptedQtyCell poNumber={report.po_number} asin={item.asin} value={item.accepted_qty} onSaved={handleAcceptedQtySaved} />
                        </td>
                        <td className="px-3 py-2 text-center text-zinc-600">{item.received_qty ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">₹{fmt(item.zoho_mrp, 0)}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{item.gst}%</td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">₹{fmt(item.mrp_wo_gst)}</td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                          <span title="Edit margin on the Amazon SKU Mapping page">
                            {item.margin != null ? `${(item.margin * 100).toFixed(1)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                          {item.cost_price_wo_tax != null ? `₹${fmt(item.cost_price_wo_tax)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                          {item.total_cost != null ? `₹${fmt(item.total_cost)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                          {item.total_cost_gst != null ? `₹${fmt(item.total_cost_gst)}` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{item.hsn || '—'}</td>
                        <td className="px-3 py-2">
                          <EtradeUnitCostCell poNumber={report.po_number} asin={item.asin} value={item.etrade_unit_cost} onSaved={handleEtradeUnitCostSaved} />
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${diffColor}`}>
                          {item.diff != null ? `₹${fmt(item.diff)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-center text-zinc-800 dark:text-zinc-200">{fmtInt(item.zoho_stock)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${item.purchase_status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                            {item.purchase_status || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-zinc-100">{fmtInt(item.current_stock)}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{fmtInt(item.open_po)}</td>
                        <td className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-zinc-100">{fmtInt(item.total_qty)}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{fmtInt(item.last_30_sales)}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{item.ads.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center text-zinc-500">{item.coverage_days}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{fmtInt(item.target_stock)}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{fmtInt(item.max_allowed_qty)}</td>
                        <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400 text-sm">{fmtInt(item.final_supply_qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
