'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect } from 'react';
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
import { TrendingUp, Package, Award, BarChart3 } from 'lucide-react';

// Types for the API response
interface ProductMetrics {
  avg_daily_on_stock_days: number;
  avg_weekly_on_stock_days: number;
  avg_monthly_on_stock_days: number;
  total_sales_in_period: number;
  days_of_coverage: number;
  days_with_inventory: number;
  closing_stock: number;
}

interface TopProduct {
  item_id: number;
  item_name: string;
  sku_code: string;
  city: string;
  warehouse: string;
  metrics: ProductMetrics;
  year: number;
  month: number;
}

interface TopProductsResponse {
  products: TopProduct[];
  total_count: number;
  current_month: number;
  current_year: number;
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

function Page() {
  const { isLoading, accessToken, user } = useAuth();
  const [data, setData] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [bestPerformer, setBestPerformer] = useState<TopProduct | null>(null);

  // API Base URL - adjust according to your setup
  const API_BASE_URL = `${process.env.api_url}/dashboard`;

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/top-products?limit=10`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const result: TopProductsResponse = await response.json();

        setData(result.products);

        // Calculate totals
        const total = result.products.reduce(
          (sum, item) => sum + item.metrics.total_sales_in_period,
          0
        );
        setTotalUnits(total);

        // Set best performer
        if (result.products.length > 0) {
          setBestPerformer(result.products[0]);
        }
      } catch (err) {
        console.error('Error fetching top products:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken, API_BASE_URL]);

  // Transform data for the chart
  const chartData = data.map((product) => ({
    item:
      product.item_name.length > 15
        ? product.item_name.substring(0, 15) + '...'
        : product.item_name,
    fullName: product.item_name,
    unitsSold: product.metrics.total_sales_in_period,
    category: product.city, // Using city as category, adjust as needed
    warehouse: product.warehouse,
    sku: product.sku_code,
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg'>
          <p className='font-semibold text-gray-900'>{data.fullName}</p>
          <p className='text-blue-600'>
            Units Sold:{' '}
            <span className='font-bold'>
              {payload[0].value.toLocaleString()}
            </span>
          </p>
          <p className='text-gray-600 text-sm'>City: {data.category}</p>
          <p className='text-gray-600 text-sm'>SKU: {data.sku}</p>
          <p className='text-gray-600 text-sm'>Warehouse: {data.warehouse}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-lg shadow-md text-center'>
          <BarChart3 className='h-16 w-16 text-gray-400 mx-auto mb-4' />
          <p className='text-xl text-gray-700'>
            Please log in to see this content.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-lg shadow-md text-center'>
          <div className='text-red-500 mb-4'>
            <BarChart3 className='h-16 w-16 mx-auto' />
          </div>
          <p className='text-xl text-gray-700 mb-2'>Error loading data</p>
          <p className='text-gray-500'>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className='mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
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
            Welcome back, {user?.name}!
          </h1>
          <p className='text-gray-600'>
            Here's an overview of your top performing items for this month
          </p>
        </div>

        {/* Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
          <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
            <div className='flex items-center'>
              <div className='p-2 bg-blue-100 rounded-lg'>
                <Package className='h-6 w-6 text-blue-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm font-medium text-gray-600'>
                  Total Units Sold
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {totalUnits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
            <div className='flex items-center'>
              <div className='p-2 bg-green-100 rounded-lg'>
                <Award className='h-6 w-6 text-green-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm font-medium text-gray-600'>
                  Best Performer
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {bestPerformer?.item_name.length &&
                  bestPerformer.item_name.length > 20
                    ? bestPerformer.item_name.substring(0, 20) + '...'
                    : bestPerformer?.item_name || 'Loading...'}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
            <div className='flex items-center'>
              <div className='p-2 bg-purple-100 rounded-lg'>
                <TrendingUp className='h-6 w-6 text-purple-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm font-medium text-gray-600'>
                  Top 10 Average
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {data.length > 0
                    ? Math.round(totalUnits / data.length).toLocaleString()
                    : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
          <div className='mb-6'>
            <h2 className='text-xl font-bold text-gray-900 mb-2'>
              Top 10 Performing Items
            </h2>
            <p className='text-gray-600'>
              Units sold by product for the current month
            </p>
          </div>

          {loading ? (
            <div className='h-96 flex items-center justify-center'>
              <div className='text-center'>
                <div className='animate-pulse'>
                  <div className='h-4 bg-gray-200 rounded w-48 mx-auto mb-4'></div>
                  <div className='h-4 bg-gray-200 rounded w-32 mx-auto'></div>
                </div>
                <p className='text-gray-500 mt-4'>Loading chart data...</p>
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
        </div>

        {/* Data Table */}
        <div className='mt-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-200'>
            <h3 className='text-lg font-semibold text-gray-900'>
              Detailed Rankings
            </h3>
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
                    City
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Warehouse
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Units Sold
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {data.map((item, index) => (
                  <tr key={item.item_id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                            index === 0
                              ? 'bg-yellow-500'
                              : index === 1
                              ? 'bg-gray-400'
                              : index === 2
                              ? 'bg-orange-600'
                              : 'bg-gray-300'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>
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
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                        {item.city}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='text-sm text-gray-600'>
                        {item.warehouse}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold'>
                      {item.metrics.total_sales_in_period.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
