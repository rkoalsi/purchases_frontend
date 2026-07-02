'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Check,
  Undo2,
  Trash2,
  ClipboardList,
  Plus,
  Download,
  Upload,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';

const API = `${process.env.NEXT_PUBLIC_API_URL}/amazon_listing`;
const AMAZON_API = `${process.env.NEXT_PUBLIC_API_URL}/amazon`;
const ZOHO_API = `${process.env.NEXT_PUBLIC_API_URL}/zoho`;
const USERS_API = `${process.env.NEXT_PUBLIC_API_URL}/users`;
const PAGE_SIZE = 25;

const MANAGE_PERM = 'items_amazon_listing_manage';
const LIST_PERM = 'items_amazon_listing';

const PURCHASE_STATUSES = ['active', 'inactive', 'discontinued until stock lasts', 'active - combo'];

// ─── shared dark-mode class helpers (match /items/amazon conventions) ──────────
const CARD = 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden';
const CTRL = 'text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded px-2 py-1';
const BTN = 'flex items-center gap-1 text-sm border border-gray-200 dark:border-zinc-700 rounded px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800';
const TH = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider';
const TD = 'px-3 py-2 text-sm text-gray-800 dark:text-zinc-200';
const TD_MUTED = 'px-3 py-2 text-xs text-gray-500 dark:text-zinc-400';
const ROW = 'border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors';

type Tab = 'queue' | 'products';

type QueueEntry = {
  _id: string;
  product_id: string;
  sku_code?: string;
  product_name?: string;
  brand?: string;
  status: 'pending' | 'listed';
  purchase_status?: string;
  zoho_status?: string;
  requested_by_name?: string;
  requested_at?: string;
  listed_by_name?: string | null;
  listed_at?: string | null;
};

type Group = { date: string; count: number; pending: number; listed: number };

type Product = {
  _id: string;
  cf_sku_code?: string;
  name?: string;
  brand?: string;
  status?: string;
  purchase_status?: string;
  is_combo_product?: boolean;
  is_listed?: boolean;
  amazon_status?: string | null;
  active_platforms?: string[] | null;
  amazon_asin?: string | null;
};

