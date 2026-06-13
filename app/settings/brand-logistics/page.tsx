'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Truck,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface BrandLogistics {
  brand: string;
  lead_time: number;
  safety_days_fast: number;
  safety_days_medium: number;
  safety_days_slow: number;
  order_processing: number;
}

const DEFAULT_FORM: BrandLogistics = {
  brand: '',
  lead_time: 60,
  safety_days_fast: 40,
  safety_days_medium: 25,
  safety_days_slow: 15,
  order_processing: 10,
};

const numInputCls =
  'w-20 px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50 transition-colors';

export default function BrandLogisticsPage() {
  const { isLoading, accessToken } = useAuth();
  const [brands, setBrands] = useState<BrandLogistics[]>([]);
  const [availableBrands, setAvailableBrands] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingBrand, setSavingBrand] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBrand, setNewBrand] = useState<BrandLogistics>({ ...DEFAULT_FORM });
  const [addingSaving, setAddingSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const authHeaders = { headers: { Authorization: `Bearer ${accessToken}` } };

  const fetchAvailableBrands = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, authHeaders);
      setAvailableBrands(response.data.brands || []);
    } catch {}
  };

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brand-logistics`, authHeaders);
      setBrands(
        (response.data.data || []).map((b: BrandLogistics) => ({
          ...b,
          order_processing: b.order_processing ?? 10,
        }))
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch brand logistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchBrands();
      fetchAvailableBrands();
    }
  }, [accessToken]);

  const saveBrand = async (brand: BrandLogistics, isNew = false) => {
    const key = brand.brand;
    if (isNew) setAddingSaving(true); else setSavingBrand(key);
    setError(null);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/master/brand-logistics`, null, {
        params: {
          brand: brand.brand,
          lead_time: brand.lead_time,
          safety_days_fast: brand.safety_days_fast,
          safety_days_medium: brand.safety_days_medium,
          safety_days_slow: brand.safety_days_slow,
          order_processing: brand.order_processing,
        },
        ...authHeaders,
      });
      setSuccess(`Saved settings for ${brand.brand}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchBrands();
      if (isNew) {
        setShowAddForm(false);
        setNewBrand({ ...DEFAULT_FORM });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save brand logistics');
    } finally {
      if (isNew) setAddingSaving(false); else setSavingBrand(null);
    }
  };

  const deleteBrand = async (brandName: string) => {
    setDeletingBrand(brandName);
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/master/brand-logistics`, {
        params: { brand: brandName },
        ...authHeaders,
      });
      setSuccess(`Deleted settings for ${brandName}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchBrands();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete brand logistics');
    } finally {
      setDeletingBrand(null);
      setDeleteConfirm(null);
    }
  };

  const updateBrandField = (index: number, field: keyof BrandLogistics, value: string) => {
    setBrands(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === 'brand' ? value : parseFloat(value) || 0,
      };
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='h-7 w-7 animate-spin text-indigo-600' />
      </div>
    );
  }

  const FIELDS: { key: keyof BrandLogistics; label: string; step?: string }[] = [
    { key: 'lead_time', label: 'Lead Time (days)' },
    { key: 'safety_days_fast', label: 'Safety Days — Fast' },
    { key: 'safety_days_medium', label: 'Safety Days — Medium' },
    { key: 'safety_days_slow', label: 'Safety Days — Slow' },
    { key: 'order_processing', label: 'Order Processing (days)' },
  ];

  return (
    <div className='p-4 sm:p-6'>
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={() => setDeleteConfirm(null)} />
          <div className='relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-5'>
            <div className='flex items-center gap-3 mb-3'>
              <div className='p-2 bg-red-100 dark:bg-red-900/30 rounded-lg'>
                <Trash2 className='h-4 w-4 text-red-600 dark:text-red-400' />
              </div>
              <h3 className='text-base font-semibold text-gray-900 dark:text-white'>Delete Brand</h3>
            </div>
            <p className='text-sm text-gray-600 dark:text-gray-400 mb-5'>
              Delete logistics settings for{' '}
              <span className='font-semibold text-gray-900 dark:text-white'>{deleteConfirm}</span>? This cannot be undone.
            </p>
            <div className='flex justify-end gap-2'>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={!!deletingBrand}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBrand(deleteConfirm)}
                disabled={!!deletingBrand}
                className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50'
              >
                {deletingBrand ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Trash2 className='h-3.5 w-3.5' />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='max-w-5xl mx-auto space-y-5'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <div className='p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
                <Truck className='h-5 w-5 text-indigo-600 dark:text-indigo-400' />
              </div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>Brand Logistics</h1>
            </div>
            <p className='text-sm text-gray-500 dark:text-gray-400 ml-12'>
              Configure lead time and safety days per brand. Used in the master report for order calculations.
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(v => !v); setNewBrand({ ...DEFAULT_FORM }); }}
            className='inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shrink-0'
          >
            {showAddForm ? <X className='h-4 w-4' /> : <Plus className='h-4 w-4' />}
            {showAddForm ? 'Cancel' : 'Add Brand'}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className='flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm'>
            <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
            <span className='flex-1'>{error}</span>
            <button onClick={() => setError(null)} className='text-red-400 hover:text-red-600'>
              <X className='h-4 w-4' />
            </button>
          </div>
        )}
        {success && (
          <div className='flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm'>
            <CheckCircle2 className='h-4 w-4 shrink-0' />
            {success}
          </div>
        )}

        {/* Add Brand Form */}
        {showAddForm && (
          <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5'>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white mb-3'>Add New Brand</h3>
            <div className='flex items-start gap-2.5 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-300'>
              <Info className='h-3.5 w-3.5 shrink-0 mt-0.5' />
              <span>
                If the brand you need isn&apos;t in the dropdown, it must first be created at{' '}
                <a href='/vendors/vendor_brand_mapping' className='underline font-medium hover:text-amber-900 dark:hover:text-amber-200'>
                  Vendors → Vendor Brand Mapping
                </a>
                {' '}before it will appear here.
              </span>
            </div>
            {/* Grid: brand select + 5 numeric fields, all same height */}
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4'>
              {/* Brand selector */}
              <div className='flex flex-col'>
                <label className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 h-8 flex items-center'>
                  Brand Name
                </label>
                <select
                  value={newBrand.brand}
                  onChange={(e) => setNewBrand(prev => ({ ...prev, brand: e.target.value }))}
                  className='px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none'
                >
                  <option value=''>Select a brand...</option>
                  {availableBrands
                    .filter((b) => !brands.some((bl) => bl.brand === b.value))
                    .map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                </select>
              </div>

              {/* Numeric fields */}
              {FIELDS.map(({ key, label }) => (
                <div key={key} className='flex flex-col'>
                  <label className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 h-8 flex items-center leading-tight'>
                    {label}
                  </label>
                  <input
                    type='number'
                    value={(newBrand as any)[key]}
                    onChange={(e) => setNewBrand(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    className={numInputCls}
                  />
                </div>
              ))}
            </div>

            <div className='mt-4 flex gap-2'>
              <button
                onClick={() => saveBrand(newBrand, true)}
                disabled={!newBrand.brand || addingSaving}
                className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 transition-colors'
              >
                {addingSaving ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Save className='h-3.5 w-3.5' />}
                {addingSaving ? 'Saving...' : 'Save Brand'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewBrand({ ...DEFAULT_FORM }); }}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Brands Table */}
        <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
          <div className='px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-gray-900 dark:text-white'>
              Configured Brands
              <span className='ml-2 text-xs font-normal text-gray-400'>({brands.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-16 gap-3'>
              <Loader2 className='h-6 w-6 animate-spin text-indigo-600' />
              <span className='text-sm text-gray-500 dark:text-gray-400'>Loading brands...</span>
            </div>
          ) : brands.length === 0 ? (
            <div className='text-center py-16 text-gray-400 dark:text-gray-500 text-sm'>
              No brand logistics configured yet. Click <span className='font-medium'>Add Brand</span> to get started.
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Brand</th>
                    {FIELDS.map(({ key, label }) => (
                      <th key={key} className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>{label}</th>
                    ))}
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Actions</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-gray-800'>
                  {brands.map((brand, index) => {
                    const isSaving = savingBrand === brand.brand;
                    const isDeleting = deletingBrand === brand.brand;
                    return (
                      <tr key={brand.brand} className='hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'>
                        <td className='px-5 py-3.5 whitespace-nowrap'>
                          <div className='flex items-center gap-2'>
                            {(isSaving || isDeleting) && (
                              <Loader2 className='h-3.5 w-3.5 animate-spin text-indigo-500 shrink-0' />
                            )}
                            <span className='font-medium text-gray-900 dark:text-zinc-100'>{brand.brand}</span>
                          </div>
                        </td>
                        {FIELDS.map(({ key }) => (
                          <td key={key} className='px-4 py-3.5'>
                            <input
                              type='number'
                              value={(brand as any)[key]}
                              onChange={(e) => updateBrandField(index, key, e.target.value)}
                              disabled={isSaving || isDeleting}
                              className={`w-24 ${numInputCls}`}
                            />
                          </td>
                        ))}
                        <td className='px-4 py-3.5'>
                          <div className='flex items-center gap-1.5'>
                            <button
                              onClick={() => saveBrand(brand)}
                              disabled={isSaving || isDeleting}
                              className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors'
                            >
                              {isSaving ? <Loader2 className='h-3 w-3 animate-spin' /> : <Save className='h-3 w-3' />}
                              Save
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(brand.brand)}
                              disabled={isSaving || isDeleting}
                              className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors'
                            >
                              <Trash2 className='h-3 w-3' />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4'>
          <div className='flex items-start gap-3'>
            <Info className='h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5' />
            <div>
              <h3 className='text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2'>How Movement Classification Works</h3>
              <ul className='text-sm text-blue-700 dark:text-blue-300 space-y-1'>
                <li><span className='font-medium'>Fast Mover (Class 1):</span> Top 20% by volume or revenue percentile — uses Safety Days (Fast).</li>
                <li><span className='font-medium'>Medium Mover (Class 2):</span> Top 50% by volume or revenue percentile — uses Safety Days (Medium).</li>
                <li><span className='font-medium'>Slow Mover (Class 3):</span> Bottom 50% — uses Safety Days (Slow).</li>
                <li><span className='font-medium'>Target Days = Lead Time + Safety Days + Order Processing (default 10 days)</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
