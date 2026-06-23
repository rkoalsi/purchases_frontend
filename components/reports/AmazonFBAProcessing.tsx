'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Upload, RefreshCw, Trash2, Edit2, Check, X, Download,
  Save, ChevronRight, FileText, Link2, Unlink, AlertCircle, Plus,
  Package, ExternalLink,
} from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState, SearchBar } from './TableStyles';
import AmazonFBAShipmentQueue from './AmazonFBAShipmentQueue';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SHIPMENTS_PER_PAGE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingRow {
  shipment_id: string;
  shipment_name?: string;
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
  _from_queue?: boolean;
}

interface ShipmentGroup {
  rows: ProcessingRow[];
  hasUploaded: boolean;
  shipmentName: string;
  location: string;
  date: string | null;
}

interface DraftEdit {
  packed_qty?: number;
  sp?: number | null;
  cost_price?: number | null;
}

interface EstimateInfo {
  zoho_estimate_id?: string;
  estimate_number?: string;
  sub_total?: number | null;
  total?: number | null;
  status?: string | null;
  sales_order_no?: string | null;
  sales_order_id?: string | null;
  package_number?: string | null;
  estimate_linked_so_number?: string | null;
  so_packages?: string[];
  transfer_order_number?: string | null;
  transfer_order_id?: string | null;
  bundle_ids?: string[];
  assembly_numbers?: string[];
}

interface Warehouse {
  warehouse_id: string;
  warehouse_name: string;
}

interface SalesOrderSearchResult {
  salesorder_number: string;
  salesorder_id: string;
  customer_name?: string;
}

interface EstimateDiffItem {
  sku_code: string;
  asin: string;
  item_name: string;
  processing_qty: number;
  estimate_qty: number | null;
  processing_rate: number;
  estimate_rate: number | null;
  processing_item_total: number;
  estimate_item_total: number | null;
  in_estimate: boolean;
  qty_match: boolean;
  rate_match: boolean;
}

interface EstimateDiff {
  estimate_number: string;
  estimate_sub_total: number | null;
  estimate_total: number | null;
  processing_sub_total: number;
  processing_total: number;
  processing_item_count: number;
  estimate_item_count: number;
  processing_total_qty: number;
  estimate_total_qty: number;
  items: EstimateDiffItem[];
  only_in_estimate: { sku_code: string; item_name: string; estimate_qty: number; estimate_rate: number; estimate_item_total: number }[];
}

