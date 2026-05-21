'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  Plus, Upload, Trash2, Download, Pencil, X, Check, Loader2, RefreshCw,
  FileText, ChevronDown, ChevronRight, Package, Tag, AlertTriangle, Search,
  Archive, Eye, FolderOpen, ArrowLeft, ArrowRight, Link2, BarChart2,
  Layers, Filter,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DOCS_PER_PAGE = 5;

interface VendorInfo { contact_id: string; contact_name: string; currency_code?: string; }
interface Brand { name: string; vendors: VendorInfo[]; }
interface Document {
  doc_id: string;
  filename: string;
  content_type: string;
  size: number;
  uploaded_at: string;
  s3_key: string;
  category?: string;
  item_id?: string;
  item_name?: string;
}

interface LineItem {
  item_id: string;
  name: string;
  description?: string;
  account_name?: string;
  quantity: number;
  item_total?: number;
  is_new?: boolean;
}

function lineItemLabel(item: LineItem): string {
  const label = item.name?.trim() || item.description?.trim() || 'Unnamed item';
  const isSample = item.account_name?.trim().toLowerCase() === 'sample';
  return isSample ? `${label} (Sample)` : label;
}
interface BrandOrder {
  _id: string;
  brand: string;
  vendor_id: string | null;
  vendor_name: string | null;
  name: string;
  order_date: string;
  shipment_eta: string;
  purchaseorder_number: string | null;
  po_status: string | null;
  po_currency_code: string | null;
  documents: Document[];
  doc_count?: number;
  created_at: string;
  updated_at: string;
  initiation_date?: string;
  proforma_date?: string;
  ready_date?: string;
  etd_date?: string;
  eta_port_date?: string;
  duty_payment_date?: string;
  inward_date?: string;
}
interface CreateFormState {
  brand: string; vendor_id: string; name?: string; order_date: string; shipment_eta: string;
  purchaseorder_number?: string;
  initiation_date?: string; proforma_date?: string; ready_date?: string;
  etd_date?: string; eta_port_date?: string; duty_payment_date?: string;
  inward_date?: string;
}
interface PoResult { purchaseorder_number: string; order_status_formatted: string; vendor_id?: string; bill_date?: string; po_date?: string; }
interface GlobalFileResult {
  order_id: string;
  order_name: string;
  brand: string;
  doc: Document;
}

