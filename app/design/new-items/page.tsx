'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Palette, Search } from 'lucide-react';

const API = `${process.env.NEXT_PUBLIC_API_URL}/design`;
const PAGE_SIZE = 20;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (val?: string) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ─── Badges ──────────────────────────────────────────────────────────────────

const ZOHO_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  inactive: {
    label: 'Inactive',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  },
};

const PURCHASE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
  },
  inactive: {
    label: 'Inactive',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  },
  'discontinued until stock lasts': {
    label: 'Disc. until stock lasts',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
};

function ZohoStatusBadge({ value }: { value?: string }) {
  if (!value)
    return (
      <span className='inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700'>
        —
      </span>
    );
  const cfg = ZOHO_STATUS_CONFIG[value] ?? {
    label: value,
    className:
      'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function PurchaseStatusBadge({ value }: { value?: string }) {
  if (!value)
    return (
      <span className='inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700'>
        Not set
      </span>
    );
  const cfg = PURCHASE_STATUS_CONFIG[value] ?? {
    label: value,
    className:
      'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const pages = (() => {
    const arr: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  })();

  return (
    <div className='flex items-center gap-1'>
      <button
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
      >
        <ChevronLeft className='w-4 h-4' />
      </button>
      {pages.map((pg) => (
        <button
          key={pg}
          onClick={() => onChange(pg)}
          className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${
            currentPage === pg
              ? 'bg-purple-600 text-white'
              : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          {pg}
        </button>
      ))}
      <button
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
      >
        <ChevronRight className='w-4 h-4' />
      </button>
      <div className='flex items-center gap-1 ml-2 pl-2 border-l border-gray-200 dark:border-zinc-700'>
        <span className='text-xs text-gray-400 dark:text-zinc-500'>Go to</span>
        <input
          type='number'
          min={1}
          max={totalPages}
          placeholder='…'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = parseInt(e.currentTarget.value);
              if (v >= 1 && v <= totalPages) {
                onChange(v);
                e.currentTarget.value = '';
              }
            }
          }}
          className='w-12 px-1.5 py-1 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        />
        <span className='text-xs text-gray-400 dark:text-zinc-500'>of {totalPages}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignNewItemsPage() {
  const { isLoading, accessToken } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [zohoStatus, setZohoStatus] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setBrands(res.data.brands || []))
      .catch(() => {});
  }, [accessToken]);

  const fetchProducts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/new-items`, {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          brand: brand || undefined,
          zoho_status: zohoStatus || undefined,
          purchase_status: purchaseStatus || undefined,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setProducts(res.data.products);
      setTotal(res.data.pagination.totalProducts);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, brand, zohoStatus, purchaseStatus, accessToken]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search, brand, zohoStatus, purchaseStatus]);

  if (isLoading)
    return (
      <div className='flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-500'>
        <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-purple-500' />
        Loading…
      </div>
    );

  if (!accessToken)
    return (
      <div className='flex flex-col items-center justify-center py-24 text-gray-400 dark:text-zinc-500'>
        <Palette className='w-10 h-10 mb-3 opacity-40' />
        <p className='font-medium'>Please log in to view this page</p>
      </div>
    );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg'>
            <Palette className='w-5 h-5 text-purple-600 dark:text-purple-400' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>New Items</h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Latest non-combo products added to Zoho — newest first
            </p>
          </div>
        </div>
        {total > 0 && (
          <span className='text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full'>
            {total} products
          </span>
        )}
      </div>

      {/* Table card */}
      <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
        {/* Filters */}
        <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap'>
          {/* Search */}
          <div className='relative flex-1 min-w-[180px] max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by name or SKU…'
              className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            />
          </div>

          {/* Brand */}
          {brands.length > 0 && (
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'
            >
              <option value=''>All Brands</option>
              {brands.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          )}

          {/* Zoho Status */}
          <select
            value={zohoStatus}
            onChange={(e) => setZohoStatus(e.target.value)}
            className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'
          >
            <option value=''>All Zoho Statuses</option>
            <option value='active'>Active</option>
            <option value='inactive'>Inactive</option>
          </select>

          {/* Purchase Status */}
          <select
            value={purchaseStatus}
            onChange={(e) => setPurchaseStatus(e.target.value)}
            className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'
          >
            <option value=''>All Purchase Statuses</option>
            <option value='active'>Active</option>
            <option value='inactive'>Inactive</option>
            <option value='discontinued until stock lasts'>Disc. until stock lasts</option>
          </select>
        </div>

        {loading ? (
          <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
            <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-purple-500' />
            Loading…
          </div>
        ) : products.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
            <Palette className='w-10 h-10 mb-3 opacity-40' />
            <p className='font-medium'>
              {search ? `No results for "${search}"` : 'No products found'}
            </p>
          </div>
        ) : (
          <>
            <div>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-10'>#</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Product</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Brand</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>MRP</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Created</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Updated</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Zoho Status</th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Purchase Status</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                  {products.map((p: any, i) => (
                    <tr
                      key={p._id || i}
                      className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'
                    >
                      <td className='px-4 py-3.5 text-xs text-gray-400 dark:text-zinc-500'>
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className='px-4 py-3.5'>
                        <div className='flex items-center gap-3'>
                          <div className='w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shrink-0'>
                            <span className='text-white text-xs font-semibold'>
                              {(p.name || 'P').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className='font-medium text-gray-800 dark:text-zinc-200'>
                            {p.name || 'Unnamed'}
                          </span>
                        </div>
                      </td>
                      <td className='px-4 py-3.5'>
                        {p.cf_sku_code ? (
                          <span className='inline-block font-mono text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded'>
                            {p.cf_sku_code}
                          </span>
                        ) : (
                          <span className='text-gray-400 dark:text-zinc-500'>—</span>
                        )}
                      </td>
                      <td className='px-4 py-3.5 text-gray-600 dark:text-zinc-300 text-sm'>
                        {p.brand || '—'}
                      </td>
                      <td className='px-4 py-3.5 font-medium text-gray-800 dark:text-zinc-200 whitespace-nowrap'>
                        {p.rate != null ? fmt(p.rate) : '—'}
                      </td>
                      <td className='px-4 py-3.5 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap'>
                        {fmtDate(p.created_at)}
                      </td>
                      <td className='px-4 py-3.5 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap'>
                        {fmtDate(p.updated_at)}
                      </td>
                      <td className='px-4 py-3.5'>
                        <ZohoStatusBadge value={p.status} />
                      </td>
                      <td className='px-4 py-3.5'>
                        <PurchaseStatusBadge value={p.purchase_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
              <p className='text-xs text-gray-400 dark:text-zinc-500'>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
