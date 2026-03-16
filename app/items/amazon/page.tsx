'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/amazon`;
const PAGE_SIZE = 25;

async function buildSkuBrandMap(token: string): Promise<Map<string, string>> {
  const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/sku-brand-map`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return new Map<string, string>(Object.entries(res.data));
}

type SkuItem = {
  _id: string;
  item_id: string;
  sku_code: string;
  item_name: string;
  seller_sku?: string;
};

type SyncResult = {
  message: string;
  inserted: number;
  updated: number;
  unchanged: number;
  total_sp_listings: number;
};

export default function AmazonSkuMappingPage() {
  const { accessToken } = useAuth();
  const [skuData, setSkuData] = useState<SkuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [allBrands, setAllBrands] = useState<{ value: string; label: string }[]>([]);
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [brand, setBrand] = useState('');
  const [skuBrandMap, setSkuBrandMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setAllBrands(res.data.brands || []))
      .catch(() => {});
  }, [accessToken]);

  // Build sku→brand map from all Zoho products once on load
  useEffect(() => {
    if (!accessToken) return;
    buildSkuBrandMap(accessToken).then(setSkuBrandMap);
  }, [accessToken]);

  // Compute relevant brands once skuData + map are ready
  useEffect(() => {
    if (skuData.length === 0 || skuBrandMap.size === 0 || allBrands.length === 0) return;
    const present = new Set(
      skuData.map((i) => skuBrandMap.get(i.sku_code)).filter((b): b is string => Boolean(b))
    );
    const relevant = allBrands.filter((b) => present.has(b.value));
    setBrands(relevant.length > 0 ? relevant : allBrands);
  }, [skuData, skuBrandMap, allBrands]);

  useEffect(() => { setPage(1); }, [brand]);

  const filtered = skuData.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (
      item.item_id.toLowerCase().includes(q) ||
      item.sku_code.toLowerCase().includes(q) ||
      item.item_name.toLowerCase().includes(q)
    );
    const matchesBrand = !brand || skuBrandMap.get(item.sku_code) === brand;
    return matchesSearch && matchesBrand;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSkuData(); }, []);

  const fetchSkuData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/get_amazon_sku_mapping`);
      setSkuData(res.data);
    } catch {
      toast.error('Failed to load SKU mapping data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post<SyncResult>(`${API_BASE}/sync-sku-mapping`);
      const d = res.data;
      toast.success(`Sync complete — ${d.inserted} added, ${d.updated} updated, ${d.unchanged} unchanged`);
      await fetchSkuData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg'>
            <Package className='w-5 h-5 text-orange-600 dark:text-orange-400' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
              Amazon SKU Mapping
            </h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Manage ASIN → SKU code mappings synced from Amazon SP-API
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className='flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium text-sm transition-colors'
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync from Amazon'}
        </button>
      </div>

      {/* Table card */}
      <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap'>
          <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>All Mappings</h2>
          <div className='relative flex-1 min-w-[160px] max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by ASIN, SKU code or name…'
              className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
            />
          </div>
          {brands.length > 0 && (
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer'
            >
              <option value=''>All Brands</option>
              {brands.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          )}
          {!loading && (
            <span className='text-xs text-black dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full shrink-0'>
              {filtered.length}{filtered.length !== skuData.length ? ` / ${skuData.length}` : ''} items
            </span>
          )}
        </div>

        {loading ? (
          <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
            <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-orange-500' />
            Loading…
          </div>
        ) : skuData.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
            <Package className='w-10 h-10 mb-3 opacity-40' />
            <p className='font-medium'>No items yet</p>
            <p className='text-sm mt-1'>Sync from Amazon to populate mappings</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-12'>#</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item Name</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>ASIN</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='px-6 py-10 text-center text-sm text-gray-400 dark:text-zinc-500'>
                      {search ? `No results for "${search}"` : 'No items yet'}
                    </td>
                  </tr>
                ) : paginated.map((item, index) => (
                  <tr key={item._id} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                    <td className='px-6 py-3.5 text-sm text-gray-400 dark:text-zinc-500'>
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className='px-6 py-3.5 text-gray-800 dark:text-zinc-200'>
                      {item.item_name}
                    </td>
                    <td className='px-6 py-3.5'>
                      <span className='inline-block font-mono text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded'>
                        {item.sku_code}
                      </span>
                    </td>
                    <td className='px-6 py-3.5 font-mono text-xs text-gray-600 dark:text-zinc-300'>
                      {item.item_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
            <p className='text-xs text-gray-400 dark:text-zinc-500'>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className='flex items-center gap-1'>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronLeft className='w-4 h-4' />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, page - 2);
                const actual = Math.max(1, Math.min(totalPages, start + i));
                return (
                  <button
                    key={actual}
                    onClick={() => setPage(actual)}
                    className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${page === actual ? 'bg-orange-600 text-white' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    {actual}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
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
                        setPage(v);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                  className='w-12 px-1.5 py-1 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                />
                <span className='text-xs text-gray-400 dark:text-zinc-500'>of {totalPages}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
