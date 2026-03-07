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
  <div className='flex rounded-full overflow-hidden h-3 w-full'>
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

// ─── SKU detail table (lowest + highest combined) ─────────────────────────────

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
            <th className='px-2 py-1.5 text-left text-gray-500 dark:text-zinc-400 font-medium'>SKU / Name</th>
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
                  <div className='font-medium text-gray-800 dark:text-zinc-200'>{s.sku_code}</div>
                  <div className='text-gray-400 dark:text-zinc-500 truncate max-w-[180px]'>{s.item_name}</div>
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

const DownloadButton = ({ accessToken, API }: { accessToken: string; API: string }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const download = async (breakdown: 'brand' | 'product') => {
    setLoading(breakdown);
    setOpen(false);
    try {
      const res = await fetch(`${API}/master/dashboard-kpi/download?breakdown=${breakdown}`, {
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
        {loading === 'brand' ? 'Exporting…' : loading === 'product' ? 'Exporting…' : 'Download'}
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
    {/* Stock classification */}
    <div className='mb-5'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-xs font-semibold text-gray-700 dark:text-zinc-200'>
          Stock Classification  ·  Weighted Avg Days Cover: {fmtDec(b.weighted_avg_days_cover, 1)}d
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

    {/* Additional metrics row */}
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

    {/* Lowest / highest 10 SKUs */}
    <SkuTable lowest={b.sku_lowest_10} highest={b.sku_highest_10} />
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const { isLoading, accessToken, user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardKPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const API = process.env.NEXT_PUBLIC_API_URL!;

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/master/dashboard-kpi`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [accessToken, API]);

  useEffect(() => { if (accessToken) fetchData(); }, [accessToken]);

  const toggleBrand = (brand: string) =>
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });

  // Auth gates
  if (isLoading) return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
      <Loader2 className='animate-spin h-10 w-10 text-blue-600' />
    </div>
  );

  if (!accessToken) {
    setTimeout(() => router.push('/login'), 3000);
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <div className='bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-md text-center'>
          <p className='text-xl text-gray-700 dark:text-zinc-300'>Please log in to see this content.</p>
          <p className='text-sm text-gray-500 dark:text-zinc-400 mt-1'>Redirecting to login…</p>
        </div>
      </div>
    );
  }

  const t = data?.totals;
  const period = data?.period;
  const gsc = data?.global_stock_classification;

  return (
    <div className='bg-gray-50 dark:bg-zinc-950 py-8'>
      <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>

        {/* ── Header ── */}
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
              {greeting()}, {user?.name}!
            </h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Stock Cover KPI · Last 90 days
              {period && ` · ${period.start_date} → ${period.end_date}`}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={fetchData}
              disabled={loading}
              className='flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors'
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {accessToken && <DownloadButton accessToken={accessToken} API={API} />}
          </div>
        </div>

        {/* ── Error ── */}
        {error && !loading && (
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3'>
            <XCircle className='h-5 w-5 text-red-500 flex-shrink-0' />
            <p className='text-sm text-red-700 dark:text-red-300'>{error}</p>
            <button onClick={fetchData} className='ml-auto text-sm text-red-600 dark:text-red-400 underline'>Retry</button>
          </div>
        )}

        {/* ── Summary KPI cards ── */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          {[
            { label: 'Net Sales (90d)', value: t?.net_sales, icon: <TrendingUp className='w-5 h-5 text-blue-500' />, fmt: 'num' },
            { label: 'Net Stock (Latest)', value: t?.latest_net_stock, icon: <Package className='w-5 h-5 text-green-500' />, fmt: 'num' },
            { label: 'Overall DRR', value: t?.drr, icon: <ArrowDownToLine className='w-5 h-5 text-purple-500' />, fmt: 'drr' },
            { label: 'Wtd. Avg Days Cover', value: t?.weighted_avg_days_cover, icon: <Layers className='w-5 h-5 text-amber-500' />, fmt: 'days' },
          ].map((c) => (
            <div key={c.label} className='bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center gap-2 mb-2'>{c.icon}<span className='text-xs text-gray-500 dark:text-zinc-400'>{c.label}</span></div>
              {loading
                ? <div className='h-7 w-24 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse' />
                : <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
                  {c.value == null ? '—'
                    : c.fmt === 'drr' ? fmtDec(c.value, 2)
                      : c.fmt === 'days' ? `${fmtDec(c.value, 1)}d`
                        : fmt(c.value)}
                </p>
              }
            </div>
          ))}
        </div>

        {/* ── Secondary metric cards ── */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          {[
            { label: 'Net Inv. Value', value: t?.net_sellable_inventory_value, icon: <DollarSign className='w-5 h-5 text-teal-500' />, fmt: 'currency' },
            { label: 'Return %', value: t?.return_pct, icon: <TrendingDown className='w-5 h-5 text-rose-500' />, fmt: 'pct' },
            { label: 'Missed Sales /day (units)', value: t?.missed_sales_daily_units, icon: <AlertTriangle className='w-5 h-5 text-orange-500' />, fmt: 'drr' },
            { label: 'Missed Sales /day (₹)', value: t?.missed_sales_daily_value, icon: <DollarSign className='w-5 h-5 text-orange-500' />, fmt: 'currency' },
          ].map((c) => (
            <div key={c.label} className='bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-4'>
              <div className='flex items-center gap-2 mb-2'>{c.icon}<span className='text-xs text-gray-500 dark:text-zinc-400'>{c.label}</span></div>
              {loading
                ? <div className='h-7 w-24 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse' />
                : <p className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
                  {c.value == null ? '—'
                    : c.fmt === 'currency' ? fmtCurrency(c.value)
                      : c.fmt === 'pct' ? fmtPct(c.value)
                        : c.fmt === 'drr' ? fmtDec(c.value, 2)
                          : fmt(c.value)}
                </p>
              }
            </div>
          ))}
        </div>

        {/* ── Global stock classification summary ── */}
        {gsc && !loading && (
          <div className='bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-5'>
            <div className='flex items-center justify-between mb-3'>
              <h2 className='text-sm font-semibold text-gray-900 dark:text-zinc-100'>
                Portfolio Stock Classification  ·  {t?.sku_count} SKUs
              </h2>
              <span className='text-xs text-gray-400 dark:text-zinc-500'>
                Reorder Risk = &lt;Lead Time · Healthy = 1–1.5× · Heavy = 1.5–2× · Overstock = 2–3× · Dead = &gt;3× or no sales
              </span>
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
        )}

        {/* ── Brand KPI table ── */}
        <div className='bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between'>
            <div>
              <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100'>Stock Cover by Brand</h2>
              <p className='text-xs text-gray-500 dark:text-zinc-400 mt-0.5'>
                Click a row to see classification breakdown + lowest/highest 10 SKUs &nbsp;·&nbsp;
                <span className='text-red-600 font-medium'>Red</span> = &lt;Lead Time &nbsp;·&nbsp;
                <span className='text-amber-600 font-medium'>Yellow</span> = &lt;Target Days
              </p>
            </div>
            {t && !loading && (
              <span className='text-xs text-gray-400 dark:text-zinc-500'>
                {t.brand_count} brands · {t.sku_count} SKUs
              </span>
            )}
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-16'>
              <Loader2 className='animate-spin h-8 w-8 text-blue-600' />
              <span className='ml-3 text-sm text-gray-500 dark:text-zinc-400'>Generating 90-day report…</span>
            </div>
          ) : !data || data.brands.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3'>
              <Package className='h-12 w-12 text-gray-300 dark:text-zinc-600' />
              <p className='text-sm text-gray-500 dark:text-zinc-400'>No data available</p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-gray-50 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400 uppercase'>
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
                    <tr className='bg-blue-50 dark:bg-blue-900/10 font-semibold text-gray-900 dark:text-zinc-100 border-b border-gray-200 dark:border-zinc-700'>
                      <td className='px-3 py-3' />
                      <td className='px-3 py-3 whitespace-nowrap'>All Brands</td>
                      <td className='px-3 py-3 text-right'>{fmt(t.sku_count)}</td>
                      <td className='px-3 py-3 text-right'>{fmt(t.net_sales)}</td>
                      <td className='px-3 py-3 text-right'>{fmtCurrency(t.revenue)}</td>
                      <td className='px-3 py-3 text-right'>{fmtDec(t.drr, 2)}</td>
                      <td className='px-3 py-3 text-right'>{fmt(t.latest_net_stock)}</td>
                      <td className='px-3 py-3 text-right'>{fmt(t.stock_in_transit)}</td>
                      <td className='px-3 py-3 text-right font-bold'>{fmtDec(t.weighted_avg_days_cover, 1)}d</td>
                      <td className='px-3 py-3' />
                      <td className='px-3 py-3 text-right'>{fmtPct(t.return_pct)}</td>
                      <td className='px-3 py-3 text-right'>—</td>
                      <td className='px-3 py-3 text-right'>{fmtDec(t.missed_sales_daily_units, 1)}</td>
                      <td className='px-3 py-3 text-right'>{fmtCurrency(t.missed_sales_daily_value)}</td>
                      <td className='px-3 py-3' />
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
                          <td className='px-3 py-3 font-medium text-gray-900 dark:text-zinc-100 whitespace-nowrap'>
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
                                  <span className='text-gray-500'>{b.stock_classification.counts.dead}💀</span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail */}
                        {expanded && (
                          <tr className='border-b border-gray-200 dark:border-zinc-700'>
                            <td colSpan={15} className='p-0'>
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
        <div className='text-xs text-gray-400 dark:text-zinc-500 flex flex-wrap gap-4'>
          <span><b className='text-gray-600 dark:text-zinc-300'>DRR</b> = Net Sales ÷ 90 days</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>W.Avg Cover</b> = stock-weighted average of per-SKU days cover</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Target</b> = Lead Time + Safety Days + 10</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Net Stock</b> = Zoho WH + FBA (latest snapshot)</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Net Sales</b> = Units Sold − Credit Notes − Transfer Orders</span>
          <span><b className='text-gray-600 dark:text-zinc-300'>Net Inv. Value</b> = Net Stock × Selling Price</span>
        </div>

      </div>
    </div>
  );
}
