'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Download, RefreshCw, FileSpreadsheet, ChevronDown, ChevronUp, Edit2, Check, X, Trash2, Search, FileUp, ExternalLink, FileText, Link2, Package } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface EtradeAddress {
  address_id: string;
  attention: string;
  address: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface POListItem {
  po_number: string;
  vendor: string;
  po_date: string;
  po_status: 'pending' | 'processing' | 'packed' | 'closed' | 'intransit' | 'delivered' | 'completed';
  item_count: number;
  created_at: string;
  total_requested_qty: number;
  total_accepted_qty: number;
  total_received_qty: number;
  total_supply_qty: number;
  total_cost: number | null;
  total_cost_gst: number | null;
  order_file_s3_key?: string;
  estimate_number?: string;
  zoho_estimate_id?: string;
  packages?: string[];
  so_packages?: string[] | null;
  so_number?: string;
  accepted_total_cost?: number | null;
  accepted_total_cost_gst?: number | null;
  transfer_order_number?: string;
  transfer_order_id?: string;
  bundle_ids?: string[];
  assembly_numbers?: string[];
  sales_order_no?: string;
  sales_order_id?: string;
}

interface POItem {
  asin: string;
  model_number: string;
  title: string;
  ship_to_location: string;
  requested_qty: number;
  supply_qty: number | null;
  supply_qty_override: number | null;
  accepted_qty: number | null;
  received_qty: number | null;
  etrade_unit_cost: number;
  etrade_asp: number | null;
  zoho_mrp: number;
  gst: number;
  mrp_wo_gst: number;
  margin: number | null;
  cost_price_wo_tax: number | null;
  total_cost: number | null;
  total_cost_gst: number | null;
  total_cost_accepted: number | null;
  total_cost_accepted_gst: number | null;
  total_cost_dispatched: number | null;
  total_cost_dispatched_gst: number | null;
  dispatched_qty: number | null;
  hsn: string;
  diff: number | null;
  zoho_stock: number;
  purchase_status: string;
  current_stock: number;
  open_po: number;
  open_po_override: number | null;
  total_qty: number;
  ads: number;
  coverage_days: number;
  coverage_days_override: number | null;
  lead_time: number;
  lead_time_override: number | null;
  net_total_days: number | null;
  total_target_days: number;
  target_stock: number;
  final_supply_qty: number;
  final_drr: number | null;
  final_drr_flag: string | null;
  final_units: number | null;
  final_units_override: number | null;
  final_supply_fo: number | null;
  final_supply_fo_override: number | null;
  monthly_sales: number[];
  month_labels: [number, number, string][];
}

interface POReport {
  po_number: string;
  vendor: string;
  po_date: string;
  po_status: string;
  inventory_date: string | null;
  zoho_stock_date: string | null;
  po_update_date: string | null;
  estimate_number?: string;
  zoho_estimate_id?: string;
  transfer_order_number?: string;
  transfer_order_id?: string;
  bundle_ids?: string[];
  assembly_numbers?: string[];
  packages?: string[];
  so_packages?: string[] | null;
  so_number?: string;
  sales_order_no?: string;
  sales_order_id?: string;
  items: POItem[];
}

interface EstimateDiffItem {
  model_number: string;
  title: string;
  asin: string;
  supply_qty: number;
  po_rate: number | null;
  po_item_total: number | null;
  in_estimate: boolean;
  estimate_qty: number | null;
  estimate_rate: number | null;
  estimate_item_total: number | null;
  qty_diff: number | null;
  rate_diff: number | null;
  total_diff: number | null;
}

interface EstimateDiff {
  po_number: string;
  estimate_number: string;
  estimate_sub_total: number | null;
  estimate_total: number | null;
  po_computed_total: number | null;
  po_computed_total_gst: number | null;
  items: EstimateDiffItem[];
  only_in_estimate: { sku: string; name: string; quantity: number | null; rate: number | null; item_total: number | null }[];
}

interface PackageBreakdownItem {
  sku: string;
  name: string;
  qty: number;
  asin: string | null;
  etrade_asp: number | null;
  gst: number;
  mrp_wo_gst: number | null;
  margin: number | null;
  unit_cost: number | null;
  item_total: number | null;
  item_total_gst: number | null;
}

