'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Save, Shield, Search, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

interface ProductLogistics {
    cf_sku_code: string;
    name: string;
    brand: string;
    cbm: number;
    case_pack: number;
}

function ProductLogisticsPage() {
    const { isLoading, accessToken } = useAuth();
    const [products, setProducts] = useState<ProductLogistics[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Pagination & search
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;

    // Track edited values
    const [editedValues, setEditedValues] = useState<{ [sku: string]: { cbm?: number; case_pack?: number } }>({});

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics`, {
                params: { search: searchTerm, page, page_size: pageSize },
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
    }, [accessToken, searchTerm, page]);

    useEffect(() => {
        if (accessToken) fetchProducts();
    }, [accessToken, page]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (accessToken) {
                setPage(1);
                fetchProducts();
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleEdit = (sku: string, field: 'cbm' | 'case_pack', value: string) => {
        const numVal = parseFloat(value) || 0;
        setEditedValues(prev => ({
            ...prev,
            [sku]: { ...prev[sku], [field]: numVal },
        }));

        // Also update local display
        setProducts(prev => prev.map(p => {
            if (p.cf_sku_code === sku) {
                return { ...p, [field]: numVal };
            }
            return p;
        }));
    };

    const handleSave = async (sku: string) => {
        const edits = editedValues[sku];
        if (!edits) return;

        try {
            setSaving(sku);
            setError(null);
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/master/product-logistics`, null, {
                params: {
                    sku_code: sku,
                    ...(edits.cbm !== undefined && { cbm: edits.cbm }),
                    ...(edits.case_pack !== undefined && { case_pack: edits.case_pack }),
                },
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            // Clear edited state for this SKU
            setEditedValues(prev => {
                const next = { ...prev };
                delete next[sku];
                return next;
            });

            setSuccess(`Updated ${sku}`);
            setTimeout(() => setSuccess(null), 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || `Failed to update ${sku}`);
        } finally {
            setSaving(null);
        }
    };

    const handleImportFromPSR = async () => {
        if (!confirm('Import CBM and Case Pack from PSR Sheet.xlsx? This will update existing product data.')) return;
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
                                Manage CBM and Case Pack per product. These values are used in the master report for order calculations.
                            </p>
                        </div>
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

                {/* Search */}
                <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4'>
                    <div className='relative max-w-md'>
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
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>CBM</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Case Pack</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-200'>
                                    {products.map((product) => (
                                        <tr key={product.cf_sku_code} className='hover:bg-gray-50'>
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
                                                <input
                                                    type='number'
                                                    step='0.0001'
                                                    value={product.cbm || 0}
                                                    onChange={(e) => handleEdit(product.cf_sku_code, 'cbm', e.target.value)}
                                                    className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500'
                                                />
                                            </td>
                                            <td className='px-6 py-3'>
                                                <input
                                                    type='number'
                                                    value={product.case_pack || 0}
                                                    onChange={(e) => handleEdit(product.cf_sku_code, 'case_pack', e.target.value)}
                                                    className='w-24 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500'
                                                />
                                            </td>
                                            <td className='px-6 py-3'>
                                                {editedValues[product.cf_sku_code] && (
                                                    <button
                                                        onClick={() => handleSave(product.cf_sku_code)}
                                                        disabled={saving === product.cf_sku_code}
                                                        className='inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors'
                                                    >
                                                        <Save className='h-3 w-3 mr-1' />
                                                        {saving === product.cf_sku_code ? 'Saving...' : 'Save'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
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
