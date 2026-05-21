'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  Upload, Trash2, Download, Loader2, RefreshCw, FileText, ChevronDown,
  ChevronRight, Tag, Search, Eye, FolderOpen, ArrowLeft, ArrowRight, X, Archive,
  Calendar, Package, Plus, Layers, Filter,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DOCS_PER_PAGE = 5;

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

interface DesignerOrder {
  _id: string;
  brand: string;
  name: string;
  order_date?: string;
  shipment_eta?: string;
  purchaseorder_number?: string | null;
  po_status?: string | null;
  designer_documents?: Document[];
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
  vendor_id?: string | null;
  vendor_name?: string | null;
}

interface GlobalFileResult {
  order_id: string;
  order_name: string;
  brand: string;
  doc: Document;
}

function fmtDate(s?: string | null) {
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

function lineItemLabel(item: LineItem): string {
  const label = item.name?.trim() || item.description?.trim() || 'Unnamed item';
  const isSample = item.account_name?.trim().toLowerCase() === 'sample';
  return isSample ? `${label} (Sample)` : label;
}

const PO_STATUS_COLORS: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  billed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  closed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};
function poStatusClass(s: string | null | undefined) {
  if (!s) return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  return PO_STATUS_COLORS[s.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIconColor(contentType: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif'].includes(ext))
    return 'text-pink-500';
  if (['psd', 'ai', 'eps', 'indd', 'xd', 'fig', 'sketch'].includes(ext))
    return 'text-purple-500';
  if (contentType === 'application/pdf' || ext === 'pdf') return 'text-red-500';
  if (['doc', 'docx'].includes(ext) || contentType.includes('word')) return 'text-blue-500';
  if (['xls', 'xlsx'].includes(ext) || contentType.includes('excel')) return 'text-green-600';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'text-amber-500';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext) || contentType.startsWith('video/')) return 'text-violet-500';
  return 'text-zinc-400';
}

