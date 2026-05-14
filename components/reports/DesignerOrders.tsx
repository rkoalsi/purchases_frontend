'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  Upload, Trash2, Download, Loader2, RefreshCw, FileText, ChevronDown,
  ChevronRight, Tag, Search, Eye, FolderOpen, ArrowLeft, ArrowRight, X, Archive,
  Calendar, Package,
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
}

interface DesignerOrder {
  _id: string;
  brand: string;
  name: string;
  order_date?: string;
  shipment_eta?: string;
  purchaseorder_number?: string | null;
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
  const [docSearch, setDocSearch] = useState<Record<string, string>>({});
  const [docPage, setDocPage] = useState<Record<string, number>>({});
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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<DesignerOrder[]>(`${API_URL}/design/orders`);
      setOrders(data);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // group by brand
  const brandGroups = useMemo(() => {
    const map: Record<string, DesignerOrder[]> = {};
    for (const order of orders) {
      const key = order.brand || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

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
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  };

  const handleToggleOrder = useCallback((orderId: string) => {
    const isOpen = expandedOrders.has(orderId);
    setExpandedOrders(prev => {
      const next = new Set(prev);
      isOpen ? next.delete(orderId) : next.add(orderId);
      return next;
    });
    if (!isOpen && docsMap[orderId] === undefined) {
      const order = orders.find(o => o._id === orderId);
      if (order) setDocsMap(prev => ({ ...prev, [orderId]: order.designer_documents || [] }));
    }
  }, [expandedOrders, docsMap, orders]);

  // keep docs in sync when orders refresh
  useEffect(() => {
    for (const order of orders) {
      if (expandedOrders.has(order._id)) {
        setDocsMap(prev => ({ ...prev, [order._id]: order.designer_documents || [] }));
      }
    }
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUploadDoc = useCallback(async (
    orderId: string,
    files: { file: File; relativePath?: string }[]
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
      const { data } = await axios.get<{ url: string }>(
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

  const totalOrders = orders.length;
  const totalDocs = orders.reduce((sum, o) => sum + (o.doc_count || 0), 0);

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
              <span className="inline-flex items-center gap-1">
                <Package size={12} className="text-violet-400" />
                {totalOrders} orders
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

        {/* Search */}
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
              const brandDocCount = brandOrders.reduce((s, o) => s + (o.doc_count || 0), 0);
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
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                        {brandOrders.length} order{brandOrders.length !== 1 ? 's' : ''}
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
                      {brandOrders.map(order => {
                        const isOrderExpanded = expandedOrders.has(order._id);
                        const docs = docsMap[order._id] ?? (order.designer_documents || []);
                        const dsq = (docSearch[order._id] || '').toLowerCase();
                        const filteredDocs = dsq
                          ? docs.filter(d => d.filename.toLowerCase().includes(dsq))
                          : docs;
                        const page = docPage[order._id] || 0;
                        const totalPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE);
                        const pagedDocs = filteredDocs.slice(page * DOCS_PER_PAGE, (page + 1) * DOCS_PER_PAGE);
                        const isUploading = uploadingFor === order._id;
                        const uploadProgress = isUploading ? progress : null;

                        return (
                          <div key={order._id}>
                            {/* Order row */}
                            <div className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleOrder(order._id)}
                                  className="flex-shrink-0 mt-0.5 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                >
                                  {isOrderExpanded
                                    ? <ChevronDown size={14} />
                                    : <ChevronRight size={14} />}
                                </button>

                                <div className="flex-1 min-w-0">
                                  {/* Order title row */}
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                      {order.name}
                                    </span>
                                    {order.purchaseorder_number && (
                                      <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full font-medium">
                                        {order.purchaseorder_number}
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

                            {/* Documents panel */}
                            {isOrderExpanded && (
                              <div className="mx-4 mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">

                                {/* Docs toolbar */}
                                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <FileText size={12} className="text-zinc-400" />
                                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Files</span>
                                    {docs.length > 0 && (
                                      <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full font-medium">
                                        {dsq && filteredDocs.length !== docs.length
                                          ? `${filteredDocs.length}/${docs.length}`
                                          : docs.length}
                                      </span>
                                    )}
                                  </div>

                                  {docs.length > 0 && (
                                    <div className="relative flex-1 min-w-[140px]">
                                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                      <input
                                        type="text"
                                        value={docSearch[order._id] || ''}
                                        onChange={e => {
                                          setDocSearch(prev => ({ ...prev, [order._id]: e.target.value }));
                                          setDocPage(prev => ({ ...prev, [order._id]: 0 }));
                                        }}
                                        placeholder="Filter files…"
                                        className="w-full pl-7 pr-6 py-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
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
                                  )}

                                  {canEdit && (
                                    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
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
                                              handleUploadDoc(order._id, Array.from(e.target.files).map(f => ({ file: f })));
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
                                              handleUploadDoc(order._id, Array.from(e.target.files).map(f => ({
                                                file: f,
                                                relativePath: (f as any).webkitRelativePath || undefined,
                                              })));
                                          }}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>

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
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{doc.filename}</p>
                                            <p className="text-xs text-zinc-400 mt-0.5">
                                              {fmtSize(doc.size)}
                                              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
                                              {fmtDateTime(doc.uploaded_at)}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button
                                              onClick={() => handleViewDoc(order._id, doc.doc_id)}
                                              disabled={viewingDoc === doc.doc_id}
                                              className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                              title="View"
                                            >
                                              {viewingDoc === doc.doc_id
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : <Eye size={12} />}
                                            </button>
                                            <button
                                              onClick={() => handleDownloadDoc(order._id, doc.doc_id, doc.filename)}
                                              disabled={downloadingDoc === doc.doc_id}
                                              className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                              title="Download"
                                            >
                                              {downloadingDoc === doc.doc_id
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : <Download size={12} />}
                                            </button>
                                            {canEdit && (
                                              <button
                                                onClick={() => handleDeleteDoc(order._id, doc.doc_id)}
                                                disabled={deletingDoc === doc.doc_id}
                                                className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                              >
                                                {deletingDoc === doc.doc_id
                                                  ? <Loader2 size={12} className="animate-spin" />
                                                  : <Trash2 size={12} />}
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
