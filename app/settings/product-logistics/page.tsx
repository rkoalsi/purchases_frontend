'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Shield, Search, ChevronLeft, ChevronRight, Upload, Download } from 'lucide-react';

interface ProductLogistics {
    item_id: string;
    cf_sku_code: string;
    name: string;
    brand: string;
    cbm: number;
    case_pack: number;
    purchase_status: string;
    stock_in_transit_1: number;
    stock_in_transit_2: number;
    stock_in_transit_3: number;
}

const STATUS_OPTIONS = ['active', 'inactive', 'discontinued until stock lasts'] as const;

function ProductLogisticsPage() {
    const { isLoading, accessToken } = useAuth();
    const [products, setProducts] = useState<ProductLogistics[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [importLoading, setImportLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
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

    const handleNumberBlur = (item_id: string, sku: string, field: 'cbm' | 'case_pack' | 'stock_in_transit_1' | 'stock_in_transit_2' | 'stock_in_transit_3', raw: string) => {
        const val = parseFloat(raw) || 0;
        setProducts(prev => prev.map(p => p.item_id === item_id ? { ...p, [field]: val } : p));
        saveField(item_id, sku, { [field]: val });
    };

    const handleStatusChange = (item_id: string, sku: string, value: string) => {
        setProducts(prev => prev.map(p => p.item_id === item_id ? { ...p, purchase_status: value } : p));
        saveField(item_id, sku, { purchase_status: value });
    };

    const handleImportFromPSR = async () => {
        if (!confirm('Import Status, CBM and Case Pack from the PSR Google Sheet? This will update existing product data.')) return;
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
            setError(err.response?.data?.detail || 'Failed to import from PSR Sheet');
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
                <span className='ml-2 text-gray-600'>Loading...</span>
            </div>
        );
    }

    if (!accessToken) {
        return (
            <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
                <div className='bg-white p-8 rounded-lg shadow-md text-center'>
                    <Shield className='h-16 w-16 text-gray-400 mx-auto mb-4' />
                    <p className='text-xl text-gray-700'>Please log in to see this content.</p>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen py-8'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                {/* Header */}
                <div className='mb-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h1 className='text-2xl font-bold text-white flex items-center gap-2'>
                                <Box className='h-6 w-6' />
                                Product Logistics
                            </h1>
                            <p className='mt-1 text-sm text-gray-300'>
                                Manage status, CBM and Case Pack per product. Changes save automatically.
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
                                onClick={handleImportFromPSR}
                                disabled={importLoading}
                                className='inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors'
                            >
                                <Upload className='h-4 w-4 mr-2' />
                                {importLoading ? 'Importing...' : 'Import from PSR Sheet'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'>
                        {error}
                        <button onClick={() => setError(null)} className='ml-2 text-red-500 hover:text-red-700'>x</button>
                    </div>
                )}
                {success && (
                    <div className='mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700'>
                        {success}
                    </div>
                )}

                {/* Search & Filters */}
                <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4'>
                    <div className='flex flex-wrap gap-3'>
                        <div className='relative flex-1 min-w-[200px]'>
                            <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                                <Search className='h-5 w-5 text-gray-400' />
                            </div>
                            <input
                                type='text'
                                placeholder='Search by SKU code or product name...'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className='block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500'
                            />
                        </div>
                        <select
                            value={selectedBrand}
                            onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
                            className='px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 bg-white'
                        >
                            <option value=''>All Brands</option>
                            {availableBrands.map((b) => (
                                <option key={b.value} value={b.value}>{b.label}</option>
                            ))}
                        </select>
                        <select
                            value={selectedStatus}
                            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                            className='px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 bg-white'
                        >
                            <option value=''>All Statuses</option>
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div className='mt-2 text-sm text-gray-500'>
                        {total} products total | Page {page} of {totalPages}
                    </div>
                </div>

                {/* Products Table */}
                <div className='bg-white rounded-lg shadow-sm border border-gray-200'>
                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                            <span className='ml-2 text-gray-600'>Loading products...</span>
                        </div>
                    ) : products.length === 0 ? (
                        <div className='text-center py-12 text-gray-500'>
                            {searchTerm ? `No products found for "${searchTerm}"` : 'No products found'}
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full'>
                                <thead className='bg-gray-50'>
                                    <tr>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>SKU Code</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Product Name</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Brand</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Status</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>CBM</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Case Pack</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Transit 1</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Transit 2</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Transit 3</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-200'>
                                    {products.map((product) => {
                                        const isSaving = saving.has(product.item_id);
                                        return (
                                            <tr key={product.item_id || product.cf_sku_code} className={`hover:bg-gray-50 ${isSaving ? 'opacity-60' : ''}`}>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm font-mono text-gray-900'>{product.cf_sku_code}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-900'>{product.name || 'N/A'}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <span className='text-sm text-gray-600'>{product.brand || 'N/A'}</span>
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <select
                                                        value={product.purchase_status || STATUS_OPTIONS[0]}
                                                        onChange={(e) => handleStatusChange(product.item_id, product.cf_sku_code, e.target.value)}
                                                        disabled={isSaving}
                                                        className='px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
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
                                                        className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        defaultValue={product.case_pack || 0}
                                                        key={`cp-${product.item_id}-${product.case_pack}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'case_pack', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        defaultValue={product.stock_in_transit_1 || 0}
                                                        key={`sit1-${product.item_id}-${product.stock_in_transit_1}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'stock_in_transit_1', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        defaultValue={product.stock_in_transit_2 || 0}
                                                        key={`sit2-${product.item_id}-${product.stock_in_transit_2}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'stock_in_transit_2', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
                                                </td>
                                                <td className='px-6 py-3'>
                                                    <input
                                                        type='number'
                                                        defaultValue={product.stock_in_transit_3 || 0}
                                                        key={`sit3-${product.item_id}-${product.stock_in_transit_3}`}
                                                        onBlur={(e) => handleNumberBlur(product.item_id, product.cf_sku_code, 'stock_in_transit_3', e.target.value)}
                                                        disabled={isSaving}
                                                        className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50'
                                                    />
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
                        <div className='px-6 py-4 border-t border-gray-200 flex items-center justify-between'>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className='inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50'
                            >
                                <ChevronLeft className='h-4 w-4 mr-1' />
                                Previous
                            </button>
                            <span className='text-sm text-gray-700'>
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className='inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50'
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
