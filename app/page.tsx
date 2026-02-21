'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Package,
  BarChart3,
  AlertCircle,
  Loader2,
  TrendingUp,
  RefreshCw,
  DollarSign,
  Layers,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasterReportItem {
  sku_code: string;
  item_name: string;
  brand?: string;
  sources: string[];
  combined_metrics: {
    total_units_sold: number;
    total_amount: number;
    total_closing_stock: number;
    avg_daily_run_rate: number;
  };
  in_stock: boolean;
}

interface MasterSummary {
  total_unique_skus: number;
  total_units_sold: number;
  total_amount: number;
  total_closing_stock: number;
  sources_included: string[];
  source_record_counts: { [key: string]: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
];

const PIE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeNum = (v: any, fallback = 0): number => {
  if (typeof v === 'number' && !isNaN(v)) return v;
  const p = parseFloat(v);
  return isNaN(p) ? fallback : p;
};

const getLast30 = () => {
  const end = new Date();
  return {
    start: format(subDays(end, 30), 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const BarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className='bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm'>
      <p className='font-semibold text-gray-900 dark:text-zinc-100 mb-1 max-w-[200px] leading-snug'>
        {d.fullName}
      </p>
      <p className='text-blue-600 dark:text-blue-400'>
        Units Sold: <span className='font-bold'>{d.unitsSold.toLocaleString()}</span>
      </p>
      <p className='text-gray-500 dark:text-zinc-400'>SKU: {d.sku}</p>
      {d.sources?.length > 0 && (
        <p className='text-gray-400 dark:text-zinc-500 text-xs mt-1'>
          Sources: {d.sources.join(', ')}
        </p>
      )}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className='bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm'>
      <p className='font-semibold text-gray-900 dark:text-zinc-100'>{d.name}</p>
      <p className='text-gray-600 dark:text-zinc-300'>
        Units Sold: <span className='font-bold'>{d.value.toLocaleString()}</span>
      </p>
      <p className='text-gray-500 dark:text-zinc-400'>
        Share: {d.payload?.total > 0 ? `${((d.value / d.payload.total) * 100).toFixed(1)}%` : '—'}
      </p>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function Page() {
  const { isLoading, accessToken, user } = useAuth();
  const router = useRouter();

  const [masterItems, setMasterItems] = useState<MasterReportItem[]>([]);
  const [masterSummary, setMasterSummary] = useState<MasterSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL!;
  const { start: d30Start, end: d30End } = getLast30();

  // ── Single master-report fetch ────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/master/master-report?start_date=${d30Start}&end_date=${d30End}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setMasterItems(json.combined_data || []);
      setMasterSummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [accessToken, API, d30Start, d30End]);

  useEffect(() => {
    if (accessToken) fetchData();
  }, [accessToken]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const top10 = [...masterItems]
    .filter((p) => safeNum(p.combined_metrics?.total_units_sold) > 0)
    .sort(
      (a, b) =>
        safeNum(b.combined_metrics?.total_units_sold) -
        safeNum(a.combined_metrics?.total_units_sold)
    )
    .slice(0, 10);

  const chartData = top10.map((p) => ({
    item:
      p.item_name.length > 16 ? p.item_name.substring(0, 16) + '…' : p.item_name,
    fullName: p.item_name,
    unitsSold: safeNum(p.combined_metrics?.total_units_sold),
    sku: p.sku_code,
    sources: p.sources,
  }));

  // Brand distribution pie — group combined_data by brand, sum units sold
  const brandTotals: { [brand: string]: number } = {};
  for (const item of masterItems) {
    const brand = item.brand?.trim() || 'Unknown';
    brandTotals[brand] = (brandTotals[brand] || 0) + safeNum(item.combined_metrics?.total_units_sold);
  }
  const brandEntries = Object.entries(brandTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const brandTotal = brandEntries.reduce((s, [, v]) => s + v, 0);
  const pieData = brandEntries.map(([brand, units], i) => ({
    name: brand,
    value: units,
    fill: PIE_COLORS[i % PIE_COLORS.length],
    total: brandTotal,
  }));

  // ── Auth gates ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <Loader2 className='animate-spin h-10 w-10 text-blue-600' />
      </div>
    );
  }

  if (!accessToken) {
    setTimeout(() => router.push('/login'), 3000);
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <div className='bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-md text-center'>
          <BarChart3 className='h-16 w-16 text-gray-400 dark:text-zinc-500 mx-auto mb-4' />
          <p className='text-xl text-gray-700 dark:text-zinc-300'>Please log in to see this content.</p>
          <p className='text-sm text-gray-500 dark:text-zinc-400 mt-1'>Redirecting to login…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className='bg-gray-50 dark:bg-zinc-950 py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>

        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
              {greeting()}, {user?.name}!
            </h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Last 30 days · {d30Start} → {d30End}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className='flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors'
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && !loading && (
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3'>
            <AlertCircle className='h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0' />
            <p className='text-sm text-red-700 dark:text-red-300'>{error}</p>
            <button onClick={fetchData} className='ml-auto text-sm text-red-600 dark:text-red-400 underline'>
              Retry
            </button>
          </div>
        )}

        {/* KPI cards */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          {[
            {
              label: 'Units Sold',
              value: masterSummary?.total_units_sold,
              icon: <TrendingUp className='w-5 h-5 text-blue-500' />,
            },
            {
              label: 'Total Active SKUs',
              value: masterSummary?.total_unique_skus,
              icon: <Package className='w-5 h-5 text-green-500' />,
            },
            {
              label: 'Total Revenue',
              value: masterSummary?.total_amount,
              icon: <DollarSign className='w-5 h-5 text-amber-500' />,
              format: 'currency',
            },
            {
              label: 'Closing Stock',
              value: masterSummary?.total_closing_stock,
              icon: <Layers className='w-5 h-5 text-purple-500' />,
            },
          ].map((card) => (
            <div
              key={card.label}
              className='bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-4'
            >
              <div className='flex items-center gap-2 mb-2'>
                {card.icon}
                <span className='text-xs text-gray-500 dark:text-zinc-400'>{card.label}</span>
              </div>
              {loading ? (
                <div className='h-7 w-20 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse' />
              ) : (
                <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
                  {card.value == null
                    ? '—'
                    : card.format === 'currency'
                    ? `₹${safeNum(card.value).toLocaleString('en-IN')}`
                    : safeNum(card.value).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className='grid grid-cols-1 lg:grid-cols-5 gap-6'>

          {/* Top 10 bar chart */}
          <div className='lg:col-span-3 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6'>
            <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1'>
              Top 10 Performing Items
            </h2>
            <p className='text-xs text-gray-500 dark:text-zinc-400 mb-4'>By units sold · last 30 days</p>

            {loading ? (
              <div className='h-72 flex items-center justify-center'>
                <Loader2 className='animate-spin h-8 w-8 text-blue-600' />
              </div>
            ) : chartData.length === 0 ? (
              <div className='h-72 flex items-center justify-center flex-col gap-2'>
                <Package className='h-12 w-12 text-gray-300 dark:text-zinc-600' />
                <p className='text-sm text-gray-500 dark:text-zinc-400'>No data for this period</p>
              </div>
            ) : (
              <div className='h-72'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                    <XAxis
                      dataKey='item'
                      angle={-40}
                      textAnchor='end'
                      height={70}
                      interval={0}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                    />
                    <Tooltip content={<BarTooltip />} />
                    <Bar dataKey='unitsSold' radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Brand distribution pie chart */}
          <div className='lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6'>
            <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1'>
              Sales by Brand
            </h2>
            <p className='text-xs text-gray-500 dark:text-zinc-400 mb-4'>Units sold distribution · last 30 days</p>

            {loading ? (
              <div className='h-72 flex items-center justify-center'>
                <Loader2 className='animate-spin h-8 w-8 text-blue-600' />
              </div>
            ) : pieData.length === 0 ? (
              <div className='h-72 flex items-center justify-center flex-col gap-2'>
                <BarChart3 className='h-12 w-12 text-gray-300 dark:text-zinc-600' />
                <p className='text-sm text-gray-500 dark:text-zinc-400'>No brand data</p>
              </div>
            ) : (
              <div className='h-72'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey='value'
                      nameKey='name'
                      cx='50%'
                      cy='42%'
                      outerRadius={85}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={true}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Page;
