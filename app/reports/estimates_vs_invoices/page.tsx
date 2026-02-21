'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState } from 'react';
import axios from 'axios';
import {
    FileText,
    TrendingUp,
    Package,
    RefreshCw,
    Download,
    Calendar,
    AlertCircle
} from 'lucide-react';
import DateRange from '@/components/reports/DateRange';

interface EstimateVsInvoiceItem {
    item_id: string;
    item_name: string;
    sku: string;
    estimated_quantity: number;
    invoiced_quantity: number;
    fill_rate: number;
    closing_stock: number;
    missed_quantity: number;
}

interface ReportMeta {
    start_date: string;
    end_date: string;
    total_items: number;
    total_estimates: number;
    total_invoices: number;
    missed_items: number;
    over_delivered_items: number;
    fully_delivered_items: number;
    stock_date: string | null;
}

function EstimatesVsInvoicesPage() {
    const { isLoading, accessToken } = useAuth();
    const [data, setData] = useState<EstimateVsInvoiceItem[]>([]);
    const [meta, setMeta] = useState<ReportMeta | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Date range state
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const fetchReport = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/zoho/estimates-vs-invoices`,
                {
                    params: {
                        start_date: startDate,
                        end_date: endDate,
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            setData(response.data.data || []);
            setMeta(response.data.meta || null);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch report data');
            console.error('Error fetching report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = async () => {
        if (data.length === 0) {
            setError('No data to download');
            return;
        }

        try {
            setDownloadLoading(true);

            // Create CSV content
            const headers = ['Item Name', 'SKU', 'Estimated Quantity', 'Invoiced Quantity', 'Missed Quantity', 'Fill Rate (%)', 'Closing Stock'];
            const csvContent = [
                headers.join(','),
                ...data.map(item => [
                    `"${item.item_name}"`,
                    `"${item.sku}"`,
                    item.estimated_quantity,
                    item.invoiced_quantity,
                    item.missed_quantity,
                    item.fill_rate,
                    item.closing_stock
                ].join(','))
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `estimates_vs_invoices_${startDate}_to_${endDate}.csv`
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError('Failed to download file');
            console.error('Error downloading file:', err);
        } finally {
            setDownloadLoading(false);
        }
    };

    const formatNumber = (value: number) => {
        return value.toLocaleString('en-IN');
    };

    const getFillRateColor = (fillRate: number) => {
        if (fillRate >= 90) return 'text-green-600 bg-green-50';
        if (fillRate >= 70) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    const averageFillRate = data.length > 0
        ? data.reduce((sum, item) => sum + item.fill_rate, 0) / data.length
        : 0;

    const totalEstimated = data.reduce((sum, item) => sum + item.estimated_quantity, 0);
    const totalInvoiced = data.reduce((sum, item) => sum + item.invoiced_quantity, 0);

    if (isLoading) {
        return <div className='p-8 text-black'>Loading...</div>;
    }

    return (
        <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8'>
            <div className='max-w-[1800px] mx-auto'>
                {/* Header */}
                <div className='mb-8'>
                    <h1 className='text-3xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-3'>
                        <FileText className='w-8 h-8 text-blue-600' />
                        Estimates vs Invoices Report
                    </h1>
                    <p className='mt-2 text-sm text-zinc-900 dark:text-zinc-50'>
                        Compare estimated quantities with invoiced quantities to track fill rates
                    </p>
                </div>

                {/* Filters Section */}
                <div className='bg-white rounded-lg shadow-sm p-6 mb-6'>
                    <DateRange
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                        onGenerate={fetchReport}
                        loading={loading}
                        downloadReport={handleDownloadExcel}
                        downloadDisabledCondition={data.length === 0}
                        downloadLoading={downloadLoading}
                    />
                </div>

                {/* Error Display */}
                {error && (
                    <div className='bg-red-50 border border-red-200 rounded-lg p-4 mb-6'>
                        <div className='flex items-center'>
                            <AlertCircle className='h-5 w-5 text-red-400 mr-3' />
                            <p className='text-sm font-medium text-red-800'>{error}</p>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                {meta && data.length > 0 && (
                    <>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6'>
                            <div className='bg-white rounded-lg shadow-sm p-4'>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <p className='text-xs font-medium text-gray-600'>Total Items</p>
                                        <p className='text-xl font-bold text-gray-900 mt-1'>
                                            {formatNumber(meta.total_items)}
                                        </p>
                                    </div>
                                    <div className='p-2 bg-purple-100 rounded-full'>
                                        <Package className='w-5 h-5 text-purple-600' />
                                    </div>
                                </div>
                            </div>

                            <div className='bg-white rounded-lg shadow-sm p-4'>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <p className='text-xs font-medium text-gray-600'>Estimated Qty</p>
                                        <p className='text-xl font-bold text-gray-900 mt-1'>
                                            {formatNumber(totalEstimated)}
                                        </p>
                                    </div>
                                    <div className='p-2 bg-blue-100 rounded-full'>
                                        <FileText className='w-5 h-5 text-blue-600' />
                                    </div>
                                </div>
                            </div>

                            <div className='bg-white rounded-lg shadow-sm p-4'>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <p className='text-xs font-medium text-gray-600'>Invoiced Qty</p>
                                        <p className='text-xl font-bold text-gray-900 mt-1'>
                                            {formatNumber(totalInvoiced)}
                                        </p>
                                    </div>
                                    <div className='p-2 bg-green-100 rounded-full'>
                                        <FileText className='w-5 h-5 text-green-600' />
                                    </div>
                                </div>
                            </div>

                            <div className='bg-white rounded-lg shadow-sm p-4'>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <p className='text-xs font-medium text-gray-600'>Avg Fill Rate</p>
                                        <p className='text-xl font-bold text-gray-900 mt-1'>
                                            {averageFillRate.toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className='p-2 bg-yellow-100 rounded-full'>
                                        <TrendingUp className='w-5 h-5 text-yellow-600' />
                                    </div>
                                </div>
                            </div>

                            <div className='bg-white rounded-lg shadow-sm p-4'>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <p className='text-xs font-medium text-gray-600'>Total Stock</p>
                                        <p className='text-xl font-bold text-gray-900 mt-1'>
                                            {formatNumber(data.reduce((sum, item) => sum + item.closing_stock, 0))}
                                        </p>
                                    </div>
                                    <div className='p-2 bg-indigo-100 rounded-full'>
                                        <Package className='w-5 h-5 text-indigo-600' />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Missed vs Over-delivered Summary */}
                        <div className='bg-gradient-to-r from-red-50 to-green-50 rounded-lg shadow-sm p-4 mb-6'>
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-center'>
                                <div className='bg-white/80 rounded-lg p-3'>
                                    <p className='text-xs font-medium text-red-600'>Missed Items</p>
                                    <p className='text-2xl font-bold text-red-700 mt-1'>
                                        {formatNumber(meta.missed_items)}
                                    </p>
                                    <p className='text-xs text-gray-500 mt-1'>
                                        ({((meta.missed_items / meta.total_items) * 100).toFixed(1)}%)
                                    </p>
                                </div>
                                <div className='bg-white/80 rounded-lg p-3'>
                                    <p className='text-xs font-medium text-gray-600'>Fully Delivered</p>
                                    <p className='text-2xl font-bold text-gray-700 mt-1'>
                                        {formatNumber(meta.fully_delivered_items)}
                                    </p>
                                    <p className='text-xs text-gray-500 mt-1'>
                                        ({((meta.fully_delivered_items / meta.total_items) * 100).toFixed(1)}%)
                                    </p>
                                </div>
                                <div className='bg-white/80 rounded-lg p-3'>
                                    <p className='text-xs font-medium text-green-600'>Over-delivered</p>
                                    <p className='text-2xl font-bold text-green-700 mt-1'>
                                        {formatNumber(meta.over_delivered_items)}
                                    </p>
                                    <p className='text-xs text-gray-500 mt-1'>
                                        ({((meta.over_delivered_items / meta.total_items) * 100).toFixed(1)}%)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Data Table */}
                <div className='bg-white rounded-lg shadow-sm'>
                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <RefreshCw className='animate-spin h-8 w-8 text-blue-600' />
                            <span className='ml-3 text-gray-600'>Loading report data...</span>
                        </div>
                    ) : data.length === 0 ? (
                        <div className='text-center py-12'>
                            <FileText className='mx-auto h-12 w-12 text-gray-400' />
                            <h3 className='mt-2 text-sm font-medium text-gray-900'>No data found</h3>
                            <p className='mt-1 text-sm text-gray-500'>
                                Select a date range and click "Generate Report" to view data.
                            </p>
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-gray-200'>
                                <thead className='bg-gray-50'>
                                    <tr>
                                        <th className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Item Name
                                        </th>
                                        <th className='px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            SKU
                                        </th>
                                        <th className='px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Est. Qty
                                        </th>
                                        <th className='px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Inv. Qty
                                        </th>
                                        <th className='px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Missed
                                        </th>
                                        <th className='px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Closing Stock{meta?.stock_date ? ` (${meta.stock_date})` : ''}
                                        </th>
                                        <th className='px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Fill Rate
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className='bg-white divide-y divide-gray-200'>
                                    {data.map((item) => (
                                        <tr
                                            key={item.item_id}
                                            className={`hover:bg-gray-50 transition-colors ${
                                                item.invoiced_quantity < item.estimated_quantity
                                                    ? 'bg-red-50/30'
                                                    : ''
                                            }`}
                                        >
                                            <td className='px-3 py-2'>
                                                <div className='text-xs font-medium text-gray-900'>
                                                    {item.item_name || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap'>
                                                <div className='text-xs text-gray-600 font-mono'>
                                                    {item.sku || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap text-right'>
                                                <div className='text-xs font-medium text-gray-900'>
                                                    {formatNumber(item.estimated_quantity)}
                                                </div>
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap text-right'>
                                                <div className='text-xs font-medium text-gray-900'>
                                                    {formatNumber(item.invoiced_quantity)}
                                                </div>
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap text-right'>
                                                <div className={`text-xs font-semibold ${
                                                    item.missed_quantity > 0 ? 'text-red-600' : 'text-gray-400'
                                                }`}>
                                                    {item.missed_quantity > 0 ? formatNumber(item.missed_quantity) : '-'}
                                                </div>
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap text-right'>
                                                <div className='text-xs font-medium text-indigo-600'>
                                                    {formatNumber(item.closing_stock)}
                                                </div>
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap text-right'>
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getFillRateColor(item.fill_rate)}`}>
                                                    {item.fill_rate.toFixed(0)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Results Count */}
                    {data.length > 0 && meta && (
                        <div className='px-4 py-3 border-t border-gray-200 bg-gray-50'>
                            <div className='flex flex-wrap gap-4 text-xs text-gray-600'>
                                <span>
                                    <span className='font-medium'>{data.length}</span> items
                                </span>
                                <span className='text-gray-300'>|</span>
                                <span>
                                    <span className='font-medium'>{meta.total_estimates}</span> estimates
                                </span>
                                <span className='text-gray-300'>|</span>
                                <span>
                                    <span className='font-medium'>{meta.total_invoices}</span> invoices
                                </span>
                                <span className='text-gray-300'>|</span>
                                <span className='text-red-600'>
                                    <span className='font-medium'>{meta.missed_items}</span> missed
                                </span>
                                <span className='text-gray-300'>|</span>
                                <span className='text-green-600'>
                                    <span className='font-medium'>{meta.over_delivered_items}</span> over-delivered
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EstimatesVsInvoicesPage;
