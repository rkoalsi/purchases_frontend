'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Package, 
    TrendingUp, 
    TrendingDown, 
    ShoppingCart, 
    DollarSign, 
    FileText, 
    Download,
    Search,
    RefreshCw,
    Calendar,
    Filter,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import DateRangePresets from './DateRange';

interface SettlementPivotItem {
    order_id: string;
    posted_date: string;
    sku: string;
    [key: string]: any; // Dynamic columns for different charge types
    'Grand Total'?: number;
}

interface SettlementsSummaryItem {
    amount_description: string;
    total_amount: number;
    count: number;
    average_amount: number;
}

interface PivotColumn {
    name: string;
    visible: boolean;
}

function AmazonSettlementsPage() {
    const { isLoading, accessToken } = useAuth();
    const [settlements, setSettlements] = useState<SettlementPivotItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableColumns, setAvailableColumns] = useState<string[]>([]);
    const [summary, setSummary] = useState<SettlementsSummaryItem[]>([]);

    // Date range state
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1); // Default to last month
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSku, setSelectedSku] = useState('');
    const [filteredData, setFilteredData] = useState<SettlementPivotItem[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Column visibility
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    // Summary stats
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [uniqueSkus, setUniqueSkus] = useState(0);
    const [avgOrderValue, setAvgOrderValue] = useState(0);

    useEffect(() => {
        if (accessToken) {
            fetchAvailableColumns();
        }
    }, [accessToken]);

    useEffect(() => {
        // Filter data based on search term and selected SKU
        let filtered = settlements;

        if (searchTerm) {
            filtered = filtered.filter((item) =>
                item.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedSku) {
            filtered = filtered.filter((item) => item.sku === selectedSku);
        }

        setFilteredData(filtered);
    }, [settlements, searchTerm, selectedSku]);

    useEffect(() => {
        // Calculate summary statistics
        if (settlements.length > 0) {
            const total = settlements.reduce((sum, item) => sum + (item['Grand Total'] || 0), 0);
            const skuSet = new Set(settlements.map(item => item.sku));
            
            setTotalRevenue(total);
            setTotalOrders(settlements.length);
            setUniqueSkus(skuSet.size);
            setAvgOrderValue(settlements.length > 0 ? total / settlements.length : 0);
        } else {
            setTotalRevenue(0);
            setTotalOrders(0);
            setUniqueSkus(0);
            setAvgOrderValue(0);
        }
    }, [settlements]);

    const fetchAvailableColumns = async () => {
        try {
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/amazon/settlements/pivot/columns`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            const columns = response.data.columns || [];
            setAvailableColumns(columns);
            
            // Initialize all columns as visible
            const defaultVisible:any = new Set(columns);
            setVisibleColumns(defaultVisible);
        } catch (err: any) {
            console.error('Error fetching columns:', err);
        }
    };

    const fetchSettlements = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/amazon/settlements/pivot`,
                {
                    params: {
                        start_date: startDate,
                        end_date: endDate,
                        format: 'json',
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            const data = response.data.data || [];
            setSettlements(data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch settlements data');
            console.error('Error fetching settlements:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/amazon/settlements/summary`,
                {
                    params: {
                        start_date: startDate,
                        end_date: endDate,
                        group_by: 'amount_description',
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            const summaryData = response.data.data || [];
            setSummary(summaryData);
        } catch (err: any) {
            console.error('Error fetching summary:', err);
        }
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates');
            return;
        }

        await Promise.all([fetchSettlements(), fetchSummary()]);
    };

    const handleDownloadExcel = async () => {
        try {
            setDownloadLoading(true);

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/amazon/settlements/pivot`,
                {
                    params: {
                        start_date: startDate,
                        end_date: endDate,
                        format: 'excel',
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    responseType: 'blob',
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `amazon_settlements_${startDate}_to_${endDate}.xlsx`
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError('Failed to download Excel file');
            console.error('Error downloading Excel:', err);
        } finally {
            setDownloadLoading(false);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });

        const sorted = [...filteredData].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            return direction === 'asc'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        setFilteredData(sorted);
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'asc' ? (
            <ChevronUp className='w-4 h-4' />
        ) : (
            <ChevronDown className='w-4 h-4' />
        );
    };

    const toggleColumnVisibility = (column: string) => {
        const newVisible = new Set(visibleColumns);
        if (newVisible.has(column)) {
            newVisible.delete(column);
        } else {
            newVisible.add(column);
        }
        setVisibleColumns(newVisible);
    };

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined || isNaN(value)) return '₹0.00';
        return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatNumber = (value: number | null | undefined) => {
        if (value === null || value === undefined || isNaN(value)) return '0';
        return value.toLocaleString('en-IN');
    };

    const getValueColor = (value: number | null | undefined) => {
        if (value === null || value === undefined || value === 0) return 'text-gray-600 dark:text-zinc-400';
        return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    };

    const uniqueSkusList = Array.from(new Set(settlements.map(item => item.sku))).sort();

    // Core columns that should always be visible
    const coreColumns = ['order_id', 'posted_date', 'sku', 'quantity_purchased'];
    
    // Dynamic charge columns
    const chargeColumns = availableColumns.filter(col => !coreColumns.includes(col));

    return (
        <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8'>
            <div className='max-w-[1800px] mx-auto'>
                {/* Header */}
                <div className='mb-8'>
                    <h1 className='text-3xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-3'>
                        <FileText className='w-8 h-8 text-blue-600' />
                        Amazon Settlements Report
                    </h1>
                    <p className='mt-2 text-sm text-gray-600 dark:text-zinc-400'>
                        View and analyze Amazon settlement charges in pivot table format
                    </p>
                </div>

                {/* Filters Section */}
                <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 mb-6 text-black dark:text-zinc-100'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                        {/* Date Range */}
                        <div>
                            <label className='block font-medium text-black dark:text-zinc-100 mb-2'>
                                <Calendar className='inline w-4 h-4 mr-1' />
                                Start Date
                            </label>
                            <input
                                type='date'
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className='w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-black dark:text-zinc-100'
                            />
                        </div>

                        <div>
                            <label className='block font-medium text-black dark:text-zinc-100 mb-2'>
                                <Calendar className='inline w-4 h-4 mr-1' />
                                End Date
                            </label>
                            <input
                                type='date'
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className='w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-black dark:text-zinc-100'
                            />
                        </div>

                        {/* SKU Filter */}
                        <div>
                            <label className='block text-sm font-medium text-black dark:text-zinc-100 mb-2'>
                                <Package className='inline w-4 h-4 mr-1' />
                                Filter by SKU
                            </label>
                            <select
                                value={selectedSku}
                                onChange={(e) => setSelectedSku(e.target.value)}
                                className='w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-black dark:text-zinc-100'
                            >
                                <option value=''>All SKUs</option>
                                {uniqueSkusList.map((sku) => (
                                    <option key={sku} value={sku}>
                                        {sku}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div>
                            <label className='block text-sm font-medium text-black dark:text-zinc-100 mb-2'>
                                <Search className='inline w-4 h-4 mr-1' />
                                Search
                            </label>
                            <input
                                type='text'
                                placeholder='Order ID or SKU'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className='w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-black dark:text-zinc-100'
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className='flex flex-wrap gap-3 mt-6'>
                        <button
                            onClick={handleGenerateReport}
                            disabled={loading}
                            className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className='animate-spin -ml-1 mr-2 h-4 w-4' />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className='-ml-1 mr-2 h-4 w-4' />
                                    Generate Report
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleDownloadExcel}
                            disabled={downloadLoading || settlements.length === 0}
                            className='inline-flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-700 text-sm font-medium rounded-md text-black dark:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                            {downloadLoading ? (
                                <>
                                    <RefreshCw className='animate-spin -ml-1 mr-2 h-4 w-4' />
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <Download className='-ml-1 mr-2 h-4 w-4' />
                                    Download Excel
                                </>
                            )}
                        </button>

                        <div className='relative'>
                            <button
                                onClick={() => setShowColumnSelector(!showColumnSelector)}
                                className='inline-flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-700 text-sm font-medium rounded-md text-black dark:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            >
                                <Filter className='-ml-1 mr-2 h-4 w-4' />
                                Manage Columns ({visibleColumns.size})
                            </button>

                            {showColumnSelector && (
                                <div className='absolute z-10 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-md shadow-lg border border-gray-200 dark:border-zinc-800 max-h-96 overflow-y-auto'>
                                    <div className='p-4'>
                                        <h3 className='text-sm font-medium text-gray-900 dark:text-zinc-100 mb-3'>
                                            Select Columns to Display
                                        </h3>
                                        <div className='space-y-2'>
                                            {chargeColumns.map((column) => (
                                                <label
                                                    key={column}
                                                    className='flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 p-2 rounded'
                                                >
                                                    <input
                                                        type='checkbox'
                                                        checked={visibleColumns.has(column)}
                                                        onChange={() => toggleColumnVisibility(column)}
                                                        className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-zinc-700 rounded'
                                                    />
                                                    <span className='text-sm text-black dark:text-zinc-100'>{column}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6'>
                        <div className='flex items-center'>
                            <div className='flex-shrink-0'>
                                <svg
                                    className='h-5 w-5 text-red-400 dark:text-red-300'
                                    xmlns='http://www.w3.org/2000/svg'
                                    viewBox='0 0 20 20'
                                    fill='currentColor'
                                >
                                    <path
                                        fillRule='evenodd'
                                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                                        clipRule='evenodd'
                                    />
                                </svg>
                            </div>
                            <div className='ml-3'>
                                <p className='text-sm font-medium text-red-800 dark:text-red-300'>{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                {settlements.length > 0 && (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6'>
                        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6'>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <p className='text-sm font-medium text-gray-600 dark:text-zinc-400'>Total Revenue</p>
                                    <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-2'>
                                        {formatCurrency(totalRevenue)}
                                    </p>
                                </div>
                                <div className='p-3 bg-green-100 dark:bg-green-900/20 rounded-full'>
                                    <DollarSign className='w-6 h-6 text-green-600 dark:text-green-300' />
                                </div>
                            </div>
                        </div>

                        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6'>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <p className='text-sm font-medium text-gray-600 dark:text-zinc-400'>Total Orders</p>
                                    <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-2'>
                                        {formatNumber(totalOrders)}
                                    </p>
                                </div>
                                <div className='p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full'>
                                    <ShoppingCart className='w-6 h-6 text-blue-600 dark:text-blue-300' />
                                </div>
                            </div>
                        </div>

                        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6'>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <p className='text-sm font-medium text-gray-600 dark:text-zinc-400'>Unique SKUs</p>
                                    <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-2'>
                                        {formatNumber(uniqueSkus)}
                                    </p>
                                </div>
                                <div className='p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full'>
                                    <Package className='w-6 h-6 text-purple-600 dark:text-purple-300' />
                                </div>
                            </div>
                        </div>

                        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6'>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <p className='text-sm font-medium text-gray-600 dark:text-zinc-400'>Avg Order Value</p>
                                    <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-2'>
                                        {formatCurrency(avgOrderValue)}
                                    </p>
                                </div>
                                <div className='p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full'>
                                    <TrendingUp className='w-6 h-6 text-yellow-600 dark:text-yellow-300' />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm'>
                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <RefreshCw className='animate-spin h-8 w-8 text-blue-600' />
                            <span className='ml-3 text-gray-600 dark:text-zinc-400'>Loading settlements data...</span>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className='text-center py-12'>
                            <FileText className='mx-auto h-12 w-12 text-gray-400 dark:text-zinc-500' />
                            <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-zinc-100'>No settlements found</h3>
                            <p className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
                                Select a date range and click "Generate Report" to view data.
                            </p>
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-gray-200 dark:divide-zinc-800'>
                                <thead className='bg-gray-50 dark:bg-zinc-900'>
                                    <tr>
                                        {/* Core Columns */}
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 sticky left-0 bg-gray-50 dark:bg-zinc-900 z-10'
                                            onClick={() => handleSort('order_id')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Order ID</span>
                                                {getSortIcon('order_id')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800'
                                            onClick={() => handleSort('posted_date')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Posted Date</span>
                                                {getSortIcon('posted_date')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800'
                                            onClick={() => handleSort('sku')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>SKU</span>
                                                {getSortIcon('sku')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800'
                                            onClick={() => handleSort('quantity_purchased')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Quantity</span>
                                                {getSortIcon('quantity_purchased')}
                                            </div>
                                        </th>

                                        {/* Dynamic Charge Columns */}
                                        {chargeColumns.map((column) => 
                                            visibleColumns.has(column) ? (
                                                <th
                                                    key={column}
                                                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                    onClick={() => handleSort(column)}
                                                >
                                                    <div className='flex items-center space-x-1'>
                                                        <span>{column}</span>
                                                        {getSortIcon(column)}
                                                    </div>
                                                </th>
                                            ) : null
                                        )}

                                        {/* Grand Total */}
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 sticky right-0 bg-gray-50 dark:bg-zinc-900 z-10'
                                            onClick={() => handleSort('Grand Total')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Grand Total</span>
                                                {getSortIcon('Grand Total')}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className='bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800'>
                                    {filteredData.map((item, index) => (
                                        <tr key={index} className='hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors'>
                                            {/* Core Columns */}
                                            <td className='px-6 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-zinc-900 z-10'>
                                                <div className='text-sm font-mono text-blue-600'>
                                                    {item.order_id || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm text-gray-900 dark:text-zinc-100'>
                                                    {item.posted_date || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-medium text-gray-900 dark:text-zinc-100'>
                                                    {item.sku || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-medium text-gray-900 dark:text-zinc-100'>
                                                    {item.quantity_purchased || 'N/A'}
                                                </div>
                                            </td>

                                            {/* Dynamic Charge Columns */}
                                            {chargeColumns.map((column) =>
                                                visibleColumns.has(column) ? (
                                                    <td key={column} className='px-6 py-4 whitespace-nowrap'>
                                                        <div className={`text-sm font-medium ${getValueColor(item[column])}`}>
                                                            {item[column] !== null && item[column] !== undefined
                                                                ? formatCurrency(item[column])
                                                                : '-'}
                                                        </div>
                                                    </td>
                                                ) : null
                                            )}

                                            {/* Grand Total */}
                                            <td className='px-6 py-4 whitespace-nowrap sticky right-0 bg-white dark:bg-zinc-900 z-10'>
                                                <div className={`text-sm font-bold ${getValueColor(item['Grand Total'])}`}>
                                                    {formatCurrency(item['Grand Total'])}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Results Count */}
                    {filteredData.length > 0 && (
                        <div className='px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50'>
                            <p className='text-sm text-black dark:text-zinc-100'>
                                Showing <span className='font-medium'>{filteredData.length}</span> of{' '}
                                <span className='font-medium'>{settlements.length}</span> orders
                            </p>
                        </div>
                    )}
                </div>

                {/* Summary by Charge Type */}
                {summary.length > 0 && (
                    <div className='mt-6 bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6'>
                        <h2 className='text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4'>
                            Summary by Charge Type
                        </h2>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {summary.slice(0, 12).map((item, index) => (
                                <div key={index} className='border border-gray-200 dark:border-zinc-800 rounded-lg p-4'>
                                    <p className='text-sm font-medium text-gray-600 dark:text-zinc-400 truncate' title={item.amount_description}>
                                        {item.amount_description}
                                    </p>
                                    <p className={`text-lg font-bold mt-1 ${getValueColor(item.total_amount)}`}>
                                        {formatCurrency(item.total_amount)}
                                    </p>
                                    <p className='text-xs text-gray-500 dark:text-zinc-400 mt-1'>
                                        {formatNumber(item.count)} transactions • Avg: {formatCurrency(item.average_amount)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AmazonSettlementsPage;