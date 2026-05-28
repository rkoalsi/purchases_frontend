'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { RefreshCw, Edit2, Check, X, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState } from './TableStyles';
import capitalize from '@/util/capitalize';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShipmentRow {
  po_number: string;
  po_date: string;
  po_status: string;
  location: string | null;
  total_requested_qty: number;
  total_supply_qty: number;
  total_accepted_qty: number;
  // computed
  short_supply_qty: number;
  short_supply_pct: number | null;
  // editable
  reason_for_short_supply: string | null;
  box_count: number | null;
  appointment_initiated_date: string | null;
  appointment_id: string | null;
  appointment_date: string | null;
  dispatched_date: string | null;
  delivery_date: string | null;
}

// ─── Inline editable cells ────────────────────────────────────────────────────

type EditableTextCellProps = {
  poNumber: string;
  field: string;
  value: string | null;
  onSaved: (field: string, value: string | null) => void;
  placeholder?: string;
};

const EditableTextCell: React.FC<EditableTextCellProps> = ({ poNumber, field, value, onSaved, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/shipment`, { [field]: val || null });
      onSaved(field, val || null);
      setEditing(false);
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group min-w-[80px]">
        <span className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
          {value ?? <span className="text-zinc-400 text-xs">—</span>}
        </span>
        <button
          onClick={() => { setVal(value ?? ''); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity flex-shrink-0"
        >
          <Edit2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="text"
        value={val}
        placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)}
        className="w-32 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

type EditableDateCellProps = {
  poNumber: string;
  field: string;
  value: string | null;
  onSaved: (field: string, value: string | null) => void;
};

const EditableDateCell: React.FC<EditableDateCellProps> = ({ poNumber, field, value, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/shipment`, { [field]: val || null });
      onSaved(field, val || null);
      setEditing(false);
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group min-w-[90px]">
        <span className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
          {value ?? <span className="text-zinc-400 text-xs">—</span>}
        </span>
        <button
          onClick={() => { setVal(value ?? ''); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity flex-shrink-0"
        >
          <Edit2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="date"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

type EditableNumberCellProps = {
  poNumber: string;
  field: string;
  value: number | null;
  onSaved: (field: string, value: number | null) => void;
};

const EditableNumberCell: React.FC<EditableNumberCellProps> = ({ poNumber, field, value, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value != null ? String(value) : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = val === '' ? null : parseInt(val, 10);
    if (num !== null && isNaN(num)) { toast.error('Must be a number'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/shipment`, { [field]: num });
      onSaved(field, num);
      setEditing(false);
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-center">
        <span className="text-sm text-zinc-800 dark:text-zinc-200">
          {value ?? <span className="text-zinc-400 text-xs">—</span>}
        </span>
        <button
          onClick={() => { setVal(value != null ? String(value) : ''); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity flex-shrink-0"
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

// ─── Pagination Component ─────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between flex-wrap gap-4 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-700 rounded-b-lg">
      {/* Items per page selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Rows per page:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
        >
          {[5, 10, 15, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Item count info */}
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{startItem}</span> to{' '}
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{endItem}</span> of{' '}
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalItems}</span> Purchase Orders
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-2 py-1 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        {/* Page info */}
        <div className="text-sm text-zinc-600 dark:text-zinc-400 px-2">
          Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentPage}</span> of{' '}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages}</span>
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-2 py-1 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function EtradeShipmentSummary() {
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<Omit<ShipmentRow, 'short_supply_qty' | 'short_supply_pct'>[]>(
        `${API_URL}/vendor_po/shipment_summary`
      );
      setRows(data.map(r => ({
        ...r,
        short_supply_qty: (r.total_accepted_qty ?? 0) - (r.total_supply_qty ?? 0),
        short_supply_pct: r.total_supply_qty
          ? ((r.total_accepted_qty ?? 0) - r.total_supply_qty) / r.total_supply_qty
          : null,
      })));
      setCurrentPage(1);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFieldSaved = useCallback((poNumber: string, field: string, value: string | number | null) => {
    setRows(prev => prev.map(r => r.po_number === poNumber ? { ...r, [field]: value } : r));
  }, []);

  const fmtPct = (v: number | null) => {
    if (v == null) return '—';
    return `${(v * 100).toFixed(2)}%`;
  };

  const fmtDate = (v: string | null) => v ? v.split('T')[0].split(' ')[0] : null;

  // Pagination logic
  const totalItems = rows.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get(`${API_URL}/vendor_po/shipment_summary/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'etrade_shipment_summary.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API_URL}/vendor_po/shipment_summary/upload`, fd);
      toast.success(`Updated ${data.updated} PO(s)`);
      if (data.errors?.length) toast.warn(data.errors.slice(0, 3).join('\n'));
      await fetchData();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Etrade Shipment Summary</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            One row per Vendor Central PO — tracks supply, dispatch, and delivery details
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Download size={15} />
            Download
          </button>
          <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
            <Upload size={15} className={uploading ? 'animate-pulse' : ''} />
            {uploading ? 'Uploading…' : 'Upload'}
            <input ref={uploadRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} />
          </label>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={TABLE_CLASSES.container}>
        {loading && <LoadingState message="Loading shipment summary…" />}
        {error && <ErrorState error={error} onRetry={fetchData} />}
        {!loading && !error && rows.length === 0 && (
          <div className="py-12 text-center text-zinc-400 text-sm">
            No purchase orders found. Upload POs on the Vendor Central POs page first.
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div className="flex flex-col border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div className={TABLE_CLASSES.overflow}>
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                  <tr>
                    {[
                      { label: 'PO Date', editable: false },
                      { label: 'PO Number', editable: false },
                      { label: 'Location', editable: false },
                      { label: 'Requested Qty', editable: false },
                      { label: 'Supply Qty\n(After Overstock)', editable: false },
                      { label: 'Accepted /\nDispatched Qty', editable: false },
                      { label: 'Short Supply\n(Qty)', editable: false },
                      { label: 'Short Supply\n(%)', editable: false },
                      { label: 'Reason for\nShort Supply', editable: true },
                      { label: 'Box Count', editable: true },
                      { label: 'Appointment\nInitiated Date', editable: true },
                      { label: 'Appointment ID', editable: true },
                      { label: 'Appointment\nDate', editable: true },
                      { label: 'Dispatched\nDate', editable: true },
                      { label: 'Status', editable: false },
                      { label: 'Delivery Date', editable: true },
                    ].map(({ label, editable }) => (
                      <th
                        key={label}
                        className={`px-3 py-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 whitespace-pre-line border-b border-zinc-200 dark:border-zinc-700 ${editable ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {paginatedRows.map((row) => {
                    const shortQtyColor = row.short_supply_qty < 0
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : row.short_supply_qty === 0
                      ? 'text-zinc-500'
                      : 'text-green-600 dark:text-green-400 font-semibold';

                    return (
                      <tr key={row.po_number} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        {/* PO Date */}
                        <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{fmtDate(row.po_date) ?? '—'}</td>

                        {/* PO Number */}
                        <td className="px-3 py-2">
                          <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{row.po_number}</span>
                        </td>

                        {/* Location */}
                        <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{row.location ?? '—'}</td>

                        {/* Requested Qty */}
                        <td className="px-3 py-2 text-center font-medium text-zinc-900 dark:text-zinc-100">
                          {(row.total_requested_qty ?? 0).toLocaleString('en-IN')}
                        </td>

                        {/* Supply Qty */}
                        <td className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10">
                          {(row.total_supply_qty ?? 0).toLocaleString('en-IN')}
                        </td>

                        {/* Accepted / Dispatched Qty */}
                        <td className="px-3 py-2 text-center text-zinc-800 dark:text-zinc-200">
                          {(row.total_accepted_qty ?? 0).toLocaleString('en-IN')}
                        </td>

                        {/* Short Supply Qty */}
                        <td className={`px-3 py-2 text-center ${shortQtyColor}`}>
                          {row.short_supply_qty.toLocaleString('en-IN')}
                        </td>

                        {/* Short Supply % */}
                        <td className={`px-3 py-2 text-center ${shortQtyColor}`}>
                          {fmtPct(row.short_supply_pct)}
                        </td>

                        {/* Reason for Short Supply — editable text */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableTextCell
                            poNumber={row.po_number}
                            field="reason_for_short_supply"
                            value={row.reason_for_short_supply}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                            placeholder="Enter reason…"
                          />
                        </td>

                        {/* Box Count — editable number */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableNumberCell
                            poNumber={row.po_number}
                            field="box_count"
                            value={row.box_count}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                          />
                        </td>

                        {/* Appointment Initiated Date — editable date */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableDateCell
                            poNumber={row.po_number}
                            field="appointment_initiated_date"
                            value={fmtDate(row.appointment_initiated_date)}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                          />
                        </td>

                        {/* Appointment ID — editable text */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableTextCell
                            poNumber={row.po_number}
                            field="appointment_id"
                            value={row.appointment_id}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                            placeholder="ID…"
                          />
                        </td>

                        {/* Appointment Date — editable date */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableDateCell
                            poNumber={row.po_number}
                            field="appointment_date"
                            value={fmtDate(row.appointment_date)}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                          />
                        </td>

                        {/* Dispatched Date — editable date */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableDateCell
                            poNumber={row.po_number}
                            field="dispatched_date"
                            value={fmtDate(row.dispatched_date)}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                          />
                        </td>

                        {/* Status — from PO, read-only */}
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.po_status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            row.po_status === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            row.po_status === 'packed' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                            row.po_status === 'intransit' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' :
                            row.po_status === 'delivered' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' :
                            row.po_status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {capitalize(row.po_status)}
                          </span>
                        </td>

                        {/* Delivery Date — editable date */}
                        <td className="px-3 py-2 bg-yellow-50/30 dark:bg-yellow-900/5">
                          <EditableDateCell
                            poNumber={row.po_number}
                            field="delivery_date"
                            value={fmtDate(row.delivery_date)}
                            onSaved={(f, v) => handleFieldSaved(row.po_number, f, v)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