// Stored datetimes are naive UTC — treat a tz-less ISO string as UTC for display.
function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const listed = status === 'listed';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        listed
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      }`}
    >
      {listed ? 'Listed' : 'Pending'}
    </span>
  );
};

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function AmazonListingPage() {
  usePageTitle('Amazon Listing');
  const { accessToken, user } = useAuth();

  const [tab, setTab] = useState<Tab>('queue');
  const [brands, setBrands] = useState<string[]>([]);

  // ─── permissions ──────────────────────────────────────────────────────────
  const [permNames, setPermNames] = useState<string[]>([]);
  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await axios.get(`${USERS_API}/permissions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const all: any[] = res.data || [];
        const ids: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
        setPermNames(all.filter((p) => ids.includes(p._id)).map((p) => p.name));
      } catch {
        setPermNames([]);
      }
    })();
  }, [accessToken, user?.permissions]);

  const canManage = user?.role === 'admin' || permNames.includes(MANAGE_PERM);
  const canMarkListed = canManage || permNames.includes(LIST_PERM);

  const actor = {
    by: user?.email || user?._id || 'unknown',
    name: user?.name || user?.email || 'Unknown',
  };

  // brand list (shared by queue + products filters)
  useEffect(() => {
    axios
      .get(`${ZOHO_API}/brands`)
      .then((res) => setBrands((res.data || []).filter(Boolean).sort()))
      .catch(() => setBrands([]));
  }, []);

  // ─── queue tab ──────────────────────────────────────────────────────────---
  const [qStatus, setQStatus] = useState<'all' | 'pending' | 'listed'>('all');
  const [qBrand, setQBrand] = useState('');
  const [qPurchase, setQPurchase] = useState('');
  const [qSearch, setQSearch] = useState('');
  const [qSearchInput, setQSearchInput] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [gLoading, setGLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemsByDate, setItemsByDate] = useState<Record<string, QueueEntry[]>>({});
  const [uploading, setUploading] = useState(false);

  const queueParams = useMemo(
    () => ({
      status: qStatus,
      brand: qBrand || undefined,
      purchase_status: qPurchase || undefined,
      search: qSearch || undefined,
    }),
    [qStatus, qBrand, qPurchase, qSearch]
  );

  const fetchGroups = useCallback(async () => {
    setGLoading(true);
    try {
      const res = await axios.get(`${API}/queue/groups`, { params: queueParams });
      setGroups(res.data.groups || []);
      setExpanded(new Set());
      setItemsByDate({});
    } catch {
      toast.error('Failed to load listing queue');
    } finally {
      setGLoading(false);
    }
  }, [queueParams]);

  useEffect(() => {
    if (tab === 'queue') fetchGroups();
  }, [tab, fetchGroups]);

  const loadDate = useCallback(
    async (date: string) => {
      try {
        const res = await axios.get(`${API}/queue`, {
          params: { ...queueParams, date, limit: 2000 },
        });
        setItemsByDate((prev) => ({ ...prev, [date]: res.data.items || [] }));
      } catch {
        toast.error('Failed to load items');
      }
    },
    [queueParams]
  );

  const toggleGroup = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
        if (!itemsByDate[date]) loadDate(date);
      }
      return next;
    });
  };

  const fetchGroupsCounts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/queue/groups`, { params: queueParams });
      setGroups(res.data.groups || []);
    } catch {
      /* non-fatal */
    }
  }, [queueParams]);

  const mutateStatus = async (
    entry: QueueEntry,
    date: string,
    newStatus: 'listed' | 'pending'
  ) => {
    try {
      await axios.patch(`${API}/queue/${entry._id}/status`, {
        status: newStatus,
        listed_by: newStatus === 'listed' ? actor.by : undefined,
        listed_by_name: newStatus === 'listed' ? actor.name : undefined,
      });
      toast.success(newStatus === 'listed' ? 'Marked as listed' : 'Reverted to pending');
      loadDate(date);
      fetchGroupsCounts();
    } catch {
      toast.error('Failed to update');
    }
  };

  const removeEntry = async (entry: QueueEntry, date: string) => {
    if (!confirm(`Remove ${entry.sku_code || entry.product_name} from the queue?`)) return;
    try {
      await axios.delete(`${API}/queue/${entry._id}`);
      toast.success('Removed');
      loadDate(date);
      fetchGroupsCounts();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const downloadQueue = async () => {
    try {
      const res = await axios.get(`${API}/queue/download`, {
        params: queueParams,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'amazon_listing_queue.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const uploadQueue = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('listed_by', actor.by);
      fd.append('listed_by_name', actor.name);
      const res = await axios.post(`${API}/queue/upload`, fd);
      toast.success(
        `Updated — ${res.data.marked_listed} listed, ${res.data.reverted_pending} reverted`
      );
      fetchGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ─── products tab (Zoho products + Amazon listing status, combined) ─────────
  const [products, setProducts] = useState<Product[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [pSearch, setPSearch] = useState('');
  const [pSearchInput, setPSearchInput] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pPurchase, setPPurchase] = useState('');
  const [pZoho, setPZoho] = useState('');
  const [pListed, setPListed] = useState<'all' | 'listed' | 'not_listed'>('all');
  const [pPage, setPPage] = useState(1);
  const [pTotalPages, setPTotalPages] = useState(1);
  const [pTotal, setPTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skuStatus, setSkuStatus] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchSkuStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/queue/sku-status`);
      setSkuStatus(res.data.by_product_id || {});
    } catch {
      /* non-fatal */
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setPLoading(true);
    try {
      const res = await axios.get(`${API}/products`, {
        params: {
          page: pPage,
          limit: PAGE_SIZE,
          search: pSearch || undefined,
          brand: pBrand || undefined,
          purchase_status: pPurchase || undefined,
          zoho_status: pZoho || undefined,
          listed: pListed,
        },
      });
      setProducts(res.data.products || []);
      setPTotalPages(res.data.pagination?.totalPages || 1);
      setPTotal(res.data.pagination?.totalProducts || 0);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setPLoading(false);
    }
  }, [pPage, pSearch, pBrand, pPurchase, pZoho, pListed]);

  useEffect(() => {
    if (tab === 'products') {
      fetchProducts();
      fetchSkuStatus();
    }
  }, [tab, fetchProducts, fetchSkuStatus]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const res = await axios.post(`${API}/queue`, {
        product_ids: Array.from(selected),
        requested_by: actor.by,
        requested_by_name: actor.name,
      });
      const added = res.data.added?.length || 0;
      const skipped = res.data.skipped?.length || 0;
      toast.success(`Added ${added} to queue${skipped ? `, ${skipped} skipped` : ''}`);
      setSelected(new Set());
      fetchSkuStatus();
    } catch {
      toast.error('Failed to add to queue');
    } finally {
      setAdding(false);
    }
  };

  const syncFromAmazon = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${AMAZON_API}/sync-sku-mapping`);
      const d = res.data;
      toast.success(
        `Sync complete — ${d.inserted} added, ${d.updated} updated, ${d.unchanged} unchanged`
      );
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ─── shared bits ────────────────────────────────────────────────────────---
  const TabBtn: React.FC<{ id: Tab; label: string }> = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        tab === id
          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
          : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );

  const BrandSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
    <select className={CTRL} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All brands</option>
      {brands.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );

  const PurchaseSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
    <select className={CTRL} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All purchase statuses</option>
      {PURCHASE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {cap(s)}
        </option>
      ))}
    </select>
  );

  const SearchBox: React.FC<{
    value: string;
    onChange: (v: string) => void;
    onEnter: () => void;
    placeholder: string;
  }> = ({ value, onChange, onEnter, placeholder }) => (
    <div className="flex items-center gap-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded px-2 py-1">
      <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
      <input
        className="text-sm outline-none min-w-[160px] bg-transparent text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      />
    </div>
  );

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Amazon Listing</h1>
        {tab === 'products' && (
          <span className="ml-2 text-sm text-gray-500 dark:text-zinc-400">
            {pTotal.toLocaleString('en-IN')} product{pTotal !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800 mb-4 overflow-x-auto">
        <TabBtn id="queue" label="Listing Queue" />
        <TabBtn id="products" label="All Products" />
      </div>

      {/* ─── Queue tab ─── */}
      {tab === 'queue' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <SearchBox
              value={qSearchInput}
              onChange={setQSearchInput}
              onEnter={() => setQSearch(qSearchInput)}
              placeholder="Search SKU / name"
            />
            <select
              className={CTRL}
              value={qStatus}
              onChange={(e) => setQStatus(e.target.value as any)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="listed">Listed</option>
            </select>
            <BrandSelect value={qBrand} onChange={setQBrand} />
            <PurchaseSelect value={qPurchase} onChange={setQPurchase} />
            <button onClick={() => fetchGroups()} className={BTN}>
              <RefreshCw className={`w-4 h-4 ${gLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <div className="flex-1" />
            <button onClick={downloadQueue} className={BTN}>
              <Download className="w-4 h-4" /> Download
            </button>
            {canMarkListed && (
              <label className={`${BTN} cursor-pointer`}>
                <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} /> Upload
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadQueue(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            )}
          </div>

          <div className={`${CARD} divide-y divide-gray-100 dark:divide-zinc-800`}>
            {groups.map((g) => {
              const open = expanded.has(g.date);
              const rows = itemsByDate[g.date] || [];
              return (
                <div key={g.date}>
                  <button
                    onClick={() => toggleGroup(g.date)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left"
                  >
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                    )}
                    <span className="font-medium text-sm text-gray-900 dark:text-zinc-100">{g.date}</span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      {g.count} item{g.count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-amber-700 dark:text-amber-400">{g.pending} pending</span>
                    <span className="text-xs text-green-700 dark:text-green-400">{g.listed} listed</span>
                  </button>
                  {open && (
                    <div className="overflow-x-auto bg-gray-50/50 dark:bg-zinc-800/30">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className={TH}>SKU</th>
                            <th className={TH}>Product</th>
                            <th className={TH}>Brand</th>
                            <th className={TH}>Purchase Status</th>
                            <th className={TH}>Status</th>
                            <th className={TH}>Requested</th>
                            <th className={TH}>Listed</th>
                            <th className={`${TH} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((e) => (
                            <tr key={e._id} className={`${ROW} bg-white dark:bg-zinc-900`}>
                              <td className={`${TD} font-mono text-xs`}>{e.sku_code || '—'}</td>
                              <td className={TD}>{e.product_name || '—'}</td>
                              <td className={TD}>{e.brand || '—'}</td>
                              <td className={`${TD} capitalize`}>{e.purchase_status || '—'}</td>
                              <td className={TD}>
                                <StatusBadge status={e.status} />
                              </td>
                              <td className={TD_MUTED}>
                                {e.requested_by_name || '—'}
                                <div className="text-gray-400 dark:text-zinc-500">{fmtDate(e.requested_at)}</div>
                              </td>
                              <td className={TD_MUTED}>
                                {e.listed_by_name || '—'}
                                <div className="text-gray-400 dark:text-zinc-500">{fmtDate(e.listed_at)}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  {canMarkListed && e.status === 'pending' && (
                                    <button
                                      onClick={() => mutateStatus(e, g.date, 'listed')}
                                      className="flex items-center gap-1 text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700"
                                    >
                                      <Check className="w-3 h-3" /> Mark Listed
                                    </button>
                                  )}
                                  {canManage && e.status === 'listed' && (
                                    <button
                                      onClick={() => mutateStatus(e, g.date, 'pending')}
                                      title="Revert to pending"
                                      className={`${BTN} text-xs`}
                                    >
                                      <Undo2 className="w-3 h-3" /> Revert
                                    </button>
                                  )}
                                  {canManage && (
                                    <button
                                      onClick={() => removeEntry(e, g.date)}
                                      title="Remove from queue"
                                      className="text-gray-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 p-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-3 py-4 text-center text-gray-400 dark:text-zinc-500">
                                Loading…
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {!gLoading && groups.length === 0 && (
              <div className="px-3 py-8 text-center text-gray-400 dark:text-zinc-500">
                No products in the queue.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Products & Amazon Listing tab ─── */}
      {tab === 'products' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <SearchBox
              value={pSearchInput}
              onChange={setPSearchInput}
              onEnter={() => (setPPage(1), setPSearch(pSearchInput))}
              placeholder="Search SKU / name / ASIN"
            />
            <BrandSelect value={pBrand} onChange={(v) => (setPPage(1), setPBrand(v))} />
            <PurchaseSelect value={pPurchase} onChange={(v) => (setPPage(1), setPPurchase(v))} />
            <select className={CTRL} value={pZoho} onChange={(e) => (setPPage(1), setPZoho(e.target.value))}>
              <option value="">All Zoho statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className={CTRL}
              value={pListed}
              onChange={(e) => (setPPage(1), setPListed(e.target.value as any))}
            >
              <option value="all">All listing states</option>
              <option value="listed">Listed on Amazon</option>
              <option value="not_listed">Not listed</option>
            </select>
            <button onClick={syncFromAmazon} disabled={syncing} className={`${BTN} disabled:opacity-50`}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync from Amazon
            </button>
            <div className="flex-1" />
            {canManage && (
              <button
                onClick={addSelected}
                disabled={selected.size === 0 || adding}
                className="flex items-center gap-1 text-sm bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add {selected.size || ''} to queue
              </button>
            )}
          </div>

          <div className={`${CARD} overflow-x-auto`}>
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-zinc-800/60">
                <tr>
                  {canManage && <th className={`${TH} w-8`}></th>}
                  <th className={TH}>SKU</th>
                  <th className={TH}>Product</th>
                  <th className={TH}>Brand</th>
                  <th className={TH}>Zoho Status</th>
                  <th className={TH}>Purchase Status</th>
                  <th className={TH}>Amazon Status</th>
                  <th className={TH}>ASIN</th>
                  <th className={TH}>Platforms</th>
                  <th className={TH}>Queue</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const qs = skuStatus[p._id];
                  const disabled = !!qs || !!p.is_listed;
                  return (
                    <tr key={p._id} className={ROW}>
                      {canManage && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={selected.has(p._id)}
                            onChange={() => toggleSelect(p._id)}
                            title={
                              p.is_listed
                                ? 'Already listed on Amazon'
                                : qs
                                ? 'Already in queue'
                                : undefined
                            }
                          />
                        </td>
                      )}
                      <td className={`${TD} font-mono text-xs`}>{p.cf_sku_code || '—'}</td>
                      <td className={TD}>
                        {p.name || '—'}
                        {p.is_combo_product && (
                          <span className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            Combo
                          </span>
                        )}
                      </td>
                      <td className={TD}>{p.brand || '—'}</td>
                      <td className={`${TD} capitalize`}>{p.status || '—'}</td>
                      <td className={`${TD} capitalize`}>{p.purchase_status || '—'}</td>
                      <td className={TD}>
                        {p.is_listed ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            {p.amazon_status || 'Listed'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-zinc-500">Not listed</span>
                        )}
                      </td>
                      <td className={`${TD} font-mono text-xs`}>
                        {p.amazon_asin || <span className="text-gray-400 dark:text-zinc-500">—</span>}
                      </td>
                      <td className={TD}>
                        {(p.active_platforms || []).join(', ') || (
                          <span className="text-gray-400 dark:text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {qs ? (
                          <StatusBadge status={qs} />
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!pLoading && products.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 10 : 9} className="px-3 py-8 text-center text-gray-400 dark:text-zinc-500">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pager page={pPage} totalPages={pTotalPages} onChange={setPPage} />
        </div>
      )}
    </div>
  );
}

const Pager: React.FC<{ page: number; totalPages: number; onChange: (p: number) => void }> = ({
  page,
  totalPages,
  onChange,
}) => {
  const [jump, setJump] = useState('');
  if (totalPages <= 1) return null;
  const btn = 'p-1 border border-gray-200 dark:border-zinc-700 rounded text-gray-600 dark:text-zinc-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800';
  const go = () => {
    const n = parseInt(jump, 10);
    if (!isNaN(n)) onChange(Math.min(totalPages, Math.max(1, n)));
    setJump('');
  };
  return (
    <div className="flex items-center justify-end gap-2 mt-3 text-sm">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className={btn}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-gray-600 dark:text-zinc-400">
        Page {page} of {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={btn}>
        <ChevronRight className="w-4 h-4" />
      </button>
      <input
        type="number"
        min={1}
        max={totalPages}
        value={jump}
        onChange={(e) => setJump(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder="Go to"
        className="w-16 text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded px-2 py-1"
      />
      <button onClick={go} className={`${btn} px-2`}>
        Go
      </button>
    </div>
  );
};
