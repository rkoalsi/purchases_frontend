'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, BookOpen, Search, RefreshCw } from 'lucide-react';

const API = `${process.env.NEXT_PUBLIC_API_URL}/zoho`;
const PAGE_SIZE = 10;

type Tab = 'products' | 'composites';

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
              ? 'bg-blue-600 text-white'
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
    </div>
  );
}

export default function ZohoItemsPage() {
  const { isLoading, accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('products');

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodTotalPages, setProdTotalPages] = useState(1);
  const [prodLoading, setProdLoading] = useState(false);

  // Composite state
  const [composites, setComposites] = useState<any[]>([]);
  const [compSearch, setCompSearch] = useState('');
  const [compPage, setCompPage] = useState(1);
  const [compTotal, setCompTotal] = useState(0);
  const [compTotalPages, setCompTotalPages] = useState(1);
  const [compLoading, setCompLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setProdLoading(true);
    try {
      const res = await axios.get(`${API}/products`, {
        params: { page: prodPage, limit: PAGE_SIZE, search: prodSearch || undefined },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setProducts(res.data.products);
      setProdTotal(res.data.pagination.totalProducts);
      setProdTotalPages(res.data.pagination.totalPages);
    } finally {
      setProdLoading(false);
    }
  }, [prodPage, prodSearch, accessToken]);

  const fetchComposites = useCallback(async () => {
    setCompLoading(true);
    try {
      const res = await axios.get(`${API}/composite-products`, {
        params: { page: compPage, limit: PAGE_SIZE, search: compSearch || undefined },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setComposites(res.data.items);
      setCompTotal(res.data.pagination.totalItems);
      setCompTotalPages(res.data.pagination.totalPages);
    } finally {
      setCompLoading(false);
    }
  }, [compPage, compSearch, accessToken]);

  useEffect(() => { if (accessToken) fetchProducts(); }, [fetchProducts, accessToken]);
  useEffect(() => { if (accessToken) fetchComposites(); }, [fetchComposites, accessToken]);

  // Reset to page 1 when search changes
  useEffect(() => { setProdPage(1); }, [prodSearch]);
  useEffect(() => { setCompPage(1); }, [compSearch]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  if (isLoading) return (
    <div className='flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-500'>
      <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-500' />
      Loading…
    </div>
  );

  if (!accessToken) return (
    <div className='flex flex-col items-center justify-center py-24 text-gray-400 dark:text-zinc-500'>
      <BookOpen className='w-10 h-10 mb-3 opacity-40' />
      <p className='font-medium'>Please log in to view this page</p>
    </div>
  );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg'>
            <BookOpen className='w-5 h-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>Zoho Products</h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Synced from Zoho Books
            </p>
          </div>
        </div>
        <div className='flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-1.5 rounded-full'>
          <RefreshCw className='w-3 h-3' />
          Updated daily
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 border-b border-gray-200 dark:border-zinc-800'>
        {([['products', 'Products', prodTotal], ['composites', 'Composite Items', compTotal]] as const).map(([id, label, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4'>
            <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>Products</h2>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
              <input
                type='text'
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder='Search by name or SKU…'
                className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
          </div>

          {prodLoading ? (
            <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
              <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-500' />
              Loading…
            </div>
          ) : products.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
              <BookOpen className='w-10 h-10 mb-3 opacity-40' />
              <p className='font-medium'>{prodSearch ? `No results for "${prodSearch}"` : 'No products found'}</p>
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Product</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Price</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Stock</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Status</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                    {products.map((p: any, i) => (
                      <tr key={p._id || i} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                        <td className='px-6 py-3.5'>
                          <div className='flex items-center gap-3'>
                            <div className='w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0'>
                              <span className='text-white text-xs font-semibold'>{(p.name || 'P').charAt(0).toUpperCase()}</span>
                            </div>
                            <span className='font-medium text-gray-800 dark:text-zinc-200'>{p.name || 'Unnamed'}</span>
                          </div>
                        </td>
                        <td className='px-6 py-3.5 font-mono text-xs text-gray-500 dark:text-zinc-400'>{p.sku || p.item_id || '—'}</td>
                        <td className='px-6 py-3.5 font-medium text-gray-800 dark:text-zinc-200'>{fmt(p.rate || p.price)}</td>
                        <td className='px-6 py-3.5 text-gray-600 dark:text-zinc-300'>{p.stock ?? 0}</td>
                        <td className='px-6 py-3.5'>
                          <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            p.status === 'active' || p.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {p.status === 'active' || p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
                <p className='text-xs text-gray-400 dark:text-zinc-500'>
                  {(prodPage - 1) * PAGE_SIZE + 1}–{Math.min(prodPage * PAGE_SIZE, prodTotal)} of {prodTotal}
                </p>
                <Pagination currentPage={prodPage} totalPages={prodTotalPages} onChange={setProdPage} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Composite items tab */}
      {tab === 'composites' && (
        <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4'>
            <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>Composite Items</h2>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
              <input
                type='text'
                value={compSearch}
                onChange={(e) => setCompSearch(e.target.value)}
                placeholder='Search by name or SKU…'
                className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
          </div>

          {compLoading ? (
            <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
              <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-500' />
              Loading…
            </div>
          ) : composites.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
              <BookOpen className='w-10 h-10 mb-3 opacity-40' />
              <p className='font-medium'>{compSearch ? `No results for "${compSearch}"` : 'No composite items found'}</p>
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Name</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Components</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                    {composites.map((c: any, i) => (
                      <tr key={c._id || i} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                        <td className='px-6 py-3.5 font-medium text-gray-800 dark:text-zinc-200'>{c.name}</td>
                        <td className='px-6 py-3.5'>
                          <span className='inline-block font-mono text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded'>
                            {c.sku_code || '—'}
                          </span>
                        </td>
                        <td className='px-6 py-3.5'>
                          <div className='flex flex-wrap gap-1'>
                            {(c.components || []).map((comp: any, ci: number) => (
                              <span key={ci} className='text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-2 py-0.5 rounded'>
                                {comp.name}{comp.quantity > 1 ? ` ×${comp.quantity}` : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className='px-6 py-3.5 text-xs text-gray-400 dark:text-zinc-500'>
                          {c.last_updated ? new Date(c.last_updated).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
                <p className='text-xs text-gray-400 dark:text-zinc-500'>
                  {(compPage - 1) * PAGE_SIZE + 1}–{Math.min(compPage * PAGE_SIZE, compTotal)} of {compTotal}
                </p>
                <Pagination currentPage={compPage} totalPages={compTotalPages} onChange={setCompPage} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