interface EtradeAddress {
  address_id: string;
  attention: string;
  address: string;
  city: string;
  state: string;
  zip: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtMoney = (v: number | null | undefined) =>
  v != null ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const EST_STATUS_CLASSES: Record<string, string> = {
  draft:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  sent:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  invoiced: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  declined: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  expired:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const EstStatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return null;
  const cls = EST_STATUS_CLASSES[status.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
};

// True when the shipment has any linked Zoho artifact (estimate, SO, package, TO or assembly)
const hasAnyLink = (d: EstimateInfo | null | undefined): boolean =>
  !!d && (
    !!d.estimate_number ||
    !!d.sales_order_no ||
    !!d.estimate_linked_so_number ||
    !!d.package_number ||
    (d.so_packages?.length ?? 0) > 0 ||
    !!d.transfer_order_number ||
    (d.assembly_numbers?.length ?? 0) > 0
  );

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

  const shortPct = row.short_supply_pct != null ? `${(row.short_supply_pct * 100).toFixed(1)}%` : '—';

  return (
    <tr className={TABLE_CLASSES.tr}>
      <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-600 dark:text-zinc-400'>{row.shipment_id}</span></td>
      <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{fmt(row.shipment_date)}</span></td>
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
      <td className={TABLE_CLASSES.td} style={{ minWidth: 180 }}>
        {editing ? (
          <input type='text' value={draft.reason_for_short_supply ?? ''}
            onChange={e => setDraft(d => ({ ...d, reason_for_short_supply: e.target.value }))}
            className='w-full px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100' />
        ) : <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.reason_for_short_supply || '—'}</span>}
      </td>
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <input type='date' value={draft.appointment_initiated_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, appointment_initiated_date: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100' />
        ) : <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.appointment_initiated_date || '—'}</span>}
      </td>
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <input type='date' value={draft.appointment_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, appointment_date: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100' />
        ) : <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.appointment_date || '—'}</span>}
      </td>
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <input type='date' value={draft.dispatched_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, dispatched_date: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100' />
        ) : <span className='text-sm text-zinc-900 dark:text-zinc-100'>{row.dispatched_date || '—'}</span>}
      </td>
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <select value={draft.status ?? row.status}
            onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
            className='px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none dark:bg-zinc-800 dark:text-zinc-100'>
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
      <td className={TABLE_CLASSES.td}>
        {editing ? (
          <div className='flex items-center gap-1'>
            <button onClick={async () => { await onSave(key, draft); setEditing(false); }} className='p-1 text-green-600 hover:text-green-700'><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className='p-1 text-red-500 hover:text-red-600'><X size={14} /></button>
          </div>
        ) : (
          <button onClick={startEdit} className='p-1 text-zinc-400 hover:text-blue-600 transition-colors'><Edit2 size={14} /></button>
        )}
      </td>
    </tr>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AmazonFBAProcessing() {
  const [activeTab, setActiveTab] = useState<'queue' | 'processing' | 'summary'>('queue');

  // Processing tab state
  const [processing, setProcessing] = useState<ProcessingRow[]>([]);
  const [loadingProc, setLoadingProc] = useState(false);
  const [errorProc, setErrorProc] = useState<string | null>(null);
  const [uploadingProc, setUploadingProc] = useState(false);
  const procFileRef = useRef<HTMLInputElement>(null);
  const requestedEstimatesRef = useRef<Set<string>>(new Set());
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdit>>({});
  const [savingRows, setSavingRows] = useState(false);

  // Accordion search + pagination
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [shipmentPage, setShipmentPage] = useState(1);
  const [rowSearch, setRowSearch] = useState('');

  // Estimate state
  const [estimateByShipment, setEstimateByShipment] = useState<Record<string, EstimateInfo | null>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [etradeCustomer, setEtradeCustomer] = useState<{ contact_id: string; addresses: EtradeAddress[] } | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [estDate, setEstDate] = useState('');
  const [estBillingAddr, setEstBillingAddr] = useState('');
  const [estShippingAddr, setEstShippingAddr] = useState('');
  const [creatingEstimate, setCreatingEstimate] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkEstInput, setLinkEstInput] = useState('');
  const [linkingEstimate, setLinkingEstimate] = useState(false);
  const [estimateDiff, setEstimateDiff] = useState<EstimateDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // ── Fulfilment linking (Sales Order / Transfer Order / Assemblies) ──
  const [linkSOOpen, setLinkSOOpen] = useState(false);
  const [linkSONumber, setLinkSONumber] = useState('');
  const [soSearchResults, setSoSearchResults] = useState<SalesOrderSearchResult[]>([]);
  const [linkingSO, setLinkingSO] = useState(false);

  const [linkPackageOpen, setLinkPackageOpen] = useState(false);
  const [linkPackageNumber, setLinkPackageNumber] = useState('');
  const [linkingPackage, setLinkingPackage] = useState(false);
  const [unlinkingPackage, setUnlinkingPackage] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [createTOOpen, setCreateTOOpen] = useState(false);
  const [linkTOOpen, setLinkTOOpen] = useState(false);
  const [linkTONumber, setLinkTONumber] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [creatingTO, setCreatingTO] = useState(false);
  const [linkingTO, setLinkingTO] = useState(false);
  const [unlinkingTO, setUnlinkingTO] = useState(false);

  const [linkAssemblyOpen, setLinkAssemblyOpen] = useState(false);
  const [linkAssemblyNumber, setLinkAssemblyNumber] = useState('');
  const [creatingAssemblies, setCreatingAssemblies] = useState(false);
  const [linkingAssembly, setLinkingAssembly] = useState(false);
  const [unlinkingAssemblies, setUnlinkingAssemblies] = useState(false);

  // Summary tab state
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loadingSum, setLoadingSum] = useState(false);
  const [errorSum, setErrorSum] = useState<string | null>(null);
  const [searchSum, setSearchSum] = useState('');

  // Reset inline state when switching shipments
  useEffect(() => {
    setDraftEdits({});
    setRowSearch('');
    setEstimateDiff(null);
    setShowDiff(false);
    setShowLinkInput(false);
    setLinkEstInput('');
    setLinkSOOpen(false);
    setLinkSONumber('');
    setSoSearchResults([]);
    setLinkPackageOpen(false);
    setLinkPackageNumber('');
    setCreateTOOpen(false);
    setLinkTOOpen(false);
    setLinkTONumber('');
    setToDate('');
    setLinkAssemblyOpen(false);
    setLinkAssemblyNumber('');
  }, [selectedShipmentId]);
  
  const shipmentGroups = useMemo<Record<string, ShipmentGroup>>(() => {
    const g: Record<string, ShipmentGroup> = {};
    for (const row of processing) {
      if (!g[row.shipment_id]) {
        g[row.shipment_id] = {
          rows: [],
          hasUploaded: false,
          shipmentName: row.shipment_name ?? '',
          location: row.location ?? '',
          date: row.date,
        };
      }
      g[row.shipment_id].rows.push(row);
      if (!row._from_queue) g[row.shipment_id].hasUploaded = true;
    }
    return g;
  }, [processing]);

  // Auto-load estimate chips for all shipments as soon as processing data arrives
  useEffect(() => {
    const toLoad = Object.keys(shipmentGroups).filter(
      sid => !requestedEstimatesRef.current.has(sid),
    );
    if (toLoad.length === 0) return;
    toLoad.forEach(sid => {
      requestedEstimatesRef.current.add(sid);
      axios.get(`${API_URL}/amazon_fba_shipment/processing/${sid}/estimate`)
        .then(res => {
          const data: EstimateInfo = res.data ?? {};
          setEstimateByShipment(prev => ({ ...prev, [sid]: hasAnyLink(data) ? data : null }));
        })
        .catch(() => {
          setEstimateByShipment(prev => ({ ...prev, [sid]: null }));
        });
    });
  }, [shipmentGroups]);

  // ─── Loaders ────────────────────────────────────────────────────────────────

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

  const handleTabChange = useCallback((tab: 'queue' | 'processing' | 'summary') => {
    setActiveTab(tab);
    if (tab === 'processing') loadProcessing();
    if (tab === 'summary') loadSummary();
  }, [loadProcessing, loadSummary]);

  const handleOpenFromQueue = useCallback((shipmentId: string, _shipmentName: string) => {
    setSelectedShipmentId(shipmentId);
    handleTabChange('processing');
  }, [handleTabChange]);

  // ─── Estimate helpers ───────────────────────────────────────────────────────

  const handleToggleShipment = useCallback((sid: string) => {
    const next = selectedShipmentId === sid ? null : sid;
    setSelectedShipmentId(next);
    setShipmentPage(1);
  }, [selectedShipmentId]);

  const openCreateModal = useCallback(async () => {
    setShowCreateModal(true);
    setEstDate(new Date().toISOString().slice(0, 10));
    if (!etradeCustomer) {
      setLoadingAddresses(true);
      try {
        const res = await axios.get(`${API_URL}/vendor_po/etrade_customer`);
        setEtradeCustomer(res.data);
        const addrs: EtradeAddress[] = res.data.addresses ?? [];
        if (addrs.length > 0) {
          setEstBillingAddr(addrs[0].address_id);
          setEstShippingAddr(addrs[0].address_id);
        }
      } catch {
        toast.error('Failed to load customer addresses');
      } finally {
        setLoadingAddresses(false);
      }
    }
  }, [etradeCustomer]);

  const handleCreateEstimate = useCallback(async () => {
    if (!selectedShipmentId || !estBillingAddr || !estShippingAddr) return;
    setCreatingEstimate(true);
    try {
      const res = await axios.post(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/estimate`,
        { billing_address_id: estBillingAddr, shipping_address_id: estShippingAddr, date: estDate },
      );
      const data = res.data;
      toast.success(`Estimate ${data.estimate_number} created`);
      setEstimateByShipment(prev => ({
        ...prev,
        [selectedShipmentId]: {
          zoho_estimate_id: data.estimate_id,
          estimate_number: data.estimate_number,
          sub_total: data.sub_total,
          total: data.total,
          status: data.status,
        },
      }));
      setShowCreateModal(false);
      if (data.skipped_items?.length) {
        toast.warn(`Skipped ${data.skipped_items.length} item(s): ${data.skipped_items.slice(0, 3).join(', ')}`);
      }
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to create estimate' : 'Failed to create estimate');
    } finally {
      setCreatingEstimate(false);
    }
  }, [selectedShipmentId, estBillingAddr, estShippingAddr, estDate]);

  const handleLinkEstimate = useCallback(async () => {
    if (!selectedShipmentId || !linkEstInput.trim()) return;
    setLinkingEstimate(true);
    try {
      const res = await axios.put(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/estimate`,
        { estimate_number: linkEstInput.trim() },
      );
      const data = res.data;
      toast.success(`Linked estimate ${data.estimate_number}`);
      setEstimateByShipment(prev => ({
        ...prev,
        [selectedShipmentId]: {
          zoho_estimate_id: data.zoho_estimate_id,
          estimate_number: data.estimate_number,
          sub_total: data.sub_total,
          total: data.total,
        },
      }));
      setShowLinkInput(false);
      setLinkEstInput('');
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to link estimate' : 'Failed to link estimate');
    } finally {
      setLinkingEstimate(false);
    }
  }, [selectedShipmentId, linkEstInput]);

  const handleUnlinkEstimate = useCallback(async () => {
    if (!selectedShipmentId) return;
    if (!confirm('Remove the estimate link from this shipment?')) return;
    try {
      await axios.delete(`${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/estimate`);
      toast.success('Estimate unlinked');
      setEstimateByShipment(prev => ({ ...prev, [selectedShipmentId]: null }));
      setEstimateDiff(null);
      setShowDiff(false);
    } catch {
      toast.error('Failed to unlink estimate');
    }
  }, [selectedShipmentId]);

  const handleLoadDiff = useCallback(async () => {
    if (!selectedShipmentId) return;
    setLoadingDiff(true);
    try {
      const res = await axios.get(`${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/estimate_diff`);
      setEstimateDiff(res.data);
      setShowDiff(true);
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to load breakdown' : 'Failed to load breakdown');
    } finally {
      setLoadingDiff(false);
    }
  }, [selectedShipmentId]);

  // ─── Fulfilment: Sales Order / Transfer Order / Assemblies ──────────────────

  const patchEst = useCallback((sid: string, updates: Partial<EstimateInfo>) => {
    setEstimateByShipment(prev => ({ ...prev, [sid]: { ...(prev[sid] ?? {}), ...updates } }));
  }, []);

  // Sales order search (reuses the vendor_po search endpoint)
  useEffect(() => {
    if (!linkSOOpen) return;
    const q = linkSONumber.trim();
    if (!q) { setSoSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get<SalesOrderSearchResult[]>(
          `${API_URL}/vendor_po/search/sales_orders`, { params: { q } },
        );
        setSoSearchResults(data ?? []);
      } catch { setSoSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [linkSONumber, linkSOOpen]);

  const handleLinkSO = useCallback(async () => {
    if (!selectedShipmentId || !linkSONumber.trim()) return;
    setLinkingSO(true);
    try {
      const { data } = await axios.patch<{ sales_order_no: string; sales_order_id: string | null }>(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/sales_order_no`,
        { sales_order_no: linkSONumber.trim() },
      );
      toast.success(`Sales order ${data.sales_order_no} linked`);
      patchEst(selectedShipmentId, { sales_order_no: data.sales_order_no, sales_order_id: data.sales_order_id });
      setLinkSOOpen(false);
      setLinkSONumber('');
      setSoSearchResults([]);
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to link sales order' : 'Failed to link sales order');
    } finally {
      setLinkingSO(false);
    }
  }, [selectedShipmentId, linkSONumber, patchEst]);

  const handleLinkPackage = useCallback(async () => {
    if (!selectedShipmentId || !linkPackageNumber.trim()) return;
    setLinkingPackage(true);
    try {
      const { data } = await axios.patch<{ package_number: string }>(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/package`,
        { package_number: linkPackageNumber.trim() },
      );
      toast.success(`Package ${data.package_number} linked`);
      patchEst(selectedShipmentId, { package_number: data.package_number });
      setLinkPackageOpen(false);
      setLinkPackageNumber('');
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to link package' : 'Failed to link package');
    } finally {
      setLinkingPackage(false);
    }
  }, [selectedShipmentId, linkPackageNumber, patchEst]);

  const handleUnlinkPackage = useCallback(async () => {
    if (!selectedShipmentId) return;
    if (!confirm('Remove the manually-linked package from this shipment?')) return;
    setUnlinkingPackage(true);
    try {
      await axios.delete(`${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/package`);
      toast.success('Package unlinked');
      patchEst(selectedShipmentId, { package_number: null });
    } catch {
      toast.error('Failed to unlink package');
    } finally {
      setUnlinkingPackage(false);
    }
  }, [selectedShipmentId, patchEst]);

  const loadWarehouses = useCallback(async () => {
    if (warehouses.length > 0 || warehousesLoading) return;
    setWarehousesLoading(true);
    try {
      const { data } = await axios.get<{ warehouses: Warehouse[] }>(`${API_URL}/vendor_po/warehouses`);
      setWarehouses(data.warehouses ?? []);
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setWarehousesLoading(false);
    }
  }, [warehouses.length, warehousesLoading]);

  const openCreateTOModal = useCallback(() => {
    setToDate('');
    setFromWarehouseId('3220178000000403010');   // Pupscribe (default)
    setToWarehouseId('3220178000156676949');      // Mumbai (Amazon) (default)
    setCreateTOOpen(true);
    loadWarehouses();
  }, [loadWarehouses]);

  const handleCreateTO = useCallback(async () => {
    if (!selectedShipmentId) return;
    setCreatingTO(true);
    try {
      const { data } = await axios.post<{ transfer_order_id: string; transfer_order_number: string; status: string }>(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/transfer_order`,
        { date: toDate || undefined, from_warehouse_id: fromWarehouseId || undefined, to_warehouse_id: toWarehouseId || undefined },
      );
      toast.success(`Transfer order ${data.transfer_order_number} created`);
      patchEst(selectedShipmentId, { transfer_order_number: data.transfer_order_number, transfer_order_id: data.transfer_order_id });
      setCreateTOOpen(false);
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to create transfer order' : 'Failed to create transfer order');
    } finally {
      setCreatingTO(false);
    }
  }, [selectedShipmentId, toDate, fromWarehouseId, toWarehouseId, patchEst]);

  const handleLinkTO = useCallback(async () => {
    if (!selectedShipmentId || !linkTONumber.trim()) return;
    setLinkingTO(true);
    try {
      const { data } = await axios.patch<{ transfer_order_number: string; transfer_order_id: string }>(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/transfer_order`,
        { transfer_order_number: linkTONumber.trim() },
      );
      toast.success(`Transfer order ${data.transfer_order_number} linked`);
      patchEst(selectedShipmentId, { transfer_order_number: data.transfer_order_number, transfer_order_id: data.transfer_order_id });
      setLinkTOOpen(false);
      setLinkTONumber('');
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to link transfer order' : 'Failed to link transfer order');
    } finally {
      setLinkingTO(false);
    }
  }, [selectedShipmentId, linkTONumber, patchEst]);

  const handleUnlinkTO = useCallback(async () => {
    if (!selectedShipmentId) return;
    if (!confirm('Remove the transfer order link from this shipment?')) return;
    setUnlinkingTO(true);
    try {
      await axios.delete(`${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/transfer_order`);
      toast.success('Transfer order unlinked');
      patchEst(selectedShipmentId, { transfer_order_number: null, transfer_order_id: null });
    } catch {
      toast.error('Failed to unlink transfer order');
    } finally {
      setUnlinkingTO(false);
    }
  }, [selectedShipmentId, patchEst]);

  const handleCreateAssemblies = useCallback(async () => {
    if (!selectedShipmentId) return;
    setCreatingAssemblies(true);
    try {
      const { data } = await axios.post<{ bundle_ids: string[]; assembly_numbers: string[] }>(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/assemblies`,
      );
      toast.success(`${data.assembly_numbers.length} assembly(s) created`);
      patchEst(selectedShipmentId, { bundle_ids: data.bundle_ids, assembly_numbers: data.assembly_numbers });
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to create assemblies' : 'Failed to create assemblies');
    } finally {
      setCreatingAssemblies(false);
    }
  }, [selectedShipmentId, patchEst]);

  const handleLinkAssembly = useCallback(async () => {
    if (!selectedShipmentId || !linkAssemblyNumber.trim()) return;
    setLinkingAssembly(true);
    try {
      const { data } = await axios.patch<{ bundle_ids: string[]; assembly_numbers: string[] }>(
        `${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/assemblies`,
        { assembly_number: linkAssemblyNumber.trim() },
      );
      toast.success(`Assembly ${linkAssemblyNumber.trim()} linked`);
      patchEst(selectedShipmentId, { bundle_ids: data.bundle_ids, assembly_numbers: data.assembly_numbers });
      setLinkAssemblyOpen(false);
      setLinkAssemblyNumber('');
    } catch (e: unknown) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.detail ?? 'Failed to link assembly' : 'Failed to link assembly');
    } finally {
      setLinkingAssembly(false);
    }
  }, [selectedShipmentId, linkAssemblyNumber, patchEst]);

  const handleUnlinkAssemblies = useCallback(async () => {
    if (!selectedShipmentId) return;
    if (!confirm('Remove all assembly links from this shipment?')) return;
    setUnlinkingAssemblies(true);
    try {
      await axios.delete(`${API_URL}/amazon_fba_shipment/processing/${selectedShipmentId}/assemblies`);
      toast.success('Assemblies unlinked');
      patchEst(selectedShipmentId, { bundle_ids: [], assembly_numbers: [] });
    } catch {
      toast.error('Failed to unlink assemblies');
    } finally {
      setUnlinkingAssemblies(false);
    }
  }, [selectedShipmentId, patchEst]);

  // ─── Shipment groups ─────────────────────────────────────────────────────────


  const allShipmentIds = useMemo(() =>
    Object.keys(shipmentGroups).sort((a, b) => {
      const da = shipmentGroups[a].date ? new Date(shipmentGroups[a].date!).getTime() : 0;
      const db2 = shipmentGroups[b].date ? new Date(shipmentGroups[b].date!).getTime() : 0;
      if (da !== db2) return db2 - da;
      return b.localeCompare(a); // tie-break: newer ShipmentId last char higher
    }),
  [shipmentGroups]);

  const filteredShipmentIds = useMemo(() => {
    const q = shipmentSearch.toLowerCase();
    if (!q) return allShipmentIds;
    return allShipmentIds.filter(sid => {
      const g = shipmentGroups[sid];
      return (
        sid.toLowerCase().includes(q) ||
        g.shipmentName?.toLowerCase().includes(q) ||
        g.location?.toLowerCase().includes(q)
      );
    });
  }, [allShipmentIds, shipmentSearch, shipmentGroups]);

  const totalPages = Math.max(1, Math.ceil(filteredShipmentIds.length / SHIPMENTS_PER_PAGE));
  const pagedIds = filteredShipmentIds.slice(
    (shipmentPage - 1) * SHIPMENTS_PER_PAGE,
    shipmentPage * SHIPMENTS_PER_PAGE,
  );

  // Reset page when search changes
  useEffect(() => { setShipmentPage(1); }, [shipmentSearch]);

  // Derived from selected shipment
  const selectedGroup = selectedShipmentId ? (shipmentGroups[selectedShipmentId] ?? null) : null;
  const isVirtualOnly = selectedGroup ? !selectedGroup.hasUploaded : false;
  const hasDraftChanges = Object.keys(draftEdits).length > 0;

  const selectedRows = useMemo(() => {
    if (!selectedShipmentId || !selectedGroup) return [];
    const q = rowSearch.toLowerCase();
    if (!q) return selectedGroup.rows;
    return selectedGroup.rows.filter(r =>
      r.sku_code?.toLowerCase().includes(q) ||
      r.item_name?.toLowerCase().includes(q) ||
      r.asin?.toLowerCase().includes(q) ||
      r.fnsku?.toLowerCase().includes(q)
    );
  }, [selectedShipmentId, selectedGroup, rowSearch]);

  // ─── Upload processing sheet ─────────────────────────────────────────────────

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

  // ─── Save virtual rows ───────────────────────────────────────────────────────

  const handleSaveRows = useCallback(async () => {
    if (!selectedGroup) return;
    setSavingRows(true);
    try {
      const rows = selectedGroup.rows.map(row => {
        const edits = draftEdits[row.sku_code] ?? {};
        return {
          ...row,
          packed_qty: edits.packed_qty ?? row.packed_qty,
          sp: edits.sp !== undefined ? edits.sp : row.sp,
          cost_price: edits.cost_price !== undefined ? edits.cost_price : row.cost_price,
        };
      });
      const res = await axios.post(`${API_URL}/amazon_fba_shipment/processing/rows`, { rows });
      toast.success(`Saved ${res.data.rows_saved} rows`);
      setDraftEdits({});
      await loadProcessing();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingRows(false);
    }
  }, [selectedGroup, draftEdits, loadProcessing]);

  // ─── Clear uploaded rows for selected shipment ────────────────────────────────

  const handleClearShipment = useCallback(async () => {
    if (!selectedShipmentId || !selectedGroup?.hasUploaded) return;
    if (!confirm(`Clear all uploaded processing records for ${selectedShipmentId}?`)) return;
    try {
      const res = await axios.delete(`${API_URL}/amazon_fba_shipment/processing`, {
        data: { shipment_ids: [selectedShipmentId] },
      });
      toast.success(`Cleared ${res.data.deleted} records`);
      await loadProcessing();
      setSummary([]);
    } catch {
      toast.error('Failed to clear records');
    }
  }, [selectedShipmentId, selectedGroup, loadProcessing]);

  // ─── Summary ──────────────────────────────────────────────────────────────────

  const saveSummaryEdit = useCallback(async (key: string, updates: Partial<SummaryRow>) => {
    const [shipmentId, location] = key.split('|||');
    try {
      await axios.put(`${API_URL}/amazon_fba_shipment/summary/${encodeURIComponent(shipmentId)}`, updates, { params: { location } });
      setSummary(prev => prev.map(r => `${r.shipment_id}|||${r.location}` === key ? { ...r, ...updates } : r));
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    }
  }, []);

  const filteredSum = useMemo(() => {
    const q = searchSum.toLowerCase();
    if (!q) return summary;
    return summary.filter(r => r.shipment_id?.toLowerCase().includes(q) || r.location?.toLowerCase().includes(q));
  }, [summary, searchSum]);

  // ─── Address label helper ────────────────────────────────────────────────────

  const addrLabel = (a: EtradeAddress) =>
    [a.attention, a.address, a.city, a.state].filter(Boolean).join(', ');

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection}>
          <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>FBA Shipments</h2>
          <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
            View SP-API synced shipments, upload processing sheets, create estimates, and track progress.
          </p>
        </div>
        <div className='border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-6 overflow-x-auto'>
          <nav className='flex gap-6 -mb-px'>
            {([
              { key: 'queue', label: 'Shipment Queue' },
              { key: 'processing', label: 'Shipment Processing' },
              { key: 'summary', label: 'Shipment Summary' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => handleTabChange(key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Queue Tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <AmazonFBAShipmentQueue onOpenProcessing={handleOpenFromQueue} />
      )}

      {/* ── Processing Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'processing' && (
        <div className='space-y-4'>
          {/* Toolbar */}
          <div className={TABLE_CLASSES.container}>
            <div className={TABLE_CLASSES.headerSection}>
              <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  Select a shipment to view its data. Queue-sourced shipments can be edited inline and saved without Excel upload.
                </p>
                <div className='flex items-center gap-2 flex-wrap flex-shrink-0'>
                  <button onClick={loadProcessing} disabled={loadingProc}
                    className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-50'>
                    <RefreshCw size={14} className={loadingProc ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                  <a href={`${API_URL}/amazon_fba_shipment/processing/template`} download='fba_processing_template.xlsx'
                    className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50'>
                    <Download size={14} />
                    Template
                  </a>
                  <input ref={procFileRef} type='file' accept='.xlsx,.xls' className='hidden' onChange={handleUploadProc} />
                  <button onClick={() => procFileRef.current?.click()} disabled={uploadingProc}
                    className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50'>
                    <Upload size={14} />
                    {uploadingProc ? 'Uploading…' : 'Upload Sheet'}
                  </button>
                  {selectedGroup && isVirtualOnly && (
                    <button onClick={handleSaveRows} disabled={savingRows}
                      className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50'>
                      <Save size={14} />
                      {savingRows ? 'Saving…' : hasDraftChanges ? 'Save (edited)' : 'Save as Processing'}
                    </button>
                  )}
                  {selectedGroup?.hasUploaded && (
                    <button onClick={handleClearShipment}
                      className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-zinc-800 border border-red-300 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20'>
                      <Trash2 size={14} />
                      Clear Shipment
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {loadingProc && <LoadingState message='Loading processing data…' />}
          {errorProc && <ErrorState error={errorProc} onRetry={loadProcessing} />}

          {!loadingProc && !errorProc && (
            <>
              {allShipmentIds.length === 0 ? (
                <div className='bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-8 text-center text-sm text-zinc-500 dark:text-zinc-400'>
                  No shipments found. Go to <strong>Shipment Queue</strong> and click <strong>Processing →</strong> on any shipment, or upload a processing sheet above.
                </div>
              ) : (
                <div className={TABLE_CLASSES.container}>
                  <div className={TABLE_CLASSES.headerSection}>
                    {/* Accordion search */}
                    <div className='flex items-center gap-3 mb-3'>
                      <div className='flex-1'>
                        <SearchBar value={shipmentSearch} onChange={setShipmentSearch} placeholder='Search by shipment ID, name or FC…' />
                      </div>
                      <span className='text-xs text-zinc-400 whitespace-nowrap'>
                        {filteredShipmentIds.length} of {allShipmentIds.length} shipment{allShipmentIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Accordion list */}
                    <div className='space-y-2'>
                      {pagedIds.length === 0 ? (
                        <p className='text-sm text-zinc-400 text-center py-6'>No shipments match your search.</p>
                      ) : pagedIds.map(sid => {
                        const group = shipmentGroups[sid];
                        const isOpen = selectedShipmentId === sid;
                        const estInfo = estimateByShipment[sid];
                        const isEstLoading = !(sid in estimateByShipment);

                        return (
                          <div key={sid} className={`border rounded-lg overflow-hidden transition-shadow ${
                            isOpen
                              ? 'border-blue-400 dark:border-blue-600 shadow-sm'
                              : 'border-zinc-200 dark:border-zinc-700'
                          }`}>
                            {/* Accordion header */}
                            <div
                              role='button'
                              tabIndex={0}
                              onClick={() => handleToggleShipment(sid)}
                              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleToggleShipment(sid)}
                              className={`flex items-center gap-2 sm:gap-3 px-3 py-2.5 cursor-pointer select-none ${
                                isOpen
                                  ? 'bg-blue-50 dark:bg-blue-900/10 border-b border-blue-200 dark:border-blue-800'
                                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              <ChevronRight size={14} className={`text-zinc-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                              <span className='font-mono text-[11px] text-zinc-400 flex-shrink-0 hidden xs:inline'>{sid}</span>
                              <span className='text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate min-w-0' title={group.shipmentName || undefined}>
                                {group.shipmentName || <span className='italic text-zinc-400'>No name</span>}
                              </span>
                              <span className='text-xs text-zinc-400 whitespace-nowrap hidden sm:inline'>
                                {group.rows.length} SKU{group.rows.length !== 1 ? 's' : ''}
                              </span>
                              {group.location && (
                                <span className='text-xs text-zinc-400 whitespace-nowrap hidden md:inline'>· {group.location}</span>
                              )}
                              {group.hasUploaded ? (
                                <span className='text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap'>
                                  Uploaded
                                </span>
                              ) : (
                                <span className='text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap'>
                                  From Queue
                                </span>
                              )}
                              {estInfo?.estimate_number && (
                                <span className='text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 whitespace-nowrap hidden sm:inline'>
                                  {estInfo.estimate_number}
                                </span>
                              )}
                              {estInfo?.estimate_number && estInfo?.status && (
                                <span className='hidden md:inline'><EstStatusBadge status={estInfo.status} /></span>
                              )}
                              {/* Download link — stops propagation so accordion doesn't toggle */}
                              <a
                                href={`${API_URL}/amazon_fba_shipment/processing/${sid}/download`}
                                download
                                onClick={e => e.stopPropagation()}
                                className='p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors flex-shrink-0'
                                title='Download as Excel'
                              >
                                <Download size={13} />
                              </a>
                            </div>

                            {/* Accordion body */}
                            {isOpen && (
                              <div className='p-4 flex flex-col gap-4'>
                                {/* Row search + count */}
                                <div className='flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-700 pt-4'>
                                  <div className='flex-1'>
                                    <SearchBar value={rowSearch} onChange={setRowSearch} placeholder='Search by SKU, item name, ASIN or FNSKU…' />
                                  </div>
                                  <span className='text-xs text-zinc-400 whitespace-nowrap'>
                                    {selectedRows.length} of {group.rows.length} rows
                                  </span>
                                </div>

                                {/* Processing table */}
                                <div className={TABLE_CLASSES.overflow}>
                                  <table className={TABLE_CLASSES.table}>
                                    <thead className={TABLE_CLASSES.thead}>
                                      <tr>
                                        {[
                                          'SKU Code', 'ASIN', 'FNSKU', 'Item Name',
                                          'MRP', isVirtualOnly ? 'SP ✎' : 'SP',
                                          'Requested Qty',
                                          isVirtualOnly ? 'Packed Qty ✎' : 'Packed Qty',
                                          isVirtualOnly ? 'Cost Price ✎' : 'Cost Price',
                                          'HSN Code', 'GST', 'Date', 'Location',
                                        ].map(h => (
                                          <th key={h} className={TABLE_CLASSES.th} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className={TABLE_CLASSES.tbody}>
                                      {selectedRows.map((row, idx) => {
                                        const edits = draftEdits[row.sku_code] ?? {};
                                        const displaySp = edits.sp !== undefined ? edits.sp : (row.sp ?? row.mrp);
                                        const displayPackedQty = edits.packed_qty ?? row.packed_qty;
                                        const displayCostPrice = edits.cost_price !== undefined ? edits.cost_price : row.cost_price;
                                        return (
                                          <tr key={`${row.sku_code}-${idx}`} className={TABLE_CLASSES.tr}>
                                            <td className={TABLE_CLASSES.td}><span className='text-sm font-mono text-zinc-700 dark:text-zinc-300'>{row.sku_code}</span></td>
                                            <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-500 dark:text-zinc-400'>{row.asin || '—'}</span></td>
                                            <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-500 dark:text-zinc-400'>{row.fnsku || '—'}</span></td>
                                            <td className={TABLE_CLASSES.td} style={{ minWidth: 160, maxWidth: 240 }}>
                                              <span className='text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2' title={row.item_name}>{row.item_name || '—'}</span>
                                            </td>
                                            <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.mrp != null ? `₹${row.mrp.toLocaleString()}` : '—'}</span></td>

                                            {/* SP — editable for virtual rows; pre-filled = MRP */}
                                            <td className={TABLE_CLASSES.td}>
                                              {isVirtualOnly ? (
                                                <input type='number' min={0}
                                                  value={displaySp ?? ''}
                                                  onChange={e => {
                                                    const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                                    setDraftEdits(d => ({ ...d, [row.sku_code]: { ...d[row.sku_code], sp: v } }));
                                                  }}
                                                  className='w-24 px-2 py-1 text-xs border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                              ) : (
                                                <span className={TABLE_CLASSES.tdText}>{row.sp != null ? `₹${row.sp.toLocaleString()}` : '—'}</span>
                                              )}
                                            </td>

                                            <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.requested_qty.toLocaleString()}</span></td>

                                            {/* Packed Qty */}
                                            <td className={TABLE_CLASSES.td}>
                                              {isVirtualOnly ? (
                                                <input type='number' min={0} value={displayPackedQty}
                                                  onChange={e => {
                                                    const v = parseInt(e.target.value, 10) || 0;
                                                    setDraftEdits(d => ({ ...d, [row.sku_code]: { ...d[row.sku_code], packed_qty: v } }));
                                                  }}
                                                  className='w-20 px-2 py-1 text-xs border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                              ) : (
                                                <span className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>{row.packed_qty.toLocaleString()}</span>
                                              )}
                                            </td>

                                            {/* Cost Price — optional */}
                                            <td className={TABLE_CLASSES.td}>
                                              {isVirtualOnly ? (
                                                <input type='number' min={0} placeholder='optional'
                                                  value={displayCostPrice ?? ''}
                                                  onChange={e => {
                                                    const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                                    setDraftEdits(d => ({ ...d, [row.sku_code]: { ...d[row.sku_code], cost_price: v } }));
                                                  }}
                                                  className='w-24 px-2 py-1 text-xs border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                              ) : (
                                                <span className={TABLE_CLASSES.tdText}>{row.cost_price != null ? `₹${row.cost_price.toLocaleString()}` : '—'}</span>
                                              )}
                                            </td>

                                            <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.hsn_code || '—'}</span></td>
                                            <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.gst != null ? `${row.gst}%` : '—'}</span></td>
                                            <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{fmt(row.date)}</span></td>
                                            <td className={TABLE_CLASSES.td}><span className={TABLE_CLASSES.tdText}>{row.location || '—'}</span></td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Save footer for virtual-only shipments */}
                                {isVirtualOnly && (
                                  <div className='px-4 py-3 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3 bg-amber-50/60 dark:bg-amber-900/10'>
                                    <p className='text-xs text-amber-700 dark:text-amber-400'>
                                      {hasDraftChanges
                                        ? `${Object.keys(draftEdits).length} row${Object.keys(draftEdits).length !== 1 ? 's' : ''} edited — save to persist.`
                                        : 'Edit Packed Qty and SP above, then save to create the processing record. Cost Price is optional.'}
                                    </p>
                                    <button onClick={handleSaveRows} disabled={savingRows}
                                      className='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 whitespace-nowrap'>
                                      <Save size={14} />
                                      {savingRows ? 'Saving…' : 'Save as Processing'}
                                    </button>
                                  </div>
                                )}

                                {/* ── Estimate section (rendered above the table via order-first) ── */}
                                <div className='order-first'>
                                  <div className='flex items-center gap-2 mb-3'>
                                    <FileText size={14} className='text-zinc-400' />
                                    <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Estimate</span>
                                  </div>

                                  {isEstLoading ? (
                                    <p className='text-xs text-zinc-400'>Loading estimate status…</p>
                                  ) : estInfo?.estimate_number ? (
                                    /* Estimate linked */
                                    <div className='space-y-3'>
                                      <div className='flex flex-wrap items-center gap-3'>
                                        <span className='text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'>
                                          {estInfo.estimate_number}
                                        </span>
                                        <EstStatusBadge status={estInfo.status} />
                                        {estInfo.sub_total != null && (
                                          <span className='text-xs text-zinc-600 dark:text-zinc-400'>
                                            Sub-total: <strong>{fmtMoney(estInfo.sub_total)}</strong>
                                          </span>
                                        )}
                                        {estInfo.total != null && (
                                          <span className='text-xs text-zinc-600 dark:text-zinc-400'>
                                            Total (incl. GST): <strong>{fmtMoney(estInfo.total)}</strong>
                                          </span>
                                        )}
                                        <button
                                          onClick={() => showDiff ? setShowDiff(false) : handleLoadDiff()}
                                          disabled={loadingDiff}
                                          className='inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 disabled:opacity-50'
                                        >
                                          <FileText size={11} />
                                          {loadingDiff ? 'Loading…' : showDiff ? 'Hide Breakdown' : 'View Breakdown'}
                                        </button>
                                        <button onClick={handleUnlinkEstimate}
                                          className='inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50'>
                                          <Unlink size={11} />
                                          Unlink
                                        </button>
                                      </div>

                                      {/* Estimate breakdown diff */}
                                      {showDiff && estimateDiff && (
                                        <div className='border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden mt-2'>
                                          {/* Totals summary */}
                                          <div className='p-3 bg-zinc-50 dark:bg-zinc-800/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs'>
                                            {[
                                              {
                                                label: 'Items',
                                                proc: estimateDiff.processing_item_count,
                                                est: estimateDiff.estimate_item_count,
                                                match: estimateDiff.processing_item_count === estimateDiff.estimate_item_count,
                                                isQty: true,
                                              },
                                              {
                                                label: 'Requested Qty',
                                                proc: estimateDiff.processing_total_qty,
                                                est: estimateDiff.estimate_total_qty,
                                                match: estimateDiff.processing_total_qty === estimateDiff.estimate_total_qty,
                                                isQty: true,
                                              },
                                              {
                                                label: 'Amount (pre-GST)',
                                                proc: estimateDiff.processing_sub_total,
                                                est: estimateDiff.estimate_sub_total,
                                                match: Math.abs((estimateDiff.estimate_sub_total ?? 0) - estimateDiff.processing_sub_total) < 1,
                                                isQty: false,
                                              },
                                              {
                                                label: 'Amount (incl. GST)',
                                                proc: estimateDiff.processing_total,
                                                est: estimateDiff.estimate_total,
                                                match: Math.abs((estimateDiff.estimate_total ?? 0) - estimateDiff.processing_total) < 1,
                                                isQty: false,
                                              },
                                            ].map(col => (
                                              <div key={col.label} className='space-y-0.5'>
                                                <p className='text-zinc-500 dark:text-zinc-400'>{col.label}</p>
                                                <div className='flex items-center gap-1.5'>
                                                  {col.match
                                                    ? <Check size={11} className='text-green-500 flex-shrink-0' />
                                                    : <AlertCircle size={11} className='text-red-500 flex-shrink-0' />}
                                                  <span className={col.match ? 'text-green-700 dark:text-green-400 font-medium' : 'text-red-700 dark:text-red-400 font-medium'}>
                                                    {col.isQty ? (col.proc as number).toLocaleString() : fmtMoney(col.proc as number)}
                                                  </span>
                                                </div>
                                                <p className='text-zinc-400'>
                                                  Est: {col.isQty ? (col.est as number | null ?? '—') : fmtMoney(col.est as number | null)}
                                                </p>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Per-item table */}
                                          <div className='overflow-x-auto'>
                                            <table className={TABLE_CLASSES.table}>
                                              <thead className={TABLE_CLASSES.thead}>
                                                <tr>
                                                  {['SKU Code', 'Item Name', 'Proc Qty', 'Est Qty', 'Proc Rate', 'Est Rate', 'Proc Total', 'Est Total', 'In Est?'].map(h => (
                                                    <th key={h} className={TABLE_CLASSES.th} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody className={TABLE_CLASSES.tbody}>
                                                {estimateDiff.items.map(item => (
                                                  <tr key={item.sku_code} className={TABLE_CLASSES.tr}>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-zinc-700 dark:text-zinc-300'>{item.sku_code}</span></td>
                                                    <td className={TABLE_CLASSES.td} style={{ minWidth: 140 }}><span className='text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1'>{item.item_name || '—'}</span></td>
                                                    <td className={TABLE_CLASSES.td}>
                                                      <span className={`text-xs font-medium ${item.qty_match ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {item.processing_qty}
                                                      </span>
                                                    </td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-600 dark:text-zinc-400'>{item.estimate_qty ?? '—'}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-600 dark:text-zinc-400'>{fmtMoney(item.processing_rate)}</span></td>
                                                    <td className={TABLE_CLASSES.td}>
                                                      <span className={`text-xs ${item.rate_match ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {fmtMoney(item.estimate_rate)}
                                                      </span>
                                                    </td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-700 dark:text-zinc-300'>{fmtMoney(item.processing_item_total)}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-600 dark:text-zinc-400'>{fmtMoney(item.estimate_item_total)}</span></td>
                                                    <td className={TABLE_CLASSES.td}>
                                                      {item.in_estimate
                                                        ? <span className='inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400'><Check size={11} /> Yes</span>
                                                        : <span className='inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400'><X size={11} /> No</span>}
                                                    </td>
                                                  </tr>
                                                ))}
                                                {estimateDiff.only_in_estimate.map(item => (
                                                  <tr key={`oe-${item.sku_code}`} className='bg-amber-50/50 dark:bg-amber-900/5'>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs font-mono text-amber-700 dark:text-amber-400'>{item.sku_code}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-900 dark:text-zinc-100'>{item.item_name || '—'}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-red-600'>—</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-600'>{item.estimate_qty}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-400'>—</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-600'>{fmtMoney(item.estimate_rate)}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-400'>—</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-zinc-600'>{fmtMoney(item.estimate_item_total)}</span></td>
                                                    <td className={TABLE_CLASSES.td}><span className='text-xs text-amber-600'>Est. only</span></td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* No estimate — create / link */
                                    <div className='flex flex-wrap items-start gap-3'>
                                      <div className='text-xs text-zinc-400'>No estimate linked.</div>
                                      <button onClick={openCreateModal}
                                        className='inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700'>
                                        <Plus size={11} />
                                        Create Estimate
                                      </button>
                                      <button onClick={() => { setShowLinkInput(v => !v); setLinkEstInput(''); }}
                                        className='inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-white dark:bg-zinc-800 border border-purple-200 dark:border-purple-800 rounded-md hover:bg-purple-50'>
                                        <Link2 size={11} />
                                        Link Existing
                                      </button>

                                      {showLinkInput && (
                                        <div className='flex items-center gap-2 w-full sm:w-auto'>
                                          <input
                                            type='text'
                                            value={linkEstInput}
                                            onChange={e => setLinkEstInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleLinkEstimate()}
                                            placeholder='EST/25-26/0042'
                                            className='px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-600 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-zinc-800 dark:text-zinc-100 w-40'
                                          />
                                          <button onClick={handleLinkEstimate} disabled={linkingEstimate || !linkEstInput.trim()}
                                            className='px-3 py-1 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50'>
                                            {linkingEstimate ? 'Linking…' : 'Link'}
                                          </button>
                                          <button onClick={() => setShowLinkInput(false)} className='p-1 text-zinc-400 hover:text-zinc-600'>
                                            <X size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* ── Fulfilment section (rendered above the table via order-first) ── */}
                                <div className='order-first border-t border-zinc-200 dark:border-zinc-700 pt-4'>
                                  <div className='flex items-center gap-2 mb-3'>
                                    <Package size={14} className='text-zinc-400' />
                                    <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Fulfilment</span>
                                  </div>

                                  {isEstLoading ? (
                                    <p className='text-xs text-zinc-400'>Loading fulfilment status…</p>
                                  ) : (() => {
                                    const soNum = estInfo?.estimate_linked_so_number || estInfo?.sales_order_no;
                                    const soPackages = estInfo?.so_packages ?? [];
                                    const manualPkg = estInfo?.package_number || null;
                                    const hasPackage = soPackages.length > 0 || !!manualPkg;
                                    const toNum = estInfo?.transfer_order_number;
                                    const assemblies = estInfo?.assembly_numbers ?? [];
                                    return (
                                      <div className='space-y-3'>
                                        {/* Sales Order */}
                                        <div className='flex flex-wrap items-center gap-2'>
                                          <span className='text-xs font-medium text-zinc-500 dark:text-zinc-400 w-28'>Sales Order</span>
                                          {soNum ? (
                                            <span className='px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-mono'>
                                              {soNum}
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => { setLinkSOOpen(true); setLinkSONumber(''); setSoSearchResults([]); }}
                                              className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                            >
                                              <Link2 size={11} /> Link SO
                                            </button>
                                          )}
                                        </div>

                                        {/* Packages — SO-derived or manually linked by number */}
                                        <div className='flex flex-wrap items-center gap-2'>
                                          <span className='text-xs font-medium text-zinc-500 dark:text-zinc-400 w-28'>Packages</span>
                                          {soPackages.map((pkg, i) => (
                                            <span key={`so-${i}`} className='px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono'>
                                              {pkg}
                                            </span>
                                          ))}
                                          {manualPkg && (
                                            <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono'>
                                              {manualPkg}
                                              <button onClick={handleUnlinkPackage} disabled={unlinkingPackage}
                                                className='text-blue-400 hover:text-red-500 disabled:opacity-50' title='Unlink package'>
                                                {unlinkingPackage ? <RefreshCw size={10} className='animate-spin' /> : <X size={11} />}
                                              </button>
                                            </span>
                                          )}
                                          {!hasPackage && (
                                            <button onClick={() => { setLinkPackageOpen(true); setLinkPackageNumber(''); }}
                                              className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'>
                                              <Link2 size={11} /> Link Package
                                            </button>
                                          )}
                                        </div>

                                        {/* Transfer Order — created from the package */}
                                        <div className='flex flex-wrap items-center gap-2'>
                                          <span className='text-xs font-medium text-zinc-500 dark:text-zinc-400 w-28'>Transfer Order</span>
                                          {toNum ? (
                                            <>
                                              <span className='px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800 font-mono'>
                                                {toNum}
                                              </span>
                                              <button onClick={handleUnlinkTO} disabled={unlinkingTO}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50'>
                                                {unlinkingTO ? <RefreshCw size={11} className='animate-spin' /> : <Unlink size={11} />} Unlink
                                              </button>
                                            </>
                                          ) : hasPackage ? (
                                            <>
                                              <button onClick={openCreateTOModal}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-600 text-white hover:bg-violet-700'>
                                                <ExternalLink size={11} /> Create TO
                                              </button>
                                              <button onClick={() => { setLinkTOOpen(true); setLinkTONumber(''); }}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'>
                                                <Link2 size={11} /> Link TO
                                              </button>
                                            </>
                                          ) : (
                                            <span className='text-xs text-zinc-400'>Link a package first</span>
                                          )}
                                        </div>

                                        {/* Assemblies — created for combo items in the package */}
                                        <div className='flex flex-wrap items-center gap-2'>
                                          <span className='text-xs font-medium text-zinc-500 dark:text-zinc-400 w-28'>Assemblies</span>
                                          {assemblies.length > 0 ? (
                                            <>
                                              {assemblies.map((an, i) => (
                                                <span key={i} className='px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono'>
                                                  {an}
                                                </span>
                                              ))}
                                              <button onClick={handleUnlinkAssemblies} disabled={unlinkingAssemblies}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50'>
                                                {unlinkingAssemblies ? <RefreshCw size={11} className='animate-spin' /> : <Unlink size={11} />} Unlink
                                              </button>
                                            </>
                                          ) : hasPackage ? (
                                            <>
                                              <button onClick={handleCreateAssemblies} disabled={creatingAssemblies}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'>
                                                {creatingAssemblies ? <RefreshCw size={11} className='animate-spin' /> : <ExternalLink size={11} />} Create Assemblies
                                              </button>
                                              <button onClick={() => { setLinkAssemblyOpen(true); setLinkAssemblyNumber(''); }}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'>
                                                <Link2 size={11} /> Link Assembly
                                              </button>
                                            </>
                                          ) : (
                                            <span className='text-xs text-zinc-400'>Link a package first</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className='flex items-center justify-center gap-1 mt-4 flex-wrap'>
                        <button
                          onClick={() => setShipmentPage(p => Math.max(1, p - 1))}
                          disabled={shipmentPage === 1}
                          className='px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-40'
                        >
                          ← Prev
                        </button>
                        {(() => {
                          const pages: (number | '…')[] = [];
                          const delta = 2;
                          const left = shipmentPage - delta;
                          const right = shipmentPage + delta;
                          let prev = 0;
                          for (let p = 1; p <= totalPages; p++) {
                            if (p === 1 || p === totalPages || (p >= left && p <= right)) {
                              if (prev && p - prev > 1) pages.push('…');
                              pages.push(p);
                              prev = p;
                            }
                          }
                          return pages.map((p, i) =>
                            p === '…'
                              ? <span key={`e${i}`} className='px-1 text-xs text-zinc-400'>…</span>
                              : <button key={p} onClick={() => setShipmentPage(p as number)}
                                  className={`w-7 h-7 text-xs rounded-md font-medium ${
                                    p === shipmentPage
                                      ? 'bg-blue-600 text-white'
                                      : 'text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50'
                                  }`}
                                >{p}</button>
                          );
                        })()}
                        <button
                          onClick={() => setShipmentPage(p => Math.min(totalPages, p + 1))}
                          disabled={shipmentPage === totalPages}
                          className='px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-40'
                        >
                          Next →
                        </button>
                        <span className='text-xs text-zinc-400 ml-1'>
                          {shipmentPage}/{totalPages}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Summary Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className='space-y-4'>
          <div className={TABLE_CLASSES.container}>
            <div className={TABLE_CLASSES.headerSection}>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  Summary aggregated from the Processing tab. Edit <strong>Reason, Appointment dates, Dispatched date, Status</strong> inline.
                </p>
                <button onClick={loadSummary} disabled={loadingSum}
                  className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-50'>
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
                        'Reason for Short Supply ✎', 'Appt. Initiated ✎',
                        'Appointment Date ✎', 'Dispatched Date ✎', 'Status ✎', 'Actions',
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

      {/* ── Create Estimate Modal ─────────────────────────────────────────── */}
      {showCreateModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
          <div className='bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl w-full max-w-md'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700'>
              <h3 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>Create Zoho Estimate</h3>
              <button onClick={() => setShowCreateModal(false)} className='p-1 text-zinc-400 hover:text-zinc-600 rounded'>
                <X size={16} />
              </button>
            </div>

            <div className='px-5 py-4 space-y-4'>
              {selectedShipmentId && (
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                  Shipment: <span className='font-mono text-zinc-700 dark:text-zinc-300'>{selectedShipmentId}</span>
                  {selectedGroup?.shipmentName ? ` — ${selectedGroup.shipmentName}` : ''}
                </p>
              )}

              <div>
                <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Date</label>
                <input type='date' value={estDate} onChange={e => setEstDate(e.target.value)}
                  className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-zinc-800 dark:text-zinc-100' />
              </div>

              {loadingAddresses ? (
                <p className='text-xs text-zinc-400'>Loading addresses…</p>
              ) : etradeCustomer?.addresses?.length ? (
                <>
                  <div>
                    <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Billing Address</label>
                    <select value={estBillingAddr} onChange={e => setEstBillingAddr(e.target.value)}
                      className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-zinc-800 dark:text-zinc-100'>
                      {etradeCustomer.addresses.map(a => (
                        <option key={a.address_id} value={a.address_id}>{addrLabel(a)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Shipping Address</label>
                    <select value={estShippingAddr} onChange={e => setEstShippingAddr(e.target.value)}
                      className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-zinc-800 dark:text-zinc-100'>
                      {etradeCustomer.addresses.map(a => (
                        <option key={a.address_id} value={a.address_id}>{addrLabel(a)}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <p className='text-xs text-red-500'>No customer addresses found.</p>
              )}

              <p className='text-xs text-zinc-400'>
                Line items: each processing row at <strong>MRP ÷ (1 + GST%)</strong> × Requested Qty. Customer: ETRADE MARKETING.
              </p>
            </div>

            <div className='flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700'>
              <button onClick={() => setShowCreateModal(false)}
                className='px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50'>
                Cancel
              </button>
              <button
                onClick={handleCreateEstimate}
                disabled={creatingEstimate || !estBillingAddr || !estShippingAddr}
                className='px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50'
              >
                {creatingEstimate ? 'Creating…' : 'Create Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Sales Order Modal ─────────────────────────────────────────── */}
      {linkSOOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-700'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full'>
                <Link2 size={18} className='text-amber-600 dark:text-amber-400' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>Link Sales Order</h3>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 font-mono'>{selectedShipmentId}</p>
              </div>
            </div>
            <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Sales Order Number</label>
            <input
              type='text'
              value={linkSONumber}
              onChange={e => setLinkSONumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLinkSO()}
              placeholder='SO-00123'
              className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
            />
            {soSearchResults.length > 0 && (
              <div className='mt-2 max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md divide-y divide-zinc-100 dark:divide-zinc-800'>
                {soSearchResults.map(so => (
                  <button
                    key={so.salesorder_id}
                    onClick={() => { setLinkSONumber(so.salesorder_number); setSoSearchResults([]); }}
                    className='w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  >
                    <span className='font-mono text-zinc-700 dark:text-zinc-300'>{so.salesorder_number}</span>
                    {so.customer_name && <span className='text-zinc-400 ml-2'>{so.customer_name}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => { setLinkSOOpen(false); setLinkSONumber(''); setSoSearchResults([]); }} disabled={linkingSO}
                className='px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50'>
                Cancel
              </button>
              <button onClick={handleLinkSO} disabled={linkingSO || !linkSONumber.trim()}
                className='px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2'>
                {linkingSO ? <RefreshCw size={13} className='animate-spin' /> : <Link2 size={13} />}
                {linkingSO ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Package Modal ─────────────────────────────────────────────── */}
      {linkPackageOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-700'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full'>
                <Package size={18} className='text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>Link Package</h3>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 font-mono'>{selectedShipmentId}</p>
              </div>
            </div>
            <p className='text-xs text-zinc-500 dark:text-zinc-400 mb-3'>
              The package must already exist in Zoho (it drives the Transfer Order &amp; Assemblies).
            </p>
            <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Package Number</label>
            <input type='text' value={linkPackageNumber} onChange={e => setLinkPackageNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLinkPackage()} placeholder='PKG-00123'
              className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => { setLinkPackageOpen(false); setLinkPackageNumber(''); }} disabled={linkingPackage}
                className='px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50'>
                Cancel
              </button>
              <button onClick={handleLinkPackage} disabled={linkingPackage || !linkPackageNumber.trim()}
                className='px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2'>
                {linkingPackage ? <RefreshCw size={13} className='animate-spin' /> : <Link2 size={13} />}
                {linkingPackage ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Transfer Order Modal ────────────────────────────────────── */}
      {createTOOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-700'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-violet-100 dark:bg-violet-900/30 rounded-full'>
                <ExternalLink size={18} className='text-violet-600 dark:text-violet-400' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>Create Transfer Order</h3>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 font-mono'>{selectedShipmentId}</p>
              </div>
            </div>
            <p className='text-xs text-zinc-500 dark:text-zinc-400 mb-4'>
              Creates a Zoho Inventory transfer order from the linked package&apos;s line items.
            </p>
            <div className='space-y-3'>
              <div>
                <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>From Warehouse</label>
                {warehousesLoading ? (
                  <div className='flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded-md'>
                    <RefreshCw size={12} className='animate-spin' /> Loading warehouses…
                  </div>
                ) : (
                  <select value={fromWarehouseId} onChange={e => setFromWarehouseId(e.target.value)}
                    className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500'>
                    {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>To Warehouse</label>
                {warehousesLoading ? (
                  <div className='flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded-md'>
                    <RefreshCw size={12} className='animate-spin' /> Loading warehouses…
                  </div>
                ) : (
                  <select value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)}
                    className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500'>
                    {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Date (optional — defaults to today)</label>
                <input type='date' value={toDate} onChange={e => setToDate(e.target.value)}
                  className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500' />
              </div>
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => { setCreateTOOpen(false); setToDate(''); }} disabled={creatingTO}
                className='px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50'>
                Cancel
              </button>
              <button onClick={handleCreateTO} disabled={creatingTO || warehousesLoading}
                className='px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2'>
                {creatingTO ? <RefreshCw size={13} className='animate-spin' /> : <ExternalLink size={13} />}
                {creatingTO ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Transfer Order Modal ──────────────────────────────────────── */}
      {linkTOOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-700'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-violet-100 dark:bg-violet-900/30 rounded-full'>
                <Link2 size={18} className='text-violet-600 dark:text-violet-400' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>Link Transfer Order</h3>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 font-mono'>{selectedShipmentId}</p>
              </div>
            </div>
            <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Transfer Order Number</label>
            <input type='text' value={linkTONumber} onChange={e => setLinkTONumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLinkTO()} placeholder='TO-123'
              className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500' />
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => { setLinkTOOpen(false); setLinkTONumber(''); }} disabled={linkingTO}
                className='px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50'>
                Cancel
              </button>
              <button onClick={handleLinkTO} disabled={linkingTO || !linkTONumber.trim()}
                className='px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2'>
                {linkingTO ? <RefreshCw size={13} className='animate-spin' /> : <Link2 size={13} />}
                {linkingTO ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Assembly Modal ────────────────────────────────────────────── */}
      {linkAssemblyOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-700'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full'>
                <Link2 size={18} className='text-indigo-600 dark:text-indigo-400' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>Link Assembly</h3>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 font-mono'>{selectedShipmentId}</p>
              </div>
            </div>
            <label className='block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'>Assembly Reference Number</label>
            <input type='text' value={linkAssemblyNumber} onChange={e => setLinkAssemblyNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLinkAssembly()} placeholder='ASM-00045'
              className='w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500' />
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => { setLinkAssemblyOpen(false); setLinkAssemblyNumber(''); }} disabled={linkingAssembly}
                className='px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50'>
                Cancel
              </button>
              <button onClick={handleLinkAssembly} disabled={linkingAssembly || !linkAssemblyNumber.trim()}
                className='px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2'>
                {linkingAssembly ? <RefreshCw size={13} className='animate-spin' /> : <Link2 size={13} />}
                {linkingAssembly ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
