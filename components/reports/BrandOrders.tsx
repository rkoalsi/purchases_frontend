'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  Plus, Upload, Trash2, Download, Pencil, X, Check, Loader2, RefreshCw,
  FileText, ChevronDown, ChevronRight, Package, Tag, AlertTriangle, Search,
  Archive, Eye, FolderOpen, ArrowLeft, ArrowRight, Link2, BarChart2,
  Layers, Filter, Folder, FolderPlus, Calendar, CreditCard, LayoutList,
} from 'lucide-react';
import OrdersCalendar, { CalendarEvent, CalendarLegendItem } from '@/components/common/OrdersCalendar';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DOCS_PER_PAGE = 5;
const ORDERS_PER_PAGE = 5;

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
  folder?: string;
  item_id?: string;
  item_name?: string;
}

interface FolderRecord {
  folder_id: string;
  name: string;
  path: string;
  parent_path: string;
  created_at: string;
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
  po_sub_total?: number | null;
  po_due_date?: string;
  advance_payment_date?: string;
  advance_payment_amount?: number | null;
  custom_duty?: number | null;
  custom_duty_due_date?: string;
  shipping_charges?: number | null;
  shipping_charges_due_date?: string;
  balance_payment_date?: string;
  balance_payment_amount?: number | null;
  total_payment_made_to_supplier?: number | null;
  total_payment_made_to_supplier_date?: string;
  vendor_payments?: Array<{ name: string | null; amount: number | null; date: string | null }>;
}
interface VendorPaymentRow { name: string; amount: string; date: string; }
interface CreateFormState {
  brand: string; vendor_id: string; name?: string; order_date: string; shipment_eta: string;
  purchaseorder_number?: string;
  initiation_date?: string; proforma_date?: string; ready_date?: string;
  etd_date?: string; eta_port_date?: string; duty_payment_date?: string;
  inward_date?: string;
  po_due_date?: string;
  advance_payment_date?: string;
  advance_payment_amount?: string;
  custom_duty?: string;
  custom_duty_due_date?: string;
  shipping_charges?: string;
  shipping_charges_due_date?: string;
  balance_payment_date?: string;
  balance_payment_amount?: string;
  total_payment_made_to_supplier?: string;
  total_payment_made_to_supplier_date?: string;
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
    const ts = /[Z+\-]\d{2}:?\d{2}$|Z$/.test(s) ? s : s + 'Z';
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch { return s; }
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DateStage = 'neutral' | 'teal' | 'sky' | 'blue' | 'amber' | 'orange' | 'indigo' | 'purple' | 'emerald' | 'red';
const DATE_CHIP_STYLES: Record<DateStage, { wrap: string; icon: string; label: string; value: string }> = {
  neutral: { wrap: 'bg-zinc-50 border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700', icon: 'text-zinc-400 dark:text-zinc-500', label: 'text-zinc-400 dark:text-zinc-500', value: 'text-zinc-700 dark:text-zinc-300' },
  teal: { wrap: 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800', icon: 'text-teal-500 dark:text-teal-400', label: 'text-teal-600 dark:text-teal-500', value: 'text-teal-900 dark:text-teal-200' },
  sky: { wrap: 'bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800', icon: 'text-sky-400 dark:text-sky-400', label: 'text-sky-500 dark:text-sky-400', value: 'text-sky-800 dark:text-sky-200' },
  blue: { wrap: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800', icon: 'text-blue-400', label: 'text-blue-500 dark:text-blue-400', value: 'text-blue-800 dark:text-blue-200' },
  amber: { wrap: 'bg-amber-50 border-amber-300 dark:bg-amber-900/25 dark:border-amber-700', icon: 'text-amber-500 dark:text-amber-400', label: 'text-amber-600 dark:text-amber-500', value: 'text-amber-900 dark:text-amber-200' },
  orange: { wrap: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700', icon: 'text-orange-400', label: 'text-orange-500 dark:text-orange-400', value: 'text-orange-800 dark:text-orange-200' },
  indigo: { wrap: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800', icon: 'text-indigo-400', label: 'text-indigo-500 dark:text-indigo-400', value: 'text-indigo-800 dark:text-indigo-200' },
  purple: { wrap: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800', icon: 'text-purple-400', label: 'text-purple-500 dark:text-purple-400', value: 'text-purple-800 dark:text-purple-200' },
  emerald: { wrap: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700', icon: 'text-emerald-500 dark:text-emerald-400', label: 'text-emerald-600 dark:text-emerald-500', value: 'text-emerald-900 dark:text-emerald-200' },
  red: { wrap: 'bg-red-50 border-red-300 dark:bg-red-900/25 dark:border-red-700', icon: 'text-red-500 dark:text-red-400', label: 'text-red-500 dark:text-red-400', value: 'text-red-800 dark:text-red-200' },
};
const LABEL_STAGE_MAP: Record<string, DateStage> = {
  'PO Date': 'teal', 'Initiated': 'sky', 'Proforma': 'blue',
  'Bill Date': 'amber', 'Ready': 'amber', 'ETD': 'orange',
  'Port ETA': 'indigo', 'Duty Paid': 'purple', 'Inward': 'emerald',
};
interface DateChipProps { label: string; value?: string | null; stage?: DateStage; dim?: boolean; }
function DateChip({ label, value, stage, dim }: DateChipProps) {
  if (!value) return null;
  const s = dim ? 'neutral' : (stage ?? LABEL_STAGE_MAP[label] ?? 'neutral');
  const cls = DATE_CHIP_STYLES[s];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cls.wrap}`}>
      <Calendar size={10} className={`flex-shrink-0 ${cls.icon}`} />
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${cls.label}`}>{label}</span>
      <span className={`font-semibold ${cls.value}`}>{fmtDate(value)}</span>
    </span>
  );
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
  const searchParams = useSearchParams();
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
  const [vendorOrderPage, setVendorOrderPage] = useState<Record<string, number>>({});
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
  const [downloadingPaymentReport, setDownloadingPaymentReport] = useState(false);
  const [downloadingLineItems, setDownloadingLineItems] = useState<string | null>(null);

  // categories
  const [categories, setCategories] = useState<string[]>([]);
  const [orderUploadCategory, setOrderUploadCategory] = useState<Record<string, string>>({});
  const [addingCatForOrder, setAddingCatForOrder] = useState<string | null>(null);
  const [catInput, setCatInput] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [recatDoc, setRecatDoc] = useState<string | null>(null);
  const [recatLoading, setRecatLoading] = useState<string | null>(null);
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameCatInput, setRenameCatInput] = useState('');
  const [renamingCatLoading, setRenamingCatLoading] = useState(false);

  // line items
  const [lineItemsMap, setLineItemsMap] = useState<Record<string, LineItem[]>>({});
  const [lineItemsLoading, setLineItemsLoading] = useState<Record<string, boolean>>({});
  const [expandedLineItems, setExpandedLineItems] = useState<Record<string, Set<string>>>({});
  const [expandedLineItemSections, setExpandedLineItemSections] = useState<Set<string>>(new Set());
  const [collapsedNewSections, setCollapsedNewSections] = useState<Set<string>>(new Set());
  const [collapsedExistingSections, setCollapsedExistingSections] = useState<Set<string>>(new Set());

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
  const emptyVendor = (): VendorPaymentRow => ({ name: '', amount: '', date: '' });
  const [createVendorPayments, setCreateVendorPayments] = useState<VendorPaymentRow[]>([emptyVendor(), emptyVendor(), emptyVendor()]);
  const [editVendorPayments, setEditVendorPayments] = useState<VendorPaymentRow[]>([]);
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

  // ── folder state ─────────────────────────────────────────────────────────
  const [orderFolders, setOrderFolders] = useState<Record<string, FolderRecord[]>>({});
  const [foldersLoading, setFoldersLoading] = useState<Record<string, boolean>>({});
  const [currentFolderPath, setCurrentFolderPath] = useState<Record<string, string>>({});
  const [creatingFolderFor, setCreatingFolderFor] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [movingDocId, setMovingDocId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const ordersByVendor = useMemo(() => {
    const map: Record<string, BrandOrder[]> = {};
    for (const order of orders) {
      const key = order.vendor_id ?? '__unassigned__';
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    for (const vendorOrders of Object.values(map)) {
      vendorOrders.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb !== ta ? tb - ta : b._id.localeCompare(a._id);
      });
    }
    return map;
  }, [orders]);

  // Unique vendors derived from brands list, sorted by most recent order first
  const vendorList = useMemo(() => {
    const map: Record<string, { contact_id: string; contact_name: string; currency_code?: string; brands: Brand[] }> = {};
    for (const brand of brands) {
      for (const v of brand.vendors) {
        if (!map[v.contact_id]) map[v.contact_id] = { contact_id: v.contact_id, contact_name: v.contact_name, currency_code: v.currency_code, brands: [] };
        map[v.contact_id].brands.push(brand);
      }
    }
    return Object.values(map).sort((a, b) => {
      const aOrders = ordersByVendor[a.contact_id] || [];
      const bOrders = ordersByVendor[b.contact_id] || [];
      const aLatest = aOrders.length > 0 ? Math.max(...aOrders.map(o => o.created_at ? new Date(o.created_at).getTime() : 0)) : 0;
      const bLatest = bOrders.length > 0 ? Math.max(...bOrders.map(o => o.created_at ? new Date(o.created_at).getTime() : 0)) : 0;
      if (bLatest !== aLatest) return bLatest - aLatest;
      return a.contact_name.localeCompare(b.contact_name);
    });
  }, [brands, ordersByVendor]);

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
    return orders.filter(o => !o.inward_date && !['closed', 'cancelled'].includes(o.po_status?.toLowerCase() ?? '')).length;
  }, [orders]);

  // All brand names per vendor_id joined with "/" (Dogfest/Catfest → Petfest)
  const vendorBrandLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const vendor of vendorList) {
      const vOrders = ordersByVendor[vendor.contact_id] || [];
      const seen = new Set<string>();
      for (const o of vOrders) {
        if (!o.brand) continue;
        const b = o.brand === 'Dogfest' || o.brand === 'Catfest' ? 'Petfest' : o.brand;
        seen.add(b);
      }
      if (seen.size > 0) map[vendor.contact_id] = [...seen].sort().join('/');
    }
    return map;
  }, [vendorList, ordersByVendor]);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const fields: Array<{ key: keyof BrandOrder; label: string; stage: CalendarEvent['stage'] }> = [
      { key: 'order_date',                  label: 'PO Date',       stage: 'teal' },
      { key: 'initiation_date',             label: 'Initiated',     stage: 'sky' },
      { key: 'proforma_date',               label: 'Proforma',      stage: 'blue' },
      { key: 'ready_date',                  label: 'Ready',         stage: 'amber' },
      { key: 'etd_date',                    label: 'ETD',           stage: 'orange' },
      { key: 'eta_port_date',               label: 'Port ETA',      stage: 'indigo' },
      { key: 'duty_payment_date',           label: 'Duty Paid',     stage: 'purple' },
      { key: 'inward_date',                 label: 'Inward',        stage: 'emerald' },
      { key: 'po_due_date',                 label: 'PO Due',        stage: 'red' },
      { key: 'advance_payment_date',        label: 'Advance Pmt',   stage: 'amber' },
      { key: 'custom_duty_due_date',        label: 'Duty Due',      stage: 'orange' },
      { key: 'shipping_charges_due_date',   label: 'Shipping Due',  stage: 'blue' },
      { key: 'balance_payment_date',        label: 'Balance Pmt',   stage: 'teal' },
      { key: 'total_payment_made_to_supplier_date', label: 'Paid to Supplier', stage: 'emerald' },
    ];
    const normalizeBrand = (order: BrandOrder): string => {
      if (order.vendor_id && vendorBrandLabel[order.vendor_id]) {
        return vendorBrandLabel[order.vendor_id];
      }
      const raw = order.brand;
      return raw === 'Dogfest' || raw === 'Catfest' ? 'Petfest' : raw;
    };
    const evts: CalendarEvent[] = [];
    for (const order of orders) {
      const brand = normalizeBrand(order);
      for (const { key, label, stage } of fields) {
        const val = order[key] as string | undefined | null;
        if (val) {
          evts.push({
            date: val.slice(0, 10),
            label,
            brand,
            poNumber: order.purchaseorder_number,
            orderName: order.name,
            orderId: order._id,
            stage,
          });
        }
      }
      // Dynamic vendor_payments dates
      const VENDOR_STAGES: CalendarEvent['stage'][] = ['sky', 'purple', 'teal', 'amber', 'orange', 'indigo', 'red', 'blue', 'emerald'];
      for (const [i, vp] of (order.vendor_payments ?? []).entries()) {
        if (vp.date) {
          const label = vp.name ? `${vp.name}` : `Vendor ${i + 1}`;
          evts.push({ date: vp.date.slice(0, 10), label, brand, poNumber: order.purchaseorder_number, orderName: order.name, orderId: order._id, stage: VENDOR_STAGES[i % VENDOR_STAGES.length] });
        }
      }
    }
    return evts;
  }, [orders, vendorBrandLabel]);

  const calendarLegend: CalendarLegendItem[] = [
    { label: 'PO Date',     stage: 'teal' },
    { label: 'Initiated',   stage: 'sky' },
    { label: 'Proforma',    stage: 'blue' },
    { label: 'Ready',       stage: 'amber' },
    { label: 'ETD',         stage: 'orange' },
    { label: 'Port ETA',    stage: 'indigo' },
    { label: 'Duty Paid',   stage: 'purple' },
    { label: 'Inward',      stage: 'emerald' },
    { label: 'PO Due',      stage: 'red' },
    { label: 'Advance Pmt', stage: 'amber' },
    { label: 'Duty Due',    stage: 'orange' },
    { label: 'Shipping Due', stage: 'blue' },
  ];

  
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
        const hasView = resolved.some((p) => p.name === 'vendors_brand_orders_view' || p.name === 'brand_orders_view');
        const hasEdit = resolved.some((p) => p.name === 'vendors_brand_orders_edit' || p.name === 'brand_orders_edit');
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
      const { data } = await axios.get<BrandOrder[]>(`${API_URL}/brand_orders`);
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

  // Deep-link: ?po=<purchaseorder_number> → expand vendor + order and scroll into view
  useEffect(() => {
    const targetPo = searchParams.get('po');
    if (!targetPo || orders.length === 0) return;
    const order = orders.find(o => o.purchaseorder_number === targetPo);
    if (!order) return;
    const vendorId = order.vendor_id ?? '__unassigned__';
    setExpandedBrands(prev => { const s = new Set(prev); s.add(vendorId); return s; });
    setExpandedOrder(order._id);
    fetchOrderDocs(order._id);
    fetchOrderFolders(order._id);
    if (order.purchaseorder_number && lineItemsMap[order._id] === undefined) {
      fetchLineItemsForOrder(order._id);
    }
    setTimeout(() => {
      document.getElementById(`order-${order._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [orders, searchParams]);

  const fetchOrderDocs = useCallback(async (orderId: string) => {
    setDocsLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const { data } = await axios.get<BrandOrder>(`${API_URL}/brand_orders/${orderId}`);
      setOrderDocs(prev => ({ ...prev, [orderId]: data.documents || [] }));
      setDocPage(prev => ({ ...prev, [orderId]: 0 }));
    } catch { toast.error('Failed to load documents'); }
    finally { setDocsLoading(prev => ({ ...prev, [orderId]: false })); }
  }, []);

  const fetchOrderFolders = useCallback(async (orderId: string) => {
    setFoldersLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const { data } = await axios.get<FolderRecord[]>(`${API_URL}/brand_orders/${orderId}/folders`);
      setOrderFolders(prev => ({ ...prev, [orderId]: data || [] }));
    } catch { /* silently ignore */ }
    finally { setFoldersLoading(prev => ({ ...prev, [orderId]: false })); }
  }, []);

  const handleCalendarEventClick = useCallback((orderId: string) => {
    setViewMode('list');
    const order = orders.find(o => o._id === orderId);
    if (!order) return;
    const vendorId = order.vendor_id ?? '__unassigned__';
    setExpandedBrands(prev => { const s = new Set(prev); s.add(vendorId); return s; });
    setExpandedOrder(orderId);
    fetchOrderDocs(orderId);
    fetchOrderFolders(orderId);
    setTimeout(() => {
      document.getElementById(`order-${orderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [orders, fetchOrderDocs, fetchOrderFolders]);


  const handleCreateFolder = useCallback(async (orderId: string) => {
    const name = newFolderName.trim();
    if (!name) { setCreatingFolderFor(null); return; }
    setSavingFolder(true);
    try {
      const parent = currentFolderPath[orderId] || '';
      const { data } = await axios.post<FolderRecord>(`${API_URL}/brand_orders/${orderId}/folders`, { name, parent_path: parent });
      setOrderFolders(prev => ({ ...prev, [orderId]: [...(prev[orderId] || []), data] }));
      setCreatingFolderFor(null);
      setNewFolderName('');
      toast.success(`Folder "${name}" created`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create folder');
    } finally { setSavingFolder(false); }
  }, [newFolderName, currentFolderPath]);

  const handleRenameFolder = useCallback(async (orderId: string, folderId: string) => {
    const name = renameFolderName.trim();
    if (!name) { setRenamingFolderId(null); return; }
    setSavingFolder(true);
    try {
      const { data } = await axios.patch<FolderRecord>(`${API_URL}/brand_orders/${orderId}/folders/${folderId}`, { name });
      setOrderFolders(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(f => f.folder_id === folderId ? { ...f, name: data.name, path: data.path } : f),
      }));
      // also cascade rename in docs
      setOrderDocs(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(d => {
          if (d.folder === (orderFolders[orderId]?.find(f => f.folder_id === folderId)?.path || '')) {
            return { ...d, folder: data.path };
          }
          return d;
        }),
      }));
      setRenamingFolderId(null);
      toast.success('Folder renamed');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to rename folder');
    } finally { setSavingFolder(false); }
  }, [renameFolderName, orderFolders]);

  const handleDeleteFolder = useCallback(async (orderId: string, folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Files inside will be moved to the parent folder.`)) return;
    try {
      const folderPath = orderFolders[orderId]?.find(f => f.folder_id === folderId)?.path || '';
      const parentPath = orderFolders[orderId]?.find(f => f.folder_id === folderId)?.parent_path || '';
      await axios.delete(`${API_URL}/brand_orders/${orderId}/folders/${folderId}`);
      setOrderFolders(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).filter(f => f.folder_id !== folderId && !f.path.startsWith(folderPath + '/')),
      }));
      // Move docs to parent path in local state
      setOrderDocs(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(d =>
          (d.folder === folderPath || d.folder?.startsWith(folderPath + '/'))
            ? { ...d, folder: parentPath }
            : d
        ),
      }));
      // If we were viewing the deleted folder, navigate to parent
      if ((currentFolderPath[orderId] || '') === folderPath || (currentFolderPath[orderId] || '').startsWith(folderPath + '/')) {
        setCurrentFolderPath(prev => ({ ...prev, [orderId]: parentPath }));
      }
      toast.success(`Folder "${folderName}" deleted`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete folder');
    }
  }, [orderFolders, currentFolderPath]);

  const handleMoveDoc = useCallback(async (orderId: string, docId: string, targetFolder: string) => {
    try {
      await axios.patch(`${API_URL}/brand_orders/${orderId}/documents/${docId}`, { folder: targetFolder });
      setOrderDocs(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(d => d.doc_id === docId ? { ...d, folder: targetFolder } : d),
      }));
      setMovingDocId(null);
      toast.success('File moved');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to move file');
    }
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
    fetchOrderFolders(id);
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
    setCreateVendorPayments([emptyVendor(), emptyVendor(), emptyVendor()]);
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
      if (createForm.po_due_date) form.append('po_due_date', createForm.po_due_date);
      if (createForm.advance_payment_date) form.append('advance_payment_date', createForm.advance_payment_date);
      if (createForm.custom_duty_due_date) form.append('custom_duty_due_date', createForm.custom_duty_due_date);
      if (createForm.shipping_charges_due_date) form.append('shipping_charges_due_date', createForm.shipping_charges_due_date);
      if (createForm.advance_payment_amount) form.append('advance_payment_amount', createForm.advance_payment_amount);
      if (createForm.custom_duty) form.append('custom_duty', createForm.custom_duty);
      if (createForm.shipping_charges) form.append('shipping_charges', createForm.shipping_charges);
      if (createForm.balance_payment_date) form.append('balance_payment_date', createForm.balance_payment_date);
      if (createForm.balance_payment_amount) form.append('balance_payment_amount', createForm.balance_payment_amount);
      if (createForm.total_payment_made_to_supplier) form.append('total_payment_made_to_supplier', createForm.total_payment_made_to_supplier);
      if (createForm.total_payment_made_to_supplier_date) form.append('total_payment_made_to_supplier_date', createForm.total_payment_made_to_supplier_date);
      form.append('vendor_payments', JSON.stringify(createVendorPayments.map(vp => ({ name: vp.name, amount: vp.amount, date: vp.date }))));
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
      po_due_date: order.po_due_date ?? '',
      advance_payment_date: order.advance_payment_date ?? '',
      advance_payment_amount: order.advance_payment_amount != null ? String(order.advance_payment_amount) : '',
      custom_duty: order.custom_duty != null ? String(order.custom_duty) : '',
      custom_duty_due_date: order.custom_duty_due_date ?? '',
      shipping_charges: order.shipping_charges != null ? String(order.shipping_charges) : '',
      shipping_charges_due_date: order.shipping_charges_due_date ?? '',
      balance_payment_date: order.balance_payment_date ?? '',
      balance_payment_amount: order.balance_payment_amount != null ? String(order.balance_payment_amount) : '',
      total_payment_made_to_supplier: order.total_payment_made_to_supplier != null ? String(order.total_payment_made_to_supplier) : '',
      total_payment_made_to_supplier_date: order.total_payment_made_to_supplier_date ?? '',
    });
    const existingVps: VendorPaymentRow[] = (order.vendor_payments ?? []).map(vp => ({
      name: vp.name ?? '',
      amount: vp.amount != null ? String(vp.amount) : '',
      date: vp.date ?? '',
    }));
    setEditVendorPayments(existingVps.length > 0 ? existingVps : [emptyVendor(), emptyVendor(), emptyVendor()]);
  };
  const cancelEdit = () => { setEditingOrder(null); setEditForm({}); };

  const handleSaveEdit = async (orderId: string) => {
    setSaving(true);
    try {
      const form = new FormData();
      if (editForm.name !== undefined) form.append('name', editForm.name);
      if (editForm.order_date !== undefined) form.append('order_date', editForm.order_date);
      if (editForm.shipment_eta != null) form.append('shipment_eta', editForm.shipment_eta);
      form.append('initiation_date', editForm.initiation_date ?? '');
      form.append('proforma_date', editForm.proforma_date ?? '');
      form.append('ready_date', editForm.ready_date ?? '');
      form.append('etd_date', editForm.etd_date ?? '');
      form.append('eta_port_date', editForm.eta_port_date ?? '');
      form.append('duty_payment_date', editForm.duty_payment_date ?? '');
      form.append('inward_date', editForm.inward_date ?? '');
      form.append('po_due_date', editForm.po_due_date ?? '');
      form.append('advance_payment_date', editForm.advance_payment_date ?? '');
      form.append('custom_duty_due_date', editForm.custom_duty_due_date ?? '');
      form.append('shipping_charges_due_date', editForm.shipping_charges_due_date ?? '');
      if (editForm.advance_payment_amount !== undefined && editForm.advance_payment_amount !== '') form.append('advance_payment_amount', editForm.advance_payment_amount);
      if (editForm.custom_duty !== undefined && editForm.custom_duty !== '') form.append('custom_duty', editForm.custom_duty);
      if (editForm.shipping_charges !== undefined && editForm.shipping_charges !== '') form.append('shipping_charges', editForm.shipping_charges);
      form.append('balance_payment_date', editForm.balance_payment_date ?? '');
      if (editForm.balance_payment_amount !== undefined && editForm.balance_payment_amount !== '') form.append('balance_payment_amount', editForm.balance_payment_amount);
      form.append('total_payment_made_to_supplier_date', editForm.total_payment_made_to_supplier_date ?? '');
      if (editForm.total_payment_made_to_supplier !== undefined && editForm.total_payment_made_to_supplier !== '') form.append('total_payment_made_to_supplier', editForm.total_payment_made_to_supplier);
      form.append('vendor_payments', JSON.stringify(editVendorPayments.map(vp => ({ name: vp.name, amount: vp.amount, date: vp.date }))));
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
    folderOverride?: string,
  ) => {
    setUploadingFor(orderId);
    setUploadProgress(prev => ({ ...prev, [orderId]: { done: 0, total: uploads.length } }));
    const targetFolder = folderOverride !== undefined ? folderOverride : (currentFolderPath[orderId] || '');
    try {
      await Promise.all(uploads.map(async ({ file, relativePath }) => {
        const form = new FormData();
        form.append('file', file);
        if (relativePath) form.append('relative_path', relativePath);
        if (category) form.append('category', category);
        if (targetFolder) form.append('folder', targetFolder);
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

  const handleRenameCategory = useCallback(async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setRenamingCat(null); setRenameCatInput(''); return; }
    setRenamingCatLoading(true);
    try {
      await axios.patch(`${API_URL}/brand_orders/categories/${encodeURIComponent(oldName)}`, { new_name: trimmed });
      setCategories(prev => prev.map(c => c === oldName ? trimmed : c));
      setOrderUploadCategory(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (next[k] === oldName) next[k] = trimmed; });
        return next;
      });
      setRenamingCat(null);
      setRenameCatInput('');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to rename category');
    } finally {
      setRenamingCatLoading(false);
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

  const handleDownloadPaymentReport = async (brand?: string) => {
    if (!accessToken) { toast.error('Not authenticated'); return; }
    setDownloadingPaymentReport(true);
    try {
      const params = brand ? { brand } : {};
      const response = await axios.get(`${API_URL}/brand_orders/payment-report`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Payment_Report_${date}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const detail = err?.response?.data ? 'Access denied or server error' : 'Failed to download report';
      toast.error(detail);
    } finally { setDownloadingPaymentReport(false); }
  };

  const handleDownloadLineItems = useCallback(async (orderId: string, poNumber: string) => {
    setDownloadingLineItems(orderId);
    try {
      const { data } = await axios.get(
        `${API_URL}/brand_orders/${orderId}/line-items/download`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(data as unknown as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${poNumber}_line_items.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download line items');
    } finally {
      setDownloadingLineItems(null);
    }
  }, []);

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { fetchBrands(); fetchOrders(); }}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              title="Calendar view"
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors border-l border-zinc-200 dark:border-zinc-700 ${viewMode === 'calendar' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Calendar size={14} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
            <button
              onClick={() => handleDownloadPaymentReport(reportBrand || undefined)}
              disabled={downloadingPaymentReport}
              title="Download Payment Report"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              {downloadingPaymentReport ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Payment Report
            </button>
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between px-3 sm:px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
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
              <div className="px-3 sm:px-6 py-5 space-y-4">

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

                {/* Order Dates */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Order Dates</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      ['initiation_date', 'Date of Initiation'],
                      ['proforma_date', 'Date of Proforma Invoice'],
                      ['ready_date', 'Order Ready Date'],
                      ['etd_date', 'ETD / Sailing Date'],
                      ['eta_port_date', 'Port / ETA Date'],
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

                {/* Payment Dates and Details */}
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/60">
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Payment Dates and Details</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">PO Due Date</label>
                      <input type="date" value={createForm.po_due_date || ''} onChange={e => setCreateForm(p => ({ ...p, po_due_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Advance Payment Date</label>
                      <input type="date" value={createForm.advance_payment_date || ''} onChange={e => setCreateForm(p => ({ ...p, advance_payment_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Advance Payment Amount (PO Currency)</label>
                      <input type="number" min="0" step="0.01" value={createForm.advance_payment_amount || ''} onChange={e => setCreateForm(p => ({ ...p, advance_payment_amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Custom Duty Due Date</label>
                      <input type="date" value={createForm.custom_duty_due_date || ''} onChange={e => setCreateForm(p => ({ ...p, custom_duty_due_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Custom Duty (INR)</label>
                      <input type="number" min="0" step="0.01" value={createForm.custom_duty || ''} onChange={e => setCreateForm(p => ({ ...p, custom_duty: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Shipping Charges Due Date</label>
                      <input type="date" value={createForm.shipping_charges_due_date || ''} onChange={e => setCreateForm(p => ({ ...p, shipping_charges_due_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Shipping Charges (INR)</label>
                      <input type="number" min="0" step="0.01" value={createForm.shipping_charges || ''} onChange={e => setCreateForm(p => ({ ...p, shipping_charges: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Balance Payment Date</label>
                      <input type="date" value={createForm.balance_payment_date || ''} onChange={e => setCreateForm(p => ({ ...p, balance_payment_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Balance Payment Amount (INR)</label>
                      <input type="number" min="0" step="0.01" value={createForm.balance_payment_amount || ''} onChange={e => setCreateForm(p => ({ ...p, balance_payment_amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Total Payment Made to Supplier Date</label>
                      <input type="date" value={createForm.total_payment_made_to_supplier_date || ''} onChange={e => setCreateForm(p => ({ ...p, total_payment_made_to_supplier_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Total Payment Made to Supplier (USD)</label>
                      <input type="number" min="0" step="0.01" value={createForm.total_payment_made_to_supplier || ''} onChange={e => setCreateForm(p => ({ ...p, total_payment_made_to_supplier: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>
                  {/* Dynamic vendor (service provider) rows */}
                  <div className="mt-2 space-y-2">
                    {createVendorPayments.map((vp, i) => (
                      <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Vendor {i + 1} (Service Provider)</span>
                          {i >= 3 && (
                            <button type="button" onClick={() => setCreateVendorPayments(p => p.filter((_, idx) => idx !== i))}
                              className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Name</label>
                            <input type="text" value={vp.name} onChange={e => setCreateVendorPayments(p => p.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                              placeholder="e.g. Freight Forwarder"
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Amount (INR)</label>
                            <input type="number" min="0" step="0.01" value={vp.amount} onChange={e => setCreateVendorPayments(p => p.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))}
                              placeholder="0.00"
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date</label>
                            <input type="date" value={vp.date} onChange={e => setCreateVendorPayments(p => p.map((r, idx) => idx === i ? { ...r, date: e.target.value } : r))}
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setCreateVendorPayments(p => [...p, emptyVendor()])}
                      className="w-full py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                      + Add Vendor (Service Provider)
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 px-3 sm:px-6 pb-5">
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

      {/* ── Calendar view ── */}
      {viewMode === 'calendar' && (
        <OrdersCalendar
          events={calendarEvents}
          legend={calendarLegend}
          onEventClick={handleCalendarEventClick}
          accentColor="emerald"
        />
      )}

      {/* ── Vendor list ── */}
      {viewMode === 'list' && (loading && vendorList.length === 0 ? (
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
            const newVendorOrdersCount = allOrders.filter(o => !o.inward_date && !['closed', 'cancelled'].includes(o.po_status?.toLowerCase() ?? '')).length;
            const orderPage = vendorOrderPage[vendor.contact_id] ?? 0;
            const orderTotalPages = Math.ceil(visibleOrders.length / ORDERS_PER_PAGE);
            const pagedOrders = visibleOrders.slice(orderPage * ORDERS_PER_PAGE, (orderPage + 1) * ORDERS_PER_PAGE);

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
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-violet-600 text-white leading-none">{newVendorOrdersCount} new</span>
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
                        {pagedOrders.map(order => {
                          const isExpanded = expandedOrder === order._id;
                          const isEditing = editingOrder === order._id;
                          const isPoEditing = poEditingOrder === order._id;
                          const etaPast = isEtaOverdue(order.shipment_eta, order.po_status);
                          const isNewOrder = !order.inward_date && !['closed', 'cancelled'].includes(order.po_status?.toLowerCase() ?? '');
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
                          const selectedCategory = rawUploadCat ?? '';
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
                            <div key={order._id} id={`order-${order._id}`} className={etaPast ? 'border-l-[3px] border-red-400' : ''}>

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
                                        {/* Order Dates */}
                                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                          <div className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                                            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Order Dates</span>
                                          </div>
                                          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {([
                                              ['initiation_date', 'Date of Initiation (E)'],
                                              ['proforma_date', 'Proforma Invoice (F)'],
                                              ['ready_date', 'Order Ready Date (H)'],
                                              ['etd_date', 'ETD / Sailing Date (M)'],
                                              ['eta_port_date', 'Port / ETA Date (S)'],
                                              ['inward_date', 'Inward / WH Date (U/Z)'],
                                            ] as [keyof CreateFormState, string][]).map(([field, label]) => (
                                              <div key={field}>
                                                <label className="block text-xs text-zinc-400 mb-0.5">{label}</label>
                                                <input type="date" value={(editForm[field] as string) ?? ''} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                                                  className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Payment Dates and Details */}
                                        <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 overflow-hidden">
                                          <div className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/60">
                                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Payment Dates and Details</span>
                                          </div>
                                          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">PO Due Date</label>
                                              <input type="date" value={editForm.po_due_date ?? ''} onChange={e => setEditForm(p => ({ ...p, po_due_date: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            {(() => {
                                              const cur = orders.find(o => o._id === editingOrder);
                                              if (!cur?.po_sub_total && !cur?.po_currency_code) return <div />;
                                              return (
                                                <div>
                                                  <label className="block text-xs text-zinc-400 mb-0.5">PO Total Value</label>
                                                  <div className="px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    {cur.po_currency_code && <span className="mr-1">{cur.po_currency_code}</span>}
                                                    {cur.po_sub_total != null ? cur.po_sub_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Advance Payment Date</label>
                                              <input type="date" value={editForm.advance_payment_date ?? ''} onChange={e => setEditForm(p => ({ ...p, advance_payment_date: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Advance Payment Amount ({orders.find(o => o._id === editingOrder)?.po_currency_code || 'INR'})</label>
                                              <input type="number" min="0" step="0.01" value={editForm.advance_payment_amount ?? ''} onChange={e => setEditForm(p => ({ ...p, advance_payment_amount: e.target.value }))}
                                                placeholder="0.00"
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Custom Duty Due Date</label>
                                              <input type="date" value={editForm.custom_duty_due_date ?? ''} onChange={e => setEditForm(p => ({ ...p, custom_duty_due_date: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Custom Duty (INR)</label>
                                              <input type="number" min="0" step="0.01" value={editForm.custom_duty ?? ''} onChange={e => setEditForm(p => ({ ...p, custom_duty: e.target.value }))}
                                                placeholder="0.00"
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Shipping Charges Due Date</label>
                                              <input type="date" value={editForm.shipping_charges_due_date ?? ''} onChange={e => setEditForm(p => ({ ...p, shipping_charges_due_date: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Shipping Charges (INR)</label>
                                              <input type="number" min="0" step="0.01" value={editForm.shipping_charges ?? ''} onChange={e => setEditForm(p => ({ ...p, shipping_charges: e.target.value }))}
                                                placeholder="0.00"
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Balance Payment Date</label>
                                              <input type="date" value={editForm.balance_payment_date ?? ''} onChange={e => setEditForm(p => ({ ...p, balance_payment_date: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Balance Payment Amount (INR)</label>
                                              <input type="number" min="0" step="0.01" value={editForm.balance_payment_amount ?? ''} onChange={e => setEditForm(p => ({ ...p, balance_payment_amount: e.target.value }))}
                                                placeholder="0.00"
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Total Payment Made to Supplier Date</label>
                                              <input type="date" value={editForm.total_payment_made_to_supplier_date ?? ''} onChange={e => setEditForm(p => ({ ...p, total_payment_made_to_supplier_date: e.target.value }))}
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-zinc-400 mb-0.5">Total Payment Made to Supplier (USD)</label>
                                              <input type="number" min="0" step="0.01" value={editForm.total_payment_made_to_supplier ?? ''} onChange={e => setEditForm(p => ({ ...p, total_payment_made_to_supplier: e.target.value }))}
                                                placeholder="0.00"
                                                className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                            </div>
                                          </div>
                                          {/* Dynamic vendor (service provider) rows */}
                                          <div className="mt-2 space-y-2">
                                            {editVendorPayments.map((vp, i) => (
                                              <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-2">
                                                <div className="flex items-center justify-between mb-1.5">
                                                  <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Vendor {i + 1} (Service Provider)</span>
                                                  {i >= 3 && (
                                                    <button type="button" onClick={() => setEditVendorPayments(p => p.filter((_, idx) => idx !== i))}
                                                      className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                                  )}
                                                </div>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                  <div>
                                                    <label className="block text-xs text-zinc-400 mb-0.5">Name</label>
                                                    <input type="text" value={vp.name} onChange={e => setEditVendorPayments(p => p.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                                                      placeholder="e.g. Freight Forwarder"
                                                      className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs text-zinc-400 mb-0.5">Amount (INR)</label>
                                                    <input type="number" min="0" step="0.01" value={vp.amount} onChange={e => setEditVendorPayments(p => p.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))}
                                                      placeholder="0.00"
                                                      className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs text-zinc-400 mb-0.5">Date</label>
                                                    <input type="date" value={vp.date} onChange={e => setEditVendorPayments(p => p.map((r, idx) => idx === i ? { ...r, date: e.target.value } : r))}
                                                      className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                            <button type="button" onClick={() => setEditVendorPayments(p => [...p, emptyVendor()])}
                                              className="w-full py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                              + Add Vendor (Service Provider)
                                            </button>
                                          </div>
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
                                          <DateChip label="PO Date" value={order.order_date} dim={!isNewOrder} />
                                          <DateChip label="Bill Date" value={order.shipment_eta} stage={etaPast ? 'red' : undefined} dim={!isNewOrder && !etaPast} />
                                          <DateChip label="Initiated" value={order.initiation_date} dim={!isNewOrder} />
                                          <DateChip label="Proforma" value={order.proforma_date} dim={!isNewOrder} />
                                          <DateChip label="Ready" value={order.ready_date} dim={!isNewOrder} />
                                          <DateChip label="ETD" value={order.etd_date} dim={!isNewOrder} />
                                          <DateChip label="Port ETA" value={order.eta_port_date} dim={!isNewOrder} />
                                          <DateChip label="Duty Paid" value={order.duty_payment_date} dim={!isNewOrder} />
                                          <DateChip label="Inward" value={order.inward_date} dim={!isNewOrder} />
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
                                            <span className="inline-flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full">
                                              <Link2 size={10} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
                                              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">PO</span>
                                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{order.purchaseorder_number}</span>
                                              {order.po_currency_code && (
                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{order.po_currency_code}</span>
                                              )}
                                              {order.po_status && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${poStatusClass(order.po_status)}`}>
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
                                      <div className="flex items-center bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
                                        <button
                                          onClick={() => setExpandedLineItemSections(prev => {
                                            const next = new Set(prev);
                                            if (next.has(order._id)) next.delete(order._id); else next.add(order._id);
                                            return next;
                                          })}
                                          className="flex-1 flex items-center gap-2 px-4 py-2.5 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors text-left"
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
                                        <button
                                          onClick={() => handleDownloadLineItems(order._id, order.purchaseorder_number!)}
                                          disabled={downloadingLineItems === order._id}
                                          className="flex-shrink-0 p-2.5 mr-1 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors disabled:opacity-50"
                                          title="Download line items as Excel"
                                        >
                                          {downloadingLineItems === order._id
                                            ? <Loader2 size={12} className="animate-spin" />
                                            : <Download size={12} />}
                                        </button>
                                      </div>

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
                                            const newCollapsed = collapsedNewSections.has(order._id);
                                            const existingCollapsed = collapsedExistingSections.has(order._id);
                                            const toggleNew = () => setCollapsedNewSections(prev => { const s = new Set(prev); if (s.has(order._id)) s.delete(order._id); else s.add(order._id); return s; });
                                            const toggleExisting = () => setCollapsedExistingSections(prev => { const s = new Set(prev); if (s.has(order._id)) s.delete(order._id); else s.add(order._id); return s; });
                                            const renderItem = (item: LineItem) => {
                                              const itemDocs = docs.filter(d => d.item_id === item.item_id);
                                              const itemFileCount = itemDocs.length;
                                              const isItemOpen = expandedItems.has(item.item_id);
                                              return (
                                                <div key={item.item_id}>
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
                                            };
                                            return (
                                              <>
                                                {newItems.length > 0 && (
                                                  <>
                                                    <button onClick={toggleNew} className="w-full flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                                                      {newCollapsed ? <ChevronRight size={12} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" /> : <ChevronDown size={12} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
                                                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">New Products ({newItems.length})</span>
                                                    </button>
                                                    {!newCollapsed && newItems.map(renderItem)}
                                                  </>
                                                )}
                                                {existingItems.length > 0 && (
                                                  <>
                                                    <button onClick={toggleExisting} className="w-full flex items-center gap-2 px-4 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                                      {existingCollapsed ? <ChevronRight size={12} className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" /> : <ChevronDown size={12} className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />}
                                                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Existing Products ({existingItems.length})</span>
                                                    </button>
                                                    {!existingCollapsed && existingItems.map(renderItem)}
                                                  </>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* ── Files Section ── */}
                                  {(() => {
                                    const activeFolderPath = currentFolderPath[order._id] || '';
                                    const allFolders = orderFolders[order._id] || [];
                                    // Folders whose direct parent is the current path
                                    const visibleFolders = allFolders.filter(f => f.parent_path === activeFolderPath);
                                    // Docs in the current folder (empty string = root)
                                    const folderFilteredDocs = filteredDocs.filter(d => (d.folder || '') === activeFolderPath);
                                    const folderPage = docPage[order._id] ?? 0;
                                    const folderTotalPages = Math.ceil(folderFilteredDocs.length / DOCS_PER_PAGE);
                                    const folderPagedDocs = folderFilteredDocs.slice(folderPage * DOCS_PER_PAGE, (folderPage + 1) * DOCS_PER_PAGE);

                                    // Breadcrumb segments
                                    const breadcrumbs: { label: string; path: string }[] = [{ label: 'Root', path: '' }];
                                    if (activeFolderPath) {
                                      const segments = activeFolderPath.split('/');
                                      let built = '';
                                      for (const seg of segments) {
                                        built = built ? `${built}/${seg}` : seg;
                                        const found = allFolders.find(f => f.path === built);
                                        breadcrumbs.push({ label: found?.name || seg, path: built });
                                      }
                                    }

                                    return (
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
                                                        renamingCat === cat ? (
                                                          <span key={cat} className="inline-flex items-center gap-0.5 text-xs rounded-full border border-blue-400 bg-white dark:bg-zinc-800 px-1 py-0.5">
                                                            <input
                                                              autoFocus
                                                              value={renameCatInput}
                                                              onChange={e => setRenameCatInput(e.target.value)}
                                                              onKeyDown={e => {
                                                                if (e.key === 'Enter') handleRenameCategory(cat, renameCatInput);
                                                                if (e.key === 'Escape') { setRenamingCat(null); setRenameCatInput(''); }
                                                              }}
                                                              className="w-20 text-xs bg-transparent text-zinc-800 dark:text-zinc-200 focus:outline-none"
                                                            />
                                                            <button
                                                              onClick={() => handleRenameCategory(cat, renameCatInput)}
                                                              disabled={renamingCatLoading}
                                                              className="p-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                                              title="Save"
                                                            >
                                                              {renamingCatLoading ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                                                            </button>
                                                            <button
                                                              onClick={() => { setRenamingCat(null); setRenameCatInput(''); }}
                                                              className="p-0.5 text-zinc-400 hover:text-zinc-600"
                                                              title="Cancel"
                                                            >
                                                              <X size={9} />
                                                            </button>
                                                          </span>
                                                        ) : (
                                                          <span key={cat} className={`inline-flex items-center gap-0.5 text-xs rounded-full border font-medium transition-all ${selectedCategory === cat
                                                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                              : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                                                            }`}>
                                                            <button
                                                              onClick={() => setOrderUploadCategory(prev => ({ ...prev, [order._id]: selectedCategory === cat ? '' : cat }))}
                                                              className="pl-2.5 pr-0.5 py-0.5"
                                                            >
                                                              {cat}
                                                            </button>
                                                            <button
                                                              onClick={() => { setRenamingCat(cat); setRenameCatInput(cat); }}
                                                              className={`p-0.5 rounded-full transition-colors ${selectedCategory === cat ? 'hover:text-blue-200' : 'hover:text-blue-500 dark:hover:text-blue-400'}`}
                                                              title={`Rename "${cat}"`}
                                                            >
                                                              <Pencil size={9} />
                                                            </button>
                                                            <button
                                                              onClick={() => handleDeleteCategory(cat)}
                                                              className={`pr-1 py-0.5 rounded-r-full transition-colors ${selectedCategory === cat ? 'hover:text-red-200' : 'hover:text-red-500 dark:hover:text-red-400'}`}
                                                              title={`Delete category "${cat}"`}
                                                            >
                                                              <X size={9} />
                                                            </button>
                                                          </span>
                                                        )
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
                                                  {!selectedCategory && (
                                                    <span className="text-xs text-amber-500 dark:text-amber-400 italic">↑ select a category</span>
                                                  )}
                                                  <label className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 border rounded-lg transition-all ${!selectedCategory || !!uploadingFor ? 'opacity-40 cursor-not-allowed text-blue-400 border-blue-200 dark:border-blue-800' : 'text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 cursor-pointer border-blue-200 dark:border-blue-800'}`}
                                                    title={!selectedCategory ? 'Select a category first' : 'Upload files'}>
                                                    {uploadingFor === order._id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                                    Files
                                                    <input
                                                      ref={el => { fileInputRefs.current[order._id] = el; }}
                                                      type="file" multiple className="hidden" disabled={!!uploadingFor || !selectedCategory}
                                                      onChange={e => { if (e.target.files?.length) handleUploadDoc(order._id, Array.from(e.target.files).map(f => ({ file: f })), selectedCategory); }} />
                                                  </label>
                                                  <label className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 border rounded-lg transition-all ${!selectedCategory || !!uploadingFor ? 'opacity-40 cursor-not-allowed text-blue-400 border-blue-200 dark:border-blue-800' : 'text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 cursor-pointer border-blue-200 dark:border-blue-800'}`}
                                                    title={!selectedCategory ? 'Select a category first' : 'Upload folder'}>
                                                    <FolderOpen size={11} />
                                                    Folder
                                                    <input
                                                      ref={el => { folderInputRefs.current[order._id] = el; }}
                                                      type="file" className="hidden" disabled={!!uploadingFor || !selectedCategory}
                                                      // @ts-expect-error -- webkitdirectory is non-standard
                                                      webkitdirectory=""
                                                      onChange={e => { if (e.target.files?.length) handleUploadDoc(order._id, Array.from(e.target.files).map(f => ({ file: f, relativePath: (f as any).webkitRelativePath || undefined })), selectedCategory); }} />
                                                  </label>
                                                  {canEdit && (
                                                    creatingFolderFor === order._id ? (
                                                      <div className="flex items-center gap-1">
                                                        <input
                                                          autoFocus
                                                          value={newFolderName}
                                                          onChange={e => setNewFolderName(e.target.value)}
                                                          onKeyDown={e => {
                                                            if (e.key === 'Enter') handleCreateFolder(order._id);
                                                            if (e.key === 'Escape') { setCreatingFolderFor(null); setNewFolderName(''); }
                                                          }}
                                                          placeholder="Folder name…"
                                                          className="w-32 text-xs px-2 py-1 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        />
                                                        <button
                                                          onClick={() => handleCreateFolder(order._id)}
                                                          disabled={savingFolder || !newFolderName.trim()}
                                                          className="text-xs font-medium px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-40 transition-colors"
                                                        >
                                                          {savingFolder ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                        </button>
                                                        <button
                                                          onClick={() => { setCreatingFolderFor(null); setNewFolderName(''); }}
                                                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
                                                        >
                                                          <X size={10} />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <button
                                                        onClick={() => { setCreatingFolderFor(order._id); setNewFolderName(''); }}
                                                        className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-white hover:bg-amber-500 dark:text-amber-400 dark:hover:text-white dark:hover:bg-amber-600 cursor-pointer px-2.5 py-1 border border-amber-200 dark:border-amber-800 rounded-lg transition-all"
                                                        title="New folder"
                                                      >
                                                        <FolderPlus size={11} /> Folder
                                                      </button>
                                                    )
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* ── Breadcrumb navigation ── */}
                                        {(activeFolderPath || allFolders.length > 0) && (
                                          <div className="flex items-center gap-1 px-4 py-2 bg-amber-50/60 dark:bg-amber-950/10 border-b border-amber-100 dark:border-amber-900/30 flex-wrap">
                                            <Folder size={11} className="text-amber-500 flex-shrink-0" />
                                            {breadcrumbs.map((crumb, i) => (
                                              <React.Fragment key={crumb.path}>
                                                {i > 0 && <span className="text-zinc-300 dark:text-zinc-700 text-xs">/</span>}
                                                <button
                                                  onClick={() => setCurrentFolderPath(prev => ({ ...prev, [order._id]: crumb.path }))}
                                                  className={`text-xs font-medium transition-colors ${crumb.path === activeFolderPath ? 'text-amber-700 dark:text-amber-300 cursor-default' : 'text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400'}`}
                                                >
                                                  {crumb.label}
                                                </button>
                                              </React.Fragment>
                                            ))}
                                            {foldersLoading[order._id] && <Loader2 size={11} className="animate-spin text-amber-400 ml-1" />}
                                          </div>
                                        )}

                                        {/* ── Sub-folder rows ── */}
                                        {visibleFolders.length > 0 && (
                                          <div className="bg-amber-50/30 dark:bg-amber-950/5 border-b border-zinc-100 dark:border-zinc-800/60 divide-y divide-zinc-100 dark:divide-zinc-800/40">
                                            {visibleFolders.map(folder => (
                                              <div key={folder.folder_id} className="flex items-center gap-3 px-4 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors group">
                                                <Folder size={13} className="text-amber-500 flex-shrink-0" />
                                                {renamingFolderId === folder.folder_id ? (
                                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    <input
                                                      autoFocus
                                                      value={renameFolderName}
                                                      onChange={e => setRenameFolderName(e.target.value)}
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter') handleRenameFolder(order._id, folder.folder_id);
                                                        if (e.key === 'Escape') { setRenamingFolderId(null); setRenameFolderName(''); }
                                                      }}
                                                      className="flex-1 min-w-0 text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                    />
                                                    <button onClick={() => handleRenameFolder(order._id, folder.folder_id)} disabled={savingFolder}
                                                      className="p-1 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors">
                                                      {savingFolder ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                                    </button>
                                                    <button onClick={() => { setRenamingFolderId(null); setRenameFolderName(''); }}
                                                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors">
                                                      <X size={11} />
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <button
                                                      onClick={() => setCurrentFolderPath(prev => ({ ...prev, [order._id]: folder.path }))}
                                                      className="flex-1 min-w-0 text-left text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-amber-700 dark:hover:text-amber-300 transition-colors truncate"
                                                    >
                                                      {folder.name}
                                                    </button>
                                                    <span className="text-xs text-zinc-400 flex-shrink-0">
                                                      {docs.filter(d => (d.folder || '') === folder.path || (d.folder || '').startsWith(folder.path + '/')).length} files
                                                    </span>
                                                  </>
                                                )}
                                                {canEdit && renamingFolderId !== folder.folder_id && (
                                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                      onClick={() => { setRenamingFolderId(folder.folder_id); setRenameFolderName(folder.name); }}
                                                      className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                      title="Rename folder"
                                                    >
                                                      <Pencil size={11} />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteFolder(order._id, folder.folder_id, folder.name)}
                                                      className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                      title="Delete folder"
                                                    >
                                                      <Trash2 size={11} />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}

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
                                                  <option value="">General</option>
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
                                            {canEdit && <p className="text-xs mt-1 text-zinc-400">Use the buttons above to upload files or create a folder.</p>}
                                          </div>
                                        ) : folderFilteredDocs.length === 0 && visibleFolders.length === 0 ? (
                                          <div className="flex flex-col items-center justify-center py-8 text-zinc-400 bg-white dark:bg-zinc-900">
                                            <Filter size={18} className="mb-2 opacity-30" />
                                            <p className="text-sm">{hasActiveFilters ? 'No files match the current filters.' : 'This folder is empty.'}</p>
                                          </div>
                                        ) : folderFilteredDocs.length > 0 ? (
                                          <>
                                            <div className="bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                              {folderPagedDocs.map(doc => (
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
                                                    {canEdit && allFolders.length > 0 && (
                                                      <div className="relative">
                                                        {movingDocId === doc.doc_id ? (
                                                          <div className="flex items-center gap-1">
                                                            <select
                                                              autoFocus
                                                              defaultValue={doc.folder || ''}
                                                              onChange={e => handleMoveDoc(order._id, doc.doc_id, e.target.value)}
                                                              onBlur={() => setMovingDocId(null)}
                                                              className="text-xs px-1.5 py-0.5 border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                            >
                                                              <option value="">Root</option>
                                                              {allFolders.map(f => (
                                                                <option key={f.folder_id} value={f.path}>{f.path.split('/').join(' / ')}</option>
                                                              ))}
                                                            </select>
                                                            <button onClick={() => setMovingDocId(null)} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded">
                                                              <X size={10} />
                                                            </button>
                                                          </div>
                                                        ) : (
                                                          <button
                                                            onClick={() => setMovingDocId(doc.doc_id)}
                                                            className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                            title="Move to folder"
                                                          >
                                                            <Folder size={12} />
                                                          </button>
                                                        )}
                                                      </div>
                                                    )}
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
                                            {folderTotalPages > 1 && (
                                              <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                                                <span className="text-xs text-zinc-400 tabular-nums">
                                                  {folderPage * DOCS_PER_PAGE + 1}–{Math.min((folderPage + 1) * DOCS_PER_PAGE, folderFilteredDocs.length)} of {folderFilteredDocs.length}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <button onClick={() => setDocPage(prev => ({ ...prev, [order._id]: folderPage - 1 }))} disabled={folderPage === 0}
                                                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                                                    <ArrowLeft size={12} />
                                                  </button>
                                                  {Array.from({ length: folderTotalPages }, (_, i) => (
                                                    <button key={i} onClick={() => setDocPage(prev => ({ ...prev, [order._id]: i }))}
                                                      className={`w-6 h-6 text-xs rounded font-medium transition-colors ${i === folderPage ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                                                      {i + 1}
                                                    </button>
                                                  ))}
                                                  <button onClick={() => setDocPage(prev => ({ ...prev, [order._id]: folderPage + 1 }))} disabled={folderPage === folderTotalPages - 1}
                                                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                                                    <ArrowRight size={12} />
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        ) : null}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {orderTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                        <span className="text-xs text-zinc-400 tabular-nums">
                          {orderPage * ORDERS_PER_PAGE + 1}–{Math.min((orderPage + 1) * ORDERS_PER_PAGE, visibleOrders.length)} of {visibleOrders.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setVendorOrderPage(p => ({ ...p, [vendor.contact_id]: orderPage - 1 }))} disabled={orderPage === 0}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                            <ArrowLeft size={12} />
                          </button>
                          {Array.from({ length: orderTotalPages }, (_, i) => (
                            <button key={i} onClick={() => setVendorOrderPage(p => ({ ...p, [vendor.contact_id]: i }))}
                              className={`w-6 h-6 text-xs rounded font-medium transition-colors ${i === orderPage ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                              {i + 1}
                            </button>
                          ))}
                          <button onClick={() => setVendorOrderPage(p => ({ ...p, [vendor.contact_id]: orderPage + 1 }))} disabled={orderPage === orderTotalPages - 1}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
