'use client';

import { useAuth } from '@/components/context/AuthContext';
import BlinkitItemsTable from '@/components/inventory/BlinkitItemsTable';
import axios from 'axios';
import { Plus, X, Zap, Search } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-toastify';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/blinkit`;

export default function BlinkitItemsPage() {
  const { isLoading, accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ item_id: '', sku_code: '', item_name: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleCreateItem = async () => {
    const errors: Record<string, string> = {};
    if (!formData.item_id.trim()) errors.item_id = 'Item ID is required';
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
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create item');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-500'>
        <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-green-500' />
        Loading…
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='flex flex-col items-center justify-center py-24 text-gray-400 dark:text-zinc-500'>
        <div className='w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4'>
          <svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
              d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
          </svg>
        </div>
        <p className='font-medium'>Please log in to view this page</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-lg' style={{ backgroundColor: 'rgba(255, 211, 76, 0.2)' }}>
            <Zap className='w-5 h-5' style={{ color: '#FFD34C' }} />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
              Blinkit SKU Mapping
            </h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Manage Blinkit item ID → SKU code mappings
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by item ID, SKU or name…'
              className='pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent w-64'
            />
          </div>
          <button
            onClick={() => { setIsModalOpen(true); setFormErrors({}); }}
            className='flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 text-gray-900'
            style={{ backgroundColor: '#FFD34C' }}
          >
            <Plus className='w-4 h-4' />
            Add Item
          </button>
        </div>
      </div>

      {/* Table */}
      <BlinkitItemsTable search={search} />

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
                { name: 'item_id', label: 'Item ID', placeholder: 'Blinkit item ID' },
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
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
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
                  className='flex-1 px-4 py-2 text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 text-gray-900 transition-opacity'
                  style={{ backgroundColor: '#FFD34C' }}
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
