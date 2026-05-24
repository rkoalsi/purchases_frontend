'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { RefreshCw, ChevronDown, ChevronRight, Package, Truck, Search } from 'lucide-react';
import { TABLE_CLASSES, LoadingState, ErrorState, SearchBar } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShipmentItem {
  ShipmentId: string;
  SellerSKU: string;
  FulfillmentNetworkSKU: string;
  QuantityShipped: number;
  QuantityReceived: number;
  QuantityInCase: number;
  QuantityPending: number;
  FullyInwarded: boolean;
}

interface FBAShipment {
  ShipmentId: string;
  ShipmentName: string;
  ShipmentStatus: string;
  DestinationFulfillmentCenterId: string;
  ShipFromAddress?: {
    Name?: string;
    AddressLine1?: string;
    City?: string;
    StateOrProvinceCode?: string;
    CountryCode?: string;
  };
  items: ShipmentItem[];
  total_skus: number;
  fully_inwarded_count: number;
  pending_inward_count: number;
  has_processing_upload: boolean;
  last_synced_at: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; classes: string }> = {
  CLOSED:     { label: 'Closed',      classes: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' },
  WORKING:    { label: 'Working',     classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  SHIPPED:    { label: 'Shipped',     classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  IN_TRANSIT: { label: 'In Transit',  classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  DELIVERED:  { label: 'Delivered',   classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  CHECKED_IN: { label: 'Checked In',  classes: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  RECEIVING:  { label: 'Receiving',   classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  CANCELLED:  { label: 'Cancelled',   classes: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  DELETED:    { label: 'Deleted',     classes: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500' },
  ERROR:      { label: 'Error',       classes: 'bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
};

const ALL_STATUSES = ['All', 'WORKING', 'SHIPPED', 'IN_TRANSIT', 'RECEIVING', 'DELIVERED', 'CHECKED_IN', 'CLOSED', 'CANCELLED', 'DELETED', 'ERROR'];

const StatusBadge = ({ status }: { status: string }) => {
  const meta = STATUS_META[status] ?? { label: status, classes: 'bg-zinc-100 text-zinc-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.classes}`}>
      {meta.label}
    </span>
  );
};

// ─── Inward progress bar ──────────────────────────────────────────────────────

const InwardProgress = ({ total, inwarded }: { total: number; inwarded: number }) => {
  if (total === 0) return <span className="text-xs text-zinc-400">No items</span>;
  const pct = Math.round((inwarded / total) * 100);
  const color = pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-zinc-300 dark:bg-zinc-600';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
        {inwarded}/{total}
      </span>
    </div>
  );
};

// ─── Expanded items table ─────────────────────────────────────────────────────

const ItemsTable = ({ items }: { items: ShipmentItem[] }) => {
  if (!items || items.length === 0)
    return <p className="text-sm text-zinc-400 py-4 text-center">No item data available.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800/70">
            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">SKU</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">FNSKU</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Shipped</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Received</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pending</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
              <td className="px-4 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">{item.SellerSKU || '—'}</td>
              <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{item.FulfillmentNetworkSKU || '—'}</td>
              <td className="px-4 py-2 text-right text-zinc-700 dark:text-zinc-300">{item.QuantityShipped ?? 0}</td>
              <td className="px-4 py-2 text-right text-zinc-700 dark:text-zinc-300">{item.QuantityReceived ?? 0}</td>
              <td className="px-4 py-2 text-right">
                <span className={item.QuantityPending > 0 ? 'text-amber-600 font-medium' : 'text-zinc-400'}>
                  {item.QuantityPending ?? 0}
                </span>
              </td>
              <td className="px-4 py-2 text-center">
                {item.FullyInwarded ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Done
                  </span>
                ) : (item.QuantityShipped ?? 0) === 0 ? (
                  <span className="text-xs text-zinc-400">—</span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AmazonFBAShipmentQueue() {
  const [shipments, setShipments]       = useState<FBAShipment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [syncing, setSyncing]           = useState(false);
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [jumpInput, setJumpInput]       = useState('');
  const PAGE_SIZE = 50;

  // ── Fetch from DB ───────────────────────────────────────────────────────────
  const fetchShipments = useCallback(async (pg = 1, status = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page: pg, page_size: PAGE_SIZE };
      if (status !== 'All') params.status = status;
      const { data } = await axios.get(`${API_URL}/amazon_fba_shipment/db/shipments`, { params });
      setShipments(data.shipments || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
      setPage(pg);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchShipments(1, statusFilter); }, [statusFilter]);

  // ── Sync from SP-API ────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await axios.post(`${API_URL}/amazon_fba_shipment/sp/shipments/sync?days=365`);
      toast.success(`Sync complete — ${data.inserted} new, ${data.updated} updated, ${data.skipped_stable} skipped`);
      fetchShipments(1, statusFilter);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Toggle row expansion ────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Client-side search filter ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return shipments;
    const q = search.toLowerCase();
    return shipments.filter(
      s =>
        s.ShipmentId?.toLowerCase().includes(q) ||
        s.ShipmentName?.toLowerCase().includes(q) ||
        s.DestinationFulfillmentCenterId?.toLowerCase().includes(q)
    );
  }, [shipments, search]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = shipments.filter(s => s.ShipmentStatus !== 'CLOSED').length;
    const withPending = shipments.filter(s => s.pending_inward_count > 0).length;
    const linked = shipments.filter(s => s.has_processing_upload).length;
    return { active, withPending, linked };
  }, [shipments]);

  const lastSync = shipments[0]?.last_synced_at
    ? new Date(shipments[0].last_synced_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">FBA Shipment Queue</h1>
          {lastSync && (
            <p className="text-xs text-zinc-400 mt-0.5">Last synced: {lastSync}</p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync from Amazon'}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Shipments', value: total, icon: <Package className="w-5 h-5" /> },
          { label: 'Active', value: stats.active, icon: <Truck className="w-5 h-5 text-blue-500" /> },
          { label: 'Pending Inward', value: stats.withPending, icon: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { label: 'Linked to Upload', value: stats.linked, icon: <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
            <div className="text-zinc-400">{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {s === 'All' ? 'All' : (STATUS_META[s]?.label ?? s)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="ml-auto">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by shipment ID or name…"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading shipments…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => fetchShipments(1, statusFilter)} />
      ) : (
        <div className={TABLE_CLASSES.container}>
          <div className={TABLE_CLASSES.overflow}>
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  <th className="w-8" />
                  <th className={TABLE_CLASSES.th}>Shipment Name</th>
                  <th className={TABLE_CLASSES.th}>Shipment ID</th>
                  <th className={TABLE_CLASSES.th}>Status</th>
                  <th className={TABLE_CLASSES.th}>FC</th>
                  <th className={TABLE_CLASSES.th}>SKUs</th>
                  <th className={TABLE_CLASSES.th}>Inward Progress</th>
                  <th className={TABLE_CLASSES.th}>Linked</th>
                  <th className={TABLE_CLASSES.th}>Synced</th>
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-zinc-400 text-sm">
                      No shipments found. {search ? 'Try a different search.' : 'Click "Sync from Amazon" to load data.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(shipment => {
                    const expanded = expandedIds.has(shipment.ShipmentId);
                    return (
                      <React.Fragment key={shipment.ShipmentId}>
                        <tr
                          className={`${TABLE_CLASSES.tr} cursor-pointer`}
                          onClick={() => toggleExpand(shipment.ShipmentId)}
                        >
                          {/* Expand toggle */}
                          <td className="pl-3 pr-1 py-3 w-8">
                            {expanded
                              ? <ChevronDown className="w-4 h-4 text-zinc-400" />
                              : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                          </td>

                          {/* Shipment Name */}
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                              {shipment.ShipmentName || '—'}
                            </span>
                          </td>

                          {/* Shipment ID */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                              {shipment.ShipmentId}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge status={shipment.ShipmentStatus} />
                          </td>

                          {/* FC */}
                          <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                            {shipment.DestinationFulfillmentCenterId || '—'}
                          </td>

                          {/* SKU count */}
                          <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 text-center">
                            {shipment.total_skus ?? 0}
                          </td>

                          {/* Inward progress */}
                          <td className="px-4 py-3">
                            <InwardProgress
                              total={shipment.total_skus ?? 0}
                              inwarded={shipment.fully_inwarded_count ?? 0}
                            />
                          </td>

                          {/* Linked to processing upload */}
                          <td className="px-4 py-3 text-center">
                            {shipment.has_processing_upload ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Yes
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                            )}
                          </td>

                          {/* Last synced */}
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {shipment.last_synced_at
                              ? new Date(shipment.last_synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                              : '—'}
                          </td>
                        </tr>

                        {/* Expanded items row */}
                        {expanded && (
                          <tr className="bg-zinc-50 dark:bg-zinc-800/30">
                            <td colSpan={9} className="px-6 py-4">
                              {/* Ship-from address */}
                              {shipment.ShipFromAddress?.City && (
                                <p className="text-xs text-zinc-400 mb-3">
                                  <span className="font-medium text-zinc-500">From:</span>{' '}
                                  {[
                                    shipment.ShipFromAddress.Name,
                                    shipment.ShipFromAddress.City,
                                    shipment.ShipFromAddress.StateOrProvinceCode,
                                    shipment.ShipFromAddress.CountryCode,
                                  ].filter(Boolean).join(', ')}
                                </p>
                              )}
                              <ItemsTable items={shipment.items || []} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 text-sm text-zinc-500">
              <span>{total} shipments total</span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchShipments(page - 1, statusFilter)}
                  className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Prev
                </button>
                <span className="whitespace-nowrap">Page {page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchShipments(page + 1, statusFilter)}
                  className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Next
                </button>
                {/* Jump to page */}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-zinc-400">Go to</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpInput}
                    onChange={e => setJumpInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const pg = Math.min(totalPages, Math.max(1, parseInt(jumpInput, 10)));
                        if (!isNaN(pg)) {
                          fetchShipments(pg, statusFilter);
                          setJumpInput('');
                        }
                      }
                    }}
                    placeholder={String(page)}
                    className="w-14 px-2 py-1 text-xs text-center rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const pg = Math.min(totalPages, Math.max(1, parseInt(jumpInput, 10)));
                      if (!isNaN(pg)) {
                        fetchShipments(pg, statusFilter);
                        setJumpInput('');
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
