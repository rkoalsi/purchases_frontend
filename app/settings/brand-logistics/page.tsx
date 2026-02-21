'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Plus, Trash2, Save, Shield } from 'lucide-react';

interface BrandLogistics {
    brand: string;
    lead_time: number;
    safety_days_fast: number;
    safety_days_medium: number;
    safety_days_slow: number;
}

function BrandLogisticsPage() {
    const { isLoading, accessToken } = useAuth();
    const [brands, setBrands] = useState<BrandLogistics[]>([]);
    const [availableBrands, setAvailableBrands] = useState<{ value: string; label: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // New brand form
    const [newBrand, setNewBrand] = useState<BrandLogistics>({
        brand: '',
        lead_time: 60,
        safety_days_fast: 40,
        safety_days_medium: 25,
        safety_days_slow: 15,
    });
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchAvailableBrands = async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAvailableBrands(response.data.brands || []);
        } catch {
            // non-critical, silently fail
        }
    };

    const fetchBrands = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brand-logistics`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setBrands(response.data.data || []);
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

    const handleSaveBrand = async (brand: BrandLogistics) => {
        try {
            setSaving(true);
            setError(null);
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/master/brand-logistics`, null, {
                params: {
                    brand: brand.brand,
                    lead_time: brand.lead_time,
                    safety_days_fast: brand.safety_days_fast,
                    safety_days_medium: brand.safety_days_medium,
                    safety_days_slow: brand.safety_days_slow,
                },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSuccess(`Saved settings for ${brand.brand}`);
            setTimeout(() => setSuccess(null), 3000);
            await fetchBrands();
            setShowAddForm(false);
            setNewBrand({ brand: '', lead_time: 60, safety_days_fast: 40, safety_days_medium: 25, safety_days_slow: 15 });
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save brand logistics');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBrand = async (brandName: string) => {
        if (!confirm(`Delete logistics settings for "${brandName}"?`)) return;
        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/master/brand-logistics`, {
                params: { brand: brandName },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSuccess(`Deleted settings for ${brandName}`);
            setTimeout(() => setSuccess(null), 3000);
            await fetchBrands();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete brand logistics');
        }
    };

    const handleInlineEdit = (index: number, field: keyof BrandLogistics, value: string) => {
        const updated = [...brands];
        if (field === 'brand') {
            updated[index][field] = value;
        } else {
            updated[index][field] = parseFloat(value) || 0;
        }
        setBrands(updated);
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
                <div className='bg-white p-8 rounded-lg shadow-md text-center'>
                    <Shield className='h-16 w-16 text-gray-400 mx-auto mb-4' />
                    <p className='text-xl text-gray-700'>Please log in to see this content.</p>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen py-8'>
            <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8'>
                {/* Header */}
                <div className='mb-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-50  flex items-center gap-2'>
                                <Truck className='h-6 w-6' />
                                Brand Logistics Settings
                            </h1>
                            <p className='mt-1 text-sm text-zinc-900 dark:text-zinc-50 '>
                                Configure lead time and safety days per brand. These values are used in the master report for order calculations.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                        >
                            <Plus className='h-4 w-4 mr-2' />
                            Add Brand
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'>
                        {error}
                        <button onClick={() => setError(null)} className='ml-2 text-red-500 hover:text-red-700'>x</button>
                    </div>
                )}
                {success && (
                    <div className='mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'>
                        {success}
                    </div>
                )}

                {/* Add Brand Form */}
                {showAddForm && (
                    <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-6 dark:bg-zinc-900 dark:border-zinc-800'>
                        <h3 className='text-lg font-medium text-gray-900 mb-4 dark:text-zinc-100'>Add New Brand</h3>
                        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1 dark:text-zinc-400'>Brand Name</label>
                                <select
                                    value={newBrand.brand}
                                    onChange={(e) => setNewBrand({ ...newBrand, brand: e.target.value })}
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                >
                                    <option value=''>Select a brand...</option>
                                    {availableBrands
                                        .filter((b) => !brands.some((bl) => bl.brand === b.value))
                                        .map((b) => (
                                            <option key={b.value} value={b.value}>{b.label}</option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1 dark:text-zinc-400'>Lead Time (days)</label>
                                <input
                                    type='number'
                                    value={newBrand.lead_time}
                                    onChange={(e) => setNewBrand({ ...newBrand, lead_time: parseFloat(e.target.value) || 0 })}
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                />
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1 dark:text-zinc-400'>Safety Days (Fast)</label>
                                <input
                                    type='number'
                                    value={newBrand.safety_days_fast}
                                    onChange={(e) => setNewBrand({ ...newBrand, safety_days_fast: parseFloat(e.target.value) || 0 })}
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                />
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1 dark:text-zinc-400'>Safety Days (Medium)</label>
                                <input
                                    type='number'
                                    value={newBrand.safety_days_medium}
                                    onChange={(e) => setNewBrand({ ...newBrand, safety_days_medium: parseFloat(e.target.value) || 0 })}
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                />
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1 dark:text-zinc-400'>Safety Days (Slow)</label>
                                <input
                                    type='number'
                                    value={newBrand.safety_days_slow}
                                    onChange={(e) => setNewBrand({ ...newBrand, safety_days_slow: parseFloat(e.target.value) || 0 })}
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                />
                            </div>
                        </div>
                        <div className='mt-4 flex gap-2'>
                            <button
                                onClick={() => handleSaveBrand(newBrand)}
                                disabled={!newBrand.brand || saving}
                                className='inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors'
                            >
                                <Save className='h-4 w-4 mr-2' />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className='px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors dark:bg-zinc-700 dark:text-zinc-300'
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Brands Table */}
                <div className='bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800'>
                    <div className='px-6 py-4 border-b border-gray-200 dark:border-zinc-800'>
                        <h2 className='text-lg font-semibold text-gray-900 dark:text-zinc-100'>
                            Configured Brands ({brands.length})
                        </h2>
                    </div>

                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                            <span className='ml-2 text-gray-600 dark:text-zinc-400'>Loading brands...</span>
                        </div>
                    ) : brands.length === 0 ? (
                        <div className='text-center py-12 text-gray-500 dark:text-zinc-400'>
                            No brand logistics configured yet. Click "Add Brand" to get started.
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full'>
                                <thead className='bg-gray-50 dark:bg-zinc-800'>
                                    <tr>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-zinc-400'>Brand</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-zinc-400'>Lead Time (days)</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-zinc-400'>Safety Days (Fast)</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-zinc-400'>Safety Days (Medium)</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-zinc-400'>Safety Days (Slow)</th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-zinc-400'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-200 dark:divide-zinc-800'>
                                    {brands.map((brand, index) => (
                                        <tr key={brand.brand} className='hover:bg-gray-50 dark:hover:bg-zinc-800/50'>
                                            <td className='px-6 py-4'>
                                                <span className='text-sm font-medium text-gray-900 dark:text-zinc-100'>{brand.brand}</span>
                                            </td>
                                            <td className='px-6 py-4'>
                                                <input
                                                    type='number'
                                                    value={brand.lead_time}
                                                    onChange={(e) => handleInlineEdit(index, 'lead_time', e.target.value)}
                                                    className='w-20 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                            </td>
                                            <td className='px-6 py-4'>
                                                <input
                                                    type='number'
                                                    value={brand.safety_days_fast}
                                                    onChange={(e) => handleInlineEdit(index, 'safety_days_fast', e.target.value)}
                                                    className='w-20 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                            </td>
                                            <td className='px-6 py-4'>
                                                <input
                                                    type='number'
                                                    value={brand.safety_days_medium}
                                                    onChange={(e) => handleInlineEdit(index, 'safety_days_medium', e.target.value)}
                                                    className='w-20 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                            </td>
                                            <td className='px-6 py-4'>
                                                <input
                                                    type='number'
                                                    value={brand.safety_days_slow}
                                                    onChange={(e) => handleInlineEdit(index, 'safety_days_slow', e.target.value)}
                                                    className='w-20 px-2 py-1 border border-gray-300 rounded text-sm text-black focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                                                />
                                            </td>
                                            <td className='px-6 py-4'>
                                                <div className='flex gap-2'>
                                                    <button
                                                        onClick={() => handleSaveBrand(brand)}
                                                        className='inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors'
                                                        disabled={saving}
                                                    >
                                                        <Save className='h-3 w-3 mr-1' />
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBrand(brand.brand)}
                                                        className='inline-flex items-center px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors'
                                                    >
                                                        <Trash2 className='h-3 w-3 mr-1' />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Help Text */}
                <div className='mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800'>
                    <h3 className='text-sm font-medium text-blue-800 mb-2 dark:text-blue-200'>How Movement Classification Works</h3>
                    <ul className='text-sm text-blue-700 space-y-1 dark:text-blue-300'>
                        <li><span className='font-medium'>Fast Mover (Class 1):</span> Top 20% by volume OR revenue percentile. Uses "Safety Days (Fast)".</li>
                        <li><span className='font-medium'>Medium Mover (Class 2):</span> Top 50% by volume OR revenue percentile. Uses "Safety Days (Medium)".</li>
                        <li><span className='font-medium'>Slow Mover (Class 3):</span> Bottom 50%. Uses "Safety Days (Slow)".</li>
                        <li><span className='font-medium'>Target Days = Lead Time + Safety Days + 10 (Review Days)</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default BrandLogisticsPage;
