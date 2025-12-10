'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Package, BarChart3, Calendar, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import DatePicker from '../components/common/DatePicker'; // Adjust the import path as needed
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useRouter } from 'next/navigation';

// Types for the API response - Updated with safer optional properties
interface ProductMetrics {
  avg_daily_on_stock_days?: number;
  avg_weekly_on_stock_days?: number;
  avg_monthly_on_stock_days?: number;
  total_sales_in_period?: number;
  total_returns_in_period?: number;
  total_amount?: number;
  days_of_coverage?: number;
  days_with_inventory?: number;
  closing_stock?: number;
  sessions?: number;
  daily_run_rate?: number;
}

interface TopProduct {
  item_id?: number;
  item_name?: string;
  sku_code?: string;
  city?: string;
  metrics?: ProductMetrics; // Made optional to handle missing metrics
  year?: number;
  month?: number;
  sources?: string[];
}

interface TopProductsResponse {
  products?: TopProduct[];
  total_count?: number;
  current_month?: number;
  current_year?: number;
}

// Custom colors for bars
const barColors = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

// Utility function to safely get numeric values with fallbacks
const safeNumber = (value: any, fallback: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
};

// Utility function to safely get string values
const safeString = (value: any, fallback: string = 'Unknown'): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
};

function Page() {
  const { isLoading, accessToken, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState('thisMonth');
  
  // Date filtering state
  const [startDate, setStartDate] = useState<Date>(
    startOfMonth(subMonths(new Date(), 0))
  );
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  
  // Source filtering state
  const [includeBlinkit, setIncludeBlinkit] = useState(true);
  const [includeAmazon, setIncludeAmazon] = useState(true);
  const [includeZoho, setIncludeZoho] = useState(true);
  
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // State for collapsible top products section
  const [isTopProductsExpanded, setIsTopProductsExpanded] = useState(false);
  const [hasLoadedTopProducts, setHasLoadedTopProducts] = useState(false);

  // Use ref to track the current request and prevent race conditions
  const currentRequestRef = useRef<number>(0);

  // API Base URL
  const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/dashboard`;

  // Function to validate and clean product data
  const validateProductData = (products: TopProduct[]): TopProduct[] => {
    if (!Array.isArray(products)) return [];
    
    return products
      .filter(product => {
        // Basic validation - must have at least SKU or item name
        const hasSku = safeString(product.sku_code, '') !== 'Unknown';
        const hasName = safeString(product.item_name, '') !== 'Unknown';
        const hasMetrics = product.metrics && typeof product.metrics === 'object';
        const hasSales = hasMetrics && safeNumber(product?.metrics?.total_sales_in_period) > 0;
        
        if (!hasSales) {
          console.warn('Product filtered out - no sales:', product);
        }
        
        return (hasSku || hasName) && hasMetrics && hasSales;
      })
      .map(product => ({
        ...product,
        item_name: safeString(product.item_name),
        sku_code: safeString(product.sku_code),
        city: safeString(product.city, 'Multiple'),
        sources: Array.isArray(product.sources) ? product.sources : [],
        metrics: product.metrics ? {
          ...product.metrics,
          total_sales_in_period: safeNumber(product.metrics.total_sales_in_period),
          total_returns_in_period: safeNumber(product.metrics.total_returns_in_period),
          total_amount: safeNumber(product.metrics.total_amount),
          closing_stock: safeNumber(product.metrics.closing_stock),
          days_with_inventory: safeNumber(product.metrics.days_with_inventory),
          days_of_coverage: safeNumber(product.metrics.days_of_coverage),
          avg_daily_on_stock_days: safeNumber(product.metrics.avg_daily_on_stock_days),
          avg_weekly_on_stock_days: safeNumber(product.metrics.avg_weekly_on_stock_days),
          avg_monthly_on_stock_days: safeNumber(product.metrics.avg_monthly_on_stock_days),
          sessions: safeNumber(product.metrics.sessions),
          daily_run_rate: safeNumber(product.metrics.daily_run_rate),
        } : undefined
      }));
  };


  // Fetch top products data
  const fetchTopProductsData = useCallback(async (requestId: number) => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);
    setData([]);
    setAvailableCities([]);

    try {
      const params = new URLSearchParams({
        limit: '10',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        include_blinkit: includeBlinkit.toString(),
        include_amazon: includeAmazon.toString(),
        include_zoho: includeZoho.toString(),
      });

      if (selectedCity) {
        params.append('city', selectedCity);
      }
      if (selectedWarehouse) {
        params.append('warehouse', selectedWarehouse);
      }

      const response = await fetch(`${API_BASE_URL}/top-products?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const result: TopProductsResponse = await response.json();

      // Only update state if this is still the most recent request
      if (requestId === currentRequestRef.current) {
        // Validate and clean the data
        const validatedProducts = validateProductData(result.products || []);
        
        if (validatedProducts.length === 0 && result.products && result.products.length > 0) {
          console.warn('All products were filtered out during validation');
          setError('No valid product data found. Please check your filters and try again.');
        }
        
        setData(validatedProducts);

        // Extract unique cities for filters
        const cities:any = [...new Set(validatedProducts.map((p) => p.city).filter(Boolean))];
        setAvailableCities(cities);
      }
    } catch (err) {
      console.error('Error fetching top products:', err);
      if (requestId === currentRequestRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setData([]);
      }
    } finally {
      if (requestId === currentRequestRef.current) {
        setLoading(false);
      }
    }
  }, [
    accessToken,
    startDate,
    endDate,
    includeBlinkit,
    includeAmazon,
    includeZoho,
    selectedCity,
    selectedWarehouse,
    API_BASE_URL,
  ]);


  // Function to handle expanding top products section
  const handleExpandTopProducts = useCallback(async () => {
    if (!isTopProductsExpanded && !hasLoadedTopProducts) {
      // First time expanding - load the data
      const requestId = ++currentRequestRef.current;
      await fetchTopProductsData(requestId);
      setHasLoadedTopProducts(true);
    }
    setIsTopProductsExpanded(!isTopProductsExpanded);
  }, [isTopProductsExpanded, hasLoadedTopProducts, fetchTopProductsData]);


  // Handle preset date ranges
  const handlePresetRange = useCallback((range: string) => {
    const now = new Date();
    switch (range) {
      case 'thisMonth':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        setPreset('thisMonth');
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        setPreset('lastMonth');
        break;
      case 'last3Months':
        setStartDate(startOfMonth(subMonths(now, 2)));
        setEndDate(endOfMonth(now));
        setPreset('last3Months');
        break;
      default:
        break;
    }
  }, []);

  // Transform data for the chart with safe access
  const chartData = data.map((product) => ({
    item:
      product.item_name && product.item_name.length > 15
        ? product.item_name.substring(0, 15) + '...'
        : product.item_name || 'Unknown Item',
    fullName: product.item_name || 'Unknown Item',
    unitsSold: safeNumber(product.metrics?.total_sales_in_period),
    category: product.city || 'Unknown',
    sku: product.sku_code || 'Unknown',
    sources: product.sources || [],
    totalAmount: safeNumber(product.metrics?.total_amount),
    closingStock: safeNumber(product.metrics?.closing_stock),
  }));


  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg'>
          <p className='font-semibold text-gray-900'>{data.fullName}</p>
          <p className='text-blue-600'>
            Units Sold: <span className='font-bold'>{payload[0].value.toLocaleString()}</span>
          </p>
          <p className='text-gray-600 text-sm'>SKU: {data.sku}</p>
          <p className='text-gray-600 text-sm'>Stock: {data.closingStock.toLocaleString()}</p>
          {data.totalAmount > 0 && (
            <p className='text-green-600 text-sm'>
              Revenue: ${data.totalAmount.toLocaleString()}
            </p>
          )}
          {data.sources && data.sources.length > 0 && (
            <p className='text-gray-500 text-xs mt-1'>
              Sources: {data.sources.join(', ')}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='animate-spin h-12 w-12 text-blue-600 mx-auto mb-4' />
          <p className='text-gray-600'>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!accessToken) {
    setTimeout(() => {
      router.push('/login');
    }, 3000);
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-lg shadow-md text-center'>
          <BarChart3 className='h-16 w-16 text-gray-400 mx-auto mb-4' />
          <p className='text-xl text-gray-700'>Please log in to see this content.</p>
          <p className='text-sm text-gray-700'>Redirecting to login page in 3 seconds</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-lg shadow-md text-center max-w-md'>
          <AlertCircle className='h-16 w-16 text-red-500 mx-auto mb-4' />
          <p className='text-xl text-gray-700 mb-2'>Error loading data</p>
          <p className='text-gray-500 mb-4'>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setSummaryError(null);
              fetchData();
            }}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {user?.name}!
          </h1>
          <p className='text-gray-600'>
            Here's an overview of your top performing items across all platforms for the selected period
          </p>
        </div>

        {/* Filters Section */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8'>
          <div className='flex items-center mb-4'>
            <Calendar className='h-5 w-5 text-gray-500 mr-2' />
            <h3 className='text-lg font-semibold text-gray-900'>Filters</h3>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
            {/* Date Range Pickers */}
            <DatePicker
              selected={startDate}
              onChange={setStartDate}
              maxDate={endDate}
              placeholder='Select start date'
              label='Start Date'
            />

            <DatePicker
              selected={endDate}
              onChange={setEndDate}
              minDate={startDate}
              placeholder='Select end date'
              label='End Date'
            />
          </div>

          {/* Data Source Toggles */}
          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Data Sources
            </label>
            <div className='flex flex-wrap gap-4'>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={includeBlinkit}
                  onChange={(e) => setIncludeBlinkit(e.target.checked)}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <span className='ml-2 text-sm text-gray-700'>
                  Blinkit
                </span>
              </label>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={includeAmazon}
                  onChange={(e) => setIncludeAmazon(e.target.checked)}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <span className='ml-2 text-sm text-gray-700'>
                  Amazon
                </span>
              </label>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={includeZoho}
                  onChange={(e) => setIncludeZoho(e.target.checked)}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <span className='ml-2 text-sm text-gray-700'>
                  Zoho
                </span>
              </label>
            </div>
          </div>

          {/* Quick Date Range Buttons */}
          <div className='flex flex-wrap gap-2'>
            <button
              onClick={() => handlePresetRange('thisMonth')}
              className={`px-3 py-1.5 text-sm ${
                preset === 'thisMonth'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              } rounded-lg hover:bg-blue-200 transition-colors`}
            >
              This Month
            </button>
            <button
              onClick={() => handlePresetRange('lastMonth')}
              className={`px-3 py-1.5 text-sm ${
                preset === 'lastMonth'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              } rounded-lg hover:bg-gray-200 transition-colors`}
            >
              Last Month
            </button>
            <button
              onClick={() => handlePresetRange('last3Months')}
              className={`px-3 py-1.5 text-sm ${
                preset === 'last3Months'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              } rounded-lg hover:bg-gray-200 transition-colors`}
            >
              Last 3 Months
            </button>
          </div>
        </div>

        {/* Chart Section - Collapsible */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
          <button
            onClick={handleExpandTopProducts}
            className='w-full flex items-center justify-between mb-6 hover:bg-gray-50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg transition-colors'
          >
            <div className='text-left'>
              <h2 className='text-xl font-bold text-gray-900 mb-2 flex items-center gap-2'>
                Top 10 Performing Items
                {isTopProductsExpanded ? (
                  <ChevronUp className='h-5 w-5 text-gray-500' />
                ) : (
                  <ChevronDown className='h-5 w-5 text-gray-500' />
                )}
              </h2>
              <p className='text-gray-600 text-sm'>
                {isTopProductsExpanded
                  ? `Units sold by product for ${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`
                  : 'Click to view top performing items (loads data on demand)'
                }
              </p>
            </div>
          </button>

          {isTopProductsExpanded && (
            <div className='mt-4'>

          {loading ? (
            <div className='h-96 flex items-center justify-center'>
              <div className='text-center'>
                <Loader2 className='animate-spin h-12 w-12 text-blue-600 mb-4' />
                <p className='text-gray-500'>Loading chart data...</p>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className='h-96 flex items-center justify-center'>
              <div className='text-center'>
                <Package className='h-16 w-16 text-gray-300 mx-auto mb-4' />
                <p className='text-gray-500'>No data found for the selected period</p>
                <p className='text-sm text-gray-400 mt-2'>
                  Try adjusting your date range or data source filters
                </p>
              </div>
            </div>
          ) : (
            <div className='h-96 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 60,
                  }}
                >
                  <CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
                  <XAxis
                    dataKey='item'
                    angle={-45}
                    textAnchor='end'
                    height={80}
                    interval={0}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey='unitsSold' radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={barColors[index % barColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Data Table - inside collapsible section */}
          {isTopProductsExpanded && data.length > 0 && (
          <div className='mt-8 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden'>
            <div className='px-6 py-4 border-b border-gray-200'>
              <h3 className='text-lg font-semibold text-gray-900'>Detailed Rankings</h3>
            </div>
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Rank
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Item
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      SKU Code
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Units Sold
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Stock
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Sources
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-gray-200'>
                  {data.map((item, index) => (
                    <tr key={`${item.sku_code}-${index}`} className='hover:bg-gray-50'>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                            index === 0
                              ? 'bg-green-500'
                              : index === 1
                              ? 'bg-blue-500'
                              : index === 2
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='text-sm font-medium text-gray-900 max-w-xs'>
                          {item.item_name}
                        </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <span className='text-sm text-gray-900 font-mono'>
                          {item.sku_code}
                        </span>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold'>
                        {safeNumber(item.metrics?.total_sales_in_period).toLocaleString()}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                        {safeNumber(item.metrics?.closing_stock).toLocaleString()}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                        {item.sources && item.sources.length > 0 ? item.sources.join(', ') : item.city}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Page;