'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Shield, Search, ChevronLeft, ChevronRight, Upload, Download, X } from 'lucide-react';

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
}

const STATUS_OPTIONS = ['active', 'inactive', 'discontinued until stock lasts'] as const;

const CURRENCY_OPTIONS = ['USD', 'CNY', 'EUR', 'GBP', 'INR', 'AED', 'SGD'] as const;

function ProductLogisticsPage() {
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

    // Pagination, search & filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [availableBrands, setAvailableBrands] = useState<{ value: string; label: string }[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;


    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics`, {
                params: { search: searchTerm, brand: selectedBrand, status: selectedStatus, page, page_size: pageSize },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = response.data;
            setProducts(data.data || []);
            setTotalPages(data.total_pages || 1);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch products');
        } finally {
            setLoading(false);
        }
    }, [accessToken, searchTerm, selectedBrand, selectedStatus, page]);

    useEffect(() => {
        if (accessToken) {
            fetchProducts();
            fetchAvailableBrands();
        }
    }, [accessToken, page]);

    const fetchAvailableBrands = async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAvailableBrands(response.data.brands || []);
        } catch {
            // non-critical
        }
    };

    // Debounced search / filter
    useEffect(() => {
        const timer = setTimeout(() => {
            if (accessToken) {
                setPage(1);
                fetchProducts();
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, selectedBrand, selectedStatus]);

    const saveField = async (item_id: string, sku: string, fields: Record<string, string | number>) => {
        setSaving(prev => new Set(prev).add(item_id));
        setError(null);
        try {
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics`, null, {
                params: { item_id, sku_code: sku, ...fields },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSuccess(`Saved ${sku}`);
            setTimeout(() => setSuccess(null), 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || `Failed to save ${sku}`);
        } finally {
            setSaving(prev => { const s = new Set(prev); s.delete(item_id); return s; });
        }
    };

    const handleNumberBlur = (item_id: string, sku: string, field: 'cbm' | 'case_pack' | 'purchase_price', raw: string) => {
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
                { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' } },
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
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/master/import-product-logistics`, null, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSuccess(`Import complete: ${response.data.updated} products updated, ${response.data.skipped} skipped`);
            setTimeout(() => setSuccess(null), 5000);
            await fetchProducts();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to import from Updated Master Sheet');
        } finally {
            setImportLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            setDownloadLoading(true);
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics/download`, {
                params: { search: searchTerm, brand: selectedBrand, status: selectedStatus },
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'blob',
            });
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
            <div className='flex items-center justify-center min-h-screen'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                <span className='ml-2 text-gray-600 dark:text-zinc-400'>Loading...</span>
            </div>
        );
    }

    if (!accessToken) {
        return (
            <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
                <div className='bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-md text-center'>
                    <Shield className='h-16 w-16 text-gray-400 dark:text-zinc-500 mx-auto mb-4' />
                    <p className='text-xl text-gray-700 dark:text-zinc-300'>Please log in to see this content.</p>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen py-8'>
            {/* Bulk Price Upload Modal */}
            {bulkUploadOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                    <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6'>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>Bulk Price Upload</h2>
                            <button onClick={() => setBulkUploadOpen(false)} className='text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200'>
                                <X className='h-5 w-5' />
                            </button>
                        </div>
                        <div className='mb-5 text-sm text-gray-600 dark:text-zinc-400 space-y-2'>
                            <p>Upload an XLSX file to bulk-update <strong className='text-zinc-800 dark:text-zinc-200'>Currency</strong> and <strong className='text-zinc-800 dark:text-zinc-200'>Purchase Price</strong> for multiple products at once.</p>
                            <p>The file must contain exactly these three columns:</p>
                            <ul className='list-disc list-inside ml-2 space-y-0.5 font-mono text-xs bg-gray-50 dark:bg-zinc-800 rounded p-3'>
                                <li>SKU Code</li>
                                <li>Currency &nbsp;<span className='font-sans text-gray-500'>(e.g. USD, CNY)</span></li>
                                <li>Purchase Price &nbsp;<span className='font-sans text-gray-500'>(numeric)</span></li>
                            </ul>
                            <p>You can download the existing data as a starting point using the <strong className='text-zinc-800 dark:text-zinc-200'>Download XLSX</strong> button — it already contains these columns. Only rows with a matching SKU Code will be updated; all other columns in the file are ignored.</p>
                        </div>
                        <input
                            type='file'
                            accept='.xlsx,.xls'
                            onChange={(e) => setBulkUploadFile(e.target.files?.[0] ?? null)}
                            className='block w-full text-sm text-gray-700 dark:text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100 mb-5'
                        />
                        <div className='flex justify-end gap-3'>
                            <button
                                onClick={() => setBulkUploadOpen(false)}
                                className='px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkUpload}
                                disabled={!bulkUploadFile || bulkUploading}
                                className='px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors'
                            >
                                {bulkUploading ? 'Uploading...' : 'Upload & Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                {/* Header */}
                <div className='mb-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2'>
                                <Box className='h-6 w-6' />
                                Product Logistics
                            </h1>
                            <p className='mt-1 text-sm text-zinc-900 dark:text-zinc-50 '>
                                Manage status, CBM, Case Pack, Currency and Purchase Price per product. Changes save automatically.
                            </p>
                        </div>
                        <div className='flex gap-2'>
                            <button
                                onClick={handleDownload}
                                disabled={downloadLoading}
                                className='inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors'
                            >
                                <Download className='h-4 w-4 mr-2' />
                                {downloadLoading ? 'Downloading...' : 'Download XLSX'}
                            </button>
                            <button
                                onClick={() => { setBulkUploadOpen(true); setBulkUploadFile(null); }}
                                className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                            >
                                <Upload className='h-4 w-4 mr-2' />
                                Bulk Price Upload
                            </button>
                            <button
                                onClick={handleImportFromMaster}
                                disabled={importLoading}
                                className='inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors'
                            >
                                <Upload className='h-4 w-4 mr-2' />
                                {importLoading ? 'Importing...' : 'Import from Master Sheet'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className='mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300'>
                        {error}
                        <button onClick={() => setError(null)} className='ml-2 text-red-500 hover:text-red-700'>x</button>
                    </div>
                )}
                {success && (
                    <div className='mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300'>
                        {success}
                    </div>
                )}

                {/* Search & Filters */}
                <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 mb-6 p-4'>
                    <div className='flex flex-wrap gap-3'>
                        <div className='relative flex-1 min-w-[200px]'>
                            <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                                <Search className='h-5 w-5 text-gray-400 dark:text-zinc-500' />
                            </div>
                            <input
                                type='text'
                                placeholder='Search by SKU code or product name...'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className='block w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-black dark:bg-zinc-800 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500'
                            />
                        </div>
                        <select
                            value={selectedBrand}
                            onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
                            className='px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-black dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800'
                        >
                            <option value=''>All Brands</option>
                            {availableBrands.map((b) => (
                                <option key={b.value} value={b.value}>{b.label}</option>
                            ))}
                        </select>
                        <select
                            value={selectedStatus}
                            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                            className='px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-black dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800'
                        >
                            <option value=''>All Statuses</option>
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div className='mt-2 text-sm text-gray-500 dark:text-zinc-400'>
                        {total} products total | Page {page} of {totalPages}
                    </div>
                </div>

                {/* Products Table */}
                <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800'>
                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                            <span className='ml-2 text-gray-600 dark:text-zinc-400'>Loading products...</span>
                        </div>
                    ) : products.length === 0 ? (
                        <div className='text-center py-12 text-gray-500 dark:text-zinc-400'>
                            {searchTerm ? `No products found for "${searchTerm}"` : 'No products found'}
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full'>
                                <thead className='bg-gray-50 dark:bg-zinc-800'>
                                    <tr>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>SKU Code</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Product Name</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Brand</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Status</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>CBM</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Case Pack</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Currency</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Purchase Price</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Transit 1</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Transit 2</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase'>Transit 3</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-200 dark:divide-zinc-800'>
                                    {products.map((product) => {
                                        const isSaving = saving.has(product.item_id);
                                        return (
                                            <tr key={product.item_id || product.cf_sku_code} className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${isSaving ? 'opacity-60' : ''}`}>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm font-mono text-gray-900 dark:text-zinc-100'>{product.cf_sku_code}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-900 dark:text-zinc-100'>{product.name || 'N/A'}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-600 dark:text-zinc-400'>{product.brand || 'N/A'}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <select
                                                        value={product.purchase_status || STATUS_OPTIONS[0]}
                                                        onChange={(e) => handleStatusChange(product.item_id, product.cf_sku_code, e.target.value)}
                                                        disabled={isSaving}
                                                        className='px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded text-sm text-black dark:bg-zinc-800 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    >
                                                        {STATUS_OPTIONS.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        step='0.0001'
                                                        defaultValue={product.cbm || 0}
                                                        key={`cbm-${product.item_id}-${product.cbm}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'cbm', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-24 px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded text-sm text-black dark:bg-zinc-800 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        defaultValue={product.case_pack || 0}
                                                        key={`cp-${product.item_id}-${product.case_pack}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'case_pack', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-24 px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded text-sm text-black dark:bg-zinc-800 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <select
                                                        value={product.currency || ''}
                                                        onChange={(e) => handleCurrencyChange(product.item_id, product.cf_sku_code, e.target.value)}
                                                        disabled={isSaving}
                                                        className='px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded text-sm text-black dark:bg-zinc-800 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    >
                                                        <option value=''>—</option>
                                                        {CURRENCY_OPTIONS.map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        step='0.01'
                                                        defaultValue={product.purchase_price || 0}
                                                        key={`pp-${product.item_id}-${product.purchase_price}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'purchase_price', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-28 px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded text-sm text-black dark:bg-zinc-800 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-700 dark:text-zinc-300'>{product.stock_in_transit_1 || 0}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-700 dark:text-zinc-300'>{product.stock_in_transit_2 || 0}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-700 dark:text-zinc-300'>{product.stock_in_transit_3 || 0}</span>
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
                        <div className='px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between'>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50'
                            >
                                <ChevronLeft className='h-4 w-4 mr-1' />
                                Previous
                            </button>
                            <span className='text-sm text-gray-700 dark:text-zinc-300'>
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50'
                            >
                                Next
                                <ChevronRight className='h-4 w-4 ml-1' />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProductLogisticsPage;
