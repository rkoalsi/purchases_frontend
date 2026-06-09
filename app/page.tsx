'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, MinusCircle,
  Loader2, RefreshCw, Download, TrendingUp, Package,
  Layers, ArrowDownToLine, ChevronDown, ChevronRight,
  TrendingDown, DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList,
} from 'recharts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { BRAND_GROUPS, BRAND_CONSTITUENTS } from '@/util/brandGroups';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkuDetail {
  sku_code: string;
  item_name: string;
  drr: number;
  net_stock: number;
  days_cover: number;
  excess_or_order: string;
  movement: string;
  stock_class: string;
}

type StockClassKey = 'reorder_risk' | 'healthy' | 'heavy' | 'overstock' | 'dead';

interface StockClassification {
  counts: Record<StockClassKey, number>;
  pct: Record<StockClassKey, number>;
}

interface BrandKPI {
  brand: string;
  sku_count: number;
  units_sold: number;
  units_returned: number;
  credit_notes: number;
  transfer_orders: number;
  net_sales: number;
  revenue: number;
  return_pct: number;
  growth_rate: number | null;
  drr: number;
  latest_net_stock: number;
  latest_zoho_stock: number;
  latest_fba_stock: number;
  net_sellable_inventory_value: number;
  stock_in_transit: number;
  total_cbm: number;
  days_cover: number;
  current_days_coverage: number;
  weighted_avg_days_cover: number;
  lead_time: number;
  safety_days: number;
  target_days: number;
  alert_level: number;
  order_count: number;
  excess_count: number;
  no_movement_count: number;
  fast_mover_count: number;
  medium_mover_count: number;
  slow_mover_count: number;
  missed_sales_units: number;
  missed_sales_daily_units: number;
  missed_sales_value_total: number;
  missed_sales_daily_value: number;
  stock_classification: StockClassification;
  sku_lowest_10: SkuDetail[];
  sku_highest_10: SkuDetail[];
}

interface Totals {
  brand_count: number;
  sku_count: number;
  units_sold: number;
  units_returned: number;
  net_sales: number;
  revenue: number;
  return_pct: number;
  drr: number;
  latest_net_stock: number;
  net_sellable_inventory_value: number;
  stock_in_transit: number;
  total_cbm: number;
  days_cover: number;
  current_days_coverage: number;
  weighted_avg_days_cover: number;
  missed_sales_daily_units: number;
  missed_sales_daily_value: number;
}

interface DashboardKPI {
  period: { start_date: string; end_date: string; days: number };
  brands: BrandKPI[];
  totals: Totals;
  global_stock_classification: StockClassification;
  latest_stock_dates: { zoho?: string; fba?: string };
}

// ─── Session cache ─────────────────────────────────────────────────────────────
// Caches each date-range response for 30 min so re-visits are instant.

const CACHE_TTL_MS = 30 * 60 * 1000;
const mkCacheKey = (s: string, e: string) => `dkpi::${s}::${e}`;

function readCache(s: string, e: string): DashboardKPI | null {
  try {
    const raw = sessionStorage.getItem(mkCacheKey(s, e));
    if (!raw) return null;
    const { ts, payload } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL_MS ? (payload as DashboardKPI) : null;
  } catch { return null; }
}