interface DateBadgeProps { label: string; value?: string | null; highlight?: boolean; }
function DateBadge({ label, value, highlight }: DateBadgeProps) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
      highlight
        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
    }`}>
      <Calendar size={9} className="flex-shrink-0" />
      <span className="text-zinc-400 dark:text-zinc-500">{label}:</span>
      <span>{fmtDate(value)}</span>
    </span>
  );
}

const ITEM_UPLOAD_BTN = 'flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 cursor-pointer px-2 py-1 border border-blue-200 dark:border-blue-800 rounded-lg transition-all';

export default function DesignerOrders() {
  const { user, accessToken } = useAuth();
  const [orders, setOrders] = useState<DesignerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [docsMap, setDocsMap] = useState<Record<string, Document[]>>({});
  const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);
  const [downloadingItemZip, setDownloadingItemZip] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState<Record<string, string>>({});
  const [docPage, setDocPage] = useState<Record<string, number>>({});
  const [docCatFilter, setDocCatFilter] = useState<Record<string, string>>({});
  const [docItemFilter, setDocItemFilter] = useState<Record<string, string>>({});
  const [globalFileQuery, setGlobalFileQuery] = useState('');
  const [globalFileResults, setGlobalFileResults] = useState<GlobalFileResult[]>([]);
  const [globalFileLoading, setGlobalFileLoading] = useState(false);
  const [globalFileOpen, setGlobalFileOpen] = useState(false);

  // vendor → brand names (from brands collection, authoritative)
  const [vendorBrandNames, setVendorBrandNames] = useState<Record<string, string[]>>({});

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

  const globalFileRef = useRef<HTMLDivElement>(null);
  const globalFileDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const folderInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // resolve permissions
  useEffect(() => {
    if (!accessToken) return;
    const isAdmin = user?.role === 'admin' || user?.role === 'purchase_admin' || user?.role === 'design_admin';
    const userPermIds: string[] = user?.permissions ?? [];

    axios.get(`${API_URL}/users/permissions`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(({ data }: { data: any[] }) => {
        const resolved = data.filter((p) => userPermIds.includes(p._id));
        const hasEdit = resolved.some((p) => p.name === 'design_orders_edit');
        const hasView = resolved.some((p) => p.name === 'design_orders_view');
        if (hasEdit) {
          setCanEdit(true);
        } else if (hasView) {
          setCanEdit(false);
        } else {
          setCanEdit(isAdmin);
        }
      })
      .catch(() => { setCanEdit(isAdmin); });
  }, [user, accessToken]);

  // fetch categories and vendor→brand map on mount
  useEffect(() => {
    axios.get(`${API_URL}/design/categories`)
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories(['products', 'catalogue']));
    axios.get<Record<string, string[]>>(`${API_URL}/design/vendor-brands`)
      .then(({ data }) => setVendorBrandNames(data))
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<DesignerOrder[]>(`${API_URL}/design/orders`);
      setOrders(data);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // group by brand name — remap "Unknown" to the vendor's first named brand if available
  const brandGroups = useMemo(() => {
    const map: Record<string, DesignerOrder[]> = {};
    for (const order of orders) {
      let key = order.brand || 'Unknown';
      if (key === 'Unknown' && order.vendor_id) {
        const vBrands = vendorBrandNames[order.vendor_id] || [];
        const realBrand = vBrands.find(b => b !== 'Unknown');
        if (realBrand) key = realBrand;
      }
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    for (const orders of Object.values(map)) {
      orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return Object.entries(map).sort(([, aOrders], [, bOrders]) => {
      const aLatest = Math.max(...aOrders.map(o => new Date(o.created_at).getTime()));
      const bLatest = Math.max(...bOrders.map(o => new Date(o.created_at).getTime()));
      return bLatest - aLatest;
    });
  }, [orders, vendorBrandNames]);


  const filteredBrandGroups = useMemo(() => {
    if (!searchQuery.trim()) return brandGroups;
    const q = searchQuery.toLowerCase();
    return brandGroups
      .map(([brand, brandOrders]) => {
        if (brand.toLowerCase().includes(q)) return [brand, brandOrders] as [string, DesignerOrder[]];
        const filtered = brandOrders.filter(o =>
          o.name.toLowerCase().includes(q) ||
          (o.purchaseorder_number || '').toLowerCase().includes(q)
        );
        return filtered.length ? [brand, filtered] as [string, DesignerOrder[]] : null;
      })
      .filter(Boolean) as [string, DesignerOrder[]][];
  }, [brandGroups, searchQuery]);

  // auto-expand on search
  useEffect(() => {
    if (!searchQuery.trim()) return;
    setExpandedBrands(prev => {
      const next = new Set(prev);
      for (const [brand] of filteredBrandGroups) next.add(brand);
      return next;
    });
  }, [searchQuery, filteredBrandGroups]);

  const toggleBrand = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) { next.delete(brand); } else { next.add(brand); }
      return next;
    });
  };

  const fetchLineItemsForOrder = useCallback((orderId: string) => {
    setLineItemsLoading(prev => ({ ...prev, [orderId]: true }));
    axios.get<LineItem[]>(`${API_URL}/design/${orderId}/line-items`)
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

  const handleToggleOrder = useCallback((orderId: string) => {
    const isOpen = expandedOrders.has(orderId);
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (isOpen) { next.delete(orderId); } else { next.add(orderId); }
      return next;
    });
    if (!isOpen) {
      const order = orders.find(o => o._id === orderId);
      if (order && docsMap[orderId] === undefined) {
        setDocsMap(prev => ({ ...prev, [orderId]: order.designer_documents || [] }));
      }
      if (order?.purchaseorder_number && lineItemsMap[orderId] === undefined) {
        fetchLineItemsForOrder(orderId);
      }
    }
  }, [expandedOrders, docsMap, orders, lineItemsMap, fetchLineItemsForOrder]);

  // keep docs in sync when orders refresh
  useEffect(() => {
    for (const order of orders) {
      if (expandedOrders.has(order._id)) {
        setDocsMap(prev => ({ ...prev, [order._id]: order.designer_documents || [] }));
      }
    }
  }, [orders, expandedOrders]);

  const handleUploadDoc = useCallback(async (
    orderId: string,
    files: { file: File; relativePath?: string }[],
    category?: string,
    itemId?: string,
    itemName?: string,
  ) => {
    if (!files.length) return;
    setUploadingFor(orderId);
    setProgress({ done: 0, total: files.length });
    let done = 0;
    for (const { file, relativePath } of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (relativePath) fd.append('relative_path', relativePath);
        if (category) fd.append('category', category);
        if (itemId) fd.append('item_id', itemId);
        if (itemName) fd.append('item_name', itemName);
        const { data } = await axios.post<Document>(
          `${API_URL}/design/${orderId}/designer-documents`, fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setDocsMap(prev => ({
          ...prev,
          [orderId]: [...(prev[orderId] || []), data],
        }));
        setOrders(prev => prev.map(o =>
          o._id === orderId
            ? { ...o, doc_count: (o.doc_count || 0) + 1, designer_documents: [...(o.designer_documents || []), data] }
            : o
        ));
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
      done++;
      setProgress({ done, total: files.length });
    }
    toast.success(`Uploaded ${done} file${done !== 1 ? 's' : ''}`);
    setUploadingFor(null);
    setProgress(null);
    if (fileInputRefs.current[orderId]) fileInputRefs.current[orderId]!.value = '';
    if (folderInputRefs.current[orderId]) folderInputRefs.current[orderId]!.value = '';
  }, []);

  const handleAddCategory = useCallback(async (orderId: string) => {
    const name = catInput.trim();
    if (!name) { setAddingCatForOrder(null); return; }
    if (categories.includes(name)) {
      setOrderUploadCategory(prev => ({ ...prev, [orderId]: name }));
      setAddingCatForOrder(null);
      setCatInput('');
      return;
    }
    setAddingCat(true);
    try {
      await axios.post(`${API_URL}/design/categories`, { name });
      setCategories(prev => [...prev, name]);
      setOrderUploadCategory(prev => ({ ...prev, [orderId]: name }));
      setAddingCatForOrder(null);
      setCatInput('');
    } catch {
      toast.error('Failed to add category');
    } finally {
      setAddingCat(false);
    }
  }, [catInput, categories]);

  const handleDeleteCategory = useCallback(async (name: string) => {
    if (!confirm(`Delete category "${name}"? It won't remove files already tagged with it.`)) return;
    try {
      await axios.delete(`${API_URL}/design/categories/${encodeURIComponent(name)}`);
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
      await axios.patch(`${API_URL}/design/${orderId}/designer-documents/${docId}`, { category: newCategory });
      setDocsMap(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).map(d => d.doc_id === docId ? { ...d, category: newCategory } : d),
      }));
      setRecatDoc(null);
    } catch { toast.error('Failed to update category'); }
    finally { setRecatLoading(null); }
  }, []);

  const handleViewDoc = useCallback(async (orderId: string, docId: string) => {
    setViewingDoc(docId);
    try {
      const { data } = await axios.get<{ url: string }>(
        `${API_URL}/design/${orderId}/designer-documents/${docId}/url`
      );
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch { toast.error('Failed to get file URL'); }
    finally { setViewingDoc(null); }
  }, []);

  const handleDownloadDoc = useCallback(async (orderId: string, docId: string, filename: string) => {
    setDownloadingDoc(docId);
    try {
      const { data } = await axios.get<{ url: string }>(
        `${API_URL}/design/${orderId}/designer-documents/${docId}/url`
      );
      const a = document.createElement('a');
      a.href = data.url;
      a.download = filename;
      a.click();
    } catch { toast.error('Failed to download file'); }
    finally { setDownloadingDoc(null); }
  }, []);

  const handleDeleteDoc = useCallback(async (orderId: string, docId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    setDeletingDoc(docId);
    try {
      await axios.delete(`${API_URL}/design/${orderId}/designer-documents/${docId}`);
      setDocsMap(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).filter(d => d.doc_id !== docId),
      }));
      setOrders(prev => prev.map(o =>
        o._id === orderId
          ? {
              ...o,
              doc_count: Math.max(0, (o.doc_count || 0) - 1),
              designer_documents: (o.designer_documents || []).filter(d => d.doc_id !== docId),
            }
          : o
      ));
      toast.success('File deleted');
    } catch { toast.error('Failed to delete file'); }
    finally { setDeletingDoc(null); }
  }, []);

  const handleDownloadZip = useCallback(async (orderId: string, orderName: string) => {
    setDownloadingZip(orderId);
    try {
      const { data } = await axios.get(
        `${API_URL}/design/${orderId}/designer-documents/zip`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(data as unknown as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orderName}_designer.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download ZIP'); }
    finally { setDownloadingZip(null); }
  }, []);

  const handleDeleteItemDocs = useCallback(async (orderId: string, itemId: string, itemName: string) => {
    const docs = docsMap[orderId] || [];
    const targets = docs.filter(d => d.item_id === itemId);
    if (!targets.length) return;
    if (!confirm(`Delete all ${targets.length} file${targets.length !== 1 ? 's' : ''} for "${itemName}"? This cannot be undone.`)) return;
    for (const doc of targets) {
      try {
        await axios.delete(`${API_URL}/design/${orderId}/designer-documents/${doc.doc_id}`);
        setDocsMap(prev => ({ ...prev, [orderId]: (prev[orderId] || []).filter(d => d.doc_id !== doc.doc_id) }));
        setOrders(prev => prev.map(o =>
          o._id === orderId
            ? { ...o, doc_count: Math.max(0, (o.doc_count || 0) - 1), designer_documents: (o.designer_documents || []).filter(d => d.doc_id !== doc.doc_id) }
            : o
        ));
      } catch {
        toast.error(`Failed to delete ${doc.filename}`);
      }
    }
    toast.success(`Deleted all files for "${itemName}"`);
  }, [docsMap]);

  const handleDownloadItemZip = useCallback(async (
    orderId: string, orderName: string, itemId: string, itemName: string,
  ) => {
    setDownloadingItemZip(itemId);
    try {
      const { data } = await axios.get(
        `${API_URL}/design/${orderId}/designer-documents/zip`,
        { responseType: 'blob', params: { item_id: itemId } }
      );
      const url = URL.createObjectURL(data as unknown as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orderName}_${itemName}_designer.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('No files to download for this item'); }
    finally { setDownloadingItemZip(null); }
  }, []);

  // debounced global file search
  useEffect(() => {
    if (globalFileDebounce.current) clearTimeout(globalFileDebounce.current);
    if (!globalFileQuery.trim()) {
      setGlobalFileResults([]);
      setGlobalFileLoading(false);
      return;
    }
    setGlobalFileLoading(true);
    globalFileDebounce.current = setTimeout(async () => {
      try {
        const { data } = await axios.get<GlobalFileResult[]>(
          `${API_URL}/design/documents/search`,
          { params: { q: globalFileQuery.trim() } }
        );
        setGlobalFileResults(data);
        setGlobalFileOpen(true);
      } catch { toast.error('File search failed'); }
      finally { setGlobalFileLoading(false); }
    }, 300);
    return () => { if (globalFileDebounce.current) clearTimeout(globalFileDebounce.current); };
  }, [globalFileQuery]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (globalFileRef.current && !globalFileRef.current.contains(e.target as Node))
        setGlobalFileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const jumpToOrder = useCallback((result: GlobalFileResult) => {
    setGlobalFileOpen(false);
    setGlobalFileQuery('');
    setExpandedBrands(prev => new Set([...prev, result.brand]));
    setExpandedOrders(prev => new Set([...prev, result.order_id]));
    setDocsMap(prev => {
      if (prev[result.order_id]) return prev;
      const order = orders.find(o => o._id === result.order_id);
      return order ? { ...prev, [result.order_id]: order.designer_documents || [] } : prev;
    });
    const order = orders.find(o => o._id === result.order_id);
    if (order?.purchaseorder_number && lineItemsMap[result.order_id] === undefined) {
      fetchLineItemsForOrder(result.order_id);
    }
    setTimeout(() => {
      document.getElementById(`order-${result.order_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [orders, lineItemsMap, fetchLineItemsForOrder]);

  const totalOrders = orders.length;
  const totalDocs = orders.reduce((sum, o) => sum + (o.doc_count || 0), 0);
  const newOrdersCount = useMemo(() => {
    return orders.filter(o => !o.inward_date && o.po_status?.toLowerCase() !== 'closed').length;
  }, [orders]);

  // Reusable file action buttons
  const FileActions = useCallback(({ orderId, doc }: { orderId: string; doc: Document }) => (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      <button
        onClick={() => handleViewDoc(orderId, doc.doc_id)}
        disabled={viewingDoc === doc.doc_id}
        className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
        title="View"
      >
        {viewingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
      </button>
      <button
        onClick={() => handleDownloadDoc(orderId, doc.doc_id, doc.filename)}
        disabled={downloadingDoc === doc.doc_id}
        className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        title="Download"
      >
        {downloadingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      </button>
      {canEdit && (
        <button
          onClick={() => handleDeleteDoc(orderId, doc.doc_id)}
          disabled={deletingDoc === doc.doc_id}
          className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Delete"
        >
          {deletingDoc === doc.doc_id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      )}
    </div>
  ), [viewingDoc, downloadingDoc, deletingDoc, canEdit, handleViewDoc, handleDownloadDoc, handleDeleteDoc]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Tag size={18} className="text-violet-500" />
              Designer Orders
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Upload design assets and files against purchase orders
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Package size={12} className="text-violet-400" />
                {totalOrders} orders
                {newOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">{newOrdersCount} new</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText size={12} className="text-blue-400" />
                {totalDocs} files
              </span>
            </div>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global file search */}
        <div ref={globalFileRef} className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
          <input
            type="text"
            value={globalFileQuery}
            onChange={e => { setGlobalFileQuery(e.target.value); setGlobalFileOpen(true); }}
            onFocus={() => { if (globalFileResults.length) setGlobalFileOpen(true); }}
            placeholder="Search files across all orders…"
            className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 rounded-xl text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
          {globalFileLoading && (
            <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-400 animate-spin" />
          )}
          {!globalFileLoading && globalFileQuery && (
            <button
              onClick={() => { setGlobalFileQuery(''); setGlobalFileResults([]); setGlobalFileOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={13} />
            </button>
          )}
          {globalFileOpen && globalFileResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {globalFileResults.length} result{globalFileResults.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => setGlobalFileOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  <X size={11} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {globalFileResults.map(r => (
                  <button
                    key={`${r.order_id}-${r.doc.doc_id}`}
                    onClick={() => jumpToOrder(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-left"
                  >
                    <FileText size={13} className={`flex-shrink-0 ${fileIconColor(r.doc.content_type, r.doc.filename)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{r.doc.filename}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">
                        <span className="text-violet-500 font-medium">{r.brand}</span>
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                        {r.order_name}
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                        {fmtSize(r.doc.size)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {globalFileOpen && !globalFileLoading && globalFileQuery.trim() && globalFileResults.length === 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg px-4 py-6 text-center">
              <FileText size={18} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-400">No files found for &ldquo;{globalFileQuery}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Order search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by brand or order name…"
            className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm py-20">
            <Loader2 size={16} className="animate-spin" />
            Loading orders…
          </div>
        ) : filteredBrandGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Package size={32} className="mb-3 opacity-30" />
            <p className="text-sm">{searchQuery ? 'No orders match your search.' : 'No orders found.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBrandGroups.map(([brand, brandOrders]) => {
              const isExpanded = expandedBrands.has(brand);
              const brandDocCount = brandOrders.reduce((s: number, o: DesignerOrder) => s + (o.doc_count || 0), 0);
              const newBrandOrdersCount = brandOrders.filter(o => !o.inward_date && o.po_status?.toLowerCase() !== 'closed').length;
              // other brands sharing the same vendor
              const vendorId = brandOrders.find(o => o.vendor_id)?.vendor_id;
              const siblingBrands = vendorId
                ? (vendorBrandNames[vendorId] || []).filter(b => b !== brand)
                : [];
              return (
                <div key={brand} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">

                  {/* Brand header */}
                  <button
                    onClick={() => toggleBrand(brand)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Tag size={13} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{brand}</span>
                      {siblingBrands.length > 0 && (
                        <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">also: {siblingBrands.join(', ')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="inline-flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                        {brandOrders.length} order{brandOrders.length !== 1 ? 's' : ''}
                        {newBrandOrdersCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 leading-none">{newBrandOrdersCount} new</span>
                        )}
                      </span>
                      {brandDocCount > 0 && (
                        <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">
                          {brandDocCount} file{brandDocCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {isExpanded ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                    </div>
                  </button>

                  {/* Orders list */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {brandOrders.map((order: DesignerOrder) => {
                        const isOrderExpanded = expandedOrders.has(order._id);
                        const isNewOrder = !order.inward_date && order.po_status?.toLowerCase() !== 'closed';
                        const docs = docsMap[order._id] ?? (order.designer_documents || []);
                        const dsq = (docSearch[order._id] || '').toLowerCase();
                        const catFilter = docCatFilter[order._id] || '';
                        const itemFilter = docItemFilter[order._id] || '';

                        const filteredDocs = docs.filter(d => {
                          if (dsq) {
                            const text = [d.filename, d.item_name || '', d.category || ''].join(' ').toLowerCase();
                            if (!text.includes(dsq)) return false;
                          }
                          if (catFilter) {
                            const dCat = d.category?.trim() || 'general';
                            if (dCat !== catFilter) return false;
                          }
                          if (itemFilter.startsWith('__cat__')) {
                            const catVal = itemFilter.slice(7);
                            if ((d.category?.trim() || '') !== catVal) return false;
                          } else if (itemFilter === '__none__') {
                            if (d.item_id) return false;
                          } else if (itemFilter) {
                            if (d.item_id !== itemFilter) return false;
                          }
                          return true;
                        });

                        const page = docPage[order._id] || 0;
                        const totalPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE);
                        const pagedDocs = filteredDocs.slice(page * DOCS_PER_PAGE, (page + 1) * DOCS_PER_PAGE);
                        const isUploading = uploadingFor === order._id;
                        const uploadProgress = isUploading ? progress : null;
                        const lineItems = lineItemsMap[order._id] || [];
                        const lineItemsAreLoading = lineItemsLoading[order._id] ?? false;
                        const rawUploadCat = orderUploadCategory[order._id];
                        const selectedCategory = rawUploadCat === '' ? 'other' : (rawUploadCat || categories[0] || 'other');
                        const expandedItems = expandedLineItems[order._id] || new Set<string>();

                        // Category counts for filter pills
                        const catCounts = docs.reduce<Record<string, number>>((acc, d) => {
                          const c = d.category?.trim() || 'general';
                          acc[c] = (acc[c] || 0) + 1;
                          return acc;
                        }, {});
                        const docCatKeys = Object.keys(catCounts).sort();

                        // Item file counts
                        const itemDocCounts = docs.reduce<Record<string, number>>((acc, d) => {
                          if (d.item_id) acc[d.item_id] = (acc[d.item_id] || 0) + 1;
                          return acc;
                        }, {});
                        const hasUncategorizedFiles = docs.some(d => !d.item_id);
                        const hasActiveFilters = !!(dsq || catFilter || itemFilter);

                        return (
                          <div key={order._id} id={`order-${order._id}`}>
                            {/* Order row */}
                            <div className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleOrder(order._id)}
                                  className="flex-shrink-0 mt-0.5 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                >
                                  {isOrderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>

                                <div className="flex-1 min-w-0">
                                  {/* Order title row */}
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                      {order.name}
                                    </span>
                                    {isNewOrder && (
                                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 leading-none">NEW</span>
                                    )}
                                    {order.purchaseorder_number && (
                                      <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5">
                                        {order.purchaseorder_number}
                                        {order.po_status && (
                                          <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${poStatusClass(order.po_status)}`}>
                                            {order.po_status}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {(order.doc_count || 0) > 0 && (
                                      <span className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                        <FileText size={10} />
                                        {order.doc_count}
                                      </span>
                                    )}
                                  </div>

                                  {/* Dates */}
                                  <div className="flex flex-wrap gap-1.5">
                                    <DateBadge label="PO Date" value={order.order_date} />
                                    <DateBadge label="Shipment ETA" value={order.shipment_eta} highlight />
                                    <DateBadge label="Initiated" value={order.initiation_date} />
                                    <DateBadge label="Proforma" value={order.proforma_date} />
                                    <DateBadge label="Ready" value={order.ready_date} highlight />
                                    <DateBadge label="ETD" value={order.etd_date} />
                                    <DateBadge label="Port ETA" value={order.eta_port_date} />
                                    <DateBadge label="Inward" value={order.inward_date} />
                                  </div>
                                </div>

                                {/* ZIP download */}
                                {(order.doc_count || 0) > 0 && (
                                  <button
                                    onClick={() => handleDownloadZip(order._id, order.name)}
                                    disabled={downloadingZip === order._id}
                                    className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                                    title="Download all as ZIP"
                                  >
                                    {downloadingZip === order._id
                                      ? <Loader2 size={13} className="animate-spin" />
                                      : <Archive size={13} />}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expanded panel */}
                            {isOrderExpanded && (
                              <div className="px-4 pb-4 space-y-3">

                                {/* ── Line Items Accordion ── */}
                                {order.purchaseorder_number && (
                                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 overflow-hidden">
                                    {/* Section header — toggles the whole section */}
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
                                          const ordered = [...newItems, ...existingItems];
                                          return ordered.map((item, idx) => {
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
                                              {/* Item header row */}
                                              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                                <button
                                                  onClick={() => itemFileCount > 0 && toggleLineItem(order._id, item.item_id)}
                                                  className={`flex-shrink-0 transition-colors ${
                                                    itemFileCount > 0
                                                      ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer'
                                                      : 'text-zinc-200 dark:text-zinc-700 cursor-default'
                                                  }`}
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
                                                {/* File count badge */}
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                                  itemFileCount > 0
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'
                                                }`}>
                                                  {itemFileCount} {itemFileCount === 1 ? 'file' : 'files'}
                                                </span>
                                                {/* Download ZIP for this item */}
                                                {itemFileCount > 0 && (
                                                  <button
                                                    onClick={() => handleDownloadItemZip(order._id, order.name, item.item_id, lineItemLabel(item))}
                                                    disabled={downloadingItemZip === item.item_id}
                                                    className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="Download all files for this item as ZIP"
                                                  >
                                                    {downloadingItemZip === item.item_id
                                                      ? <Loader2 size={12} className="animate-spin" />
                                                      : <Archive size={12} />}
                                                  </button>
                                                )}
                                                {/* Delete all files for this item */}
                                                {canEdit && itemFileCount > 0 && (
                                                  <button
                                                    onClick={() => handleDeleteItemDocs(order._id, item.item_id, lineItemLabel(item))}
                                                    className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete all files for this item"
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                )}
                                                {/* Upload buttons */}
                                                {canEdit && (
                                                  <div className="flex items-center gap-1 flex-shrink-0">
                                                    <label className={ITEM_UPLOAD_BTN} title={`Upload files for ${lineItemLabel(item)}`}>
                                                      {isUploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                                                      Files
                                                      <input
                                                        type="file"
                                                        multiple
                                                        className="hidden"
                                                        disabled={!!uploadingFor}
                                                        onChange={e => {
                                                          if (e.target.files?.length)
                                                            handleUploadDoc(
                                                              order._id,
                                                              Array.from(e.target.files).map(f => ({ file: f })),
                                                              'product',
                                                              item.item_id,
                                                              lineItemLabel(item),
                                                            );
                                                          e.target.value = '';
                                                        }}
                                                      />
                                                    </label>
                                                    <label className={ITEM_UPLOAD_BTN} title={`Upload folder for ${lineItemLabel(item)}`}>
                                                      <FolderOpen size={10} />
                                                      Folder
                                                      <input
                                                        type="file"
                                                        className="hidden"
                                                        disabled={!!uploadingFor}
                                                        // @ts-expect-error -- webkitdirectory is non-standard
                                                        webkitdirectory=""
                                                        onChange={e => {
                                                          if (e.target.files?.length)
                                                            handleUploadDoc(
                                                              order._id,
                                                              Array.from(e.target.files).map(f => ({
                                                                file: f,
                                                                relativePath: (f as any).webkitRelativePath || undefined,
                                                              })),
                                                              'product',
                                                              item.item_id,
                                                              lineItemLabel(item),
                                                            );
                                                          e.target.value = '';
                                                        }}
                                                      />
                                                    </label>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Expanded item files */}
                                              {isItemOpen && itemDocs.length > 0 && (
                                                <div className="border-t border-blue-100 dark:border-blue-900/30 divide-y divide-blue-50 dark:divide-blue-900/20 bg-blue-50/40 dark:bg-blue-950/10">
                                                  {itemDocs.map(doc => (
                                                    <div key={doc.doc_id} className="flex items-center gap-3 pl-10 pr-4 py-2 group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                                      <FileText size={12} className={`flex-shrink-0 ${fileIconColor(doc.content_type, doc.filename)}`} />
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{doc.filename}</p>
                                                        <p className="text-xs text-zinc-400">{fmtSize(doc.size)} · {fmtDateTime(doc.uploaded_at)}</p>
                                                      </div>
                                                      <FileActions orderId={order._id} doc={doc} />
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
                                            {hasActiveFilters && filteredDocs.length !== docs.length
                                              ? `${filteredDocs.length}/${docs.length}`
                                              : docs.length}
                                          </span>
                                        )}
                                      </div>

                                      {canEdit && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {/* Category pill selector for upload */}
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
                                                  className="w-28 text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 border border-violet-300 dark:border-violet-700 rounded-full text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                />
                                                <button
                                                  onClick={() => handleAddCategory(order._id)}
                                                  disabled={addingCat || !catInput.trim()}
                                                  className="text-xs font-medium px-2 py-0.5 bg-violet-600 text-white rounded-full disabled:opacity-40 hover:bg-violet-700 transition-colors"
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
                                                      ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
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
                                                  className="text-xs px-1.5 py-0.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-violet-600 hover:border-violet-400 dark:hover:border-violet-600 transition-all flex items-center gap-0.5"
                                                  title="Add new category"
                                                >
                                                  <Plus size={10} /> New
                                                </button>
                                              </>
                                            )}
                                          </div>

                                          {/* Upload buttons */}
                                          <div className="flex items-center gap-1">
                                            <label className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-white hover:bg-violet-600 dark:text-violet-400 dark:hover:text-white dark:hover:bg-violet-600 cursor-pointer px-2.5 py-1 border border-violet-200 dark:border-violet-800 rounded-lg transition-all">
                                              {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                              Files
                                              <input
                                                ref={el => { fileInputRefs.current[order._id] = el; }}
                                                type="file"
                                                multiple
                                                className="hidden"
                                                disabled={!!uploadingFor}
                                                onChange={e => {
                                                  if (e.target.files?.length)
                                                    handleUploadDoc(
                                                      order._id,
                                                      Array.from(e.target.files).map(f => ({ file: f })),
                                                      selectedCategory,
                                                    );
                                                }}
                                              />
                                            </label>
                                            <label className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-white hover:bg-violet-600 dark:text-violet-400 dark:hover:text-white dark:hover:bg-violet-600 cursor-pointer px-2.5 py-1 border border-violet-200 dark:border-violet-800 rounded-lg transition-all">
                                              <FolderOpen size={11} />
                                              Folder
                                              <input
                                                ref={el => { folderInputRefs.current[order._id] = el; }}
                                                type="file"
                                                className="hidden"
                                                disabled={!!uploadingFor}
                                                // @ts-expect-error -- webkitdirectory is non-standard
                                                webkitdirectory=""
                                                onChange={e => {
                                                  if (e.target.files?.length)
                                                    handleUploadDoc(
                                                      order._id,
                                                      Array.from(e.target.files).map(f => ({
                                                        file: f,
                                                        relativePath: (f as any).webkitRelativePath || undefined,
                                                      })),
                                                      selectedCategory,
                                                    );
                                                }}
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Filter bar */}
                                  {docs.length > 0 && (
                                    <div className="px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center gap-3">
                                      {/* Search */}
                                      <div className="relative flex-1 min-w-[160px]">
                                        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                        <input
                                          type="text"
                                          value={docSearch[order._id] || ''}
                                          onChange={e => {
                                            setDocSearch(prev => ({ ...prev, [order._id]: e.target.value }));
                                            setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                          }}
                                          placeholder="Search files, products, categories…"
                                          className="w-full pl-7 pr-6 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                        />
                                        {docSearch[order._id] && (
                                          <button
                                            onClick={() => {
                                              setDocSearch(prev => ({ ...prev, [order._id]: '' }));
                                              setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                          >
                                            <X size={10} />
                                          </button>
                                        )}
                                      </div>

                                      {/* Category filter pills */}
                                      {docCatKeys.length > 1 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <Filter size={10} className="text-zinc-400 flex-shrink-0" />
                                          <button
                                            onClick={() => {
                                              setDocCatFilter(prev => ({ ...prev, [order._id]: '' }));
                                              setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                            }}
                                            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
                                              !catFilter
                                                ? 'bg-zinc-700 dark:bg-zinc-300 border-zinc-700 dark:border-zinc-300 text-white dark:text-zinc-900'
                                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400'
                                            }`}
                                          >
                                            All
                                          </button>
                                          {docCatKeys.map(cat => (
                                            <button
                                              key={cat}
                                              onClick={() => {
                                                setDocCatFilter(prev => ({ ...prev, [order._id]: prev[order._id] === cat ? '' : cat }));
                                                setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                              }}
                                              className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
                                                catFilter === cat
                                                  ? 'bg-violet-600 border-violet-600 text-white'
                                                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-violet-400 dark:hover:border-violet-600'
                                              }`}
                                            >
                                              {cat}
                                              <span className="ml-1 opacity-60">{catCounts[cat]}</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      {/* Product/item/category filter — dropdown */}
                                      {(categories.length > 0 || lineItems.length > 0) && (
                                        <div className="flex items-center gap-1.5">
                                          <Package size={10} className="text-zinc-400 flex-shrink-0" />
                                          <select
                                            value={itemFilter}
                                            onChange={e => {
                                              setDocItemFilter(prev => ({ ...prev, [order._id]: e.target.value }));
                                              setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                            }}
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
                                              <option value="__none__">
                                                Uncategorized ({docs.filter(d => !d.item_id).length})
                                              </option>
                                            )}
                                          </select>
                                        </div>
                                      )}

                                      {/* Clear filters */}
                                      {hasActiveFilters && (
                                        <button
                                          onClick={() => {
                                            setDocSearch(prev => ({ ...prev, [order._id]: '' }));
                                            setDocCatFilter(prev => ({ ...prev, [order._id]: '' }));
                                            setDocItemFilter(prev => ({ ...prev, [order._id]: '' }));
                                            setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                          }}
                                          className="text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-0.5 transition-colors"
                                        >
                                          <X size={10} /> Clear filters
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Upload progress */}
                                  {uploadProgress && (
                                    <div className="px-4 py-3 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/40">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                                          Uploading {uploadProgress.done} of {uploadProgress.total} file{uploadProgress.total !== 1 ? 's' : ''}…
                                        </span>
                                        <span className="text-xs tabular-nums text-violet-500 dark:text-violet-400">
                                          {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 bg-violet-100 dark:bg-violet-900/50 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-violet-500 rounded-full transition-all duration-300 ease-out"
                                          style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
                                        />
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
                                      {canEdit && (
                                        <p className="text-xs mt-1 text-zinc-400">Use the buttons above to upload files or a folder.</p>
                                      )}
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
                                          <div
                                            key={doc.doc_id}
                                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group"
                                          >
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
                                                      value={doc.category || 'general'}
                                                      onChange={e => handleRecategorize(order._id, doc.doc_id, e.target.value)}
                                                      onBlur={() => setRecatDoc(null)}
                                                      disabled={recatLoading === doc.doc_id}
                                                      className="text-xs px-1.5 py-0.5 rounded-full border border-violet-300 dark:border-violet-700 bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 flex-shrink-0"
                                                    >
                                                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                  ) : (
                                                    <button
                                                      onClick={() => setRecatDoc(doc.doc_id)}
                                                      className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                                                      title="Click to change category"
                                                    >
                                                      {recatLoading === doc.doc_id ? <Loader2 size={10} className="animate-spin inline" /> : (doc.category || 'general')}
                                                    </button>
                                                  )
                                                ) : (
                                                  doc.category && doc.category !== 'general' && (
                                                    <span className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
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
                                            <FileActions orderId={order._id} doc={doc} />
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
                                            <button
                                              onClick={() => setDocPage(prev => ({ ...prev, [order._id]: page - 1 }))}
                                              disabled={page === 0}
                                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            >
                                              <ArrowLeft size={12} />
                                            </button>
                                            {Array.from({ length: totalPages }, (_, i) => (
                                              <button
                                                key={i}
                                                onClick={() => setDocPage(prev => ({ ...prev, [order._id]: i }))}
                                                className={`w-6 h-6 text-xs rounded font-medium transition-colors ${
                                                  i === page
                                                    ? 'bg-violet-600 text-white'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                                }`}
                                              >
                                                {i + 1}
                                              </button>
                                            ))}
                                            <button
                                              onClick={() => setDocPage(prev => ({ ...prev, [order._id]: page + 1 }))}
                                              disabled={page === totalPages - 1}
                                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            >
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
