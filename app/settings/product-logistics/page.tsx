'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowDownUp,
} from 'lucide-react';

interface ProductLogistics {
  item_id: string;
  cf_sku_code: string;
  name: string;
  brand: string;
  cbm: number;
  case_pack: number;
  purchase_status: string;
  purchase_price: number;
  currency: string;
  stock_in_transit_1: number;
  stock_in_transit_2: number;
  stock_in_transit_3: number;
  transit_1_po: string;
  transit_2_po: string;
  transit_3_po: string;
}

const STATUS_OPTIONS = [
  'active',
  'active - combo',
  'inactive',
  'discontinued until stock lasts',
] as const;

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'GBP', 'INR', 'AED', 'SGD'] as const;

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'active - combo': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  inactive: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'discontinued until stock lasts':
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const inputCls =
  'px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50 transition-colors';

const selectCls =
  'px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50 transition-colors';

function TransitCell({ qty, po }: { qty: number; po: string }) {
  if (!qty && !po) {
    return <span className='text-gray-300 dark:text-zinc-600 text-sm'>—</span>;
  }
  return (
    <div className='space-y-0.5'>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
          qty > 0
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
            : 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'
        }`}
      >
        {qty}
      </span>
      {po && (
        <div className='text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate max-w-[90px]' title={po}>
          {po}
        </div>
      )}
    </div>
  );
}

export default function ProductLogisticsPage() {
  const { isLoading, accessToken } = useAuth();
  const [products, setProducts] = useState<ProductLogistics[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [sortBy, setSortBy] = useState<'sku' | 'latest'>('sku');
  const [availableBrands, setAvailableBrands] = useState<{ value: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const authHeaders = { headers: { Authorization: `Bearer ${accessToken}` } };

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics`,
        {
          params: { search: searchTerm, brand: selectedBrand, status: selectedStatus, sort_by: sortBy, page, page_size: pageSize },
          ...authHeaders,
        }
      );
      const data = response.data;
      setProducts(data.data || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchTerm, selectedBrand, selectedStatus, sortBy, page]);

  useEffect(() => {
    if (accessToken) {
      fetchProducts();
      fetchAvailableBrands();
    }
  }, [accessToken, page]);

  const fetchAvailableBrands = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, authHeaders);
      setAvailableBrands(response.data.brands || []);
    } catch {}
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (accessToken) { setPage(1); fetchProducts(); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedBrand, selectedStatus, sortBy]);

  const saveField = async (item_id: string, sku: string, fields: Record<string, string | number>) => {
    setSaving(prev => new Set(prev).add(item_id));
    setError(null);
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics`, null, {
        params: { item_id, sku_code: sku, ...fields },
        ...authHeaders,
      });
      setSuccess(`Saved ${sku}`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to save ${sku}`);
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(item_id); return s; });
    }
  };

  const handleNumberBlur = (
    item_id: string,
    sku: string,
    field: 'cbm' | 'case_pack' | 'purchase_price',
    raw: string
  ) => {
    const val = parseFloat(raw) || 0;
    setProducts(prev => prev.map(p => p.item_id === item_id ? { ...p, [field]: val } : p));
    saveField(item_id, sku, { [field]: val });
  };

  const handleStatusChange = (item_id: string, sku: string, value: string) => {
    setProducts(prev => prev.map(p => p.item_id === item_id ? { ...p, purchase_status: value } : p));
    saveField(item_id, sku, { purchase_status: value });
  };

  const handleCurrencyChange = (item_id: string, sku: string, value: string) => {
    setProducts(prev => prev.map(p => p.item_id === item_id ? { ...p, currency: value } : p));
    saveField(item_id, sku, { currency: value });
  };

  const handleBulkUpload = async () => {
    if (!bulkUploadFile) return;
    setBulkUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', bulkUploadFile);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics/bulk-upload`,
        formData,
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' } }
      );
      const { message, errors } = response.data;
      setSuccess(message + (errors?.length ? ` (${errors.length} error(s))` : ''));
      setTimeout(() => setSuccess(null), 6000);
      setBulkUploadOpen(false);
      setBulkUploadFile(null);
      await fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleImportFromMaster = async () => {
    if (!confirm('Import Status, CBM and Case Pack from the Updated Master Google Sheet? This will update existing product data.')) return;
    try {
      setImportLoading(true);
      setError(null);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/master/import-product-logistics`,
        null,
        authHeaders
      );
      setSuccess(`Import complete: ${response.data.updated} updated, ${response.data.skipped} skipped`);
      setTimeout(() => setSuccess(null), 5000);
      await fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import from Master Sheet');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloadLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics/download`,
        {
          params: { search: searchTerm, brand: selectedBrand, status: selectedStatus },
          ...authHeaders,
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'product_logistics.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download report');
    } finally {
      setDownloadLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='h-7 w-7 animate-spin text-indigo-600' />
      </div>
    );
  }

  return (
    <div className='p-4 sm:p-6'>
      {/* Bulk Price Upload Modal */}
      {bulkUploadOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={() => setBulkUploadOpen(false)} />
          <div className='relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center gap-2'>
                <div className='p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
                  <Upload className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                </div>
                <h2 className='text-base font-semibold text-gray-900 dark:text-white'>Bulk Price Upload</h2>
              </div>
              <button onClick={() => setBulkUploadOpen(false)} className='p-1 text-gray-400 hover:text-gray-600 rounded'>
                <X className='h-4 w-4' />
              </button>
            </div>
            <div className='mb-4 text-sm text-gray-600 dark:text-zinc-400 space-y-2'>
              <p>Upload an XLSX file to bulk-update <strong className='text-gray-800 dark:text-zinc-200'>Currency</strong> and <strong className='text-gray-800 dark:text-zinc-200'>Purchase Price</strong> for multiple products.</p>
              <p>The file must contain exactly these three columns:</p>
              <div className='bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 font-mono text-xs space-y-1'>
                <div>• SKU Code</div>
                <div>• Currency <span className='font-sans text-gray-400'>(e.g. USD, CNY)</span></div>
                <div>• Purchase Price <span className='font-sans text-gray-400'>(numeric)</span></div>
              </div>
              <p>Download the existing data as a starting point — it already contains these columns.</p>
            </div>
            <input
              type='file'
              accept='.xlsx,.xls'
              onChange={(e) => setBulkUploadFile(e.target.files?.[0] ?? null)}
              className='block w-full text-sm text-gray-700 dark:text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 hover:file:bg-indigo-100 mb-5'
            />
            <div className='flex justify-end gap-2'>
              <button
                onClick={() => setBulkUploadOpen(false)}
                className='px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={!bulkUploadFile || bulkUploading}
                className='inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors'
              >
                {bulkUploading ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Upload className='h-3.5 w-3.5' />}
                {bulkUploading ? 'Uploading...' : 'Upload & Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='max-w-[1600px] mx-auto space-y-5'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <div className='p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
                <Package className='h-5 w-5 text-indigo-600 dark:text-indigo-400' />
              </div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>Product Logistics</h1>
            </div>
            <p className='text-sm text-gray-500 dark:text-gray-400 ml-12'>
              Manage status, CBM, case pack, currency and purchase price per product. Changes save automatically.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              onClick={handleDownload}
              disabled={downloadLoading}
              className='inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm'
            >
              {downloadLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Download className='h-4 w-4' />}
              Download XLSX
            </button>
            <button
              onClick={() => { setBulkUploadOpen(true); setBulkUploadFile(null); }}
              className='inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm'
            >
              <Upload className='h-4 w-4' />
              Bulk Price Upload
            </button>
            <button
              onClick={handleImportFromMaster}
              disabled={importLoading}
              className='inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm'
            >
              {importLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <FileSpreadsheet className='h-4 w-4' />}
              {importLoading ? 'Importing...' : 'Import from Master Sheet'}
            </button>
          </div>
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

        {/* Search & Filters */}
        <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4'>
          <div className='flex flex-wrap gap-3'>
            <div className='relative flex-1 min-w-[220px]'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search by SKU or product name...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
              />
            </div>
            <select
              value={selectedBrand}
              onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
              className='px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none'
            >
              <option value=''>All Brands</option>
              {availableBrands.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className='px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none'
            >
              <option value=''>All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => { setSortBy(s => s === 'sku' ? 'latest' : 'sku'); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                sortBy === 'latest'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <ArrowDownUp className='h-4 w-4' />
              {sortBy === 'latest' ? 'Latest First' : 'SKU A–Z'}
            </button>
          </div>
          <div className='mt-2.5 text-xs text-gray-400 dark:text-gray-500'>
            {total.toLocaleString()} products · Page {page} of {totalPages}
          </div>
        </div>

        {/* Table */}
        <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
          {loading ? (
            <div className='flex items-center justify-center py-16 gap-3'>
              <Loader2 className='h-6 w-6 animate-spin text-indigo-600' />
              <span className='text-sm text-gray-500 dark:text-gray-400'>Loading products...</span>
            </div>
          ) : products.length === 0 ? (
            <div className='text-center py-16 text-gray-400 dark:text-gray-500 text-sm'>
              {searchTerm ? `No products found for "${searchTerm}"` : 'No products found'}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>SKU Code</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Product Name</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Brand</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Status</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>CBM</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>Case Pack</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Currency</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>Purchase Price</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>Transit 1</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>Transit 2</th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap'>Transit 3</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-gray-800'>
                  {products.map((product) => {
                    const isSaving = saving.has(product.item_id);
                    return (
                      <tr
                        key={product.item_id || product.cf_sku_code}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSaving ? 'opacity-60' : ''}`}
                      >
                        <td className='px-4 py-3 whitespace-nowrap'>
                          <div className='flex items-center gap-1.5'>
                            {isSaving && <Loader2 className='h-3 w-3 animate-spin text-indigo-500 shrink-0' />}
                            <span className='font-mono text-xs text-gray-700 dark:text-zinc-300'>{product.cf_sku_code}</span>
                          </div>
                        </td>
                        <td className='px-4 py-3 max-w-[200px]'>
                          <span className='text-gray-900 dark:text-zinc-100 truncate block'>{product.name || '—'}</span>
                        </td>
                        <td className='px-4 py-3 whitespace-nowrap'>
                          <span className='text-gray-500 dark:text-zinc-400 text-xs'>{product.brand || '—'}</span>
                        </td>
                        <td className='px-4 py-3 whitespace-nowrap'>
                          <select
                            value={product.purchase_status || STATUS_OPTIONS[0]}
                            onChange={(e) => handleStatusChange(product.item_id, product.cf_sku_code, e.target.value)}
                            disabled={isSaving}
                            className={`text-xs font-medium rounded-md px-2 py-1 border-0 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${STATUS_COLORS[product.purchase_status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className='px-4 py-3'>
                          <input
                            type='number'
                            step='0.0001'
                            defaultValue={product.cbm || 0}
                            key={`cbm-${product.item_id}-${product.cbm}`}
                            onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'cbm', e.target.value)}
                            disabled={isSaving}
                            className={`w-28 ${inputCls}`}
                          />
                        </td>
                        <td className='px-4 py-3'>
                          <input
                            type='number'
                            defaultValue={product.case_pack || 0}
                            key={`cp-${product.item_id}-${product.case_pack}`}
                            onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'case_pack', e.target.value)}
                            disabled={isSaving}
                            className={`w-20 ${inputCls}`}
                          />
                        </td>
                        <td className='px-4 py-3'>
                          <select
                            value={product.currency || ''}
                            onChange={(e) => handleCurrencyChange(product.item_id, product.cf_sku_code, e.target.value)}
                            disabled={isSaving}
                            className={selectCls}
                          >
                            <option value=''>—</option>
                            {CURRENCY_OPTIONS.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className='px-4 py-3'>
                          <input
                            type='number'
                            step='0.01'
                            defaultValue={product.purchase_price || 0}
                            key={`pp-${product.item_id}-${product.purchase_price}`}
                            onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'purchase_price', e.target.value)}
                            disabled={isSaving}
                            className={`w-24 ${inputCls}`}
                          />
                        </td>
                        <td className='px-4 py-3'>
                          <TransitCell qty={product.stock_in_transit_1} po={product.transit_1_po} />
                        </td>
                        <td className='px-4 py-3'>
                          <TransitCell qty={product.stock_in_transit_2} po={product.transit_2_po} />
                        </td>
                        <td className='px-4 py-3'>
                          <TransitCell qty={product.stock_in_transit_3} po={product.transit_3_po} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between'>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors'
              >
                <ChevronLeft className='h-4 w-4' />
                Previous
              </button>
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors'
              >
                Next
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