interface PackageBreakdown {
  po_number: string;
  package_number: string;
  accepted_total_cost: number | null;
  accepted_total_cost_gst: number | null;
  items: PackageBreakdownItem[];
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

// ─── ReceivedQtyCell ──────────────────────────────────────────────────────────

const ReceivedQtyCell: React.FC<{
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
    if (isNaN(num) || num < 0) { toast.error('Received qty must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/received_qty?received_qty=${num}`);
      onSaved(asin, num);
      setEditing(false);
      toast.success('Received qty updated');
    } catch {
      toast.error('Failed to save received qty');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-center">
        <span className="text-sm text-zinc-900 dark:text-zinc-100">{value ?? '—'}</span>
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

// ─── POListReceivedQtyCell ─────────────────────────────────────────────────────

const POListReceivedQtyCell: React.FC<{
  poNumber: string;
  value: number;
  onSaved: (poNumber: string, qty: number) => void;
}> = ({ poNumber, value, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) { toast.error('Received qty must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/received_qty?received_qty=${num}`);
      onSaved(poNumber, num);
      setEditing(false);
      toast.success('Received qty updated');
    } catch {
      toast.error('Failed to save received qty');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-center">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{value || '—'}</span>
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

// ─── SupplyQtyCell ────────────────────────────────────────────────────────────

const SupplyQtyCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number;
  isOverride: boolean;
  onSaved: () => void;
}> = ({ poNumber, asin, value, isOverride, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async (clearOverride = false) => {
    const num = clearOverride ? -1 : parseInt(val, 10);
    if (!clearOverride && (isNaN(num) || num < 0)) { toast.error('Supply qty must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/supply_qty?supply_qty=${num}`);
      onSaved();
      setEditing(false);
      toast.success(clearOverride ? 'Supply qty reset to auto-computed' : 'Supply qty updated');
    } catch {
      toast.error('Failed to save supply qty');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-center">
        <span className={`text-sm ${isOverride ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-600 dark:text-zinc-400'}`}>
          {value}
        </span>
        {isOverride && (
          <span className="text-xs text-amber-500 dark:text-amber-400" title="Manually overridden">✎</span>
        )}
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
      <button onClick={() => save()} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      {isOverride && (
        <button onClick={() => save(true)} disabled={saving} title="Reset to auto-computed" className="p-0.5 text-amber-500 hover:text-amber-700 text-xs font-bold">↺</button>
      )}
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── OpenQtyCell ──────────────────────────────────────────────────────────────

const OpenQtyCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number;
  isOverride: boolean;
  onSaved: () => void;
}> = ({ poNumber, asin, value, isOverride, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async (clearOverride = false) => {
    const num = clearOverride ? -1 : parseInt(val, 10);
    if (!clearOverride && (isNaN(num) || num < 0)) { toast.error('Open qty must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/open_qty?open_qty=${num}`);
      onSaved();
      setEditing(false);
      toast.success(clearOverride ? 'Open qty reset to auto-computed' : 'Open qty updated');
    } catch {
      toast.error('Failed to save open qty');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-center">
        <span className={`text-sm ${isOverride ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>
          {value}
        </span>
        {isOverride && (
          <span className="text-xs text-amber-500 dark:text-amber-400" title="Manually overridden">✎</span>
        )}
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
      <button onClick={() => save()} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      {isOverride && (
        <button onClick={() => save(true)} disabled={saving} title="Reset to auto-computed" className="p-0.5 text-amber-500 hover:text-amber-700 text-xs font-bold">↺</button>
      )}
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── EtradeAspCell ────────────────────────────────────────────────────────────

const EtradeAspCell: React.FC<{
  asin: string;
  value: number | null;
  onSaved: (asin: string, asp: number) => void;
}> = ({ asin, value, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value != null ? String(value) : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) { toast.error('eTrade ASP must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/vendor_po/margins/${asin}?etrade_asp=${num}`);
      onSaved(asin, num);
      setEditing(false);
      toast.success('eTrade ASP updated');
    } catch {
      toast.error('Failed to save eTrade ASP');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group justify-end">
        <span className="text-sm text-zinc-900 dark:text-zinc-100">
          {value != null ? `₹${value.toFixed(2)}` : <span className="text-zinc-400 text-xs">—</span>}
        </span>
        <button
          onClick={() => { setVal(value != null ? String(value) : ''); setEditing(true); }}
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

// ─── LeadTimeCell ─────────────────────────────────────────────────────────────

const LeadTimeCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number;
  isOverride: boolean;
  onSaved: () => void;
}> = ({ poNumber, asin, value, isOverride, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async (clear = false) => {
    const num = clear ? -1 : parseInt(val, 10);
    if (!clear && (isNaN(num) || num < 0)) { toast.error('Lead time must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/lead_time?lead_time=${num}`);
      onSaved();
      setEditing(false);
      toast.success(clear ? 'Lead time reset to default (10)' : 'Lead time updated');
    } catch { toast.error('Failed to save lead time'); } finally { setSaving(false); }
  };

  if (!editing) return (
    <div className="flex items-center gap-1 group justify-center">
      <span className={`text-sm ${isOverride ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>{value}</span>
      {isOverride && <span className="text-xs text-amber-500" title="Overridden">✎</span>}
      <button onClick={() => { setVal(String(value)); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity"><Edit2 size={12} /></button>
    </div>
  );
  return (
    <div className="flex items-center gap-1 justify-center">
      <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
        className="w-14 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
      <button onClick={() => save()} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      {isOverride && <button onClick={() => save(true)} disabled={saving} title="Reset to 10" className="p-0.5 text-amber-500 hover:text-amber-700 text-xs font-bold">↺</button>}
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── CoverageDaysCell ─────────────────────────────────────────────────────────

const CoverageDaysCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number;
  isOverride: boolean;
  onSaved: () => void;
}> = ({ poNumber, asin, value, isOverride, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async (clear = false) => {
    const num = clear ? -1 : parseInt(val, 10);
    if (!clear && (isNaN(num) || num < 0)) { toast.error('Coverage days must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/coverage_days?coverage_days=${num}`);
      onSaved();
      setEditing(false);
      toast.success(clear ? 'Coverage days reset to default (35)' : 'Coverage days updated');
    } catch { toast.error('Failed to save coverage days'); } finally { setSaving(false); }
  };

  if (!editing) return (
    <div className="flex items-center gap-1 group justify-center">
      <span className={`text-sm ${isOverride ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>{value}</span>
      {isOverride && <span className="text-xs text-amber-500" title="Overridden">✎</span>}
      <button onClick={() => { setVal(String(value)); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity"><Edit2 size={12} /></button>
    </div>
  );
  return (
    <div className="flex items-center gap-1 justify-center">
      <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
        className="w-14 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
      <button onClick={() => save()} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      {isOverride && <button onClick={() => save(true)} disabled={saving} title="Reset to 35" className="p-0.5 text-amber-500 hover:text-amber-700 text-xs font-bold">↺</button>}
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── FinalUnitsCell ───────────────────────────────────────────────────────────

const FinalUnitsCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number | null;
  isOverride: boolean;
  onSaved: () => void;
}> = ({ poNumber, asin, value, isOverride, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);

  const save = async (clear = false) => {
    const num = clear ? -1 : parseInt(val, 10);
    if (!clear && (isNaN(num) || num < 0)) { toast.error('Final units must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/final_units?final_units=${num}`);
      onSaved();
      setEditing(false);
      toast.success(clear ? 'Final units reset to formula' : 'Final units updated');
    } catch { toast.error('Failed to save final units'); } finally { setSaving(false); }
  };

  if (!editing) return (
    <div className="flex items-center gap-1 group justify-center">
      <span className={`text-sm ${isOverride ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>{value ?? '—'}</span>
      {isOverride && <span className="text-xs text-amber-500" title="Overridden">✎</span>}
      <button onClick={() => { setVal(String(value ?? '')); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity"><Edit2 size={12} /></button>
    </div>
  );
  return (
    <div className="flex items-center gap-1 justify-center">
      <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
        className="w-16 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
      <button onClick={() => save()} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      {isOverride && <button onClick={() => save(true)} disabled={saving} title="Reset to formula" className="p-0.5 text-amber-500 hover:text-amber-700 text-xs font-bold">↺</button>}
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600"><X size={12} /></button>
    </div>
  );
};

// ─── FinalSupplyFOCell ────────────────────────────────────────────────────────

const FinalSupplyFOCell: React.FC<{
  poNumber: string;
  asin: string;
  value: number | null;
  isOverride: boolean;
  onSaved: () => void;
}> = ({ poNumber, asin, value, isOverride, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);

  const save = async (clear = false) => {
    const num = clear ? -1 : parseInt(val, 10);
    if (!clear && (isNaN(num) || num < 0)) { toast.error('Supply qty must be ≥ 0'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/items/${asin}/final_supply_fo?final_supply_fo=${num}`);
      onSaved();
      setEditing(false);
      toast.success(clear ? 'Final supply qty reset to formula' : 'Final supply qty updated');
    } catch { toast.error('Failed to save final supply qty'); } finally { setSaving(false); }
  };

  if (!editing) return (
    <div className="flex items-center gap-1 group justify-center">
      <span className={`text-sm font-bold ${isOverride ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>{value ?? '—'}</span>
      {isOverride && <span className="text-xs text-amber-500" title="Overridden">✎</span>}
      <button onClick={() => { setVal(String(value ?? '')); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-blue-600 transition-opacity"><Edit2 size={12} /></button>
    </div>
  );
  return (
    <div className="flex items-center gap-1 justify-center">
      <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
        className="w-16 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
      <button onClick={() => save()} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700"><Check size={12} /></button>
      {isOverride && <button onClick={() => save(true)} disabled={saving} title="Reset to formula" className="p-0.5 text-amber-500 hover:text-amber-700 text-xs font-bold">↺</button>}
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

  // bulk update form
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // multi-select for download
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const [downloading, setDownloading] = useState(false);

  // upload order
  const [uploadOrderPO, setUploadOrderPO] = useState<string | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const orderFileInputRef = useRef<HTMLInputElement>(null);

  // delete order file
  const [deleteOrderFilePO, setDeleteOrderFilePO] = useState<string | null>(null);
  const [deletingOrderFile, setDeletingOrderFile] = useState(false);

  // delete
  const [deleteConfirmPO, setDeleteConfirmPO] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // report tabs
  const [reportTab, setReportTab] = useState<'report' | 'estimate_diff' | 'package_breakdown'>('report');
  const [estimateDiff, setEstimateDiff] = useState<EstimateDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [packageBreakdown, setPackageBreakdown] = useState<PackageBreakdown | null>(null);
  const [pkgBreakdownLoading, setPkgBreakdownLoading] = useState(false);
  const [pkgBreakdownError, setPkgBreakdownError] = useState<string | null>(null);

  // estimate modals
  const [createEstimateOpen, setCreateEstimateOpen] = useState(false);
  const [linkEstimateOpen, setLinkEstimateOpen] = useState(false);
  const [etradeAddresses, setEtradeAddresses] = useState<EtradeAddress[]>([]);
  const [billingAddressId, setBillingAddressId] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [estimateDate, setEstimateDate] = useState('');
  const [creatingEstimate, setCreatingEstimate] = useState(false);
  const [linkEstimateNumber, setLinkEstimateNumber] = useState('');
  const [linkingEstimate, setLinkingEstimate] = useState(false);
  const [unlinkingEstimate, setUnlinkingEstimate] = useState(false);

  // package modals (manual linking removed — packages derived from sales order)

  // transfer order modals
  const [createTOOpen, setCreateTOOpen] = useState(false);
  const [linkTOOpen, setLinkTOOpen] = useState(false);
  const [linkTONumber, setLinkTONumber] = useState('');
  const [toDate, setToDate] = useState('');
  const [creatingTO, setCreatingTO] = useState(false);
  const [linkingTO, setLinkingTO] = useState(false);
  const [unlinkingTO, setUnlinkingTO] = useState(false);

  // sales order modal
  const [linkSOOpen, setLinkSOOpen] = useState(false);
  const [linkSONumber, setLinkSONumber] = useState('');
  const [linkingSONumber, setLinkingSONumber] = useState(false);
  const [soSearchResults, setSOSearchResults] = useState<{ salesorder_number: string; salesorder_id: string; customer_name: string }[]>([]);
  const [soSearchLoading, setSOSearchLoading] = useState(false);

  // assembly modals
  const [linkAssemblyOpen, setLinkAssemblyOpen] = useState(false);
  const [linkAssemblyNumber, setLinkAssemblyNumber] = useState('');
  const [creatingAssemblies, setCreatingAssemblies] = useState(false);
  const [linkingAssembly, setLinkingAssembly] = useState(false);
  const [unlinkingAssemblies, setUnlinkingAssemblies] = useState(false);

  // search + jump-to-page
  const [poSearch, setPoSearch] = useState('');
  const [jumpPage, setJumpPage] = useState('');

  const filteredPoList = useMemo(
    () => poSearch.trim()
      ? poList.filter(p => p.po_number.toLowerCase().includes(poSearch.toLowerCase()))
      : poList,
    [poList, poSearch]
  );

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
  React.useEffect(() => { setPage(0); }, [poSearch]);

  // ─── fetch report ────────────────────────────────────────────────────────────

  const fetchReport = useCallback(async (poNumber: string) => {
    setSelectedPO(poNumber);
    setReport(null);
    setReportError(null);
    setReportLoading(true);
    setReportTab('report');
    setEstimateDiff(null);
    setDiffError(null);
    setPackageBreakdown(null);
    setPkgBreakdownError(null);
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

  const fetchEstimateDiff = useCallback(async (poNumber: string) => {
    setDiffLoading(true);
    setDiffError(null);
    try {
      const { data } = await axios.get<EstimateDiff>(`${API_URL}/vendor_po/${poNumber}/estimate_diff`);
      setEstimateDiff(data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Unknown error';
      setDiffError(msg);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  const fetchPackageBreakdown = useCallback(async (poNumber: string) => {
    setPkgBreakdownLoading(true);
    setPkgBreakdownError(null);
    try {
      const { data } = await axios.get<PackageBreakdown>(`${API_URL}/vendor_po/${poNumber}/package_breakdown`);
      setPackageBreakdown(data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Unknown error';
      setPkgBreakdownError(msg);
    } finally {
      setPkgBreakdownLoading(false);
    }
  }, []);

  // ─── delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (poNumber: string) => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/vendor_po/${poNumber}`);
      toast.success(`PO ${poNumber} deleted`);
      setPoList(prev => prev.filter(p => p.po_number !== poNumber));
      if (selectedPO === poNumber) { setSelectedPO(null); setReport(null); }
      setSelectedForDownload(prev => { const next = new Set(prev); next.delete(poNumber); return next; });
      setDeleteConfirmPO(null);
    } catch {
      toast.error('Failed to delete PO');
    } finally {
      setDeleting(false);
    }
  };

  // ─── upload order ────────────────────────────────────────────────────────────

  const handleUploadOrder = async () => {
    if (!orderFile || !uploadOrderPO) return;
    setUploadingOrder(true);
    try {
      const formData = new FormData();
      formData.append('file', orderFile);
      const res = await axios.post(
        `${API_URL}/vendor_po/${uploadOrderPO}/upload_order`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, responseType: 'blob' }
      );
      // Trigger download of filled file
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `POItemExport_${uploadOrderPO}_filled.xls`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Order file filled and downloaded');
      setPoList(prev => prev.map(p =>
        p.po_number === uploadOrderPO ? { ...p, order_file_s3_key: 'uploaded' } : p
      ));
      setUploadOrderPO(null);
      setOrderFile(null);
      if (orderFileInputRef.current) orderFileInputRef.current.value = '';
    } catch {
      toast.error('Failed to process order file');
    } finally {
      setUploadingOrder(false);
    }
  };

  // ─── delete order file ────────────────────────────────────────────────────────

  const handleDeleteOrderFile = async (poNumber: string) => {
    setDeletingOrderFile(true);
    try {
      await axios.delete(`${API_URL}/vendor_po/${poNumber}/order_file`);
      toast.success('Order file deleted');
      setPoList(prev => prev.map(p =>
        p.po_number === poNumber ? { ...p, order_file_s3_key: undefined } : p
      ));
      setDeleteOrderFilePO(null);
    } catch {
      toast.error('Failed to delete order file');
    } finally {
      setDeletingOrderFile(false);
    }
  };

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

  // ─── bulk update ─────────────────────────────────────────────────────────────

  const handleBulkUpdate = async () => {
    if (bulkFiles.length === 0) { toast.error('Please select at least one file'); return; }
    setBulkUploading(true);
    let totalUpdated = 0, totalSkipped = 0, totalNotFound = 0, failed = 0;
    for (const file of bulkFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await axios.post<{ results: { po_number: string; status: string; reason?: string; items_changed?: number }[] }>(
          `${API_URL}/vendor_po/bulk_update`, formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        totalUpdated += data.results.filter(r => r.status === 'updated').length;
        totalSkipped += data.results.filter(r => r.status === 'skipped').length;
        totalNotFound += data.results.filter(r => r.status === 'not_found').length;
      } catch {
        failed++;
      }
    }
    setBulkFiles([]);
    setBulkUpdateOpen(false);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    await fetchList();
    if (selectedPO) await fetchReport(selectedPO);
    if (failed > 0) toast.error(`${failed} file(s) failed to process`);
    toast.success(`Bulk update complete: ${totalUpdated} updated, ${totalSkipped} skipped, ${totalNotFound} not found`);
    setBulkUploading(false);
  };

  // ─── download single ─────────────────────────────────────────────────────────

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

  // ─── download multiple ────────────────────────────────────────────────────────

  const handleBulkDownload = async () => {
    if (selectedForDownload.size === 0) return;
    setBulkDownloading(true);
    try {
      const poNumbers = Array.from(selectedForDownload);
      if (poNumbers.length === 1) {
        const pn = poNumbers[0];
        const res = await axios.get(`${API_URL}/vendor_po/${pn}/download`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO_Report_${pn}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`PO ${pn} downloaded`);
      } else {
        const res = await axios.post(`${API_URL}/vendor_po/bulk_download`, poNumbers, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO_Reports_${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${poNumbers.length} POs downloaded as zip`);
      }
    } catch {
      toast.error('Download failed');
    } finally {
      setBulkDownloading(false);
    }
  };

  const toggleSelectForDownload = (poNumber: string) => {
    setSelectedForDownload(prev => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber);
      else next.add(poNumber);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allSelected = filteredPoList.every(p => selectedForDownload.has(p.po_number));
    setSelectedForDownload(prev => {
      const next = new Set(prev);
      if (allSelected) filteredPoList.forEach(p => next.delete(p.po_number));
      else filteredPoList.forEach(p => next.add(p.po_number));
      return next;
    });
  };

  // ─── status update ───────────────────────────────────────────────────────────

  const FROZEN_STATUSES = new Set(['processing', 'packed', 'closed', 'intransit', 'delivered', 'completed']);

  const handleStatusChange = async (poNumber: string, newStatus: string, currentStatus: string) => {
    try {
      await axios.patch(`${API_URL}/vendor_po/${poNumber}/status?po_status=${newStatus}`);
      const isFreeze = FROZEN_STATUSES.has(newStatus) && !FROZEN_STATUSES.has(currentStatus);
      toast.success(isFreeze ? 'Status updated — stock data frozen' : 'Status updated');
      setPoList(prev => prev.map(p => p.po_number === poNumber ? { ...p, po_status: newStatus as POListItem['po_status'] } : p));
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

  // ─── cell saved callbacks ─────────────────────────────────────────────────────

  const handleAcceptedQtySaved = useCallback((asin: string, qty: number) => {
    setReport(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(it => it.asin === asin ? { ...it, accepted_qty: qty } : it) };
    });
    setPoList(prev => prev.map(po => {
      if (po.po_number !== report?.po_number) return po;
      const delta = qty - (report?.items.find(it => it.asin === asin)?.accepted_qty ?? 0);
      return { ...po, total_accepted_qty: (po.total_accepted_qty ?? 0) + delta };
    }));
  }, [report]);

  const handleReceivedQtySaved = useCallback((asin: string, qty: number) => {
    setReport(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(it => it.asin === asin ? { ...it, received_qty: qty } : it) };
    });
    setPoList(prev => prev.map(po => {
      if (po.po_number !== report?.po_number) return po;
      const delta = qty - (report?.items.find(it => it.asin === asin)?.received_qty ?? 0);
      return { ...po, total_received_qty: (po.total_received_qty ?? 0) + delta };
    }));
  }, [report]);

  const handlePOReceivedQtySaved = useCallback((poNumber: string, qty: number) => {
    setPoList(prev => prev.map(po => po.po_number === poNumber ? { ...po, total_received_qty: qty } : po));
  }, []);

  const handleEtradeAspSaved = useCallback((asin: string, asp: number) => {
    setReport(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(it => it.asin === asin ? { ...it, etrade_asp: asp } : it) };
    });
  }, []);

  const handleOpenQtySaved = useCallback(() => {
    if (selectedPO) fetchReport(selectedPO);
  }, [selectedPO, fetchReport]);

  const handleSupplyQtySaved = useCallback(() => {
    // Refresh so total_cost, total_cost_gst, final_supply_qty all recompute
    if (selectedPO) fetchReport(selectedPO);
  }, [selectedPO, fetchReport]);

  const handleLeadTimeSaved = useCallback(() => {
    if (selectedPO) fetchReport(selectedPO);
  }, [selectedPO, fetchReport]);

  const handleCoverageDaysSaved = useCallback(() => {
    if (selectedPO) fetchReport(selectedPO);
  }, [selectedPO, fetchReport]);

  const handleFinalUnitsSaved = useCallback(() => {
    if (selectedPO) fetchReport(selectedPO);
  }, [selectedPO, fetchReport]);

  const handleFinalSupplyFOSaved = useCallback(() => {
    if (selectedPO) fetchReport(selectedPO);
  }, [selectedPO, fetchReport]);


  // ─── estimate handlers ────────────────────────────────────────────────────────

  const openCreateEstimateModal = async () => {
    setEstimateDate(new Date().toISOString().slice(0, 10));
    setCreateEstimateOpen(true);
    if (etradeAddresses.length === 0) {
      try {
        const { data } = await axios.get<{ contact_id: string; addresses: EtradeAddress[] }>(`${API_URL}/vendor_po/etrade_customer`);
        setEtradeAddresses(data.addresses);
        if (data.addresses.length > 0) {
          setBillingAddressId(data.addresses[0].address_id);
          setShippingAddressId(data.addresses[0].address_id);
        }
      } catch {
        toast.error('Failed to load ETRADE addresses');
      }
    }
  };

  const handleCreateEstimate = async () => {
    if (!selectedPO || !billingAddressId || !shippingAddressId) return;
    setCreatingEstimate(true);
    try {
      const { data } = await axios.post<{ estimate_id: string; estimate_number: string; total: number; skipped_items?: string[] }>(
        `${API_URL}/vendor_po/${selectedPO}/estimate`,
        { billing_address_id: billingAddressId, shipping_address_id: shippingAddressId, date: estimateDate || undefined },
      );
      toast.success(`Estimate ${data.estimate_number} created`);
      if (data.skipped_items?.length) toast.warn(`Skipped ${data.skipped_items.length} item(s) without Zoho item ID`);
      setReport(prev => prev ? { ...prev, estimate_number: data.estimate_number, zoho_estimate_id: data.estimate_id } : prev);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, estimate_number: data.estimate_number } : p));
      setCreateEstimateOpen(false);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to create estimate';
      toast.error(msg);
    } finally {
      setCreatingEstimate(false);
    }
  };

  const handleLinkEstimate = async () => {
    if (!selectedPO || !linkEstimateNumber.trim()) return;
    setLinkingEstimate(true);
    try {
      const { data } = await axios.patch<{ estimate_number: string; estimate_id: string }>(
        `${API_URL}/vendor_po/${selectedPO}/estimate`,
        { estimate_number: linkEstimateNumber.trim() },
      );
      toast.success(`Estimate ${data.estimate_number} linked`);
      setReport(prev => prev ? { ...prev, estimate_number: data.estimate_number, zoho_estimate_id: data.estimate_id } : prev);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, estimate_number: data.estimate_number } : p));
      setLinkEstimateOpen(false);
      setLinkEstimateNumber('');
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to link estimate';
      toast.error(msg);
    } finally {
      setLinkingEstimate(false);
    }
  };

  const handleUnlinkEstimate = async () => {
    if (!selectedPO) return;
    setUnlinkingEstimate(true);
    try {
      await axios.delete(`${API_URL}/vendor_po/${selectedPO}/estimate`);
      toast.success('Estimate unlinked');
      setReport(prev => prev ? { ...prev, estimate_number: undefined, zoho_estimate_id: undefined } : prev);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, estimate_number: undefined, zoho_estimate_id: undefined } : p));
    } catch {
      toast.error('Failed to unlink estimate');
    } finally {
      setUnlinkingEstimate(false);
    }
  };

  // ─── transfer order handlers ─────────────────────────────────────────────────

  const handleCreateTransferOrder = async () => {
    if (!selectedPO) return;
    setCreatingTO(true);
    try {
      const { data } = await axios.post<{ transfer_order_id: string; transfer_order_number: string; status: string }>(
        `${API_URL}/vendor_po/${selectedPO}/transfer_order`,
        { date: toDate || undefined },
      );
      toast.success(`Transfer order ${data.transfer_order_number} created`);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, transfer_order_number: data.transfer_order_number, transfer_order_id: data.transfer_order_id } : p));
      setReport(prev => prev ? { ...prev, transfer_order_number: data.transfer_order_number, transfer_order_id: data.transfer_order_id } : prev);
      setCreateTOOpen(false);
      setToDate('');
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to create transfer order';
      toast.error(msg);
    } finally {
      setCreatingTO(false);
    }
  };

  const handleLinkTransferOrder = async () => {
    if (!selectedPO || !linkTONumber.trim()) return;
    setLinkingTO(true);
    try {
      const { data } = await axios.patch<{ transfer_order_number: string; transfer_order_id: string }>(
        `${API_URL}/vendor_po/${selectedPO}/transfer_order`,
        { transfer_order_number: linkTONumber.trim() },
      );
      toast.success(`Transfer order ${data.transfer_order_number} linked`);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, transfer_order_number: data.transfer_order_number, transfer_order_id: data.transfer_order_id } : p));
      setReport(prev => prev ? { ...prev, transfer_order_number: data.transfer_order_number, transfer_order_id: data.transfer_order_id } : prev);
      setLinkTOOpen(false);
      setLinkTONumber('');
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to link transfer order';
      toast.error(msg);
    } finally {
      setLinkingTO(false);
    }
  };

  const handleUnlinkTransferOrder = async () => {
    if (!selectedPO) return;
    setUnlinkingTO(true);
    try {
      await axios.delete(`${API_URL}/vendor_po/${selectedPO}/transfer_order`);
      toast.success('Transfer order unlinked');
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, transfer_order_number: undefined, transfer_order_id: undefined } : p));
      setReport(prev => prev ? { ...prev, transfer_order_number: undefined, transfer_order_id: undefined } : prev);
    } catch {
      toast.error('Failed to unlink transfer order');
    } finally {
      setUnlinkingTO(false);
    }
  };

  const handleCreateAssemblies = async () => {
    if (!selectedPO) return;
    setCreatingAssemblies(true);
    try {
      const { data } = await axios.post<{ po_number: string; bundle_ids: string[]; assembly_numbers: string[] }>(
        `${API_URL}/vendor_po/${selectedPO}/assemblies`,
      );
      toast.success(`${data.assembly_numbers.length} assembly(s) created`);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, bundle_ids: data.bundle_ids, assembly_numbers: data.assembly_numbers } : p));
      setReport(prev => prev ? { ...prev, bundle_ids: data.bundle_ids, assembly_numbers: data.assembly_numbers } : prev);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to create assemblies';
      toast.error(msg);
    } finally {
      setCreatingAssemblies(false);
    }
  };

  const handleLinkAssembly = async () => {
    if (!selectedPO || !linkAssemblyNumber.trim()) return;
    setLinkingAssembly(true);
    try {
      const { data } = await axios.patch<{ bundle_ids: string[]; assembly_numbers: string[] }>(
        `${API_URL}/vendor_po/${selectedPO}/assemblies`,
        { assembly_number: linkAssemblyNumber.trim() },
      );
      toast.success(`Assembly ${linkAssemblyNumber.trim()} linked`);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, bundle_ids: data.bundle_ids, assembly_numbers: data.assembly_numbers } : p));
      setReport(prev => prev ? { ...prev, bundle_ids: data.bundle_ids, assembly_numbers: data.assembly_numbers } : prev);
      setLinkAssemblyOpen(false);
      setLinkAssemblyNumber('');
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to link assembly';
      toast.error(msg);
    } finally {
      setLinkingAssembly(false);
    }
  };

  const handleUnlinkAssemblies = async () => {
    if (!selectedPO) return;
    setUnlinkingAssemblies(true);
    try {
      await axios.delete(`${API_URL}/vendor_po/${selectedPO}/assemblies`);
      toast.success('Assemblies unlinked');
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, bundle_ids: undefined, assembly_numbers: undefined } : p));
      setReport(prev => prev ? { ...prev, bundle_ids: undefined, assembly_numbers: undefined } : prev);
    } catch {
      toast.error('Failed to unlink assemblies');
    } finally {
      setUnlinkingAssemblies(false);
    }
  };

  // ─── sales order handler ─────────────────────────────────────────────────────

  const handleSOSearch = async (q: string) => {
    setLinkSONumber(q);
    if (q.trim().length < 3) { setSOSearchResults([]); return; }
    setSOSearchLoading(true);
    try {
      const { data } = await axios.get<{ salesorder_number: string; salesorder_id: string; customer_name: string }[]>(
        `${API_URL}/vendor_po/search/sales_orders`,
        { params: { q } },
      );
      setSOSearchResults(data);
    } catch { setSOSearchResults([]); }
    finally { setSOSearchLoading(false); }
  };

  const handleLinkSalesOrder = async (soNumber?: string) => {
    const number = (soNumber ?? linkSONumber).trim();
    if (!selectedPO || !number) return;
    setLinkingSONumber(true);
    try {
      const { data } = await axios.patch<{ sales_order_no: string; sales_order_id: string | null }>(
        `${API_URL}/vendor_po/${selectedPO}/sales_order_no`,
        { sales_order_no: number },
      );
      toast.success(`Sales order ${data.sales_order_no} linked`);
      setPoList(prev => prev.map(p => p.po_number === selectedPO ? { ...p, sales_order_no: data.sales_order_no, sales_order_id: data.sales_order_id ?? undefined } : p));
      setLinkSOOpen(false);
      setLinkSONumber('');
      setSOSearchResults([]);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to link sales order';
      toast.error(msg);
    } finally { setLinkingSONumber(false); }
  };

  // ─── render ──────────────────────────────────────────────────────────────────

  const invDateLabel = report?.inventory_date ?? 'Latest';
  const zohoDateLabel = report?.zoho_stock_date ?? 'Latest';

  const drrLabel = useMemo(() => {
    if (!report?.po_date) return 'Final DRR';
    const end = new Date(report.po_date + 'T00:00:00');
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    const f = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Final DRR (${f(start)} – ${f(end)})`;
  }, [report?.po_date]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Vendor Central POs</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Upload and manage Vendor Central purchase orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBulkUpdateOpen(o => !o); setUploadOpen(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            Bulk Update
            {bulkUpdateOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => { setUploadOpen(o => !o); setBulkUpdateOpen(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            Upload PO
            {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Upload Form ── */}
      {uploadOpen && (
        <div className={TABLE_CLASSES.container + ' p-6'}>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-600" />
            Upload New Purchase Order
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            If the PO number already exists and its status is <strong>pending / processing / packed / closed</strong>, the record will be re-enriched and accepted/received quantities preserved.
          </p>
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

      {/* ── Bulk Update Form ── */}
      {bulkUpdateOpen && (
        <div className={TABLE_CLASSES.container + ' p-6'}>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
            <RefreshCw size={18} className="text-amber-600" />
            Bulk Update Purchase Orders
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Upload an Excel file with columns: <strong>PO Number | ASIN | Accepted Qty | Received Qty | PO Status</strong> (header row required). Only POs with status <strong>pending / processing / packed / closed</strong> will be updated. PO Status is optional.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Bulk Update Excel File</label>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={(e) => setBulkFiles(e.target.files ? Array.from(e.target.files) : [])}
                className="block w-full text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-900/30 dark:file:text-amber-400"
              />
              {bulkFiles.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">{bulkFiles.length} file{bulkFiles.length > 1 ? 's' : ''} selected</p>
              )}
            </div>
            <button
              onClick={handleBulkUpdate}
              disabled={bulkUploading || bulkFiles.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {bulkUploading ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
              {bulkUploading ? 'Updating…' : 'Upload & Update'}
            </button>
          </div>
        </div>
      )}

      {/* ── Status behaviour info ── */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <p className="font-semibold">Stock &amp; sales data freezes when status changes to <span className="underline">processing</span> (or any later status).</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
          <li><span className="font-medium">Zoho Stock</span> — taken on PO date. <span className="font-medium">Current Stock</span> — taken at T‑2 (2 days before PO date, Amazon lag).</li>
          <li><span className="font-medium">Open PO</span> — sum of other POs for the same ASIN in statuses: <span className="font-medium">processing</span> (uses supply qty) and <span className="font-medium">packed / closed / intransit</span> (uses accepted qty). Delivered &amp; completed POs are excluded.</li>
        </ul>
        <p className="text-blue-600 dark:text-blue-500 pt-0.5">Pending POs always show live T‑2 data. Once set to processing or beyond, all figures are locked permanently.</p>
      </div>

      {/* ── PO List ── */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection + ' flex items-center justify-between flex-wrap gap-2'}>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Purchase Orders</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search PO number…"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
              />
            </div>
            {selectedForDownload.size > 0 && (
              <button
                onClick={handleBulkDownload}
                disabled={bulkDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Download size={13} />
                {bulkDownloading ? 'Downloading…' : `Download ${selectedForDownload.size} PO${selectedForDownload.size > 1 ? 's' : ''}`}
              </button>
            )}
            <button onClick={fetchList} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors">
              <RefreshCw size={15} className={listLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {listLoading && <LoadingState message="Loading purchase orders…" />}
        {listError && <ErrorState error={listError} onRetry={fetchList} />}
        {!listLoading && !listError && poList.length === 0 && (
          <div className="py-12 text-center text-zinc-400 text-sm">No purchase orders found. Upload your first PO above.</div>
        )}
        {!listLoading && !listError && poList.length > 0 && (() => {
          const totalPages = Math.ceil(filteredPoList.length / PAGE_SIZE);
          const pageItems = filteredPoList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
          const allSelected = filteredPoList.length > 0 && filteredPoList.every(p => selectedForDownload.has(p.po_number));
          const someSelected = selectedForDownload.size > 0 && !allSelected;
          return (
            <>
              {filteredPoList.length === 0 && (
                <div className="py-10 text-center text-zinc-400 text-sm">No POs match &quot;{poSearch}&quot;.</div>
              )}
              {filteredPoList.length > 0 && <div className={TABLE_CLASSES.overflow}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.thead}>
                    <tr>
                      <th className={TABLE_CLASSES.th}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected; }}
                          onChange={() => toggleSelectAll()}
                          className="rounded border-zinc-300 text-blue-600"
                          title={allSelected ? 'Deselect all' : `Select all ${poList.length} POs`}
                        />
                      </th>
                      {['PO Number', 'Vendor', 'PO Date', 'Items', 'Requested Qty', 'Supply Qty', 'Accepted Qty', 'Received Qty', 'Total Cost (Supply Qty)', 'Total cost w/o GST (Supply Qty)', 'Total Cost (Accepted Qty)', 'Total cost w/o GST (Accepted Qty)', 'Status', 'Uploaded At', 'Estimate', 'Sales Order', 'Packages', 'Transfer Order', 'Assembly', 'Order File', 'Actions'].map(h => (
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
                          <input
                            type="checkbox"
                            checked={selectedForDownload.has(po.po_number)}
                            onChange={() => toggleSelectForDownload(po.po_number)}
                            className="rounded border-zinc-300 text-blue-600"
                          />
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          <span className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-400">{po.po_number}</span>
                        </td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{po.vendor || '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{po.po_date}</span></td>
                        <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{po.item_count}</span></td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fmtInt(po.total_requested_qty)}</span></td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fmtInt(po.total_supply_qty)}</span></td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fmtInt(po.total_accepted_qty)}</span></td>
                        <td className={TABLE_CLASSES.td}>
                          <POListReceivedQtyCell poNumber={po.po_number} value={po.total_received_qty} onSaved={handlePOReceivedQtySaved} />
                        </td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{po.total_cost != null ? `₹${fmt(po.total_cost)}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{po.total_cost_gst != null ? `₹${fmt(po.total_cost_gst)}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{po.accepted_total_cost != null ? `₹${fmt(po.accepted_total_cost)}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{po.accepted_total_cost_gst != null ? `₹${fmt(po.accepted_total_cost_gst)}` : '—'}</span></td>
                        <td className={TABLE_CLASSES.td}>
                          <select
                            value={po.po_status}
                            onChange={(e) => handleStatusChange(po.po_number, e.target.value, po.po_status)}
                            className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="packed">Packed</option>
                            <option value="closed">Closed</option>
                            <option value="intransit">Intransit</option>
                            <option value="delivered">Delivered</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className={TABLE_CLASSES.td}><span className="text-xs text-zinc-500">{new Date(po.created_at).toLocaleDateString('en-IN')}</span></td>
                        <td className={TABLE_CLASSES.td}>
                          {po.estimate_number ? (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-mono whitespace-nowrap">
                              {po.estimate_number}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {po.sales_order_no ? (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-mono whitespace-nowrap">
                              {po.sales_order_no}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {po.so_packages === undefined || po.so_packages === null ? (
                            <span className="text-xs text-zinc-400">—</span>
                          ) : po.so_packages.length === 0 ? (
                            <span className="text-xs text-zinc-400">—</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {po.so_packages.map((pkg, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono whitespace-nowrap">
                                  {pkg}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {po.transfer_order_number ? (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800 font-mono whitespace-nowrap">
                              {po.transfer_order_number}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {(po.assembly_numbers ?? []).length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {(po.assembly_numbers ?? []).map((an, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono whitespace-nowrap">
                                  {an}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {po.order_file_s3_key ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={async () => {
                                  try {
                                    const { data } = await axios.get<{ url: string }>(`${API_URL}/vendor_po/${po.po_number}/order_file`);
                                    window.open(data.url, '_blank');
                                  } catch {
                                    toast.error('Failed to get download link');
                                  }
                                }}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 dark:text-green-400"
                              >
                                <ExternalLink size={11} />
                                Download
                              </button>
                              <button
                                onClick={() => setDeleteOrderFilePO(po.po_number)}
                                className="p-0.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                                title="Delete order file"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => selectedPO === po.po_number ? setSelectedPO(null) : fetchReport(po.po_number)}
                              className="px-3 py-1 text-xs font-medium rounded border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              {selectedPO === po.po_number ? 'Hide' : 'View'}
                            </button>
                            <button
                              onClick={() => { setUploadOrderPO(po.po_number); setOrderFile(null); if (orderFileInputRef.current) orderFileInputRef.current.value = ''; }}
                              className="p-1 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
                              title="Upload Order (POItemExport)"
                            >
                              <FileUp size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmPO(po.po_number)}
                              className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                              title="Delete PO"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPoList.length)} of {filteredPoList.length} POs
                  </span>
                  <div className="flex items-center gap-1.5">
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
                    <span className="text-xs text-zinc-400 mx-1">|</span>
                    <span className="text-xs text-zinc-500">Go to</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpPage}
                      onChange={(e) => setJumpPage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const p = parseInt(jumpPage, 10) - 1;
                          if (!isNaN(p) && p >= 0 && p < totalPages) { setPage(p); setJumpPage(''); }
                        }
                      }}
                      placeholder={String(page + 1)}
                      className="w-12 px-1 py-1 text-xs border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const p = parseInt(jumpPage, 10) - 1;
                        if (!isNaN(p) && p >= 0 && p < totalPages) { setPage(p); setJumpPage(''); }
                      }}
                      className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Delete Purchase Order</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Are you sure you want to delete PO{' '}
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{deleteConfirmPO}</span>?
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-5">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmPO(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmPO)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Order File Modal ── */}
      {deleteOrderFilePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Delete Order File</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Delete the uploaded order file for PO{' '}
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{deleteOrderFilePO}</span>?
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-5">This will remove the file from S3 and cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteOrderFilePO(null)}
                disabled={deletingOrderFile}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteOrderFile(deleteOrderFilePO)}
                disabled={deletingOrderFile}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingOrderFile ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deletingOrderFile ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Order Modal ── */}
      {uploadOrderPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <FileUp size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Upload Order File</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{uploadOrderPO}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Upload the <strong>POItemExport .xls</strong> from Amazon Vendor Central. The backend will fill in
              <strong> Accepted quantity</strong> and <strong>Availability</strong> based on the stored accepted qtys,
              save the completed file to S3, and download it for you.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">POItemExport .xls File</label>
              <input
                ref={orderFileInputRef}
                type="file"
                accept=".xls"
                onChange={(e) => setOrderFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 dark:file:bg-purple-900/30 dark:file:text-purple-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setUploadOrderPO(null); setOrderFile(null); }}
                disabled={uploadingOrder}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadOrder}
                disabled={uploadingOrder || !orderFile}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploadingOrder ? <RefreshCw size={13} className="animate-spin" /> : <FileUp size={13} />}
                {uploadingOrder ? 'Processing…' : 'Upload & Download'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              {report && (report.estimate_number ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-mono">
                    <FileText size={12} />
                    {report.estimate_number}
                  </span>
                  <button
                    onClick={handleUnlinkEstimate}
                    disabled={unlinkingEstimate}
                    title="Unlink estimate"
                    className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors disabled:opacity-50"
                  >
                    {unlinkingEstimate ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={openCreateEstimateModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                  >
                    <FileText size={13} />
                    Create Estimate
                  </button>
                  <button
                    onClick={() => { setLinkEstimateOpen(true); setLinkEstimateNumber(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Link2 size={13} />
                    Link Estimate
                  </button>
                </>
              ))}
              {report && (() => {
                const currentPO = poList.find(p => p.po_number === selectedPO);
                return currentPO?.sales_order_no ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-mono">
                      {currentPO.sales_order_no}
                    </span>
                    <button
                      onClick={() => { setLinkSOOpen(true); setLinkSONumber(currentPO.sales_order_no ?? ''); setSOSearchResults([]); }}
                      title="Edit sales order"
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition-colors"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setLinkSOOpen(true); setLinkSONumber(''); setSOSearchResults([]); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Link2 size={13} />
                    Link Sales Order
                  </button>
                );
              })()}
              {report && (() => {
                const currentPO = poList.find(p => p.po_number === selectedPO);
                const pkgs = currentPO?.so_packages;
                if (pkgs === undefined || pkgs === null || pkgs.length === 0) {
                  return <span className="text-xs text-zinc-400 py-1.5">—</span>;
                }
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {pkgs.map((pkg) => (
                      <span key={pkg} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono">
                        <Package size={12} />
                        {pkg}
                      </span>
                    ))}
                  </div>
                );
              })()}
              {report && (() => {
                const currentPO = poList.find(p => p.po_number === selectedPO);
                if (!(currentPO?.so_packages ?? []).length) return null;
                return currentPO?.transfer_order_number ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 font-mono">
                      <ExternalLink size={12} />
                      {currentPO.transfer_order_number}
                    </span>
                    <button
                      onClick={handleUnlinkTransferOrder}
                      disabled={unlinkingTO}
                      title="Unlink transfer order"
                      className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors disabled:opacity-50"
                    >
                      {unlinkingTO ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setCreateTOOpen(true); setToDate(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors"
                    >
                      <ExternalLink size={13} />
                      Create Transfer Order
                    </button>
                    <button
                      onClick={() => { setLinkTOOpen(true); setLinkTONumber(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Link2 size={13} />
                      Link Transfer Order
                    </button>
                  </>
                );
              })()}
              {report && (() => {
                const currentPO = poList.find(p => p.po_number === selectedPO);
                if (!currentPO?.transfer_order_number) return null;
                const assemblyNumbers = currentPO.assembly_numbers ?? [];
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {assemblyNumbers.map((an, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono">
                        <ExternalLink size={12} />
                        {an}
                      </span>
                    ))}
                    {assemblyNumbers.length === 0 && (
                      <button
                        onClick={handleCreateAssemblies}
                        disabled={creatingAssemblies}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {creatingAssemblies ? <RefreshCw size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                        Create Assembly
                      </button>
                    )}
                    <button
                      onClick={() => { setLinkAssemblyOpen(true); setLinkAssemblyNumber(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Link2 size={13} />
                      Link Assembly
                    </button>
                    {assemblyNumbers.length > 0 && (
                      <button
                        onClick={handleUnlinkAssemblies}
                        disabled={unlinkingAssemblies}
                        title="Unlink all assemblies"
                        className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors disabled:opacity-50"
                      >
                        {unlinkingAssemblies ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Tabs */}
          {report && !reportLoading && (
            <div className="flex gap-1 px-1 pt-2 border-b border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setReportTab('report')}
                className={`px-4 py-2 text-xs font-medium rounded-t transition-colors ${reportTab === 'report' ? 'bg-white dark:bg-zinc-900 border border-b-white dark:border-zinc-700 dark:border-b-zinc-900 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Report
              </button>
              {report.estimate_number && (
                <button
                  onClick={() => { setReportTab('estimate_diff'); if (!estimateDiff && !diffLoading) fetchEstimateDiff(report.po_number); }}
                  className={`px-4 py-2 text-xs font-medium rounded-t transition-colors ${reportTab === 'estimate_diff' ? 'bg-white dark:bg-zinc-900 border border-b-white dark:border-zinc-700 dark:border-b-zinc-900 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  Estimate Comparison
                </button>
              )}
              {(poList.find(p => p.po_number === selectedPO)?.so_packages ?? []).length > 0 && (
                <button
                  onClick={() => { setReportTab('package_breakdown'); if (!packageBreakdown && !pkgBreakdownLoading) fetchPackageBreakdown(report.po_number); }}
                  className={`px-4 py-2 text-xs font-medium rounded-t transition-colors ${reportTab === 'package_breakdown' ? 'bg-white dark:bg-zinc-900 border border-b-white dark:border-zinc-700 dark:border-b-zinc-900 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  Package Breakdown
                </button>
              )}
            </div>
          )}

          {reportLoading && <LoadingState message="Generating report…" />}
          {reportError && <ErrorState error={reportError} onRetry={() => fetchReport(selectedPO)} />}

          {report && !reportLoading && reportTab === 'estimate_diff' && (
            <div className="p-4 space-y-4">
              {diffLoading && <LoadingState message="Loading estimate comparison…" />}
              {diffError && <ErrorState error={diffError} onRetry={() => fetchEstimateDiff(report.po_number)} />}
              {estimateDiff && !diffLoading && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'PO Computed Total', value: estimateDiff.po_computed_total },
                      { label: 'Estimate Sub-Total', value: estimateDiff.estimate_sub_total },
                      { label: 'PO Computed Total w/ GST', value: estimateDiff.po_computed_total_gst },
                      { label: 'Estimate Total', value: estimateDiff.estimate_total },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {value != null ? `₹${fmt(value)}` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      Total diff (w/o GST):{' '}
                      <strong className={(estimateDiff.estimate_sub_total ?? 0) - (estimateDiff.po_computed_total ?? 0) === 0 ? 'text-green-600' : 'text-red-500'}>
                        ₹{fmt((estimateDiff.estimate_sub_total ?? 0) - (estimateDiff.po_computed_total ?? 0))}
                      </strong>
                    </span>
                    <span>
                      {estimateDiff.items.filter(i => !i.in_estimate && i.supply_qty > 0).length} item(s) with supply qty &gt; 0 missing from estimate
                    </span>
                    {estimateDiff.only_in_estimate.length > 0 && (
                      <span>{estimateDiff.only_in_estimate.length} item(s) only in estimate</span>
                    )}
                  </div>

                  {/* Per-item table */}
                  <div className={TABLE_CLASSES.overflow}>
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                        <tr>
                          {['Model No.', 'Title', 'PO Supply Qty', 'PO Rate', 'PO Item Total', 'In Estimate', 'Est Qty', 'Est Rate', 'Est Item Total', 'Qty Diff', 'Rate Diff', 'Total Diff'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap border-b border-zinc-200 dark:border-zinc-700">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {estimateDiff.items.map((row, idx) => {
                          const missing = !row.in_estimate && row.supply_qty > 0;
                          const hasDiff = row.in_estimate && (row.qty_diff !== 0 || (row.rate_diff != null && Math.abs(row.rate_diff) > 0.01));
                          return (
                            <tr key={idx} className={`transition-colors ${missing ? 'bg-red-50 dark:bg-red-900/10' : hasDiff ? 'bg-amber-50 dark:bg-amber-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}>
                              <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{row.model_number}</td>
                              <td className="px-3 py-2 max-w-xs truncate text-zinc-800 dark:text-zinc-200" title={row.title}>{row.title}</td>
                              <td className="px-3 py-2 text-center font-semibold">{row.supply_qty}</td>
                              <td className="px-3 py-2 text-right">{row.po_rate != null ? `₹${fmt(row.po_rate)}` : '—'}</td>
                              <td className="px-3 py-2 text-right">{row.po_item_total != null ? `₹${fmt(row.po_item_total)}` : '—'}</td>
                              <td className="px-3 py-2 text-center">
                                {row.in_estimate
                                  ? <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">Yes</span>
                                  : <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">No</span>}
                              </td>
                              <td className="px-3 py-2 text-center">{row.estimate_qty ?? '—'}</td>
                              <td className="px-3 py-2 text-right">{row.estimate_rate != null ? `₹${fmt(row.estimate_rate)}` : '—'}</td>
                              <td className="px-3 py-2 text-right">{row.estimate_item_total != null ? `₹${fmt(row.estimate_item_total)}` : '—'}</td>
                              <td className={`px-3 py-2 text-center font-semibold ${row.qty_diff != null && row.qty_diff !== 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                {row.qty_diff != null ? (row.qty_diff > 0 ? `+${row.qty_diff}` : row.qty_diff) : '—'}
                              </td>
                              <td className={`px-3 py-2 text-right ${row.rate_diff != null && Math.abs(row.rate_diff) > 0.01 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}`}>
                                {row.rate_diff != null && Math.abs(row.rate_diff) > 0.01 ? `₹${fmt(row.rate_diff)}` : '—'}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${row.total_diff != null && row.total_diff !== 0 ? (row.total_diff > 0 ? 'text-red-500' : 'text-green-600') : ''}`}>
                                {row.total_diff != null && row.total_diff !== 0 ? `₹${fmt(row.total_diff)}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Items only in estimate */}
                  {estimateDiff.only_in_estimate.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Items in estimate but not in PO</h4>
                      <div className={TABLE_CLASSES.overflow}>
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                            <tr>
                              {['SKU', 'Name', 'Qty', 'Rate', 'Item Total'].map(h => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {estimateDiff.only_in_estimate.map((row, idx) => (
                              <tr key={idx} className="bg-amber-50 dark:bg-amber-900/10">
                                <td className="px-3 py-2 font-mono">{row.sku}</td>
                                <td className="px-3 py-2 max-w-xs truncate" title={row.name}>{row.name}</td>
                                <td className="px-3 py-2 text-center">{row.quantity}</td>
                                <td className="px-3 py-2 text-right">{row.rate != null ? `₹${fmt(row.rate)}` : '—'}</td>
                                <td className="px-3 py-2 text-right">{row.item_total != null ? `₹${fmt(row.item_total)}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {report && !reportLoading && reportTab === 'package_breakdown' && (
            <div className="p-4 space-y-4">
              {pkgBreakdownLoading && <LoadingState message="Loading package breakdown…" />}
              {pkgBreakdownError && <ErrorState error={pkgBreakdownError} onRetry={() => fetchPackageBreakdown(report.po_number)} />}
              {packageBreakdown && !pkgBreakdownLoading && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Package', value: packageBreakdown.package_number, isText: true },
                      { label: 'Line Items', value: packageBreakdown.items.length, isInt: true },
                      { label: 'Accepted Total Cost', value: packageBreakdown.accepted_total_cost },
                      { label: 'Accepted Total Cost w/ GST', value: packageBreakdown.accepted_total_cost_gst },
                    ].map(({ label, value, isText, isInt }) => (
                      <div key={label} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 font-mono">
                          {isText ? value : isInt ? fmtInt(value as number) : (value != null ? `₹${fmt(value as number)}` : '—')}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Per-item table */}
                  <div className={TABLE_CLASSES.overflow}>
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                        <tr>
                          {['SKU', 'Name', 'ASIN', 'Accepted Qty', 'eTrade ASP', 'GST %', 'MRP w/o GST', 'Margin %', 'Unit Cost', 'Item Total', 'Item Total w/ GST'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap border-b border-zinc-200 dark:border-zinc-700">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {packageBreakdown.items.map((row, idx) => (
                          <tr key={idx} className={`transition-colors ${row.item_total == null ? 'bg-amber-50 dark:bg-amber-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}>
                            <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{row.sku}</td>
                            <td className="px-3 py-2 max-w-xs truncate text-zinc-800 dark:text-zinc-200" title={row.name}>{row.name || '—'}</td>
                            <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{row.asin || '—'}</td>
                            <td className="px-3 py-2 text-center font-semibold">{fmtInt(row.qty)}</td>
                            <td className="px-3 py-2 text-right">{row.etrade_asp != null ? `₹${fmt(row.etrade_asp)}` : '—'}</td>
                            <td className="px-3 py-2 text-center">{row.gst ? `${row.gst}%` : '—'}</td>
                            <td className="px-3 py-2 text-right">{row.mrp_wo_gst != null ? `₹${fmt(row.mrp_wo_gst)}` : '—'}</td>
                            <td className="px-3 py-2 text-center">{row.margin != null ? `${fmt(row.margin)}%` : '—'}</td>
                            <td className="px-3 py-2 text-right">{row.unit_cost != null ? `₹${fmt(row.unit_cost, 4)}` : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold">{row.item_total != null ? `₹${fmt(row.item_total)}` : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold">{row.item_total_gst != null ? `₹${fmt(row.item_total_gst)}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50">
                        <tr>
                          <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 text-right">Total</td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {packageBreakdown.accepted_total_cost != null ? `₹${fmt(packageBreakdown.accepted_total_cost)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {packageBreakdown.accepted_total_cost_gst != null ? `₹${fmt(packageBreakdown.accepted_total_cost_gst)}` : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {report && !reportLoading && reportTab === 'report' && (
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
                      { label: 'Requested Qty', yellow: true },
                      { label: 'Supply Qty', yellow: false },
                      { label: 'Accepted Qty', yellow: false },
                      { label: 'Received Qty', yellow: false },
                      { label: 'Zoho MRP', yellow: true },
                      { label: 'eTrade ASP', yellow: false },
                      { label: 'GST %', yellow: true },
                      { label: 'MRP w/o GST', yellow: true },
                      { label: 'Margin %', yellow: true },
                      { label: 'Cost Price w/o Tax', yellow: true },
                      { label: 'Total Cost (Supply Qty)', yellow: true },
                      { label: 'Total cost w/o GST (Supply Qty)', yellow: true },
                      { label: 'Total Cost (Accepted Qty)', yellow: true },
                      { label: 'Total cost w/o GST (Accepted Qty)', yellow: true },
                      { label: 'HSN', yellow: true },
                      { label: 'Etrade Unit Cost', yellow: true },
                      { label: 'Diff', yellow: true },
                      { label: `Zoho Stock (${zohoDateLabel})`, yellow: true },
                      { label: 'Status', yellow: true },
                      { label: `Current Stock (${invDateLabel})`, yellow: true },
                      { label: 'Open PO', yellow: true },
                      { label: 'Total Qty', yellow: true },
                      { label: drrLabel, yellow: true },
                      { label: 'Net Total Days', yellow: true },
                      { label: 'Lead Time', yellow: true },
                      { label: 'Coverage Days', yellow: true },
                      { label: 'Total Target Days', yellow: true },
                      { label: 'Target Stock', yellow: true },
                      { label: 'Final Units (For Under-ordering)', yellow: true },
                      { label: 'Final Supply Qty (For Over-ordering)', yellow: true },
                      ...(report.items[0]?.month_labels ?? []).map(([,, lbl]: [number, number, string]) => ({ label: lbl, yellow: true })),
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
                        <td className="px-3 py-2">
                          <SupplyQtyCell
                            poNumber={report.po_number}
                            asin={item.asin}
                            value={item.final_supply_fo ?? item.final_supply_qty ?? item.supply_qty ?? 0}
                            isOverride={item.supply_qty_override != null || item.final_supply_fo_override != null}
                            onSaved={handleSupplyQtySaved}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <AcceptedQtyCell poNumber={report.po_number} asin={item.asin} value={item.accepted_qty} onSaved={handleAcceptedQtySaved} />
                        </td>
                        <td className="px-3 py-2">
                          <ReceivedQtyCell poNumber={report.po_number} asin={item.asin} value={item.received_qty} onSaved={handleReceivedQtySaved} />
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">₹{fmt(item.zoho_mrp, 0)}</td>
                        <td className="px-3 py-2">
                          <EtradeAspCell asin={item.asin} value={item.etrade_asp} onSaved={handleEtradeAspSaved} />
                        </td>
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
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                          {item.total_cost_accepted != null ? `₹${fmt(item.total_cost_accepted)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                          {item.total_cost_accepted_gst != null ? `₹${fmt(item.total_cost_accepted_gst)}` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{item.hsn || '—'}</td>
                        <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">₹{item.etrade_unit_cost.toFixed(2)}</td>
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
                        <td className="px-3 py-2">
                          <OpenQtyCell
                            poNumber={report.po_number}
                            asin={item.asin}
                            value={item.open_po}
                            isOverride={item.open_po_override != null}
                            onSaved={handleOpenQtySaved}
                          />
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-zinc-100">{fmtInt(item.total_qty)}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">
                          {item.final_drr != null
                            ? item.final_drr.toFixed(3)
                            : item.final_drr_flag
                              ? <span className="text-amber-600 dark:text-amber-400 text-xs">{item.final_drr_flag}</span>
                              : '—'}
                        </td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">
                          {item.net_total_days != null ? item.net_total_days.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <LeadTimeCell poNumber={report.po_number} asin={item.asin} value={item.lead_time} isOverride={item.lead_time_override != null} onSaved={handleLeadTimeSaved} />
                        </td>
                        <td className="px-3 py-2">
                          <CoverageDaysCell poNumber={report.po_number} asin={item.asin} value={item.coverage_days} isOverride={item.coverage_days_override != null} onSaved={handleCoverageDaysSaved} />
                        </td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{item.total_target_days}</td>
                        <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{fmtInt(item.target_stock)}</td>
                        <td className="px-3 py-2">
                          <FinalUnitsCell poNumber={report.po_number} asin={item.asin} value={item.final_units} isOverride={item.final_units_override != null} onSaved={handleFinalUnitsSaved} />
                        </td>
                        <td className="px-3 py-2">
                          <FinalSupplyFOCell poNumber={report.po_number} asin={item.asin} value={item.final_supply_fo} isOverride={item.final_supply_fo_override != null} onSaved={handleFinalSupplyFOSaved} />
                        </td>
                        {(item.monthly_sales ?? []).map((units, mi) => (
                          <td key={mi} className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{fmtInt(units)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Create Estimate Modal ── */}
      {createEstimateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                <FileText size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Create Zoho Estimate</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedPO}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Creates an estimate in Zoho Books for <strong>all PO items</strong> — items with Final Supply Qty = 0 appear on the estimate with quantity 0.
              Customer is fixed to <strong>ETRADE MARKETING PRIVATE LIMITED</strong>.
              Reference number will be the PO number.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Estimate Date</label>
                <input
                  type="date"
                  value={estimateDate}
                  onChange={e => setEstimateDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Billing Address</label>
                {etradeAddresses.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Loading addresses…</p>
                ) : (
                  <select
                    value={billingAddressId}
                    onChange={e => setBillingAddressId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {etradeAddresses.map(addr => (
                      <option key={addr.address_id} value={addr.address_id}>
                        {addr.attention || addr.city} — {addr.address}{addr.city ? `, ${addr.city}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Shipping Address</label>
                {etradeAddresses.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Loading addresses…</p>
                ) : (
                  <select
                    value={shippingAddressId}
                    onChange={e => setShippingAddressId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {etradeAddresses.map(addr => (
                      <option key={addr.address_id} value={addr.address_id}>
                        {addr.attention || addr.city} — {addr.address}{addr.city ? `, ${addr.city}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setCreateEstimateOpen(false)}
                disabled={creatingEstimate}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEstimate}
                disabled={creatingEstimate || !billingAddressId || !shippingAddressId}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creatingEstimate ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
                {creatingEstimate ? 'Creating…' : 'Create Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Estimate Modal ── */}
      {linkEstimateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Link2 size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Link Existing Estimate</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedPO}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Enter the estimate number (e.g. <span className="font-mono">EST/26-27/0457</span>). It must exist in the estimates collection.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Estimate Number</label>
              <input
                type="text"
                value={linkEstimateNumber}
                onChange={e => setLinkEstimateNumber(e.target.value)}
                placeholder="EST/26-27/0457"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter') handleLinkEstimate(); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setLinkEstimateOpen(false); setLinkEstimateNumber(''); }}
                disabled={linkingEstimate}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkEstimate}
                disabled={linkingEstimate || !linkEstimateNumber.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linkingEstimate ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
                {linkingEstimate ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Transfer Order Modal ── */}
      {createTOOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-full">
                <ExternalLink size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Create Transfer Order</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedPO}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Creates a Zoho Inventory transfer order from the linked package&apos;s line items.
              From: <span className="font-medium">Pupscribe Warehouse</span> → To: <span className="font-medium">Mumbai (Amazon)</span>.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date (optional — defaults to today)</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setCreateTOOpen(false); setToDate(''); }}
                disabled={creatingTO}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTransferOrder}
                disabled={creatingTO}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creatingTO ? <RefreshCw size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                {creatingTO ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Transfer Order Modal ── */}
      {linkTOOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-full">
                <Link2 size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Link Transfer Order</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedPO}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Enter the transfer order number (e.g. <span className="font-mono">TO-1000</span>). It must exist in the transfer_orders collection.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Transfer Order Number</label>
              <input
                type="text"
                value={linkTONumber}
                onChange={e => setLinkTONumber(e.target.value)}
                placeholder="TO-1000"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                onKeyDown={e => { if (e.key === 'Enter') handleLinkTransferOrder(); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setLinkTOOpen(false); setLinkTONumber(''); }}
                disabled={linkingTO}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkTransferOrder}
                disabled={linkingTO || !linkTONumber.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linkingTO ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
                {linkingTO ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Assembly Modal ── */}
      {linkAssemblyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                <Link2 size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Link Assembly</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedPO}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Enter the assembly reference number (e.g. <span className="font-mono">Bundle - 16FBA-Jan31</span>). It must exist in the assemblies collection.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Assembly Reference Number</label>
              <input
                type="text"
                value={linkAssemblyNumber}
                onChange={e => setLinkAssemblyNumber(e.target.value)}
                placeholder="Bundle - 16FBA-Jan31"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={e => { if (e.key === 'Enter') handleLinkAssembly(); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setLinkAssemblyOpen(false); setLinkAssemblyNumber(''); }}
                disabled={linkingAssembly}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkAssembly}
                disabled={linkingAssembly || !linkAssemblyNumber.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linkingAssembly ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
                {linkingAssembly ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Sales Order Modal ── */}
      {linkSOOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <FileText size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Link Sales Order</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedPO}</p>
              </div>
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Sales Order Number</label>
              <input
                type="text"
                value={linkSONumber}
                onChange={e => handleSOSearch(e.target.value)}
                placeholder="SO/26-27/0186"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                onKeyDown={e => { if (e.key === 'Enter') handleLinkSalesOrder(); }}
              />
              {soSearchLoading && (
                <div className="absolute right-3 top-8"><RefreshCw size={13} className="animate-spin text-zinc-400" /></div>
              )}
              {soSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {soSearchResults.map(so => (
                    <button
                      key={so.salesorder_number}
                      onClick={() => { handleLinkSalesOrder(so.salesorder_number); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{so.salesorder_number}</span>
                      <span className="ml-2 text-zinc-500">{so.customer_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setLinkSOOpen(false); setLinkSONumber(''); setSOSearchResults([]); }}
                disabled={linkingSONumber}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLinkSalesOrder()}
                disabled={linkingSONumber || !linkSONumber.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linkingSONumber ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
                {linkingSONumber ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