function today() { return new Date().toISOString().slice(0, 10); }
function eta45() {
  const d = new Date(); d.setDate(d.getDate() + 45);
  return d.toISOString().slice(0, 10);
}
function fmtDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}
function fmtDateTime(s: string) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysBetween(a: string | undefined | null, b: string | undefined | null): number | null {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  if (isNaN(diff)) return null;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

interface LeadTimeMetrics {
  orderProcessingDays: number | null;   // G = proforma - initiation
  orderPreparingDays: number | null;    // I = ready - proforma
  mfgLeadTime: number | null;           // N = G + I
  readyToEtdDays: number | null;        // O = etd - ready
  readyToEtdOverTarget: number | null;  // Q = O - 7
  totalDays: number | null;             // R = O + N
  sailDays: number | null;              // T = port - etd
  portToWhDays: number | null;          // V = inward - port
  portToWhOverTarget: number | null;    // X = V - 7
  leadTime: number | null;              // AA = inward - proforma
}

function computeLeadTimeMetrics(form: Partial<CreateFormState>): LeadTimeMetrics {
  const G = daysBetween(form.initiation_date, form.proforma_date);
  const I_ = daysBetween(form.proforma_date, form.ready_date);
  const N = G != null && I_ != null ? G + I_ : null;
  const O = daysBetween(form.ready_date, form.etd_date);
  const Q = O != null ? O - 7 : null;
  const R = O != null && N != null ? O + N : null;
  const T = daysBetween(form.etd_date, form.eta_port_date);
  const V = daysBetween(form.eta_port_date, form.inward_date);
  const X = V != null ? V - 7 : null;
  const AA = daysBetween(form.proforma_date, form.inward_date);
  return {
    orderProcessingDays: G,
    orderPreparingDays: I_,
    mfgLeadTime: N,
    readyToEtdDays: O,
    readyToEtdOverTarget: Q,
    totalDays: R,
    sailDays: T,
    portToWhDays: V,
    portToWhOverTarget: X,
    leadTime: AA,
  };
}

function overTargetClass(val: number | null): string {
  if (val === null) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400';
  if (val <= 0) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (val <= 3) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  if (val <= 6) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
}

function MetricCell({ label, value, unit = 'd', highlight }: { label: string; value: number | null; unit?: string; highlight?: string }) {
  const base = highlight ?? 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300';
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg px-2 py-1.5 ${base}`}>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-tight mb-0.5">{label}</span>
      <span className="text-sm font-bold tabular-nums">
        {value != null ? `${value}${unit}` : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
      </span>
    </div>
  );
}

const COMPLETED_PO_STATUSES = new Set(['billed', 'closed', 'received', 'cancelled']);
function isEtaOverdue(eta: string, poStatus: string | null) {
  if (!eta) return false;
  if (poStatus && COMPLETED_PO_STATUSES.has(poStatus.toLowerCase())) return false;
  return new Date(eta) < new Date(today());
}

const PO_STATUS_COLORS: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  billed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  closed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};
function poStatusClass(s: string | null) {
  if (!s) return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  return PO_STATUS_COLORS[s.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
}

function fileIconColor(contentType: string, filename: string) {
  const lower = filename.toLowerCase();
  if (contentType.startsWith('image/')) return 'text-emerald-500';
  if (contentType === 'application/pdf' || lower.endsWith('.pdf')) return 'text-red-500';
  if (lower.match(/\.(xlsx?|csv|ods)$/)) return 'text-green-600';
  if (lower.match(/\.(zip|rar|7z|tar|gz)$/)) return 'text-orange-500';
  if (lower.match(/\.(docx?|odt|pages)$/)) return 'text-blue-500';
  return 'text-zinc-400';
}

export default function BrandOrders() {
  const { user, accessToken } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const isAdmin = user?.role === 'admin';

  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders, setOrders] = useState<BrandOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderDocs, setOrderDocs] = useState<Record<string, Document[]>>({});
  const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});
  const [docPage, setDocPage] = useState<Record<string, number>>({});
  const [docSearch, setDocSearch] = useState<Record<string, string>>({});

  const [globalFileSearch, setGlobalFileSearch] = useState('');
  const [globalFileResults, setGlobalFileResults] = useState<GlobalFileResult[]>([]);
  const [globalFileSearching, setGlobalFileSearching] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [zippingOrder, setZippingOrder] = useState<string | null>(null);
  const [downloadingItemZip, setDownloadingItemZip] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // categories
  const [categories, setCategories] = useState<string[]>([]);
  const [orderUploadCategory, setOrderUploadCategory] = useState<Record<string, string>>({});
  const [addingCatForOrder, setAddingCatForOrder] = useState<string | null>(null);
  const [catInput, setCatInput] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [recatDoc, setRecatDoc] = useState<string | null>(null);
  const [recatLoading, setRecatLoading] = useState<string | null>(null);

  // line items
  const [lineItemsMap, setLineItemsMap] = useState<Record<string, LineItem[]>>({});
  const [lineItemsLoading, setLineItemsLoading] = useState<Record<string, boolean>>({});
  const [expandedLineItems, setExpandedLineItems] = useState<Record<string, Set<string>>>({});
  const [expandedLineItemSections, setExpandedLineItemSections] = useState<Set<string>>(new Set());

  // per-order doc filters
  const [docCatFilter, setDocCatFilter] = useState<Record<string, string>>({});
  const [docItemFilter, setDocItemFilter] = useState<Record<string, string>>({});
  const [reportBrand, setReportBrand] = useState<string>('');

  const [createForVendor, setCreateForVendor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({ brand: '', vendor_id: '', order_date: today(), shipment_eta: eta45() });

  const [showCreateBrand, setShowCreateBrand] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreateFormState>>({});
  const [saving, setSaving] = useState(false);

  const [poEditingOrder, setPoEditingOrder] = useState<string | null>(null);
  const [poQuery, setPoQuery] = useState('');
  const [poResults, setPoResults] = useState<PoResult[]>([]);
  const [poSearching, setPoSearching] = useState(false);
  const [poSaving, setPoSaving] = useState(false);

  const [createPoQuery, setCreatePoQuery] = useState('');
  const [createPoResults, setCreatePoResults] = useState<PoResult[]>([]);
  const [createPoSearching, setCreatePoSearching] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const folderInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Unique vendors derived from brands list, sorted by name
  const vendorList = useMemo(() => {
    const map: Record<string, { contact_id: string; contact_name: string; currency_code?: string; brands: Brand[] }> = {};
    for (const brand of brands) {
      for (const v of brand.vendors) {
        if (!map[v.contact_id]) map[v.contact_id] = { contact_id: v.contact_id, contact_name: v.contact_name, currency_code: v.currency_code, brands: [] };
        map[v.contact_id].brands.push(brand);
      }
    }
    return Object.values(map).sort((a, b) => a.contact_name.localeCompare(b.contact_name));
  }, [brands]);

  const ordersByVendor = useMemo(() => {
    const map: Record<string, BrandOrder[]> = {};
    for (const order of orders) {
      const key = order.vendor_id ?? '__unassigned__';
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    return map;
  }, [orders]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendorList;
    const q = searchQuery.toLowerCase();
    return vendorList.filter(v =>
      v.contact_name.toLowerCase().includes(q) ||
      v.brands.some(b => b.name.toLowerCase().includes(q)) ||
      (ordersByVendor[v.contact_id] || []).some(o =>
        o.name.toLowerCase().includes(q) || o.brand.toLowerCase().includes(q)
      )
    );
  }, [vendorList, searchQuery, ordersByVendor]);

  const newOrdersCount = useMemo(() => {
    return orders.filter(o => !o.inward_date && o.po_status?.toLowerCase() !== 'closed').length;
  }, [orders]);

  const getVisibleOrders = useCallback((vendorId: string) => {
    const vOrders = ordersByVendor[vendorId] || [];
    if (!searchQuery.trim()) return vOrders;
    const q = searchQuery.toLowerCase();
    const vendor = vendorList.find(v => v.contact_id === vendorId);
    if (vendor?.contact_name.toLowerCase().includes(q)) return vOrders;
    return vOrders.filter(o => o.name.toLowerCase().includes(q) || o.brand.toLowerCase().includes(q));
  }, [ordersByVendor, searchQuery, vendorList]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    setExpandedBrands(prev => {
      const next = new Set(prev);
      for (const vendor of vendorList) {
        const vOrders = ordersByVendor[vendor.contact_id] || [];
        if (
          vendor.contact_name.toLowerCase().includes(q) ||
          vendor.brands.some(b => b.name.toLowerCase().includes(q)) ||
          vOrders.some(o => o.name.toLowerCase().includes(q) || o.brand.toLowerCase().includes(q))
        ) next.add(vendor.contact_id);
      }
      return next;
    });
  }, [searchQuery, vendorList, ordersByVendor]);

  useEffect(() => {
    if (!accessToken) return;
    const isAdmin = user?.role === 'admin' || user?.role === 'purchase_admin';
    const userPermIds: string[] = user?.permissions ?? [];

    axios.get(`${API_URL}/users/permissions`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(({ data }: { data: any[] }) => {
        const resolved = data.filter((p) => userPermIds.includes(p._id));
        const hasView = resolved.some((p) => p.name === 'brand_orders_view');
        const hasEdit = resolved.some((p) => p.name === 'brand_orders_edit');
        if (hasEdit) {
          setCanEdit(true);
        } else if (hasView) {
          setCanEdit(false);
        } else {
          // No explicit brand_orders permission assigned — fall back to role
          setCanEdit(isAdmin);
        }
      })
      .catch(() => { setCanEdit(isAdmin); });
  }, [user, accessToken]);

  useEffect(() => {
    axios.get(`${API_URL}/brand_orders/categories`)
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories(['PI', 'CL', 'Bill of Lading', 'Bill of Entry', 'Insurance']));
  }, []);

  const fetchBrands = useCallback(async () => {
    try {
      const { data } = await axios.get<{ brands: Brand[] }>(`${API_URL}/vendors/brands`);
      setBrands(data.brands || []);
    } catch { toast.error('Failed to load brands'); }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<BrandOrder[]>(`${API_URL}/brand_orders/`);
      setOrders(data);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const run = async () => {
      await axios.post(`${API_URL}/brand_orders/backfill-vendor-ids`).catch(() => { });
      await Promise.all([fetchBrands(), fetchOrders()]);
    };
    run();
  }, [fetchBrands, fetchOrders]);

  const fetchOrderDocs = useCallback(async (orderId: string) => {
    setDocsLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const { data } = await axios.get<BrandOrder>(`${API_URL}/brand_orders/${orderId}`);
      setOrderDocs(prev => ({ ...prev, [orderId]: data.documents || [] }));
      setDocPage(prev => ({ ...prev, [orderId]: 0 }));
    } catch { toast.error('Failed to load documents'); }
    finally { setDocsLoading(prev => ({ ...prev, [orderId]: false })); }
  }, []);

  const toggleBrand = (n: string) =>
    setExpandedBrands(prev => { const s = new Set(prev); if (s.has(n)) { s.delete(n); } else { s.add(n); } return s; });

  const fetchLineItemsForOrder = useCallback((orderId: string) => {
    setLineItemsLoading(prev => ({ ...prev, [orderId]: true }));
    axios.get<LineItem[]>(`${API_URL}/brand_orders/${orderId}/line-items`)
      .then(({ data }) => setLineItemsMap(prev => ({ ...prev, [orderId]: data })))
      .catch(() => setLineItemsMap(prev => ({ ...prev, [orderId]: [] })))
      .finally(() => setLineItemsLoading(prev => ({ ...prev, [orderId]: false })));
  }, []);

  const toggleLineItem = useCallback((orderId: string, itemId: string) => {
    setExpandedLineItems(prev => {
      const set = new Set(prev[orderId] || []);
      if (set.has(itemId)) set.delete(itemId); else set.add(itemId);
      return { ...prev, [orderId]: set };
    });
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedOrder === id) { setExpandedOrder(null); return; }
    setExpandedOrder(id);
    fetchOrderDocs(id);
    const order = orders.find(o => o._id === id);
    if (order?.purchaseorder_number && lineItemsMap[id] === undefined) {
      fetchLineItemsForOrder(id);
    }
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) { toast.error('Brand name is required'); return; }
    setCreatingBrand(true);
    try {
      await axios.post(`${API_URL}/vendors/brands`, { name: newBrandName.trim() });
      toast.success(`Brand "${newBrandName.trim()}" created`);
      await fetchBrands();
      setShowCreateBrand(false);
      setNewBrandName('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create brand');
    } finally { setCreatingBrand(false); }
  };

  const openCreateOrder = (vendorId: string, vendorBrands: Brand[]) => {
    const brandOptions = vendorBrands.filter(b => b.vendors.some(v => v.contact_id === vendorId));
    const defaultBrand = brandOptions.length > 0 ? brandOptions[0].name : '';
    setCreateForVendor(vendorId);
    setCreateForm({ brand: defaultBrand, vendor_id: vendorId, order_date: '', shipment_eta: '', purchaseorder_number: undefined });
    setCreatePoQuery('');
    setCreatePoResults([]);
  };

  const searchCreatePo = async (q: string) => {
    setCreatePoQuery(q);
    if (!q.trim()) { setCreatePoResults([]); return; }
    setCreatePoSearching(true);
    try {
      const { data } = await axios.get<PoResult[]>(`${API_URL}/brand_orders/po/search`, { params: { q } });
      setCreatePoResults(data);
    } catch { setCreatePoResults([]); }
    finally { setCreatePoSearching(false); }
  };

  const selectCreatePo = (po: PoResult) => {
    if (po.vendor_id && createForm.vendor_id && po.vendor_id !== createForm.vendor_id) {
      toast.error(`This PO belongs to a different vendor — cannot attach it here`);
      return;
    }
    setCreatePoQuery(po.purchaseorder_number);
    setCreatePoResults([]);
    setCreateForm(p => ({
      ...p,
      purchaseorder_number: po.purchaseorder_number,
      ...(po.po_date ? { order_date: po.po_date } : {}),
      ...(po.bill_date ? { shipment_eta: po.bill_date } : {}),
    }));
  };

  const clearCreatePo = () => {
    setCreatePoQuery('');
    setCreatePoResults([]);
    setCreateForm(p => ({ ...p, purchaseorder_number: undefined, order_date: '', shipment_eta: '' }));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const form = new FormData();
      form.append('brand', createForm.brand);
      form.append('vendor_id', createForm.vendor_id);
      if (createForm.order_date) form.append('order_date', createForm.order_date);
      if (createForm.shipment_eta) form.append('shipment_eta', createForm.shipment_eta);
      if (createForm.purchaseorder_number) form.append('purchaseorder_number', createForm.purchaseorder_number);
      if (createForm.initiation_date) form.append('initiation_date', createForm.initiation_date);
      if (createForm.proforma_date) form.append('proforma_date', createForm.proforma_date);
      if (createForm.ready_date) form.append('ready_date', createForm.ready_date);
      if (createForm.etd_date) form.append('etd_date', createForm.etd_date);
      if (createForm.eta_port_date) form.append('eta_port_date', createForm.eta_port_date);
      if (createForm.duty_payment_date) form.append('duty_payment_date', createForm.duty_payment_date);
      if (createForm.inward_date) form.append('inward_date', createForm.inward_date);
      await axios.post(`${API_URL}/brand_orders/`, form);
      toast.success('Order created');
      setCreateForVendor(null);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create order');
    } finally { setCreating(false); }
  };

  const startEdit = (order: BrandOrder) => {
    setEditingOrder(order._id);
    setEditForm({
      name: order.name,
      order_date: order.order_date, shipment_eta: order.shipment_eta,
      initiation_date: order.initiation_date ?? '',
      proforma_date: order.proforma_date ?? '',
      ready_date: order.ready_date ?? '',
      etd_date: order.etd_date ?? '',
      eta_port_date: order.eta_port_date ?? '',
      duty_payment_date: order.duty_payment_date ?? '',
      inward_date: order.inward_date ?? '',
    });
  };
  const cancelEdit = () => { setEditingOrder(null); setEditForm({}); };

  const handleSaveEdit = async (orderId: string) => {
    setSaving(true);
    try {
      const form = new FormData();
      if (editForm.name !== undefined) form.append('name', editForm.name);
      if (editForm.order_date !== undefined) form.append('order_date', editForm.order_date);
      if (editForm.shipment_eta !== undefined) form.append('shipment_eta', editForm.shipment_eta);
      form.append('initiation_date', editForm.initiation_date ?? '');
      form.append('proforma_date', editForm.proforma_date ?? '');
      form.append('ready_date', editForm.ready_date ?? '');
      form.append('etd_date', editForm.etd_date ?? '');
      form.append('eta_port_date', editForm.eta_port_date ?? '');
      form.append('duty_payment_date', editForm.duty_payment_date ?? '');
      form.append('inward_date', editForm.inward_date ?? '');
      await axios.patch(`${API_URL}/brand_orders/${orderId}`, form);
      toast.success('Order updated');
      setEditingOrder(null);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update order');
    } finally { setSaving(false); }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Delete this order and all its documents? This cannot be undone.')) return;
    setDeletingOrder(orderId);
    try {
      await axios.delete(`${API_URL}/brand_orders/${orderId}`);
      toast.success('Order deleted');
      if (expandedOrder === orderId) setExpandedOrder(null);
      await fetchOrders();
    } catch { toast.error('Failed to delete order'); }
    finally { setDeletingOrder(null); }
  };

  const searchPo = async (q: string) => {
    setPoQuery(q);
    if (!q.trim()) { setPoResults([]); return; }
    setPoSearching(true);
    try {
      const { data } = await axios.get<PoResult[]>(`${API_URL}/brand_orders/po/search`, { params: { q } });
      setPoResults(data);
    } catch { setPoResults([]); }
    finally { setPoSearching(false); }
  };

  const attachPo = async (orderId: string, poNumber: string) => {
    setPoSaving(true);
    try {
      const form = new FormData();
      form.append('purchaseorder_number', poNumber);
      await axios.patch(`${API_URL}/brand_orders/${orderId}`, form);
      toast.success(poNumber ? `PO ${poNumber} attached` : 'PO detached');
      setPoEditingOrder(null);
      setPoQuery('');
      setPoResults([]);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to attach PO');
    } finally { setPoSaving(false); }
  };

  const searchGlobalFiles = useCallback(async (q: string) => {
    setGlobalFileSearch(q);
    if (!q.trim()) { setGlobalFileResults([]); return; }
    setGlobalFileSearching(true);
    try {
      const { data } = await axios.get<GlobalFileResult[]>(`${API_URL}/brand_orders/documents/search`, { params: { q } });
      setGlobalFileResults(data);
    } catch { setGlobalFileResults([]); }
    finally { setGlobalFileSearching(false); }
  }, []);

  const handleUploadDoc = async (
    orderId: string,
    uploads: Array<{ file: File; relativePath?: string }>,
    category?: string,
    itemId?: string,
    itemName?: string,
  ) => {
    setUploadingFor(orderId);
    setUploadProgress(prev => ({ ...prev, [orderId]: { done: 0, total: uploads.length } }));
    try {
      await Promise.all(uploads.map(async ({ file, relativePath }) => {
        const form = new FormData();
        form.append('file', file);
        if (relativePath) form.append('relative_path', relativePath);
        if (category) form.append('category', category);
        if (itemId) form.append('item_id', itemId);
        if (itemName) form.append('item_name', itemName);
        await axios.post(`${API_URL}/brand_orders/${orderId}/documents`, form);
        setUploadProgress(prev => ({
          ...prev,
          [orderId]: { done: (prev[orderId]?.done ?? 0) + 1, total: uploads.length },
        }));
      }));
      toast.success(uploads.length === 1 ? `${uploads[0].file.name} uploaded` : `${uploads.length} files uploaded`);
      await fetchOrderDocs(orderId);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingFor(null);
      setUploadProgress(prev => { const next = { ...prev }; delete next[orderId]; return next; });
      if (fileInputRefs.current[orderId]) fileInputRefs.current[orderId]!.value = '';
      if (folderInputRefs.current[orderId]) folderInputRefs.current[orderId]!.value = '';
    }
  };

  const handleAddCategory = useCallback(async (orderId: string) => {
    const name = catInput.trim();
    if (!name) { setAddingCatForOrder(null); return; }
    if (categories.includes(name)) {
      setOrderUploadCategory(prev => ({ ...prev, [orderId]: name }));
      setAddingCatForOrder(null); setCatInput(''); return;
    }
    setAddingCat(true);
    try {
      await axios.post(`${API_URL}/brand_orders/categories`, { name });
      setCategories(prev => [...prev, name]);
      setOrderUploadCategory(prev => ({ ...prev, [orderId]: name }));
      setAddingCatForOrder(null); setCatInput('');
    } catch { toast.error('Failed to add category'); }
    finally { setAddingCat(false); }
  }, [catInput, categories]);

  const handleDeleteCategory = useCallback(async (name: string) => {
    if (!confirm(`Delete category "${name}"? It won't remove files already tagged with it.`)) return;
    try {
      await axios.delete(`${API_URL}/brand_orders/categories/${encodeURIComponent(name)}`);
      setCategories(prev => prev.filter(c => c !== name));
      setOrderUploadCategory(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (next[k] === name) delete next[k]; });
        return next;
      });
    } catch {
      toast.error('Failed to delete category');
    }
  }, []);

  const handleRecategorize = useCallback(async (orderId: string, docId: string, newCategory: string) => {
    setRecatLoading(docId);
    try {
      await axios.patch(`${API_URL}/brand_orders/${orderId}/documents/${docId}`, { category: newCategory });
      setOrderDocs(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(d => d.doc_id === docId ? { ...d, category: newCategory } : d),
      }));
      setRecatDoc(null);
    } catch { toast.error('Failed to update category'); }
    finally { setRecatLoading(null); }
  }, []);

  const handleDownloadItemZip = useCallback(async (
    orderId: string, orderName: string, itemId: string, itemName: string,
  ) => {
    setDownloadingItemZip(itemId);
    try {
      const { data } = await axios.get(
        `${API_URL}/brand_orders/${orderId}/documents/zip`,
        { responseType: 'blob', params: { item_id: itemId } }
      );
      const url = URL.createObjectURL(data as unknown as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${orderName}_${itemName}_docs.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('No files to download for this item'); }
    finally { setDownloadingItemZip(null); }
  }, []);

  const handleDeleteItemDocs = useCallback(async (orderId: string, itemId: string, itemName: string) => {
    const docs = orderDocs[orderId] || [];
    const targets = docs.filter(d => d.item_id === itemId);
    if (!targets.length) return;
    if (!confirm(`Delete all ${targets.length} file${targets.length !== 1 ? 's' : ''} for "${itemName}"? This cannot be undone.`)) return;
    for (const doc of targets) {
      try {
        await axios.delete(`${API_URL}/brand_orders/${orderId}/documents/${doc.doc_id}`);
        setOrderDocs(prev => ({ ...prev, [orderId]: (prev[orderId] || []).filter(d => d.doc_id !== doc.doc_id) }));
      } catch { toast.error(`Failed to delete ${doc.filename}`); }
    }
    toast.success(`Deleted all files for "${itemName}"`);
  }, [orderDocs]);

  const handleViewDoc = async (orderId: string, docId: string) => {
    setViewingDoc(docId);
    try {
      const { data } = await axios.get<{ url: string }>(`${API_URL}/brand_orders/${orderId}/documents/${docId}/url`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch { toast.error('Failed to get view link'); }
    finally { setViewingDoc(null); }
  };

  const handleDownloadDoc = async (orderId: string, docId: string, filename: string) => {
    setDownloadingDoc(docId);
    try {
      const { data } = await axios.get<{ url: string }>(`${API_URL}/brand_orders/${orderId}/documents/${docId}/url`);
      const a = document.createElement('a');
      a.href = data.url; a.download = filename; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { toast.error('Failed to get download link'); }
    finally { setDownloadingDoc(null); }
  };

  const handleDownloadZip = async (orderId: string, orderName: string) => {
    setZippingOrder(orderId);
    try {
      const response = await axios.get(`${API_URL}/brand_orders/${orderId}/documents/zip`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${orderName}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download ZIP'); }
    finally { setZippingOrder(null); }
  };

  const handleDownloadLeadTimeReport = async (brand?: string) => {
    if (!accessToken) { toast.error('Not authenticated'); return; }
    setDownloadingReport(true);
    try {
      const params = brand ? { brand } : {};
      const response = await axios.get(`${API_URL}/brand_orders/lead-time-report`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Lead_Time_Report_${date}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const detail = err?.response?.data ? 'Access denied or server error' : 'Failed to download report';
      toast.error(detail);
    } finally { setDownloadingReport(false); }
  };

  const handleDeleteDoc = async (orderId: string, docId: string) => {
    if (!confirm('Delete this document?')) return;
    setDeletingDoc(docId);
    try {
      await axios.delete(`${API_URL}/brand_orders/${orderId}/documents/${docId}`);
      toast.success('Document deleted');
      setOrderDocs(prev => ({ ...prev, [orderId]: (prev[orderId] || []).filter(d => d.doc_id !== docId) }));
    } catch { toast.error('Failed to delete document'); }
    finally { setDeletingDoc(null); }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Brand Orders</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
            {brands.length} brand{brands.length !== 1 ? 's' : ''} · {orders.length} order{orders.length !== 1 ? 's' : ''}
            {newOrdersCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">{newOrdersCount} new</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchBrands(); fetchOrders(); }}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <select
                value={reportBrand}
                onChange={e => setReportBrand(e.target.value)}
                className="h-9 px-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
              <button
                onClick={() => handleDownloadLeadTimeReport(reportBrand || undefined)}
                disabled={downloadingReport}
                title="Download Lead Time Report"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                {downloadingReport ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                Lead Time Report 
              </button>
            </div>
          )}
          {/* {canEdit && (
            <button
              onClick={() => setShowCreateBrand(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Plus size={15} /> New Brand
            </button>
          )} */}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search brands or orders…"
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => { setGlobalSearchOpen(o => !o); setGlobalFileSearch(''); setGlobalFileResults([]); }}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-xl border shadow-sm transition-all ${globalSearchOpen ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-violet-400 dark:hover:border-violet-600'}`}
          title="Search files across all orders"
        >
          <FileText size={14} /> Files
        </button>
      </div>

      {/* ── Global file search panel ── */}
      {globalSearchOpen && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-violet-50 dark:bg-violet-950/20">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={globalFileSearch}
                onChange={e => searchGlobalFiles(e.target.value)}
                placeholder="Search file names across all orders…"
                autoFocus
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {globalFileSearching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" />}
              {globalFileSearch && !globalFileSearching && (
                <button onClick={() => { setGlobalFileSearch(''); setGlobalFileResults([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          {globalFileSearch.trim() && (
            globalFileResults.length === 0 && !globalFileSearching ? (
              <p className="text-sm text-zinc-400 text-center py-8">No files match "{globalFileSearch}"</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-80 overflow-y-auto">
                {globalFileResults.map(r => (
                  <div key={`${r.order_id}-${r.doc.doc_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <FileText size={13} className={`flex-shrink-0 ${fileIconColor(r.doc.content_type, r.doc.filename)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{r.doc.filename}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        <span className="text-violet-600 dark:text-violet-400 font-medium">{r.brand}</span>
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                        {r.order_name}
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                        {fmtSize(r.doc.size)}
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                        {fmtDateTime(r.doc.uploaded_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => handleViewDoc(r.order_id, r.doc.doc_id)} disabled={viewingDoc === r.doc.doc_id}
                        className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="View">
                        {viewingDoc === r.doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                      </button>
                      <button onClick={() => handleDownloadDoc(r.order_id, r.doc.doc_id, r.doc.filename)} disabled={downloadingDoc === r.doc.doc_id}
                        className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Download">
                        {downloadingDoc === r.doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      </button>
                      {canEdit && (
                        <button onClick={() => handleDeleteDoc(r.order_id, r.doc.doc_id)} disabled={deletingDoc === r.doc.doc_id}
                          className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                          {deletingDoc === r.doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          {!globalFileSearch.trim() && (
            <p className="text-sm text-zinc-400 text-center py-6">Type a filename to search across all orders</p>
          )}
        </div>
      )}

      {/* ── Create Brand modal ── */}
      {canEdit && showCreateBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Brand</h2>
              <button onClick={() => { setShowCreateBrand(false); setNewBrandName(''); }}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateBrand()}
                placeholder="e.g. Acme Pet Foods" autoFocus
                className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowCreateBrand(false); setNewBrandName(''); }}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateBrand} disabled={creatingBrand}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {creatingBrand ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {creatingBrand ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Order modal ── */}
      {canEdit && createForVendor !== null && (() => {
        const cv = vendorList.find(vv => vv.contact_id === createForVendor);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md">

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">New Order</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Package size={11} className="text-blue-500" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{cv?.contact_name ?? createForVendor}</span>
                    {cv?.currency_code && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{cv.currency_code}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setCreateForVendor(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">

                {/* PO Number */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    <Link2 size={13} className="text-zinc-400" />
                    PO Number
                    <span className="text-xs font-normal text-zinc-400">(optional)</span>
                  </label>
                  <div className="relative">
                    {createForm.purchaseorder_number ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <span className="font-mono text-sm font-medium text-blue-700 dark:text-blue-300 flex-1">{createForm.purchaseorder_number}</span>
                        <button onClick={clearCreatePo} className="p-0.5 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 rounded transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        <input
                          type="text"
                          value={createPoQuery}
                          onChange={e => searchCreatePo(e.target.value)}
                          placeholder="Search by PO number…"
                          autoComplete="off"
                          className="w-full pl-8 pr-8 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {createPoSearching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" />}
                        {createPoQuery && !createPoSearching && (
                          <button onClick={() => { setCreatePoQuery(''); setCreatePoResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                            <X size={13} />
                          </button>
                        )}
                      </>
                    )}
                    {createPoResults.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                        {createPoResults.map(po => (
                          <button
                            key={po.purchaseorder_number}
                            onClick={() => selectCreatePo(po)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
                          >
                            <span className="font-mono text-sm text-zinc-800 dark:text-zinc-200">{po.purchaseorder_number}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {po.po_date && <span className="text-xs text-zinc-400">{fmtDate(po.po_date)}</span>}
                              {po.bill_date && <span className="text-xs text-zinc-400">→ {fmtDate(po.bill_date)}</span>}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${poStatusClass(po.order_status_formatted)}`}>
                                {po.order_status_formatted || 'unknown'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {(createForm.order_date || createForm.shipment_eta) && (
                    <div className="flex items-center gap-3 mt-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
                      <Check size={11} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <div className="flex gap-4 text-xs text-emerald-700 dark:text-emerald-300">
                        {createForm.order_date && <span><span className="font-medium">PO Date:</span> {fmtDate(createForm.order_date)}</span>}
                        {createForm.shipment_eta && <span><span className="font-medium">Bill Date:</span> {fmtDate(createForm.shipment_eta)}</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Manual dates */}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['initiation_date', 'Date of Initiation'],
                    ['proforma_date', 'Date of Proforma Invoice'],
                    ['ready_date', 'Order Ready Date'],
                    ['etd_date', 'ETD / Sailing Date'],
                    ['eta_port_date', 'Port / ETA Date'],
                    ['duty_payment_date', 'Duty Payment Date'],
                    ['inward_date', 'Inward Date'],
                  ] as [keyof CreateFormState, string][]).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{label}</label>
                      <input
                        type="date"
                        value={(createForm[field] as string) || ''}
                        onChange={e => setCreateForm(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 px-6 pb-5">
                <button
                  onClick={() => setCreateForVendor(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'Creating…' : 'Create Order'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Vendor list ── */}
      {loading && vendorList.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-zinc-400">
          <Loader2 size={20} className="animate-spin mr-2.5" /> Loading…
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          {searchQuery ? (
            <>
              <Search size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No results for "{searchQuery}"</p>
              <p className="text-xs mt-1 text-zinc-400">Try a different search term</p>
            </>
          ) : (
            <>
              <Tag size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No vendors yet</p>
              <p className="text-xs mt-1 text-zinc-400">Add brands with vendor mappings to get started</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map(vendor => {
            const isOpen = expandedBrands.has(vendor.contact_id);
            const visibleOrders = getVisibleOrders(vendor.contact_id);
            const allOrders = ordersByVendor[vendor.contact_id] || [];
            const newVendorOrdersCount = allOrders.filter(o => !o.inward_date && o.po_status?.toLowerCase() !== 'closed').length;

            return (
              <div key={vendor.contact_id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">

                {/* Vendor header */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => toggleBrand(vendor.contact_id)}
                >
                  <span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors flex-shrink-0">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div className="flex items-center justify-center w-7 h-7 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                    <Package size={13} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{vendor.contact_name}</span>
                      {vendor.currency_code && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex-shrink-0">{vendor.currency_code}</span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400">{vendor.brands.map(b => b.name).join(', ')}</span>
                  </div>
                  <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-black dark:text-white ${allOrders.length > 0 ? 'bg-green-300' : 'bg-zinc-100'} ${allOrders.length > 0 ? 'dark:bg-green-600' : 'dark:bg-zinc-800'} rounded-full mr-1`}>
                    {allOrders.length} order{allOrders.length !== 1 ? 's' : ''}
                    {newVendorOrdersCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 leading-none">{newVendorOrdersCount} new</span>
                    )}
                  </span>
                  {canEdit && (
                    <button
                      onClick={e => { e.stopPropagation(); openCreateOrder(vendor.contact_id, brands); }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 dark:border-blue-800 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 rounded-lg transition-all"
                    >
                      <Plus size={11} /> New Order
                    </button>
                  )}
                </div>

                {/* Orders */}
                {isOpen && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800">
                    {visibleOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
                        <Package size={26} className="mb-2 opacity-30" />
                        <p className="text-sm">No orders for this brand yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {visibleOrders.map(order => {
                          const isExpanded = expandedOrder === order._id;
                          const isEditing = editingOrder === order._id;
                          const isPoEditing = poEditingOrder === order._id;
                          const etaPast = isEtaOverdue(order.shipment_eta, order.po_status);
                          const isNewOrder = !order.inward_date && order.po_status?.toLowerCase() !== 'closed';
                          const docs = orderDocs[order._id] || [];
                          const progress = uploadProgress[order._id];
                          const dsq = (docSearch[order._id] || '').toLowerCase();
                          const catFilter = docCatFilter[order._id] || '';
                          const itemFilter = docItemFilter[order._id] || '';
                          const filteredDocs = docs.filter(d => {
                            if (dsq) {
                              const text = [d.filename, d.item_name || '', d.category || ''].join(' ').toLowerCase();
                              if (!text.includes(dsq)) return false;
                            }
                            if (catFilter) {
                              if ((d.category?.trim() || 'general') !== catFilter) return false;
                            }
                            if (itemFilter.startsWith('__cat__')) {
                              const catVal = itemFilter.slice(7);
                              if ((d.category?.trim() || '') !== catVal) return false;
                            } else if (itemFilter === '__none__') { if (d.item_id) return false; }
                            else if (itemFilter) { if (d.item_id !== itemFilter) return false; }
                            return true;
                          });
                          const page = docPage[order._id] ?? 0;
                          const totalPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE);
                          const pagedDocs = filteredDocs.slice(page * DOCS_PER_PAGE, (page + 1) * DOCS_PER_PAGE);
                          const lineItems = lineItemsMap[order._id] || [];
                          const lineItemsAreLoading = lineItemsLoading[order._id] ?? false;
                          const rawUploadCat = orderUploadCategory[order._id];
                          const selectedCategory = rawUploadCat === '' ? 'other' : (rawUploadCat || categories[0] || 'other');
                          const expandedItems = expandedLineItems[order._id] || new Set<string>();
                          const catCounts = docs.reduce<Record<string, number>>((acc, d) => {
                            const c = d.category?.trim() || 'general'; acc[c] = (acc[c] || 0) + 1; return acc;
                          }, {});
                          const docCatKeys = Object.keys(catCounts).sort();
                          const itemDocCounts = docs.reduce<Record<string, number>>((acc, d) => {
                            if (d.item_id) acc[d.item_id] = (acc[d.item_id] || 0) + 1; return acc;
                          }, {});
                          const hasUncategorizedFiles = docs.some(d => !d.item_id);
                          const hasActiveFilters = !!(dsq || catFilter || itemFilter);

                          return (
                            <div key={order._id} className={etaPast ? 'border-l-[3px] border-red-400' : ''}>

                              {/* Order row */}
                              <div className={`px-5 py-3.5 ${etaPast ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                                <div className="flex items-start gap-2.5">
                                  <button
                                    onClick={() => toggleExpand(order._id)}
                                    className="flex-shrink-0 mt-0.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                  >
                                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        {/* Order number */}
                                        <div>
                                          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Order Number</label>
                                          <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-blue-500">
                                            <span className="px-2.5 py-1.5 text-sm text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/80 border-r border-zinc-200 dark:border-zinc-700 select-none">Order #</span>
                                            <input
                                              type="number" min="1"
                                              value={editForm.name?.replace(/^Order\s*#\s*/, '') ?? ''}
                                              onChange={e => setEditForm(p => ({ ...p, name: `Order #${e.target.value}` }))}
                                              className="flex-1 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 bg-transparent focus:outline-none"
                                            />
                                          </div>
                                        </div>
                                        {/* PO Date / Bill Date read-only */}
                                        {(order.order_date || order.shipment_eta) && (
                                          <div className="flex gap-4 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-xs text-zinc-500 dark:text-zinc-400">
                                            {order.order_date && <span><span className="font-medium text-zinc-400">PO Date:</span> {fmtDate(order.order_date)}</span>}
                                            {order.shipment_eta && <span><span className="font-medium text-zinc-400">Bill Date:</span> {fmtDate(order.shipment_eta)}</span>}
                                          </div>
                                        )}
                                        {/* Manual date fields */}
                                        <div className="grid grid-cols-2 gap-2">
                                          {([
                                            ['initiation_date', 'Date of Initiation (E)'],
                                            ['proforma_date', 'Proforma Invoice (F)'],
                                            ['ready_date', 'Order Ready Date (H)'],
                                            ['etd_date', 'ETD / Sailing Date (M)'],
                                            ['eta_port_date', 'Port / ETA Date (S)'],
                                            ['duty_payment_date', 'Duty Payment Date (Y)'],
                                            ['inward_date', 'Inward / WH Date (U/Z)'],
                                          ] as [keyof CreateFormState, string][]).map(([field, label]) => (
                                            <div key={field}>
                                              <label className="block text-xs text-zinc-400 mb-0.5">{label}</label>
                                              <input type="date" value={(editForm[field] as string) ?? ''} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                          ))}
                                        </div>

                                        {/* ── Lead Time Analytics ── */}
                                        {(() => {
                                          const m = computeLeadTimeMetrics(editForm);
                                          const hasAny = Object.values(m).some(v => v !== null);
                                          if (!hasAny) return null;
                                          return (
                                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                                                <BarChart2 size={11} className="text-blue-500" />
                                                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Lead Time Analysis</span>
                                              </div>
                                              <div className="p-2 space-y-2 bg-white dark:bg-zinc-900">

                                                {/* Manufacturer Phase */}
                                                <div>
                                                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Manufacturer Phase</p>
                                                  <div className="grid grid-cols-3 gap-1.5">
                                                    <MetricCell label="Processing Days (G)" value={m.orderProcessingDays} />
                                                    <MetricCell label="Preparing Days (I)" value={m.orderPreparingDays} />
                                                    <MetricCell label="Mfg. Lead Time (N)" value={m.mfgLeadTime} highlight="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" />
                                                  </div>
                                                </div>

                                                {/* Shipping Phase */}
                                                <div>
                                                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Shipping Phase</p>
                                                  <div className="grid grid-cols-4 gap-1.5">
                                                    <MetricCell label="Ready→ETD (O)" value={m.readyToEtdDays} />
                                                    <MetricCell
                                                      label="Over Target (Q=O-7)"
                                                      value={m.readyToEtdOverTarget}
                                                      highlight={overTargetClass(m.readyToEtdOverTarget)}
                                                    />
                                                    <MetricCell label="Sail Days (T)" value={m.sailDays} />
                                                    <MetricCell label="Total Days (R)" value={m.totalDays} highlight="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" />
                                                  </div>
                                                </div>

                                                {/* Last Mile Phase */}
                                                <div>
                                                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Last Mile Phase</p>
                                                  <div className="grid grid-cols-3 gap-1.5">
                                                    <MetricCell label="Port→WH (V)" value={m.portToWhDays} />
                                                    <MetricCell
                                                      label="Over Target (X=V-7)"
                                                      value={m.portToWhOverTarget}
                                                      highlight={overTargetClass(m.portToWhOverTarget)}
                                                    />
                                                    <MetricCell label="Total Lead Time (AA)" value={m.leadTime} highlight="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" />
                                                  </div>
                                                </div>

                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">{order.name}</span>
                                          {isNewOrder && (
                                            <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 leading-none">NEW</span>
                                          )}
                                          {etaPast && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                              <AlertTriangle size={9} /> Overdue
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {order.order_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">PO Date</span>
                                              {fmtDate(order.order_date)}
                                            </span>
                                          )}
                                          {order.shipment_eta && (
                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${etaPast ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                              <span className={`font-medium ${etaPast ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`}>Bill Date</span>
                                              {fmtDate(order.shipment_eta)}
                                            </span>
                                          )}
                                          {order.initiation_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">Initiated</span>
                                              {fmtDate(order.initiation_date)}
                                            </span>
                                          )}
                                          {order.proforma_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">Proforma</span>
                                              {fmtDate(order.proforma_date)}
                                            </span>
                                          )}
                                          {order.ready_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">Ready</span>
                                              {fmtDate(order.ready_date)}
                                            </span>
                                          )}
                                          {order.etd_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">ETD</span>
                                              {fmtDate(order.etd_date)}
                                            </span>
                                          )}
                                          {order.eta_port_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">Port ETA</span>
                                              {fmtDate(order.eta_port_date)}
                                            </span>
                                          )}
                                          {order.duty_payment_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">Duty Paid</span>
                                              {fmtDate(order.duty_payment_date)}
                                            </span>
                                          )}
                                          {order.inward_date && (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-medium text-zinc-400 dark:text-zinc-500">Inward</span>
                                              {fmtDate(order.inward_date)}
                                            </span>
                                          )}
                                          {(() => {
                                            const count = orderDocs[order._id]?.length ?? order.doc_count ?? 0;
                                            return (
                                              <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                                <FileText size={9} className="text-zinc-400" />
                                                {count} doc{count !== 1 ? 's' : ''}
                                              </span>
                                            );
                                          })()}
                                          {order.purchaseorder_number && (
                                            <span className="inline-flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                              <span className="font-mono text-zinc-600 dark:text-zinc-300">{order.purchaseorder_number}</span>
                                              {order.po_currency_code && (
                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{order.po_currency_code}</span>
                                              )}
                                              {order.po_status && (
                                                <span className={`text-xs px-1.5 py-0 rounded font-medium ${poStatusClass(order.po_status)}`}>
                                                  {order.po_status}
                                                </span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    {/* PO search */}
                                    {isPoEditing && (
                                      <div className="relative mt-2">
                                        <div className="flex items-center gap-2">
                                          <div className="relative flex-1">
                                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                            <input type="text" value={poQuery} onChange={e => searchPo(e.target.value)}
                                              placeholder="Search PO number…" autoFocus
                                              className="w-full pl-7 pr-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            {poSearching && <Loader2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" />}
                                          </div>
                                          {order.purchaseorder_number && (
                                            <button onClick={() => attachPo(order._id, '')} disabled={poSaving}
                                              className="text-xs font-medium text-red-500 hover:text-red-700 whitespace-nowrap">
                                              Detach
                                            </button>
                                          )}
                                          <button onClick={() => { setPoEditingOrder(null); setPoQuery(''); setPoResults([]); }}
                                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors">
                                            <X size={13} />
                                          </button>
                                        </div>
                                        {poResults.length > 0 && (
                                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                                            {poResults.map(po => {
                                              const vendorMismatch = !!(po.vendor_id && order.vendor_id && po.vendor_id !== order.vendor_id);
                                              return (
                                                <button key={po.purchaseorder_number}
                                                  onClick={() => {
                                                    if (vendorMismatch) { toast.error('This PO belongs to a different vendor — cannot attach it here'); return; }
                                                    attachPo(order._id, po.purchaseorder_number);
                                                  }}
                                                  disabled={poSaving}
                                                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors text-left ${vendorMismatch ? 'opacity-50 cursor-not-allowed bg-red-50 dark:bg-red-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{po.purchaseorder_number}</span>
                                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {vendorMismatch && <span className="text-xs text-red-500 font-medium">wrong vendor</span>}
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${poStatusClass(po.order_status_formatted)}`}>
                                                      {po.order_status_formatted}
                                                    </span>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Timestamps */}
                                    <p className="text-xs text-zinc-400 mt-1.5">
                                      Created {fmtDateTime(order.created_at)} · Updated {fmtDateTime(order.updated_at)}
                                    </p>
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                                    {isEditing ? (
                                      <>
                                        <button onClick={() => handleSaveEdit(order._id)} disabled={saving}
                                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Save">
                                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                        </button>
                                        <button onClick={cancelEdit}
                                          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Cancel">
                                          <X size={13} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {canEdit && (
                                          <>
                                            <label
                                              className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
                                              title="Upload files"
                                            >
                                              {uploadingFor === order._id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                              <input type="file" multiple className="hidden" disabled={!!uploadingFor}
                                                onChange={e => { if (e.target.files?.length) { handleUploadDoc(order._id, Array.from(e.target.files).map(file => ({ file }))); if (expandedOrder !== order._id) toggleExpand(order._id); } }} />
                                            </label>
                                            <label
                                              className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
                                              title="Upload folder"
                                            >
                                              <FolderOpen size={13} />
                                              <input type="file" className="hidden" disabled={!!uploadingFor}
                                                // @ts-expect-error -- webkitdirectory is a non-standard HTML attribute not in React's type definitions
                                                webkitdirectory=""
                                                onChange={e => { if (e.target.files?.length) { handleUploadDoc(order._id, Array.from(e.target.files).map(file => ({ file, relativePath: (file as any).webkitRelativePath || undefined }))); if (expandedOrder !== order._id) toggleExpand(order._id); } }} />
                                            </label>
                                            <button
                                              onClick={() => { setPoEditingOrder(order._id); setPoQuery(''); setPoResults([]); }}
                                              className="p-1.5 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" title="Attach PO">
                                              <Link2 size={13} />
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={() => handleDownloadZip(order._id, order.name)}
                                          disabled={zippingOrder === order._id}
                                          className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Download all as ZIP">
                                          {zippingOrder === order._id ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                                        </button>
                                        {canEdit && (
                                          <>
                                            <button
                                              onClick={() => startEdit(order)}
                                              className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Edit order">
                                              <Pencil size={13} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteOrder(order._id)}
                                              disabled={deletingOrder === order._id}
                                              className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete order">
                                              {deletingOrder === order._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded panel */}
                              {isExpanded && (
                                <div className="mx-4 mb-4 space-y-3">

                                  {/* ── Line Items Accordion ── */}
                                  {order.purchaseorder_number && (
                                    <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 overflow-hidden">
                                      <button
                                        onClick={() => setExpandedLineItemSections(prev => {
                                          const next = new Set(prev);
                                          if (next.has(order._id)) next.delete(order._id); else next.add(order._id);
                                          return next;
                                        })}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors text-left"
                                      >
                                        <Layers size={12} className="text-blue-500 flex-shrink-0" />
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex-1">
                                          Line Items — {order.purchaseorder_number}
                                        </span>
                                        {lineItemsAreLoading && <Loader2 size={11} className="animate-spin text-blue-400" />}
                                        {!lineItemsAreLoading && lineItems.length > 0 && (
                                          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                                            {lineItems.length}
                                          </span>
                                        )}
                                        {expandedLineItemSections.has(order._id)
                                          ? <ChevronDown size={13} className="text-blue-400 flex-shrink-0" />
                                          : <ChevronRight size={13} className="text-blue-400 flex-shrink-0" />}
                                      </button>

                                      {expandedLineItemSections.has(order._id) && (lineItemsAreLoading ? (
                                        <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm py-6 bg-white dark:bg-zinc-900">
                                          <Loader2 size={13} className="animate-spin" /> Loading line items…
                                        </div>
                                      ) : lineItems.length === 0 ? (
                                        <div className="px-4 py-5 text-center bg-white dark:bg-zinc-900">
                                          <p className="text-xs text-zinc-400">No line items found for this PO.</p>
                                        </div>
                                      ) : (
                                        <div className="bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                          {(() => {
                                            const newItems = lineItems.filter(i => i.is_new);
                                            const existingItems = lineItems.filter(i => !i.is_new);
                                            return [...newItems, ...existingItems].map((item, idx) => {
                                            const itemDocs = docs.filter(d => d.item_id === item.item_id);
                                            const itemFileCount = itemDocs.length;
                                            const isItemOpen = expandedItems.has(item.item_id);
                                            const showNewDivider = idx === 0 && newItems.length > 0;
                                            const showExistingDivider = idx === newItems.length && existingItems.length > 0 && newItems.length > 0;
                                            return (
                                              <div key={item.item_id}>
                                                {showNewDivider && (
                                                  <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/40">
                                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">New Products ({newItems.length})</span>
                                                  </div>
                                                )}
                                                {showExistingDivider && (
                                                  <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800">
                                                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Existing Products ({existingItems.length})</span>
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                                  <button
                                                    onClick={() => itemFileCount > 0 && toggleLineItem(order._id, item.item_id)}
                                                    className={`flex-shrink-0 transition-colors ${itemFileCount > 0 ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer' : 'text-zinc-200 dark:text-zinc-700 cursor-default'}`}
                                                  >
                                                    {isItemOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                  </button>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                        {lineItemLabel(item)}
                                                      </span>
                                                      {item.is_new && (
                                                        <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 leading-none">NEW</span>
                                                      )}
                                                    </div>
                                                    <span className="text-xs text-zinc-400">Qty: {item.quantity}</span>
                                                  </div>
                                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${itemFileCount > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'}`}>
                                                    {itemFileCount} {itemFileCount === 1 ? 'file' : 'files'}
                                                  </span>
                                                  {itemFileCount > 0 && (
                                                    <button
                                                      onClick={() => handleDownloadItemZip(order._id, order.name, item.item_id, lineItemLabel(item))}
                                                      disabled={downloadingItemZip === item.item_id}
                                                      className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                      title="Download all files for this item as ZIP"
                                                    >
                                                      {downloadingItemZip === item.item_id ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                                                    </button>
                                                  )}
                                                  {canEdit && itemFileCount > 0 && (
                                                    <button
                                                      onClick={() => handleDeleteItemDocs(order._id, item.item_id, lineItemLabel(item))}
                                                      className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                      title="Delete all files for this item"
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  )}
                                                </div>
                                                {isItemOpen && itemDocs.length > 0 && (
                                                  <div className="border-t border-blue-100 dark:border-blue-900/30 divide-y divide-blue-50 dark:divide-blue-900/20 bg-blue-50/40 dark:bg-blue-950/10">
                                                    {itemDocs.map(doc => (
                                                      <div key={doc.doc_id} className="flex items-center gap-3 pl-10 pr-4 py-2 group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                                        <FileText size={12} className={`flex-shrink-0 ${fileIconColor(doc.content_type, doc.filename)}`} />
                                                        <div className="flex-1 min-w-0">
                                                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{doc.filename}</p>
                                                          <p className="text-xs text-zinc-400">{fmtSize(doc.size)} · {fmtDateTime(doc.uploaded_at)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                          <button onClick={() => handleViewDoc(order._id, doc.doc_id)} disabled={viewingDoc === doc.doc_id}
                                                            className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="View">
                                                            {viewingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                                                          </button>
                                                          <button onClick={() => handleDownloadDoc(order._id, doc.doc_id, doc.filename)} disabled={downloadingDoc === doc.doc_id}
                                                            className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Download">
                                                            {downloadingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                                          </button>
                                                          {canEdit && (
                                                            <button onClick={() => handleDeleteDoc(order._id, doc.doc_id)} disabled={deletingDoc === doc.doc_id}
                                                              className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                                                              {deletingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                            </button>
                                                          )}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          });
                                          })()}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* ── Files Section ── */}
                                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">

                                    {/* Upload toolbar */}
                                    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <FileText size={12} className="text-zinc-400" />
                                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Files</span>
                                          {docs.length > 0 && (
                                            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full font-medium">
                                              {hasActiveFilters && filteredDocs.length !== docs.length ? `${filteredDocs.length}/${docs.length}` : docs.length}
                                            </span>
                                          )}
                                        </div>
                                        {canEdit && (
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {/* Category pill selector */}
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <span className="text-xs text-zinc-400">Upload to:</span>
                                              {addingCatForOrder === order._id ? (
                                                <>
                                                  <input
                                                    autoFocus
                                                    value={catInput}
                                                    onChange={e => setCatInput(e.target.value)}
                                                    onKeyDown={e => {
                                                      if (e.key === 'Enter') handleAddCategory(order._id);
                                                      if (e.key === 'Escape') { setAddingCatForOrder(null); setCatInput(''); }
                                                    }}
                                                    placeholder="New category…"
                                                    className="w-28 text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-700 rounded-full text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                  />
                                                  <button
                                                    onClick={() => handleAddCategory(order._id)}
                                                    disabled={addingCat || !catInput.trim()}
                                                    className="text-xs font-medium px-2 py-0.5 bg-blue-600 text-white rounded-full disabled:opacity-40 hover:bg-blue-700 transition-colors"
                                                  >
                                                    {addingCat ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
                                                  </button>
                                                  <button
                                                    onClick={() => { setAddingCatForOrder(null); setCatInput(''); }}
                                                    className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full"
                                                  >
                                                    <X size={11} />
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  {categories.map(cat => (
                                                    <span key={cat} className={`inline-flex items-center gap-0.5 text-xs rounded-full border font-medium transition-all ${
                                                      selectedCategory === cat
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                                                    }`}>
                                                      <button
                                                        onClick={() => setOrderUploadCategory(prev => ({ ...prev, [order._id]: selectedCategory === cat ? '' : cat }))}
                                                        className="pl-2.5 pr-1 py-0.5"
                                                      >
                                                        {cat}
                                                      </button>
                                                      <button
                                                        onClick={() => handleDeleteCategory(cat)}
                                                        className={`pr-1.5 py-0.5 rounded-r-full transition-colors ${selectedCategory === cat ? 'hover:text-red-200' : 'hover:text-red-500 dark:hover:text-red-400'}`}
                                                        title={`Delete category "${cat}"`}
                                                      >
                                                        <X size={9} />
                                                      </button>
                                                    </span>
                                                  ))}
                                                  <button
                                                    onClick={() => { setAddingCatForOrder(order._id); setCatInput(''); }}
                                                    className="text-xs px-1.5 py-0.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-blue-600 hover:border-blue-400 dark:hover:border-blue-600 transition-all flex items-center gap-0.5"
                                                    title="Add new category"
                                                  >
                                                    <Plus size={10} /> New
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                            {/* Upload buttons */}
                                            <div className="flex items-center gap-1">
                                              <label className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 cursor-pointer px-2.5 py-1 border border-blue-200 dark:border-blue-800 rounded-lg transition-all">
                                                {uploadingFor === order._id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                                Files
                                                <input
                                                  ref={el => { fileInputRefs.current[order._id] = el; }}
                                                  type="file" multiple className="hidden" disabled={!!uploadingFor}
                                                  onChange={e => { if (e.target.files?.length) handleUploadDoc(order._id, Array.from(e.target.files).map(f => ({ file: f })), selectedCategory); }} />
                                              </label>
                                              <label className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 cursor-pointer px-2.5 py-1 border border-blue-200 dark:border-blue-800 rounded-lg transition-all">
                                                <FolderOpen size={11} />
                                                Folder
                                                <input
                                                  ref={el => { folderInputRefs.current[order._id] = el; }}
                                                  type="file" className="hidden" disabled={!!uploadingFor}
                                                  // @ts-expect-error -- webkitdirectory is non-standard
                                                  webkitdirectory=""
                                                  onChange={e => { if (e.target.files?.length) handleUploadDoc(order._id, Array.from(e.target.files).map(f => ({ file: f, relativePath: (f as any).webkitRelativePath || undefined })), selectedCategory); }} />
                                              </label>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Filter bar */}
                                    {docs.length > 0 && (
                                      <div className="px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center gap-3">
                                        <div className="relative flex-1 min-w-[160px]">
                                          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                          <input
                                            type="text"
                                            value={docSearch[order._id] || ''}
                                            onChange={e => { setDocSearch(prev => ({ ...prev, [order._id]: e.target.value })); setDocPage(prev => ({ ...prev, [order._id]: 0 })); }}
                                            placeholder="Search files, products, categories…"
                                            className="w-full pl-7 pr-6 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                          {docSearch[order._id] && (
                                            <button onClick={() => { setDocSearch(prev => ({ ...prev, [order._id]: '' })); setDocPage(prev => ({ ...prev, [order._id]: 0 })); }}
                                              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                              <X size={10} />
                                            </button>
                                          )}
                                        </div>
                                        {docCatKeys.length > 1 && (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <Filter size={10} className="text-zinc-400 flex-shrink-0" />
                                            <button
                                              onClick={() => { setDocCatFilter(prev => ({ ...prev, [order._id]: '' })); setDocPage(prev => ({ ...prev, [order._id]: 0 })); }}
                                              className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${!catFilter ? 'bg-zinc-700 dark:bg-zinc-300 border-zinc-700 dark:border-zinc-300 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400'}`}
                                            >All</button>
                                            {docCatKeys.map(cat => (
                                              <button key={cat}
                                                onClick={() => { setDocCatFilter(prev => ({ ...prev, [order._id]: prev[order._id] === cat ? '' : cat })); setDocPage(prev => ({ ...prev, [order._id]: 0 })); }}
                                                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${catFilter === cat ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-blue-400 dark:hover:border-blue-600'}`}
                                              >
                                                {cat}<span className="ml-1 opacity-60">{catCounts[cat]}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {(categories.length > 0 || lineItems.length > 0) && (
                                          <div className="flex items-center gap-1.5">
                                            <Package size={10} className="text-zinc-400 flex-shrink-0" />
                                            <select
                                              value={itemFilter}
                                              onChange={e => { setDocItemFilter(prev => ({ ...prev, [order._id]: e.target.value })); setDocPage(prev => ({ ...prev, [order._id]: 0 })); }}
                                              className="text-xs px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]"
                                            >
                                              <option value="">Other</option>
                                              {categories.map(cat => (
                                                <option key={`__cat__${cat}`} value={`__cat__${cat}`}>{cat}</option>
                                              ))}
                                              {lineItems.filter(item => itemDocCounts[item.item_id]).map(item => (
                                                <option key={item.item_id} value={item.item_id}>
                                                  {lineItemLabel(item)} ({itemDocCounts[item.item_id]})
                                                </option>
                                              ))}
                                              {hasUncategorizedFiles && (
                                                <option value="__none__">Uncategorized ({docs.filter(d => !d.item_id).length})</option>
                                              )}
                                            </select>
                                          </div>
                                        )}
                                        {hasActiveFilters && (
                                          <button
                                            onClick={() => { setDocSearch(prev => ({ ...prev, [order._id]: '' })); setDocCatFilter(prev => ({ ...prev, [order._id]: '' })); setDocItemFilter(prev => ({ ...prev, [order._id]: '' })); setDocPage(prev => ({ ...prev, [order._id]: 0 })); }}
                                            className="text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-0.5 transition-colors"
                                          >
                                            <X size={10} /> Clear filters
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Upload progress bar */}
                                    {progress && (
                                      <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                            Uploading {progress.done} of {progress.total} file{progress.total !== 1 ? 's' : ''}…
                                          </span>
                                          <span className="text-xs tabular-nums text-blue-500 dark:text-blue-400">
                                            {Math.round((progress.done / progress.total) * 100)}%
                                          </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                                          <div className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                                        </div>
                                      </div>
                                    )}

                                    {/* Doc rows */}
                                    {docsLoading[order._id] ? (
                                      <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm py-8 bg-white dark:bg-zinc-900">
                                        <Loader2 size={14} className="animate-spin" /> Loading…
                                      </div>
                                    ) : docs.length === 0 ? (
                                      <div className="flex flex-col items-center justify-center py-10 text-zinc-400 bg-white dark:bg-zinc-900">
                                        <FileText size={22} className="mb-2 opacity-30" />
                                        <p className="text-sm">No files uploaded yet.</p>
                                        {canEdit && <p className="text-xs mt-1 text-zinc-400">Use the buttons above to upload files or a folder.</p>}
                                      </div>
                                    ) : filteredDocs.length === 0 ? (
                                      <div className="flex flex-col items-center justify-center py-8 text-zinc-400 bg-white dark:bg-zinc-900">
                                        <Filter size={18} className="mb-2 opacity-30" />
                                        <p className="text-sm">No files match the current filters.</p>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                          {pagedDocs.map(doc => (
                                            <div key={doc.doc_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                                              <FileText size={13} className={`flex-shrink-0 ${fileIconColor(doc.content_type, doc.filename)}`} />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{doc.filename}</p>
                                                  {doc.item_name && (
                                                    <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                                      {doc.item_name}
                                                    </span>
                                                  )}
                                                  {canEdit ? (
                                                    recatDoc === doc.doc_id ? (
                                                      <select
                                                        autoFocus
                                                        value={doc.category || categories[0] || ''}
                                                        onChange={e => handleRecategorize(order._id, doc.doc_id, e.target.value)}
                                                        onBlur={() => setRecatDoc(null)}
                                                        disabled={recatLoading === doc.doc_id}
                                                        className="text-xs px-1.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                                                      >
                                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                      </select>
                                                    ) : (
                                                      <button
                                                        onClick={() => setRecatDoc(doc.doc_id)}
                                                        className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                                        title="Click to change category"
                                                      >
                                                        {recatLoading === doc.doc_id ? <Loader2 size={10} className="animate-spin inline" /> : (doc.category || categories[0] || '—')}
                                                      </button>
                                                    )
                                                  ) : (
                                                    doc.category && (
                                                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                                        {doc.category}
                                                      </span>
                                                    )
                                                  )}
                                                </div>
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                  {fmtSize(doc.size)}
                                                  <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
                                                  {fmtDateTime(doc.uploaded_at)}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button onClick={() => handleViewDoc(order._id, doc.doc_id)} disabled={viewingDoc === doc.doc_id}
                                                  className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="View">
                                                  {viewingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                                                </button>
                                                <button onClick={() => handleDownloadDoc(order._id, doc.doc_id, doc.filename)} disabled={downloadingDoc === doc.doc_id}
                                                  className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Download">
                                                  {downloadingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                                </button>
                                                {canEdit && (
                                                  <button onClick={() => handleDeleteDoc(order._id, doc.doc_id)} disabled={deletingDoc === doc.doc_id}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                                                    {deletingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                                            <span className="text-xs text-zinc-400 tabular-nums">
                                              {page * DOCS_PER_PAGE + 1}–{Math.min((page + 1) * DOCS_PER_PAGE, filteredDocs.length)} of {filteredDocs.length}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <button onClick={() => setDocPage(prev => ({ ...prev, [order._id]: page - 1 }))} disabled={page === 0}
                                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                                                <ArrowLeft size={12} />
                                              </button>
                                              {Array.from({ length: totalPages }, (_, i) => (
                                                <button key={i} onClick={() => setDocPage(prev => ({ ...prev, [order._id]: i }))}
                                                  className={`w-6 h-6 text-xs rounded font-medium transition-colors ${i === page ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                                                  {i + 1}
                                                </button>
                                              ))}
                                              <button onClick={() => setDocPage(prev => ({ ...prev, [order._id]: page + 1 }))} disabled={page === totalPages - 1}
                                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                                                <ArrowRight size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
