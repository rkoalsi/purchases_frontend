'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, TrendingUp, TrendingDown, ShoppingCart, Warehouse, Globe, BarChart3 } from 'lucide-react';
import DateRangePresets from './DateRange';

interface MasterReportItem {
    sku_code: string;
    item_name: string;
    sources: string[];
    combined_metrics: {
        total_units_sold: number;
        total_units_returned: number;
        total_amount: number;
        total_closing_stock: number;
        total_sessions: number;
        avg_daily_run_rate: number;
        avg_days_of_coverage: number;
        total_days_in_stock: number;
    };
    source_breakdown: {
        blinkit: { units_sold: number; units_returned: number; closing_stock: number; amount: number };
        amazon: { units_sold: number; units_returned: number; closing_stock: number; amount: number };
        zoho: { units_sold: number; units_returned: number; closing_stock: number; amount: number };
    };
}

interface MasterReportResponse {
    message: string;
    date_range: {
        start_date: string;
        end_date: string;
    };
    summary: {
        total_unique_skus: number;
        total_units_sold: number;
        total_amount: number;
        total_closing_stock: number;
        sources_included: string[];
        source_record_counts: { [key: string]: number };
    };
    individual_reports: {
        [key: string]: {
            source: string;
            data: any[];
            success: boolean;
            error?: string;
        };
    };
    combined_data: MasterReportItem[];
    errors: string[];
    meta: {
        execution_time_seconds: number;
        timestamp: string;
        query_type: string;
    };
}

