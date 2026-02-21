'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';
import DateRange from '@/components/reports/DateRange';
import {
  SortIcon,
  TABLE_CLASSES,
  CONTROLS_CLASSES,
  LoadingState,
  ErrorState,
  EmptyState,
  SearchBar,
  formatCurrency,
  formatNumber,
  formatDate,
} from '@/components/reports/TableStyles';

function Page() {
  const { email, isLoading, accessToken, user } = useAuth();
  const [salesReport, setSalesReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError]: any = useState(null);
  const [summary, setSummary] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [reportMetadata, setReportMetadata] = useState<any>(null);

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1); // Default to last month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    // Filter data based on search term
    if (searchTerm) {
      const filtered = salesReport.filter((item: any) =>
        item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(salesReport);
    }
  }, [salesReport, searchTerm]);

  const fetchDataMetadata = async (customStartDate?: string, customEndDate?: string) => {
    try {
      setMetadataLoading(true);

      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/data-metadata`, {
         params: {
          start_date: customStartDate || startDate,
          end_date: customEndDate || endDate,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setReportMetadata(response.data.data || null);
    } catch (err: any) {
      console.error('Error fetching data metadata:', err);
    } finally {
      setMetadataLoading(false);
    }
  };

  const fetchSalesReport = async (customStartDate?: string, customEndDate?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/sales-report`, {
        params: {
          start_date: customStartDate || startDate,
          end_date: customEndDate || endDate,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setSalesReport(response.data.data || []);
      setSummary(response.data.summary || {});
      setMeta(response.data.meta || {});
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch sales report data');
      console.error('Error fetching sales report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = useCallback(async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    await Promise.all([
      fetchSalesReport(),
      fetchDataMetadata()
    ]);
  }, [startDate, endDate]);

  const handlePresetApply = async (newStartDate: string, newEndDate: string) => {
    if (!newStartDate || !newEndDate) {
      setError('Please select both start and end dates');
      return;
    }

    await Promise.all([
      fetchSalesReport(newStartDate, newEndDate),
      fetchDataMetadata(newStartDate, newEndDate)
    ]);
  };

  const downloadSalesReport = async () => {
    try {
      setDownloadLoading(true);
      setError(null);

      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/sales-report/download`, {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `sales_report_${startDate}_to_${endDate}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to download sales report');
      console.error('Error downloading sales report:', err);
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
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredData(sortedData);
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <LoadingState message='Loading user data...' />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <EmptyState
          message='Please log in to see this content.'
          icon='lock'
        />
      </div>
    );
  }

  return (
    <div className='min-h-screen py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-zinc-900 dark:text-zinc-50'>Zoho Sales Report</h1>
          <p className='mt-2 text-zinc-900 dark:text-zinc-50'>
            View detailed sales analytics with inventory insights
          </p>

          {/* Data Availability Chips */}
          {reportMetadata && (
            <div className="flex flex-wrap flex-row gap-3 mt-4">
              {reportMetadata.inventory_data && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                  <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-800 dark:text-blue-300">
                    <span className="font-medium">Inventory Records:</span> {formatNumber(reportMetadata.inventory_data.total_stock_records)} records
                    <span className="ml-1">({reportMetadata.inventory_data.first_inventory_date} to {reportMetadata.inventory_data.last_inventory_date})</span>
                  </span>
                </div>
              )}

              {reportMetadata.sales_data && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-100 dark:border-green-800">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-800 dark:text-green-300">
                    <span className="font-medium">Invoices:</span> {formatNumber(reportMetadata.sales_data.valid_invoices)} invoices
                    <span className="ml-1">({reportMetadata.sales_data.first_sales_date} to {reportMetadata.sales_data.last_sales_date})</span>
                  </span>
                </div>
              )}

              {reportMetadata.inventory_data?.missing_dates && reportMetadata.inventory_data.missing_dates.length > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-full border border-orange-100 dark:border-orange-800">
                  <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm text-orange-800 dark:text-orange-300">
                    <span className="font-medium">Missing Inventory Dates:</span> {reportMetadata.inventory_data.missing_dates.join(', ')}
                  </span>
                </div>
              )}

              {reportMetadata.sales_data?.missing_dates && reportMetadata.sales_data.missing_dates.length > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-100 dark:border-red-800">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-800 dark:text-red-300">
                    <span className="font-medium">Missing Sales Dates:</span> {reportMetadata.sales_data.missing_dates.join(', ')}
                  </span>
                </div>
              )}

              {metadataLoading && !reportMetadata && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-full border border-zinc-100 dark:border-zinc-700">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-400"></div>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Loading data info...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className={CONTROLS_CLASSES.container}>
          <div className={CONTROLS_CLASSES.inner}>
            <div className={CONTROLS_CLASSES.grid}>
              {/* Date Range Controls */}
              <div className={CONTROLS_CLASSES.section}>
                <h3 className={CONTROLS_CLASSES.sectionTitle}>Date Range & Actions</h3>
                <DateRange
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onApplyPreset={handlePresetApply}
                  onGenerate={handleGenerateReport}
                  loading={loading}
                  downloadReport={downloadSalesReport}
                  downloadDisabledCondition={downloadLoading || loading}
                  downloadLoading={downloadLoading}
                />
              </div>

              {/* Search Bar */}
              <div className={CONTROLS_CLASSES.section}>
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder='Search by product name or SKU...'
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6'>
            <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center'>
                    <svg className='w-5 h-5 text-blue-600 dark:text-blue-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 7l-8-4-8 4m16 0l-8 4-8-4m16 0v10l-8 4-8-4V7' />
                    </svg>
                  </div>
                </div>
                <div className='ml-4 min-w-0 flex-1'>
                  <dl>
                    <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>Total Items</dt>
                    <dd className='text-lg font-medium text-gray-900 dark:text-zinc-100'>{formatNumber(summary.total_items)}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center'>
                    <svg className='w-5 h-5 text-green-600 dark:text-green-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' />
                    </svg>
                  </div>
                </div>
                <div className='ml-4 min-w-0 flex-1'>
                  <dl>
                    <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>Total Units Sold</dt>
                    <dd className='text-lg font-medium text-gray-900 dark:text-zinc-100'>{formatNumber(summary.total_units_sold)}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center'>
                    <svg className='w-5 h-5 text-green-600 dark:text-green-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' />
                    </svg>
                  </div>
                </div>
                <div className='ml-4 min-w-0 flex-1'>
                  <dl>
                    <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>Total Returns</dt>
                    <dd className='text-lg font-medium text-gray-900 dark:text-zinc-100'>{formatNumber(summary.total_units_returned)}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-md flex items-center justify-center'>
                    <svg className='w-5 h-5 text-yellow-600 dark:text-yellow-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1' />
                    </svg>
                  </div>
                </div>
                <div className='ml-4 min-w-0 flex-1'>
                  <dl>
                    <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>Total Amount</dt>
                    <dd className='text-lg font-medium text-gray-900 dark:text-zinc-100'>{formatCurrency(summary.total_amount)}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-md flex items-center justify-center'>
                    <svg className='w-5 h-5 text-purple-600 dark:text-purple-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
                    </svg>
                  </div>
                </div>
                <div className='ml-4 min-w-0 flex-1'>
                  <dl>
                    <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>Avg DRR</dt>
                    <dd className='text-lg font-medium text-gray-900 dark:text-zinc-100'>{summary.average_drr?.toFixed(2) || '0.00'}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Report Table */}
        <div className={TABLE_CLASSES.container}>
          <div className={TABLE_CLASSES.headerSection}>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
              <div>
                <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>Zoho Sales Report Data</h2>
                <div className='text-sm text-zinc-500 dark:text-zinc-400'>
                  {filteredData.length} of {salesReport.length} items
                  {meta?.execution_time_seconds && (
                    <span className='ml-2'>• Generated in {meta.execution_time_seconds}s</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState message='Loading zoho sales report...' />
          ) : error ? (
            <ErrorState error={error} onRetry={handleGenerateReport} />
          ) : filteredData.length === 0 && salesReport.length === 0 ? (
            <EmptyState message='Select a date range and click "Generate Report" to view sales data' />
          ) : filteredData.length === 0 ? (
            <EmptyState
              message={
                searchTerm
                  ? `No items found for "${searchTerm}"`
                  : 'No sales data found for the selected date range'
              }
            />
          ) : (
            <div className={TABLE_CLASSES.overflow}>
              <table className={TABLE_CLASSES.table}>
                <thead className={TABLE_CLASSES.thead}>
                  <tr>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('item_name')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>Product Name</span>
                        <SortIcon column='item_name' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('sku_code')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>SKU Code</span>
                        <SortIcon column='sku_code' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('units_sold')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>Units Sold</span>
                        <SortIcon column='units_sold' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('units_returned')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>Units Returned</span>
                        <SortIcon column='units_returned' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('total_amount')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>Total Amount</span>
                        <SortIcon column='total_amount' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('closing_stock')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>Closing Stock</span>
                        <SortIcon column='closing_stock' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('total_days_in_stock')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>Days in Stock</span>
                        <SortIcon column='total_days_in_stock' sortConfig={sortConfig} />
                      </div>
                    </th>
                    <th className={TABLE_CLASSES.th} onClick={() => handleSort('drr')}>
                      <div className={TABLE_CLASSES.thContent}>
                        <span>DRR</span>
                        <SortIcon column='drr' sortConfig={sortConfig} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className={TABLE_CLASSES.tbody}>
                  {filteredData.map((item: any, index) => (
                    <tr key={index} className={TABLE_CLASSES.tr}>
                      <td className={TABLE_CLASSES.td}>
                        <div className={TABLE_CLASSES.tdTextMedium}>
                          {item.item_name || 'N/A'}
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className='text-sm font-mono text-zinc-900 dark:text-zinc-100'>
                          {item.sku_code || 'N/A'}
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className={TABLE_CLASSES.tdTextMedium}>
                          {formatNumber(item.units_sold)}
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className={TABLE_CLASSES.tdTextMedium}>
                          {formatNumber(item.units_returned)}
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className={TABLE_CLASSES.tdTextMedium}>
                          {formatCurrency(item.total_amount)}
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className='flex items-center'>
                          <div className={TABLE_CLASSES.tdTextMedium}>
                            {formatNumber(item.closing_stock)}
                          </div>
                          {item.closing_stock === 0 && (
                            <span className='ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'>
                              Out of Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className={TABLE_CLASSES.tdText}>
                          {item.total_days_in_stock} days
                        </div>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <div className={TABLE_CLASSES.tdTextMedium}>
                          {item.drr?.toFixed(2) || '0.00'}
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

export default Page;
