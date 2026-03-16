'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, RefreshCw, Plus, X, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/amazon`;
const PAGE_SIZE = 25;

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
  const [skuData, setSkuData] = useState<SkuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ item_id: '', sku_code: '', item_name: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchSkuData(); }, []);

  const filtered = skuData.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.item_id.toLowerCase().includes(q) ||
      item.sku_code.toLowerCase().includes(q) ||
      item.item_name.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

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

  const handleCreateItem = async () => {
    const errors: Record<string, string> = {};
    if (!formData.item_id.trim()) errors.item_id = 'ASIN is required';
    if (!formData.sku_code.trim()) errors.sku_code = 'SKU Code is required';
    if (!formData.item_name.trim()) errors.item_name = 'Item Name is required';
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      setCreating(true);
      await axios.post(`${API_BASE}/create_single_item`, formData);
      toast.success('Item created');
      setIsModalOpen(false);
      setFormData({ item_id: '', sku_code: '', item_name: '' });
      await fetchSkuData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create item');
    } finally {
      setCreating(false);
    }
  };

  const deleteItem = async (item: SkuItem) => {
    try {
      await axios.delete(`${API_BASE}/delete_item/${item._id}`);
      toast.success('Item deleted');
      fetchSkuData();
    } catch {
      toast.error('Failed to delete item');
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
        <div className='flex items-center gap-2'>
          <button
            onClick={handleSync}
            disabled={syncing}
            className='flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium text-sm transition-colors'
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Amazon'}
          </button>
          <button
            onClick={() => { setIsModalOpen(true); setFormErrors({}); }}
            className='flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-zinc-100 hover:bg-gray-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg font-medium text-sm transition-colors'
          >
            <Plus className='w-4 h-4' />
            Add Item
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-4'>
          <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>
            All Mappings
          </h2>
          <div className='relative flex-1 max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by ASIN, SKU code or name…'
              className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
            />
          </div>
          {!loading && (
            <span className='text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full shrink-0'>
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
            <p className='text-sm mt-1'>Sync from Amazon or add items manually</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>ASIN</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item Name</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-16'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='px-6 py-10 text-center text-sm text-gray-400 dark:text-zinc-500'>
                      {search ? `No results for "${search}"` : 'No items yet'}
                    </td>
                  </tr>
                ) : paginated.map((item) => (
                  <tr key={item._id} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                    <td className='px-6 py-3.5 font-mono text-xs text-gray-600 dark:text-zinc-300'>
                      {item.item_id}
                    </td>
                    <td className='px-6 py-3.5'>
                      <span className='inline-block font-mono text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded'>
                        {item.sku_code}
                      </span>
                    </td>
                    <td className='px-6 py-3.5 text-gray-800 dark:text-zinc-200 max-w-md'>
                      {item.item_name}
                    </td>
                    <td className='px-6 py-3.5'>
                      <button
                        onClick={() => deleteItem(item)}
                        className='p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
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
                    className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${
                      page === actual ? 'bg-orange-600 text-white' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
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
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {isModalOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-zinc-800'>
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800'>
              <h3 className='font-semibold text-gray-900 dark:text-zinc-100'>Add Item</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className='p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
            <form
              className='p-6 space-y-4'
              onSubmit={(e) => { e.preventDefault(); handleCreateItem(); }}
            >
              {[
                { name: 'item_id', label: 'ASIN', placeholder: 'e.g. B09XYZ1234' },
                { name: 'sku_code', label: 'SKU Code', placeholder: 'e.g. PS-DOG-001' },
                { name: 'item_name', label: 'Item Name', placeholder: 'Product title' },
              ].map(({ name, label, placeholder }) => (
                <div key={name}>
                  <label className='block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1'>
                    {label}
                  </label>
                  <input
                    type='text'
                    name={name}
                    value={formData[name as keyof typeof formData]}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
                      setFormErrors((p) => ({ ...p, [e.target.name]: '' }));
                    }}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      formErrors[name] ? 'border-red-400' : 'border-gray-300 dark:border-zinc-700'
                    }`}
                  />
                  {formErrors[name] && (
                    <p className='text-xs text-red-500 mt-1'>{formErrors[name]}</p>
                  )}
                </div>
              ))}
              <div className='flex gap-3 pt-2'>
                <button
                  type='button'
                  onClick={() => setIsModalOpen(false)}
                  className='flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={creating}
                  className='flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white transition-colors'
                >
                  {creating ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