function writeCache(s: string, e: string, payload: DashboardKPI) {
  try { sessionStorage.setItem(mkCacheKey(s, e), JSON.stringify({ ts: Date.now(), payload })); }
  catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeNum = (v: any, fallback = 0): number => {
  if (typeof v === 'number' && !isNaN(v)) return v;
  const p = parseFloat(v);
  return isNaN(p) ? fallback : p;
};

const fmt = (n: any) => safeNum(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDec = (n: any, d = 1) =>
  safeNum(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtCurrency = (n: any) =>
  `₹${safeNum(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtPct = (n: any) =>
  `${safeNum(n).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// ─── Petfest brand merge ───────────────────────────────────────────────────────
// Only Catfest + Dogfest are merged into "Petfest". Barkbutler and FOFOS remain
// as separate brands on this page despite being in BRAND_GROUPS.

const PETFEST_MEMBERS = new Set(
  (BRAND_GROUPS['Petfest'] ?? []).map((s) => s.toLowerCase())
);

function mergePetfestBrands(brands: BrandKPI[]): BrandKPI[] {
  const petfestGroup = brands.filter((b) => PETFEST_MEMBERS.has(b.brand.toLowerCase()));
  const rest = brands.filter((b) => !PETFEST_MEMBERS.has(b.brand.toLowerCase()));
  if (petfestGroup.length === 0) return brands;

  const sumField = (f: keyof BrandKPI) =>
    petfestGroup.reduce((acc, b) => acc + safeNum(b[f]), 0);
  const sumClassCounts = (): Record<StockClassKey, number> => {
    const keys: StockClassKey[] = ['reorder_risk', 'healthy', 'heavy', 'overstock', 'dead'];
    const counts: Record<string, number> = {};
    for (const k of keys) counts[k] = petfestGroup.reduce((acc, b) => acc + safeNum(b.stock_classification.counts[k]), 0);
    return counts as Record<StockClassKey, number>;
  };

  const mergedCounts = sumClassCounts();
  const totalSkus = Object.values(mergedCounts).reduce((a, b) => a + b, 0);
  const mergedPct: Record<StockClassKey, number> = {} as any;
  for (const k of Object.keys(mergedCounts) as StockClassKey[]) {
    mergedPct[k] = totalSkus > 0 ? Math.round((mergedCounts[k] / totalSkus) * 100) : 0;
  }

  const totalUnits = sumField('units_sold') + sumField('units_returned');
  const mergedDrr = sumField('drr');
  const mergedStock = sumField('latest_net_stock');

  const merged: BrandKPI = {
    brand: 'Petfest',
    sku_count: sumField('sku_count'),
    units_sold: sumField('units_sold'),
    units_returned: sumField('units_returned'),
    credit_notes: sumField('credit_notes'),
    transfer_orders: sumField('transfer_orders'),
    net_sales: sumField('net_sales'),
    revenue: sumField('revenue'),
    return_pct: totalUnits > 0 ? (sumField('units_returned') / totalUnits) * 100 : 0,
    growth_rate: petfestGroup.every((b) => b.growth_rate === null)
      ? null
      : petfestGroup.filter((b) => b.growth_rate !== null).reduce((acc, b) => acc + safeNum(b.growth_rate), 0) /
        petfestGroup.filter((b) => b.growth_rate !== null).length,
    drr: mergedDrr,
    latest_net_stock: mergedStock,
    latest_zoho_stock: sumField('latest_zoho_stock'),
    latest_fba_stock: sumField('latest_fba_stock'),
    net_sellable_inventory_value: sumField('net_sellable_inventory_value'),
    stock_in_transit: sumField('stock_in_transit'),
    total_cbm: sumField('total_cbm'),
    days_cover: mergedDrr > 0 ? mergedStock / mergedDrr : 0,
    current_days_coverage: mergedDrr > 0 ? mergedStock / mergedDrr : 0,
    weighted_avg_days_cover: mergedStock > 0
      ? petfestGroup.reduce((acc, b) => acc + safeNum(b.latest_net_stock) * safeNum(b.weighted_avg_days_cover), 0) / mergedStock
      : 0,
    lead_time: Math.max(...petfestGroup.map((b) => b.lead_time)),
    safety_days: Math.max(...petfestGroup.map((b) => b.safety_days)),
    target_days: Math.max(...petfestGroup.map((b) => b.target_days)),
    alert_level: (() => {
      const mergedLeadTime = Math.max(...petfestGroup.map((b) => b.lead_time));
      const mergedTargetDays = Math.max(...petfestGroup.map((b) => b.target_days));
      const dc = mergedDrr > 0 ? mergedStock / mergedDrr : 0;
      if (mergedDrr === 0) return 3;
      if (dc < mergedLeadTime) return 2;
      if (dc < mergedTargetDays) return 1;
      return 0;
    })(),
    order_count: sumField('order_count'),
    excess_count: sumField('excess_count'),
    no_movement_count: sumField('no_movement_count'),
    fast_mover_count: sumField('fast_mover_count'),
    medium_mover_count: sumField('medium_mover_count'),
    slow_mover_count: sumField('slow_mover_count'),
    missed_sales_units: sumField('missed_sales_units'),
    missed_sales_daily_units: sumField('missed_sales_daily_units'),
    missed_sales_value_total: sumField('missed_sales_value_total'),
    missed_sales_daily_value: sumField('missed_sales_daily_value'),
    stock_classification: { counts: mergedCounts, pct: mergedPct },
    sku_lowest_10: petfestGroup.flatMap((b) => b.sku_lowest_10 ?? []),
    sku_highest_10: petfestGroup.flatMap((b) => b.sku_highest_10 ?? []),
  };

  return [...rest, merged].sort((a, b) => a.brand.localeCompare(b.brand));
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

// ─── Stock class config ────────────────────────────────────────────────────────

const CLASS_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  reorder_risk: { label: 'Reorder Risk', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500' },
  healthy: { label: 'Healthy', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30', bar: 'bg-green-500' },
  heavy: { label: 'Heavy', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30', bar: 'bg-amber-500' },
  overstock: { label: 'Overstock', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/30', bar: 'bg-orange-500' },
  dead: { label: 'Dead / No Sales', color: 'text-gray-500 dark:text-zinc-400', bg: 'bg-gray-100 dark:bg-zinc-800', bar: 'bg-gray-400' },
};
const CLASS_ORDER: StockClassKey[] = ['reorder_risk', 'healthy', 'heavy', 'overstock', 'dead'];

// ─── Alert badge ──────────────────────────────────────────────────────────────

const AlertBadge = ({ level, targetDays, leadTime }: {
  level: number; targetDays: number; leadTime: number;
}) => {
  if (level === 3) return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'>
      <MinusCircle className='w-3 h-3' /> No Movement
    </span>
  );
  if (level === 2) return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'>
      <XCircle className='w-3 h-3' /> Critical &lt;{leadTime}d
    </span>
  );
  if (level === 1) return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'>
      <AlertTriangle className='w-3 h-3' /> Caution &lt;{targetDays}d
    </span>
  );
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'>
      <CheckCircle2 className='w-3 h-3' /> OK
    </span>
  );
};

const rowBg = (level: number) => {
  if (level === 2) return 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100/70 dark:hover:bg-red-900/20';
  if (level === 1) return 'bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100/70 dark:hover:bg-amber-900/20';
  return 'hover:bg-gray-50 dark:hover:bg-zinc-800/50';
};

// ─── Stock classification bar ─────────────────────────────────────────────────

const ClassificationBar = ({ sc }: { sc: StockClassification }) => (
  <div className='flex rounded-full overflow-hidden h-4 w-full'>
    {CLASS_ORDER.map((k) => {
      const pct = sc.pct[k] || 0;
      if (pct === 0) return null;
      return (
        <div
          key={k}
          className={`${CLASS_CONFIG[k].bar} transition-all`}
          style={{ width: `${pct}%` }}
          title={`${CLASS_CONFIG[k].label}: ${sc.counts[k]} SKUs (${pct}%)`}
        />
      );
    })}
  </div>
);

// ─── SKU detail table ─────────────────────────────────────────────────────────

const SkuTable = ({ lowest, highest }: { lowest: SkuDetail[]; highest: SkuDetail[] }) => {
  if (!lowest.length && !highest.length) return null;
  const rows = [
    ...lowest.map((s) => ({ ...s, _type: 'risk' as const })),
    ...highest.map((s) => ({ ...s, _type: 'over' as const })),
  ];
  return (
    <div className='rounded-lg border border-gray-200 dark:border-zinc-700'>
      <table className='w-full text-xs'>
        <thead className='bg-gray-50 dark:bg-zinc-800'>
          <tr>
            <th className='px-2 py-1.5 text-left text-gray-500 dark:text-zinc-400 font-medium'>Name / SKU Code</th>
            <th className='px-2 py-1.5 text-left text-gray-500 dark:text-zinc-400 font-medium'>Type</th>
            <th className='px-2 py-1.5 text-right text-gray-500 dark:text-zinc-400 font-medium'>DRR</th>
            <th className='px-2 py-1.5 text-right text-gray-500 dark:text-zinc-400 font-medium'>Stock</th>
            <th className='px-2 py-1.5 text-right text-gray-500 dark:text-zinc-400 font-medium'>Days Cover</th>
            <th className='px-2 py-1.5 text-left text-gray-500 dark:text-zinc-400 font-medium'>Class</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100 dark:divide-zinc-700'>
          {rows.map((s) => {
            const cfg = CLASS_CONFIG[s.stock_class] || CLASS_CONFIG['healthy'];
            return (
              <tr key={`${s._type}-${s.sku_code}`} className='hover:bg-gray-50 dark:hover:bg-zinc-800/50'>
                <td className='px-2 py-1.5'>
                  <div className='font-medium text-gray-800 dark:text-zinc-200'>{s.item_name}</div>
                  <div className='text-gray-400 dark:text-zinc-500 max-w-[180px]'>{s.sku_code}</div>
                </td>
                <td className='px-2 py-1.5'>
                  {s._type === 'risk'
                    ? <span className='px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'>At Risk</span>
                    : <span className='px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'>Overstocked</span>
                  }
                </td>
                <td className='px-2 py-1.5 text-right text-gray-700 dark:text-zinc-300'>{fmtDec(s.drr, 2)}</td>
                <td className='px-2 py-1.5 text-right text-gray-700 dark:text-zinc-300'>{fmt(s.net_stock)}</td>
                <td className={`px-2 py-1.5 text-right font-semibold ${cfg.color}`}>{fmtDec(s.days_cover, 1)}d</td>
                <td className='px-2 py-1.5'>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Download button with dropdown ────────────────────────────────────────────

const DownloadButton = ({ accessToken, API, startDate, endDate }: {
  accessToken: string; API: string; startDate: string; endDate: string;
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const download = async (breakdown: 'brand' | 'product') => {
    setLoading(breakdown);
    setOpen(false);
    try {
      const res = await fetch(`${API}/master/dashboard-kpi/download?breakdown=${breakdown}&start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock_cover_kpi_${breakdown}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className='relative'>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!!loading}
        className='flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors'
      >
        {loading ? <Loader2 className='w-4 h-4 animate-spin' /> : <Download className='w-4 h-4' />}
        {loading ? 'Exporting…' : 'Download'}
        <ChevronDown className='w-3 h-3' />
      </button>
      {open && (
        <div className='absolute right-0 mt-1 w-52 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-10'>
          <button
            onClick={() => download('brand')}
            className='w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2 rounded-t-lg'
          >
            <Layers className='w-4 h-4 text-blue-500' /> Brand-wise breakdown
          </button>
          <button
            onClick={() => download('product')}
            className='w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2 rounded-b-lg border-t border-gray-100 dark:border-zinc-700'
          >
            <Package className='w-4 h-4 text-purple-500' /> Product-wise breakdown
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Expanded brand detail row ─────────────────────────────────────────────────

const BrandDetail = ({ b }: { b: BrandKPI }) => (
  <div className='px-6 py-5 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-200 dark:border-zinc-700'>
    <div className='mb-5'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-xs font-semibold text-gray-700 dark:text-zinc-200'>
          Stock Classification  ·  W.Avg Cover: {fmtDec(b.weighted_avg_days_cover, 1)}d  ·  Cur. Cover: {fmtDec(b.current_days_coverage, 1)}d
        </span>
        <span className='text-xs text-gray-400 dark:text-zinc-500'>
          Lead Time: {b.lead_time}d  ·  Target: {b.target_days}d  (lead + {b.safety_days}d safety + 10d review)
        </span>
      </div>
      <ClassificationBar sc={b.stock_classification} />
      <div className='flex flex-wrap gap-3 mt-2'>
        {CLASS_ORDER.map((k) => {
          const c = b.stock_classification.counts[k];
          const p = b.stock_classification.pct[k];
          const cfg = CLASS_CONFIG[k];
          return (
            <div key={k} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.bar}`} />
              {cfg.label}: {c} ({p}%)
            </div>
          );
        })}
      </div>
    </div>

    <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5'>
      {[
        { label: 'Net Inv. Value', value: fmtCurrency(b.net_sellable_inventory_value) },
        { label: 'Total CBM (orders)', value: fmtDec(b.total_cbm, 2) },
        { label: 'Missed Sales /day (units)', value: fmtDec(b.missed_sales_daily_units, 2) },
        { label: 'Missed Sales /day (₹)', value: fmtCurrency(b.missed_sales_daily_value) },
      ].map((m) => (
        <div key={m.label} className='bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2'>
          <div className='text-xs text-gray-500 dark:text-zinc-400'>{m.label}</div>
          <div className='font-semibold text-gray-900 dark:text-zinc-100 text-sm'>{m.value}</div>
        </div>
      ))}
    </div>

    <SkuTable lowest={b.sku_lowest_10} highest={b.sku_highest_10} />
  </div>
);

// ─── Brand colours ────────────────────────────────────────────────────────────

const BRAND_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#6366f1', '#a78bfa', '#34d399', '#fb923c', '#f87171',
];

// ─── Revenue donut chart ───────────────────────────────────────────────────────

const RevenueDonut = ({ brands }: { brands: BrandKPI[] }) => {
  const chartData = brands
    .filter((b) => b.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .map((b, i) => ({ name: b.brand, value: b.revenue, color: BRAND_COLORS[i % BRAND_COLORS.length] }));
  const total = chartData.reduce((s, d) => s + d.value, 0);
  if (!chartData.length) return null;
  return (
    <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 flex flex-col shadow-sm'>
      <h2 className='text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-3'>Revenue by Brand</h2>
      <ResponsiveContainer width='100%' height={260}>
        <PieChart>
          <Pie data={chartData} cx='50%' cy='50%' innerRadius={75} outerRadius={110} dataKey='value' paddingAngle={2}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <ReTooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5' }}
            itemStyle={{ color: '#a1a1aa' }}
            labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
            formatter={(val: number, name: string) => [
              `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${((val / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className='flex flex-wrap gap-x-5 gap-y-2 justify-center mt-3'>
        {chartData.map((d) => (
          <div key={d.name} className='flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400'>
            <span className='w-2.5 h-2.5 rounded-sm flex-shrink-0' style={{ backgroundColor: d.color }} />
            <span className='font-medium text-gray-700 dark:text-zinc-300'>{d.name}</span>
            <span className='text-gray-400 dark:text-zinc-500'>({((d.value / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Days cover vs target bar chart ───────────────────────────────────────────

const DaysCoverChart = ({ brands }: { brands: BrandKPI[] }) => {
  const chartData = [...brands]
    .sort((a, b) => a.brand.localeCompare(b.brand))
    .filter((b) => b.alert_level !== 3)
    .map((b) => ({
      brand: b.brand,
      cover: Math.round(b.weighted_avg_days_cover * 10) / 10,
      target: b.target_days,
      lead_time: b.lead_time,
    }));
  if (!chartData.length) return null;
  const h = Math.max(200, chartData.length * 52 + 40);
  const coverColor = (cover: number, target: number, leadTime: number) =>
    cover < leadTime ? '#f87171' : cover < target ? '#fbbf24' : '#34d399';
  return (
    <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm'>
      <h2 className='text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-1'>W. Avg Days of Cover vs Target</h2>
      <div className='flex items-center gap-4 mb-3'>
        <span className='flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500'>
          <span className='inline-block w-3 h-2 rounded-sm bg-slate-500 opacity-60' />
          Target days
        </span>
        <span className='flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500'>
          <span className='inline-block w-3 h-2 rounded-sm bg-emerald-400' />
          Healthy &nbsp;
          <span className='inline-block w-3 h-2 rounded-sm bg-amber-400' />
          Caution &nbsp;
          <span className='inline-block w-3 h-2 rounded-sm bg-red-400' />
          Critical
        </span>
      </div>
      <ResponsiveContainer width='100%' height={h}>
        <BarChart data={chartData} layout='vertical' margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barGap={6} barCategoryGap='30%'>
          <XAxis type='number' tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis type='category' dataKey='brand' width={150} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <ReTooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5', fontSize: 12 }}
            itemStyle={{ color: '#a1a1aa' }}
            labelStyle={{ color: '#f4f4f5', fontWeight: 600, marginBottom: 4 }}
            formatter={(val: number, name: string) => [`${val}d`, name === 'cover' ? 'W.Avg Cover' : 'Target']}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey='target' fill='#475569' fillOpacity={0.55} radius={[0, 3, 3, 0]} maxBarSize={12}>
            <LabelList dataKey='target' position='right' formatter={(v: number) => `${v}d`} style={{ fontSize: 9, fill: '#6b7280' }} />
          </Bar>
          <Bar dataKey='cover' radius={[0, 3, 3, 0]} maxBarSize={20}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={coverColor(d.cover, d.target, d.lead_time)} />
            ))}
            <LabelList dataKey='cover' position='right' formatter={(v: number) => `${v}d`} style={{ fontSize: 10, fill: '#d1d5db', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── ORDER / EXCESS / No Movement chart ──────────────────────────────────────

const OrderExcessChart = ({ brands }: { brands: BrandKPI[] }) => {
  const chartData = [...brands]
    .sort((a, b) => a.brand.localeCompare(b.brand))
    .map((b) => ({
      brand: b.brand,
      order: b.order_count,
      excess: b.excess_count,
      no_movement: b.no_movement_count,
    }));
  if (!chartData.length) return null;
  const h = Math.max(180, chartData.length * 52 + 40);
  return (
    <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm'>
      <h2 className='text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-1'>ORDER / EXCESS / No Movement — SKU Count</h2>
      <div className='flex items-center gap-4 mb-3'>
        {[
          { label: 'ORDER', color: 'bg-blue-500' },
          { label: 'EXCESS', color: 'bg-orange-400' },
          { label: 'No Movement', color: 'bg-gray-400' },
        ].map((l) => (
          <span key={l.label} className='flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500'>
            <span className={`inline-block w-3 h-2 rounded-sm ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width='100%' height={h}>
        <BarChart data={chartData} layout='vertical' margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barGap={3} barCategoryGap='28%'>
          <XAxis type='number' tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type='category' dataKey='brand' width={150} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <ReTooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5', fontSize: 12 }}
            itemStyle={{ color: '#a1a1aa' }}
            labelStyle={{ color: '#f4f4f5', fontWeight: 600, marginBottom: 4 }}
            formatter={(val: number, name: string) => [
              val,
              name === 'order' ? 'ORDER' : name === 'excess' ? 'EXCESS' : 'No Movement',
            ]}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey='order' fill='#3b82f6' radius={[0, 3, 3, 0]} maxBarSize={12}>
            <LabelList dataKey='order' position='right' style={{ fontSize: 10, fill: '#6b7280' }}
              formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
          <Bar dataKey='excess' fill='#f97316' radius={[0, 3, 3, 0]} maxBarSize={12}>
            <LabelList dataKey='excess' position='right' style={{ fontSize: 10, fill: '#6b7280' }}
              formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
          <Bar dataKey='no_movement' fill='#9ca3af' radius={[0, 3, 3, 0]} maxBarSize={12}>
            <LabelList dataKey='no_movement' position='right' style={{ fontSize: 10, fill: '#6b7280' }}
              formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  displayValue: string | null;
  icon: React.ReactNode;
  accentBg: string;   // top-strip colour, e.g. 'bg-blue-500'
  iconWrap: string;   // icon container classes, e.g. 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
  loading: boolean;
  sub?: string;
}

const KpiCard = ({ label, displayValue, icon, accentBg, iconWrap, loading, sub }: KpiCardProps) => (
  <div className='relative bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm overflow-hidden'>
    <div className={`absolute inset-x-0 top-0 h-1 ${accentBg}`} />
    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-4 ${iconWrap}`}>
      {icon}
    </div>
    <p className='text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 uppercase tracking-wide'>{label}</p>
    {loading ? (
      <div className='h-8 w-32 bg-gray-100 dark:bg-zinc-800 rounded-lg animate-pulse mt-1' />
    ) : (
      <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-none'>
        {displayValue ?? '—'}
      </p>
    )}
    {sub && !loading && (
      <p className='text-xs text-gray-400 dark:text-zinc-500 mt-2'>{sub}</p>
    )}
  </div>
);

// ─── Date helpers & presets ────────────────────────────────────────────────────

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const prevSundayDate = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  const d = new Date(today);
  d.setDate(today.getDate() - daysSinceSunday);
  return d;
};

const DATE_PRESETS = [
  {
    label: 'Last 30 Days', sub: '30 days',
    getDates: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 29); return { start: fmtDate(s), end: fmtDate(e) }; },
  },
  {
    label: 'Last Month', sub: 'prev month',
    getDates: () => { const e = new Date(); e.setDate(0); const s = new Date(e.getFullYear(), e.getMonth(), 1); return { start: fmtDate(s), end: fmtDate(e) }; },
  },
  {
    label: 'Last 90 Days', sub: 'ends Sunday',
    getDates: () => { const ps = prevSundayDate(); const s = new Date(ps); s.setDate(ps.getDate() - 89); return { start: fmtDate(s), end: fmtDate(ps) }; },
  },
  {
    label: 'Last 6 Months', sub: '180 days',
    getDates: () => { const e = new Date(); const s = new Date(); s.setMonth(s.getMonth() - 6); return { start: fmtDate(s), end: fmtDate(e) }; },
  },
  {
    label: 'This Year', sub: 'Jan – today',
    getDates: () => { const e = new Date(); const s = new Date(e.getFullYear(), 0, 1); return { start: fmtDate(s), end: fmtDate(e) }; },
  },
  {
    label: 'Last Year', sub: 'full year',
    getDates: () => { const yr = new Date().getFullYear() - 1; return { start: fmtDate(new Date(yr, 0, 1)), end: fmtDate(new Date(yr, 11, 31)) }; },
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  usePageTitle('Dashboard');
  const { isLoading, accessToken, user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardKPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [hasDashboardAccess, setHasDashboardAccess] = useState<boolean | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const ps = prevSundayDate();
    const s = new Date(ps);
    s.setDate(ps.getDate() - 89);
    return fmtDate(s);
  });
  const [endDate, setEndDate] = useState(() => fmtDate(prevSundayDate()));

  const API = process.env.NEXT_PUBLIC_API_URL!;

  const fetchData = useCallback(async (sd?: string, ed?: string, forceRefresh = false) => {
    if (!accessToken) return;
    const s = sd ?? startDate;
    const e = ed ?? endDate;

    // Serve from cache when available (skip on manual refresh)
    if (!forceRefresh) {
      const cached = readCache(s, e);
      if (cached) {
        const processed = { ...cached, brands: mergePetfestBrands(cached.brands) };
        setData(processed);
        setFromCache(true);
        return;
      }
    }

    setFromCache(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/master/dashboard-kpi?start_date=${s}&end_date=${e}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const raw: DashboardKPI = await res.json();
      writeCache(s, e, raw);
      if (raw?.brands) raw.brands = mergePetfestBrands(raw.brands);
      setData(raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [accessToken, API, startDate, endDate]);

  // Permission check — runs in parallel with data fetch; does NOT block rendering
  useEffect(() => {
    if (!accessToken || !user) return;
    fetch(`${API}/users/permissions`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((allPerms: any[]) => {
        const userPerms = allPerms.filter((p) => user.permissions?.includes(p._id));
        setHasDashboardAccess(userPerms.some((p) => p.name === 'dashboard'));
      })
      .catch(() => setHasDashboardAccess(false));
  }, [accessToken, user]);

  // Data fetch starts immediately — does not wait for permission check
  useEffect(() => { if (accessToken) fetchData(); }, [accessToken]);

  const toggleBrand = (brand: string) =>
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });

  // Auth gates — only hard-block on definitive auth states
  if (isLoading) return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
      <Loader2 className='animate-spin h-10 w-10 text-blue-600' />
    </div>
  );

  if (!accessToken) {
    router.push('/login');
    return null;
  }

  // Redirect only once we definitively know access is denied
  if (hasDashboardAccess === false) {
    router.replace('/no-access');
    return null;
  }

  // While permission check is still pending, show same skeleton as data loading
  const showSkeleton = hasDashboardAccess === null || loading;

  const t = data?.totals;
  const gsc = data?.global_stock_classification;

  return (
    <div className='bg-gray-50 dark:bg-zinc-950 py-8'>
      <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>

        {/* ── Header ── */}
        <div className='space-y-3'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 dark:text-zinc-100'>
                {greeting()}, {user?.name?.split(' ')[0]}
              </h1>
              <div className='flex items-center gap-2 mt-1.5 flex-wrap'>
                <span className='text-sm text-gray-500 dark:text-zinc-400'>Stock Cover KPI</span>
                <span className='text-gray-300 dark:text-zinc-600'>·</span>
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'>
                  {startDate} → {endDate}
                </span>
                {fromCache && !loading && (
                  <span className='text-xs text-gray-400 dark:text-zinc-500 italic'>cached</span>
                )}
              </div>
            </div>
            <div className='flex items-center gap-2 flex-shrink-0'>
              <button
                onClick={() => fetchData(undefined, undefined, true)}
                disabled={loading}
                className='flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors shadow-sm'
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {accessToken && <DownloadButton accessToken={accessToken} API={API} startDate={startDate} endDate={endDate} />}
            </div>
          </div>

          {/* ── Date picker ── */}
          <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-3 flex flex-col gap-3 shadow-sm'>
            <div className='flex flex-wrap gap-1.5'>
              {DATE_PRESETS.map((p) => {
                const d = p.getDates();
                const active = d.start === startDate && d.end === endDate;
                return (
                  <button
                    key={p.label}
                    onClick={() => {
                      setStartDate(d.start);
                      setEndDate(d.end);
                      fetchData(d.start, d.end);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {p.label}
                    <span className='ml-1 opacity-60'>{p.sub}</span>
                  </button>
                );
              })}
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <input
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className='flex-1 min-w-[130px] px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
              />
              <span className='text-xs text-gray-400 dark:text-zinc-500'>to</span>
              <input
                type='date'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className='flex-1 min-w-[130px] px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
              />
              <button
                onClick={() => fetchData()}
                disabled={loading}
                className='px-3 py-1 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors'
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && !loading && (
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3'>
            <XCircle className='h-5 w-5 text-red-500 flex-shrink-0' />
            <p className='text-sm text-red-700 dark:text-red-300'>{error}</p>
            <button onClick={() => fetchData()} className='ml-auto text-sm text-red-600 dark:text-red-400 underline'>Retry</button>
          </div>
        )}

        {/* ── Primary KPI cards ── */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          <KpiCard
            label='Net Sales'
            displayValue={t ? fmt(t.net_sales) : null}
            icon={<TrendingUp className='w-5 h-5' />}
            accentBg='bg-blue-500'
            iconWrap='bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            loading={showSkeleton}
            sub={t ? `${fmt(t.units_sold)} units sold` : undefined}
          />
          <KpiCard
            label='Net Stock (Latest)'
            displayValue={t ? fmt(t.latest_net_stock) : null}
            icon={<Package className='w-5 h-5' />}
            accentBg='bg-emerald-500'
            iconWrap='bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            loading={showSkeleton}
            sub={t ? `Transit: ${fmt(t.stock_in_transit)}` : undefined}
          />
          <KpiCard
            label='Overall DRR'
            displayValue={t ? fmtDec(t.drr, 2) : null}
            icon={<ArrowDownToLine className='w-5 h-5' />}
            accentBg='bg-violet-500'
            iconWrap='bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
            loading={showSkeleton}
            sub='units per day'
          />
          <KpiCard
            label='Wtd. Avg Days Cover'
            displayValue={t ? `${fmtDec(t.weighted_avg_days_cover, 1)}d` : null}
            icon={<Layers className='w-5 h-5' />}
            accentBg='bg-amber-500'
            iconWrap='bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            loading={showSkeleton}
            sub={t ? `Cur. Cover: ${fmtDec(t.current_days_coverage, 1)}d` : undefined}
          />
        </div>

        {/* ── Secondary KPI cards ── */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          <KpiCard
            label='Net Inv. Value'
            displayValue={t ? fmtCurrency(t.net_sellable_inventory_value) : null}
            icon={<DollarSign className='w-5 h-5' />}
            accentBg='bg-teal-500'
            iconWrap='bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
            loading={showSkeleton}
          />
          <KpiCard
            label='Return %'
            displayValue={t ? fmtPct(t.return_pct) : null}
            icon={<TrendingDown className='w-5 h-5' />}
            accentBg='bg-rose-500'
            iconWrap='bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
            loading={showSkeleton}
            sub={t ? `${fmt(t.units_returned)} returned` : undefined}
          />
          <KpiCard
            label='Missed Sales /day (units)'
            displayValue={t ? fmtDec(t.missed_sales_daily_units, 2) : null}
            icon={<AlertTriangle className='w-5 h-5' />}
            accentBg='bg-orange-500'
            iconWrap='bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
            loading={showSkeleton}
          />
          <KpiCard
            label='Missed Sales /day (₹)'
            displayValue={t ? fmtCurrency(t.missed_sales_daily_value) : null}
            icon={<DollarSign className='w-5 h-5' />}
            accentBg='bg-orange-400'
            iconWrap='bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
            loading={showSkeleton}
          />
        </div>

        {/* ── Charts ── */}
        {data && !showSkeleton && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 items-start'>
            <div className='flex flex-col gap-4'>
              <RevenueDonut brands={data.brands} />
              <OrderExcessChart brands={data.brands} />
            </div>
            <DaysCoverChart brands={data.brands} />
          </div>
        )}
        {showSkeleton && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            <div className='flex flex-col gap-4'>
              <div className='h-[380px] bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm animate-pulse' />
              <div className='h-[240px] bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm animate-pulse' />
            </div>
            <div className='h-[380px] bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm animate-pulse' />
          </div>
        )}

        {/* ── Global stock classification ── */}
        {gsc && !showSkeleton ? (
          <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm'>
            <div className='flex flex-wrap items-start justify-between gap-2 mb-4'>
              <div>
                <h2 className='text-sm font-semibold text-gray-900 dark:text-zinc-100'>
                  Portfolio Stock Classification
                </h2>
                <p className='text-xs text-gray-400 dark:text-zinc-500 mt-0.5'>
                  {t?.sku_count} SKUs · Reorder Risk = &lt;Lead Time · Healthy = 1–1.5× · Heavy = 1.5–2× · Overstock = 2–3× · Dead = &gt;3×
                </p>
              </div>
            </div>
            <ClassificationBar sc={gsc} />
            <div className='flex flex-wrap gap-3 mt-3'>
              {CLASS_ORDER.map((k) => {
                const c = gsc.counts[k];
                const p = gsc.pct[k];
                const cfg = CLASS_CONFIG[k];
                return (
                  <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.bar}`} />
                    {cfg.label}: <span className='font-bold ml-1'>{c}</span> <span className='opacity-70'>({p}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : showSkeleton ? (
          <div className='h-28 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm animate-pulse' />
        ) : null}

        {/* ── Brand KPI table ── */}
        <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm'>
          <div className='px-3 sm:px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-start justify-between gap-2'>
            <div>
              <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100'>Stock Cover by Brand</h2>
              <p className='text-xs text-gray-500 dark:text-zinc-400 mt-0.5'>
                Tap a row to see classification breakdown + lowest/highest 10 SKUs &nbsp;·&nbsp;
                <span className='text-red-600 font-medium'>Red</span> = &lt;Lead Time &nbsp;·&nbsp;
                <span className='text-amber-600 font-medium'>Yellow</span> = &lt;Target Days
              </p>
            </div>
            {t && !showSkeleton && (
              <span className='text-xs text-gray-400 dark:text-zinc-500 flex-shrink-0 bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-gray-200 dark:border-zinc-700'>
                {t.brand_count} brands · {t.sku_count} SKUs
              </span>
            )}
          </div>

          {showSkeleton ? (
            <div className='flex items-center justify-center py-16'>
              <Loader2 className='animate-spin h-8 w-8 text-blue-600' />
              <span className='ml-3 text-sm text-gray-500 dark:text-zinc-400'>Generating report…</span>
            </div>
          ) : !data || data.brands.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3'>
              <Package className='h-12 w-12 text-gray-300 dark:text-zinc-600' />
              <p className='text-sm text-gray-500 dark:text-zinc-400'>No data available</p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400 uppercase shadow-[0_1px_0_0] shadow-gray-200 dark:shadow-zinc-700'>
                  <tr>
                    <th className='px-3 py-3 text-left font-medium w-8' />
                    <th className='px-3 py-3 text-left font-medium whitespace-nowrap'>Brand</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>SKUs</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Net Sales</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Revenue</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>DRR</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Net Stock</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Transit</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>W.Avg Cover</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Cur. Cover</th>
                    <th className='px-3 py-3 text-left font-medium whitespace-nowrap'>Status</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Return %</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Growth %</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Miss./day (u)</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Miss./day (₹)</th>
                    <th className='px-3 py-3 text-right font-medium whitespace-nowrap'>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Totals row */}
                  {t && (
                    <tr className='bg-blue-50 dark:bg-blue-900/15 font-semibold text-gray-900 dark:text-zinc-100 border-b-2 border-blue-200 dark:border-blue-800'>
                      <td className='px-3 py-3.5' />
                      <td className='px-3 py-3.5 whitespace-nowrap text-blue-700 dark:text-blue-300'>All Brands</td>
                      <td className='px-3 py-3.5 text-right'>{fmt(t.sku_count)}</td>
                      <td className='px-3 py-3.5 text-right'>{fmt(t.net_sales)}</td>
                      <td className='px-3 py-3.5 text-right'>{fmtCurrency(t.revenue)}</td>
                      <td className='px-3 py-3.5 text-right'>{fmtDec(t.drr, 2)}</td>
                      <td className='px-3 py-3.5 text-right'>{fmt(t.latest_net_stock)}</td>
                      <td className='px-3 py-3.5 text-right'>{fmt(t.stock_in_transit)}</td>
                      <td className='px-3 py-3.5 text-right font-bold text-blue-700 dark:text-blue-300'>{fmtDec(t.weighted_avg_days_cover, 1)}d</td>
                      <td className='px-3 py-3.5 text-right font-bold text-blue-700 dark:text-blue-300'>{fmtDec(t.current_days_coverage, 1)}d</td>
                      <td className='px-3 py-3.5' />
                      <td className='px-3 py-3.5 text-right'>{fmtPct(t.return_pct)}</td>
                      <td className='px-3 py-3.5 text-right'>—</td>
                      <td className='px-3 py-3.5 text-right'>{fmtDec(t.missed_sales_daily_units, 1)}</td>
                      <td className='px-3 py-3.5 text-right'>{fmtCurrency(t.missed_sales_daily_value)}</td>
                      <td className='px-3 py-3.5' />
                    </tr>
                  )}

                  {/* Brand rows */}
                  {data.brands.map((b) => {
                    const expanded = expandedBrands.has(b.brand);
                    return (
                      <React.Fragment key={b.brand}>
                        <tr
                          className={`${rowBg(b.alert_level)} transition-colors cursor-pointer border-b border-gray-100 dark:border-zinc-800`}
                          onClick={() => toggleBrand(b.brand)}
                        >
                          <td className='px-3 py-3 text-gray-400 dark:text-zinc-500'>
                            {expanded
                              ? <ChevronDown className='w-4 h-4' />
                              : <ChevronRight className='w-4 h-4' />}
                          </td>
                          <td className='px-3 py-3 font-semibold text-gray-900 dark:text-zinc-100 whitespace-nowrap'>
                            {b.brand}
                          </td>
                          <td className='px-3 py-3 text-right text-gray-600 dark:text-zinc-300'>{b.sku_count}</td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmt(b.net_sales)}</td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmtCurrency(b.revenue)}</td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmtDec(b.drr, 2)}</td>
                          <td className='px-3 py-3 text-right'>
                            <div className='text-gray-700 dark:text-zinc-200'>{fmt(b.latest_net_stock)}</div>
                            <div className='text-xs text-gray-400 dark:text-zinc-500'>
                              WH {fmt(b.latest_zoho_stock)} + FBA {fmt(b.latest_fba_stock)}
                            </div>
                          </td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmt(b.stock_in_transit)}</td>
                          <td className='px-3 py-3 text-right'>
                            <span className={`font-semibold ${b.alert_level === 2 ? 'text-red-600 dark:text-red-400'
                              : b.alert_level === 1 ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-700 dark:text-zinc-200'
                              }`}>
                              {b.alert_level === 3 ? '—' : `${fmtDec(b.weighted_avg_days_cover, 1)}d`}
                            </span>
                          </td>
                          <td className='px-3 py-3 text-right'>
                            <span className={`font-semibold ${b.alert_level === 2 ? 'text-red-600 dark:text-red-400'
                              : b.alert_level === 1 ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-700 dark:text-zinc-200'
                              }`}>
                              {b.alert_level === 3 ? '—' : `${fmtDec(b.current_days_coverage, 1)}d`}
                            </span>
                          </td>
                          <td className='px-3 py-3 whitespace-nowrap'>
                            <AlertBadge level={b.alert_level} targetDays={b.target_days} leadTime={b.lead_time} />
                          </td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmtPct(b.return_pct)}</td>
                          <td className='px-3 py-3 text-right'>
                            {b.growth_rate == null ? (
                              <span className='text-gray-400 dark:text-zinc-500'>—</span>
                            ) : (
                              <span className={b.growth_rate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {b.growth_rate >= 0 ? '+' : ''}{fmtDec(b.growth_rate, 1)}%
                              </span>
                            )}
                          </td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmtDec(b.missed_sales_daily_units, 1)}</td>
                          <td className='px-3 py-3 text-right text-gray-700 dark:text-zinc-200'>{fmtCurrency(b.missed_sales_daily_value)}</td>
                          <td className='px-3 py-3'>
                            <div className='w-28'>
                              <ClassificationBar sc={b.stock_classification} />
                              <div className='text-xs text-gray-400 dark:text-zinc-500 mt-0.5 text-center'>
                                {b.stock_classification.counts.reorder_risk > 0 && (
                                  <span className='text-red-600 font-medium'>{b.stock_classification.counts.reorder_risk}↓ </span>
                                )}
                                {b.stock_classification.counts.dead > 0 && (
                                  <span className='text-gray-500'>{b.stock_classification.counts.dead} dead</span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className='border-b border-gray-200 dark:border-zinc-700'>
                            <td colSpan={16} className='p-0'>
                              <BrandDetail b={b} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Legend ── */}
        <div className='text-xs text-gray-400 dark:text-zinc-500 flex flex-wrap gap-4 pb-2'>
          <span><b className='text-gray-600 dark:text-zinc-300'>DRR</b> = Σ per-SKU (Units Sold − Credit Notes) ÷ Days In Stock — matches master report</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>W.Avg Cover</b> = stock-weighted average of per-SKU days cover</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Cur. Cover</b> = (Net Stock + Transit) ÷ DRR</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Target</b> = Lead Time + Safety Days + 10</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Net Stock</b> = Zoho WH + FBA (latest snapshot)</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Net Sales</b> = Units Sold − Credit Notes − Transfer Orders</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Net Inv. Value</b> = Net Stock × Selling Price</span>
        </div>

      </div>
    </div>
  );
}