function MasterReportsPage() {
    const { isLoading, accessToken } = useAuth();
    const [masterReport, setMasterReport] = useState<MasterReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<any>(null);
    const [meta, setMeta] = useState<any>(null);
    const [individualReports, setIndividualReports] = useState<any>({});
    const [reportErrors, setReportErrors] = useState<string[]>([]);

    // Date range state
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1); // Default to last month
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Source inclusion controls
    const [includeBlinkit, setIncludeBlinkit] = useState(true);
    const [includeAmazon, setIncludeAmazon] = useState(true);
    const [includeZoho, setIncludeZoho] = useState(true);
    const [amazonReportType, setAmazonReportType] = useState('all');

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredData, setFilteredData] = useState<MasterReportItem[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        // Filter data based on search term
        if (searchTerm) {
            const filtered = masterReport.filter((item) =>
                item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.sku_code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredData(filtered);
        } else {
            setFilteredData(masterReport);
        }
    }, [masterReport, searchTerm]);

    const fetchMasterReport = async () => {
        try {
            setLoading(true);
            setError(null);
            setReportErrors([]);

            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/master-report`, {
                params: {
                    start_date: startDate,
                    end_date: endDate,
                    include_blinkit: includeBlinkit,
                    include_amazon: includeAmazon,
                    include_zoho: includeZoho,
                    amazon_report_type: amazonReportType,
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const data: MasterReportResponse = response.data;

            setMasterReport(data.combined_data || []);
            setSummary(data.summary || {});
            setMeta(data.meta || {});
            setIndividualReports(data.individual_reports || {});
            setReportErrors(data.errors || []);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch master report data');
            console.error('Error fetching master report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates');
            return;
        }

        if (!includeBlinkit && !includeAmazon && !includeZoho) {
            setError('Please select at least one data source');
            return;
        }

        await fetchMasterReport();
    };

    const downloadMasterReport = async () => {
        try {
            setDownloadLoading(true);
            setError(null);

            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/master-report/download`, {
                params: {
                    start_date: startDate,
                    end_date: endDate,
                    include_blinkit: includeBlinkit,
                    include_amazon: includeAmazon,
                    include_zoho: includeZoho,
                    amazon_report_type: amazonReportType,
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'blob',
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Generate filename
            const filename = `master_report_${startDate}_to_${endDate}.xlsx`;
            link.setAttribute('download', filename);

            // Append to html link element page
            document.body.appendChild(link);

            // Start download
            link.click();

            // Clean up and remove the link
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to download master report');
            console.error('Error downloading master report:', err);
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

        const sortedData = [...filteredData].sort((a: any, b: any) => {
            const aVal = key.includes('.') ? getNestedValue(a, key) : a[key];
            const bVal = key.includes('.') ? getNestedValue(b, key) : b[key];

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        setFilteredData(sortedData);
    };

    const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount || 0);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-IN').format(num || 0);
    };

    const getSortIcon = (columnKey: string) => {
        if (!sortConfig || sortConfig.key !== columnKey) {
            return (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
            );
        }

        if (sortConfig.direction === 'asc') {
            return (
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
            );
        } else {
            return (
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
            );
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source.toLowerCase()) {
            case 'blinkit':
                return <ShoppingCart className="h-4 w-4" />;
            case 'amazon':
                return <Package className="h-4 w-4" />;
            case 'zoho':
                return <Warehouse className="h-4 w-4" />;
            default:
                return <Globe className="h-4 w-4" />;
        }
    };

    const getSourceColor = (source: string) => {
        switch (source.toLowerCase()) {
            case 'blinkit':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'amazon':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'zoho':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };
    const handlePresetApply = async (newStartDate: string, newEndDate: string) => {
        try {
            setLoading(true);
            setError(null);
            setReportErrors([]);

            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/master-report`, {
                params: {
                    start_date: newStartDate,  // Use the passed dates directly
                    end_date: newEndDate,      // Use the passed dates directly
                    include_blinkit: includeBlinkit,
                    include_amazon: includeAmazon,
                    include_zoho: includeZoho,
                    amazon_report_type: amazonReportType,
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const data: MasterReportResponse = response.data;

            setMasterReport(data.combined_data || []);
            setSummary(data.summary || {});
            setMeta(data.meta || {});
            setIndividualReports(data.individual_reports || {});
            setReportErrors(data.errors || []);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch master report data');
            console.error('Error fetching master report:', err);
        } finally {
            setLoading(false);
        }
    };
    if (isLoading) {
        return (
            <div className='flex items-center justify-center min-h-screen'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                <span className='ml-2 text-gray-600'>Loading user data...</span>
            </div>
        );
    }

    if (!accessToken) {
        return (
            <div className='flex items-center justify-center min-h-screen'>
                <div className='text-center'>
                    <div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
                        <svg
                            className='w-8 h-8 text-gray-400'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                            />
                        </svg>
                    </div>
                    <p className='text-lg text-gray-600'>Please log in to see this content.</p>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen py-8'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                {/* Header */}
                <div className='mb-8'>
                    <h1 className='text-3xl font-bold text-white'>Master Sales Report</h1>
                    <p className='mt-2 text-white'>
                        Combined sales analytics from Blinkit, Amazon, and Zoho
                    </p>

                    {/* Data Source Status */}
                    {Object.keys(individualReports).length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-4">
                            {Object.values(individualReports).map((report: any) => (
                                <div
                                    key={report.source}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border ${report.success
                                        ? 'bg-green-50 text-green-800 border-green-200'
                                        : 'bg-red-50 text-red-800 border-red-200'
                                        }`}
                                >
                                    {getSourceIcon(report.source)}
                                    <span className="text-sm font-medium capitalize">
                                        {report.source}
                                    </span>
                                    {report.success ? (
                                        <span className="text-xs bg-green-100 px-2 py-1 rounded">
                                            {formatNumber(report.data?.length || 0)} items
                                        </span>
                                    ) : (
                                        <span className="text-xs bg-red-100 px-2 py-1 rounded">
                                            Failed
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Error Messages */}
                    {reportErrors.length > 0 && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start">
                                <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Data Source Issues</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <ul className="list-disc space-y-1 pl-5">
                                            {reportErrors.map((error, index) => (
                                                <li key={index}>{error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls Section */}
                <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6'>
                    <div className='px-6 py-4'>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                            {/* Date Range and Generate Button */}
                            <div>
                                <h3 className='text-lg font-medium text-gray-900 mb-4'>Date Range & Actions</h3>
                                <DateRangePresets
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    onApplyPreset={handlePresetApply}
                                    showGenerateButton={true}
                                    onGenerate={handleGenerateReport}
                                    loading={loading}
                                    downloadDisabledCondition={downloadLoading || loading || masterReport.length === 0}
                                    downloadLoading={downloadLoading}
                                    downloadReport={downloadMasterReport}
                                />
                            </div>

                            {/* Data Source Controls */}
                            <div>
                                <h3 className='text-lg font-medium text-gray-900 mb-4'>Data Sources</h3>
                                <div className='space-y-4'>
                                    <div className='flex items-center space-x-4'>
                                        <label className='flex items-center'>
                                            <input
                                                type='checkbox'
                                                checked={includeBlinkit}
                                                onChange={(e) => setIncludeBlinkit(e.target.checked)}
                                                className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                                            />
                                            <span className='ml-2 flex items-center gap-2 text-sm font-medium text-gray-700'>
                                                <ShoppingCart className='h-4 w-4 text-orange-600' />
                                                Blinkit
                                            </span>
                                        </label>

                                        <label className='flex items-center'>
                                            <input
                                                type='checkbox'
                                                checked={includeAmazon}
                                                onChange={(e) => setIncludeAmazon(e.target.checked)}
                                                className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                                            />
                                            <span className='ml-2 flex items-center gap-2 text-sm font-medium text-gray-700'>
                                                <Package className='h-4 w-4 text-yellow-600' />
                                                Amazon
                                            </span>
                                        </label>

                                        <label className='flex items-center'>
                                            <input
                                                type='checkbox'
                                                checked={includeZoho}
                                                onChange={(e) => setIncludeZoho(e.target.checked)}
                                                className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                                            />
                                            <span className='ml-2 flex items-center gap-2 text-sm font-medium text-gray-700'>
                                                <Warehouse className='h-4 w-4 text-blue-600' />
                                                Zoho
                                            </span>
                                        </label>
                                    </div>

                                    {includeAmazon && (
                                        <div>
                                            <label htmlFor='amazon-type' className='block text-sm font-medium text-gray-700 mb-1'>
                                                Amazon Report Type
                                            </label>
                                            <select
                                                id='amazon-type'
                                                value={amazonReportType}
                                                onChange={(e) => setAmazonReportType(e.target.value)}
                                                className='block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black'
                                            >
                                                <option value='all'>All (FBA + Vendor + Seller Flex)</option>
                                                <option value='fba'>FBA Only</option>
                                                <option value='seller_flex'>Seller Flex Only</option>
                                                <option value='vendor_central'>Vendor Central Only</option>
                                                <option value='fba+seller_flex'>FBA + Seller Flex</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className='lg:col-span-2'>
                                <div className='relative max-w-md'>
                                    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                                        <svg
                                            className='h-5 w-5 text-gray-400'
                                            fill='none'
                                            stroke='currentColor'
                                            viewBox='0 0 24 24'
                                        >
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth={2}
                                                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                                            />
                                        </svg>
                                    </div>
                                    <input
                                        type='text'
                                        placeholder='Search by product name or SKU...'
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className='block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-black'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6'>
                        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
                            <div className='flex items-center'>
                                <div className='flex-shrink-0'>
                                    <div className='w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center'>
                                        <BarChart3 className='w-5 h-5 text-blue-600' />
                                    </div>
                                </div>
                                <div className='ml-5 w-0 flex-1'>
                                    <dl>
                                        <dt className='text-sm font-medium text-gray-500 truncate'>Unique SKUs</dt>
                                        <dd className='text-lg font-medium text-gray-900'>{formatNumber(summary.total_unique_skus)}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>

                        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
                            <div className='flex items-center'>
                                <div className='flex-shrink-0'>
                                    <div className='w-8 h-8 bg-green-100 rounded-md flex items-center justify-center'>
                                        <TrendingUp className='w-5 h-5 text-green-600' />
                                    </div>
                                </div>
                                <div className='ml-5 w-0 flex-1'>
                                    <dl>
                                        <dt className='text-sm font-medium text-gray-500 truncate'>Total Units Sold</dt>
                                        <dd className='text-lg font-medium text-gray-900'>{formatNumber(summary.total_units_sold)}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>

                        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
                            <div className='flex items-center'>
                                <div className='flex-shrink-0'>
                                    <div className='w-8 h-8 bg-red-100 rounded-md flex items-center justify-center'>
                                        <TrendingDown className='w-5 h-5 text-red-600' />
                                    </div>
                                </div>
                                <div className='ml-5 w-0 flex-1'>
                                    <dl>
                                        <dt className='text-sm font-medium text-gray-500 truncate'>Total Units Returned</dt>
                                        <dd className='text-lg font-medium text-gray-900'>{formatNumber(summary.total_units_returned)}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>

                        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
                            <div className='flex items-center'>
                                <div className='flex-shrink-0'>
                                    <div className='w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center'>
                                        <svg className='w-5 h-5 text-yellow-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1' />
                                        </svg>
                                    </div>
                                </div>
                                <div className='ml-5 w-0 flex-1'>
                                    <dl>
                                        <dt className='text-sm font-medium text-gray-500 truncate'>Total Amount</dt>
                                        <dd className='text-lg font-medium text-gray-900'>{formatCurrency(summary.total_amount)}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>

                        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
                            <div className='flex items-center'>
                                <div className='flex-shrink-0'>
                                    <div className='w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center'>
                                        <svg className='w-5 h-5 text-purple-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
                                        </svg>
                                    </div>
                                </div>
                                <div className='ml-5 w-0 flex-1'>
                                    <dl>
                                        <dt className='text-sm font-medium text-gray-500 truncate'>Average DRR</dt>
                                        <dd className='text-lg font-medium text-gray-900'>{summary.avg_drr?.toFixed(2) || '0.00'}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Master Report Table */}
                <div className='bg-white rounded-lg shadow-sm border border-gray-200'>
                    <div className='px-6 py-4 border-b border-gray-200'>
                        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                            <div>
                                <h2 className='text-xl font-semibold text-gray-900'>Master Sales Report Data</h2>
                                <div className='text-sm text-gray-500'>
                                    {filteredData.length} of {masterReport.length} items
                                    {meta?.execution_time_seconds && (
                                        <span className='ml-2'>• Generated in {meta.execution_time_seconds}s</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                            <span className='ml-2 text-gray-600'>Loading master report...</span>
                        </div>
                    ) : error ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='text-center'>
                                <div className='w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center'>
                                    <svg
                                        className='w-8 h-8 text-red-400'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                        />
                                    </svg>
                                </div>
                                <p className='text-red-600 mb-4'>{error}</p>
                                <button
                                    onClick={handleGenerateReport}
                                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    ) : filteredData.length === 0 && masterReport.length === 0 ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='text-center'>
                                <div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
                                    <svg
                                        className='w-8 h-8 text-gray-400'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                                        />
                                    </svg>
                                </div>
                                <p className='text-gray-600'>
                                    Select date range, sources, and click "Generate Report" to view master sales data
                                </p>
                            </div>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='text-center'>
                                <div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
                                    <svg
                                        className='w-8 h-8 text-gray-400'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                                        />
                                    </svg>
                                </div>
                                <p className='text-gray-600'>
                                    {searchTerm
                                        ? `No items found for "${searchTerm}"`
                                        : 'No sales data found for the selected date range'}
                                </p>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className='mt-2 text-blue-600 hover:text-blue-700 text-sm'
                                    >
                                        Clear search
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full'>
                                <thead className='bg-gray-50'>
                                    <tr>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('item_name')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Product Name</span>
                                                {getSortIcon('item_name')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('sku_code')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>SKU Code</span>
                                                {getSortIcon('sku_code')}
                                            </div>
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Sources
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('combined_metrics.total_units_sold')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Total Units Sold</span>
                                                {getSortIcon('combined_metrics.total_units_sold')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('combined_metrics.total_units_returned')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Total Units Returned</span>
                                                {getSortIcon('combined_metrics.total_units_returned')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('combined_metrics.total_amount')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Total Amount</span>
                                                {getSortIcon('combined_metrics.total_amount')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('combined_metrics.total_closing_stock')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Total Closing Stock</span>
                                                {getSortIcon('combined_metrics.total_closing_stock')}
                                            </div>
                                        </th>
                                        <th
                                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                                            onClick={() => handleSort('combined_metrics.avg_daily_run_rate')}
                                        >
                                            <div className='flex items-center space-x-1'>
                                                <span>Avg DRR</span>
                                                {getSortIcon('combined_metrics.avg_daily_run_rate')}
                                            </div>
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Sales Breakdown
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                            Returns Breakdown
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className='bg-white divide-y divide-gray-200'>
                                    {filteredData.map((item, index) => (
                                        <tr key={index} className='hover:bg-gray-50 transition-colors'>
                                            <td className='px-6 py-4'>
                                                <div className='text-sm font-medium text-gray-900'>
                                                    {item.item_name || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-mono text-gray-900'>
                                                    {item.sku_code || 'N/A'}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4'>
                                                <div className='flex flex-wrap gap-1'>
                                                    {item.sources.map((source) => (
                                                        <span
                                                            key={source}
                                                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${getSourceColor(source)}`}
                                                        >
                                                            {getSourceIcon(source)}
                                                            {source}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-medium text-gray-900'>
                                                    {formatNumber(item.combined_metrics.total_units_sold)}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-medium text-gray-900'>
                                                    {formatNumber(item.combined_metrics.total_units_returned)}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-medium text-gray-900'>
                                                    {formatCurrency(item.combined_metrics.total_amount)}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='flex items-center'>
                                                    <div className='text-sm font-medium text-gray-900'>
                                                        {formatNumber(item.combined_metrics.total_closing_stock)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <div className='text-sm font-medium text-gray-900'>
                                                    {item.combined_metrics.avg_daily_run_rate?.toFixed(2) || '0.00'}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4'>
                                                <div className='text-xs space-y-1'>
                                                    {item.sources.includes('blinkit') && (
                                                        <div className='flex justify-between'>
                                                            <span className='text-orange-600'>Blinkit Sales:</span>
                                                            <span className='text-black'>{formatNumber(item.source_breakdown.blinkit.units_sold)} units</span>
                                                        </div>
                                                    )}
                                                    {item.sources.includes('amazon') && (
                                                        <div className='flex justify-between'>
                                                            <span className='text-yellow-600'>Amazon Sales:</span>
                                                            <span className='text-black'>{formatNumber(item.source_breakdown.amazon.units_sold)} units</span>
                                                        </div>
                                                    )}
                                                    {item.sources.includes('zoho') && (
                                                        <div className='flex justify-between'>
                                                            <span className='text-blue-600'>Zoho Sales:</span>
                                                            <span className='text-black'>{formatNumber(item.source_breakdown.zoho.units_sold)} units</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className='px-6 py-4'>
                                                <div className='text-xs space-y-1'>
                                                    {item.sources.includes('blinkit') && (
                                                        <div className='flex justify-between'>
                                                            <span className='text-orange-600'>Blinkit Returns:</span>
                                                            <span className='text-black'>{formatNumber(item.source_breakdown.blinkit.units_returned)} units</span>
                                                        </div>
                                                    )}
                                                    {item.sources.includes('amazon') && (
                                                        <div className='flex justify-between'>
                                                            <span className='text-yellow-600'>Amazon Returns:</span>
                                                            <span className='text-black'>{formatNumber(item.source_breakdown.amazon.units_returned)} units</span>
                                                        </div>
                                                    )}
                                                    {item.sources.includes('zoho') && (
                                                        <div className='flex justify-between'>
                                                            <span className='text-blue-600'>Zoho Returns:</span>
                                                            <span className='text-black'>{formatNumber(item.source_breakdown.zoho.units_returned)} units</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MasterReportsPage;