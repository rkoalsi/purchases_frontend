'use client';

import { useAuth } from '@/components/context/AuthContext';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

function fmt(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const PRESETS = [
    {
        label: 'Last 30 Days',
        sub: '30 days',
        getDates: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 29);
            return { start: fmt(start), end: fmt(end) };
        },
    },
    {
        label: 'Last Month',
        sub: 'prev month',
        getDates: () => {
            const end = new Date();
            end.setDate(0);
            const start = new Date(end.getFullYear(), end.getMonth(), 1);
            return { start: fmt(start), end: fmt(end) };
        },
    },
    {
        label: 'Last 90 Days',
        sub: 'ends Sunday',
        getDates: () => {
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0=Sun
            const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
            const prevSunday = new Date(today);
            prevSunday.setDate(today.getDate() - daysSinceSunday);
            const start = new Date(prevSunday);
            start.setDate(prevSunday.getDate() - 89); // inclusive 90-day window
            return { start: fmt(start), end: fmt(prevSunday) };
        },
    },
    {
        label: 'Last 6 Months',
        sub: '180 days',
        getDates: () => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 6);
            return { start: fmt(start), end: fmt(end) };
        },
    },
    {
        label: 'This Year',
        sub: 'Jan – today',
        getDates: () => {
            const end = new Date();
            const start = new Date(end.getFullYear(), 0, 1);
            return { start: fmt(start), end: fmt(end) };
        },
    },
    {
        label: 'Last Year',
        sub: 'full year',
        getDates: () => {
            const yr = new Date().getFullYear() - 1;
            return { start: fmt(new Date(yr, 0, 1)), end: fmt(new Date(yr, 11, 31)) };
        },
    },
];

// ─── Accordion helpers ────────────────────────────────────────────────────────

function AccordionSection({
    title,
    open,
    onToggle,
    children,
}: {
    title: React.ReactNode;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            >
                <span>{title}</span>
                <svg
                    className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="px-3 sm:px-4 pb-4 pt-1 text-sm text-gray-700 dark:text-gray-300">{children}</div>}
        </div>
    );
}

function ColRow({ name, desc, formula }: { name: string; desc: string; formula?: string }) {
    return (
        <div className="py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-gray-800 dark:text-gray-200 shrink-0">{name}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{desc}</span>
            </div>
            {formula && (
                <code className="block mt-0.5 text-[11px] text-purple-700 dark:text-purple-400 font-mono bg-purple-50 dark:bg-purple-900/20 rounded px-1.5 py-0.5 whitespace-pre-wrap">
                    {formula}
                </code>
            )}
        </div>
    );
}

function ColGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-3 first:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{title}</p>
            <div>{children}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MasterReport() {
    const { accessToken } = useAuth();

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const toggleSection = (key: string) =>
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
        const prevSunday = new Date(today);
        prevSunday.setDate(today.getDate() - daysSinceSunday);
        const start = new Date(prevSunday);
        start.setDate(prevSunday.getDate() - 89);
        return fmt(start);
    });
    const [endDate, setEndDate] = useState(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
        const prevSunday = new Date(today);
        prevSunday.setDate(today.getDate() - daysSinceSunday);
        return fmt(prevSunday);
    });

    const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        axios
            .get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            .then((res) => setBrands(res.data.brands || []))
            .catch(() => {});
    }, [accessToken]);

    const applyPreset = (preset: typeof PRESETS[0]) => {
        const { start, end } = preset.getDates();
        setStartDate(start);
        setEndDate(end);
    };

    const handleDownload = async () => {
        if (!accessToken) return;
        setDownloading(true);
        setError(null);
        try {
            const params: Record<string, string | boolean> = {
                start_date: startDate,
                end_date: endDate,
                include_zoho: true,
            };
            if (selectedBrand) params.brand = selectedBrand;

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/master/master-report/download`,
                {
                    params,
                    headers: { Authorization: `Bearer ${accessToken}` },
                    responseType: 'blob',
                    timeout: 180000,
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const _now = new Date();
            const _pad = (n: number) => String(n).padStart(2, '0');
            const generatedAt = `${_now.getFullYear()}-${_pad(_now.getMonth() + 1)}-${_pad(_now.getDate())}_${_pad(_now.getHours())}-${_pad(_now.getMinutes())}-${_pad(_now.getSeconds())}`;
            let filename = `master_report_${startDate}_to_${endDate}`;
            if (selectedBrand) filename += `_${selectedBrand.replace(/\s+/g, '_')}`;
            filename += `_generated_${generatedAt}.xlsx`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            const msg =
                err.response?.data instanceof Blob
                    ? await err.response.data.text().then((t: string) => {
                          try { return JSON.parse(t).detail; } catch { return t; }
                      })
                    : err.response?.data?.detail || 'Failed to generate master report';
            setError(msg);
        } finally {
            setDownloading(false);
        }
    };

    const hasDraftOrder = !!selectedBrand;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Master Report
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Downloads an Excel file with inventory, sales, DRR, and order
                        quantity data for all SKUs. Select a brand to also include a Draft
                        Order sheet.
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6">

                    {/* Quick presets */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Quick Select
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    onClick={() => applyPreset(p)}
                                    className="flex flex-col items-center px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group min-w-[80px]"
                                >
                                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 leading-tight">
                                        {p.label}
                                    </span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                                        {p.sub}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                type="button"
                                onClick={() => setEndDate(fmt(new Date()))}
                                className="mt-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                            >
                                Today
                            </button>
                        </div>
                    </div>

                    {/* Brand filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Brand{' '}
                            <span className="text-gray-400 font-normal">
                                (optional — required for Draft Order sheet)
                            </span>
                        </label>
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">All Brands</option>
                            {brands.map((b) => (
                                <option key={b.value} value={b.value}>
                                    {b.label}
                                </option>
                            ))}
                        </select>

                        {/* Brand selection indicator */}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                                    hasDraftOrder
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    {hasDraftOrder ? (
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    ) : (
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    )}
                                </svg>
                                {hasDraftOrder ? 'Draft Order sheet included' : 'No Draft Order sheet'}
                            </span>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Column Reference accordion */}
                    <AccordionSection
                        title="What's in the Excel file — Column Reference"
                        open={!!openSections['cols']}
                        onToggle={() => toggleSection('cols')}
                    >
                        {/* Sheets overview */}
                        <div className="mb-3 space-y-1 text-gray-600 dark:text-gray-400">
                            <p>
                                <span className="font-medium text-gray-800 dark:text-gray-200">① Master Sheet</span> — one row per SKU with all columns below.
                            </p>
                            {hasDraftOrder ? (
                                <p>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">② Draft Order Sheet</span> — <span className="font-semibold">{selectedBrand}</span> SKUs only.
                                    Columns: Manufacturer Code, BBCode, Item Name, <em>Qty</em> (fill in),
                                    Unit Price, Total, Case Pack, Cartons, CBM, Total CBM.
                                    Formula columns (Total, Cartons, Total CBM) update automatically when you enter Qty.
                                </p>
                            ) : (
                                <p className="italic">Select a brand above to add a Draft Order sheet.</p>
                            )}
                        </div>

                        <ColGroup title="Identification & Status">
                            <ColRow name="Purchase Status" desc="active / inactive / discontinued until stock lasts" />
                            <ColRow name="Is New" desc="Yes if the product was created within the last 90 days" />
                            <ColRow name="SKU Code" desc="Internal SKU identifier" />
                            <ColRow name="Brand" desc="Brand name (hidden when a single brand is selected)" />
                            <ColRow name="Item Name" desc="Product display name" />
                            <ColRow name="Manufacturer Code" desc="Supplier / manufacturer part number" />
                        </ColGroup>

                        <ColGroup title="Pricing & Value">
                            <ColRow name="MRP" desc="Max Retail Price from product master" />
                            <ColRow name="Unit Price" desc="Purchase price from the most recent PO (currency-formatted)" />
                            <ColRow name="Total Amount" desc="Total invoiced value in the selected period (₹)" />
                            <ColRow name="Total MRP" desc="Retail value of current WH stock" formula="= MRP × Pupscribe WH Stock (latest)" />
                            <ColRow name="Collection Value" desc="Estimated net collection value (half of retail)" formula="= Total MRP ÷ 2" />
                        </ColGroup>

                        <ColGroup title="Sales Metrics">
                            <ColRow name="Total Units Sold" desc="Gross units invoiced via Zoho in the period" />
                            <ColRow name="Total Units Returned" desc="Units returned / credit-noted in the period" />
                            <ColRow name="Transfer Orders" desc="B2B inter-warehouse shipments (e.g. to Amazon/Blinkit WH) — excluded from demand" />
                            <ColRow
                                name="Net Total Sales"
                                desc="Customer demand units after removing returns and transfers"
                                formula="= Total Units Sold − Total Units Returned − Transfer Orders"
                            />
                            <ColRow name="Return %" desc="Return rate as a percentage of gross units sold" formula="= (Total Units Returned ÷ Total Units Sold) × 100" />
                        </ColGroup>

                        <ColGroup title="Daily Run Rate (DRR)">
                            <ColRow name="Days in Stock (Pupscribe WH)" desc="Number of days the Pupscribe warehouse had stock during the period" />
                            <ColRow name="Days in Stock (Any Warehouse)" desc="Days any warehouse had stock — display only, not used in DRR" />
                            <ColRow
                                name="Avg Daily Run Rate"
                                desc="Units sold per day — formula branches by row colour"
                                formula={
`White / Red / Green rows:
  IF(Days in Stock > 0,
    Net Total Sales ÷ Days in Stock,
    IF(Net Total Sales = 0, 0, Net Total Sales ÷ period_days))

Yellow / Orange rows (lookback):
  IF(Lookback Days in Stock > 0,
    Net Lookback Sales ÷ Lookback Days in Stock, 0)`
                                }
                            />
                            <ColRow name="Growth Rate (%)" desc="How much the current-period DRR has grown vs the lookback DRR. Positive = faster sales now." />
                            <ColRow name="DRR Source" desc="current_period · previous_period (lookback) · insufficient_stock (red)" />
                            <ColRow name="DRR Lookback Period" desc="Date range used when DRR Source = previous_period (e.g. '2025-08-01 to 2025-10-31')" />
                            <ColRow name="Lookback Days in Stock" desc="Days in stock during the lookback window" />
                            <ColRow name="Lookback Sales / Returns" desc="Gross units sold and returned during the lookback window" />
                            <ColRow name="Net Lookback Sales" desc="Lookback demand after returns" formula="= MAX(0, Lookback Sales − Lookback Returns)" />
                        </ColGroup>

                        <ColGroup title="Stock Levels">
                            <ColRow name="Pupscribe WH Stock (prev / latest)" desc="Warehouse stock snapshot for the two most-recent stock dates. Negative raw values are floored to 0." />
                            <ColRow name="FBA Stock (prev / latest)" desc="Amazon FBA stock snapshot for the same dates" />
                            <ColRow name="Total Stock (prev / latest)" desc="Combined WH + FBA" formula="= Pupscribe WH Stock + FBA Stock" />
                            <ColRow name="In Stock" desc="Yes / No based on whether any stock is currently held" />
                            <ColRow name="FBA Inventory" desc="Latest FBA inventory snapshot (date shown in column header)" />
                            <ColRow name="Blinkit Inventory" desc="Latest Blinkit dark-store inventory snapshot" />
                            <ColRow name="Etrade Inventory" desc="Latest Etrade warehouse inventory snapshot" />
                            <ColRow name="Etrade DRR" desc="Daily run rate calculated from Etrade sales data" />
                            <ColRow name="Days Total Inventory Lasts (Etrade)" desc="How many days Etrade stock covers at current Etrade DRR" formula="= Etrade Inventory ÷ Etrade DRR" />
                        </ColGroup>

                        <ColGroup title="Order Calculations">
                            <ColRow name="Movement" desc="Fast / Slow / Very Slow / No Movement — velocity classification based on DRR thresholds" />
                            <ColRow name="Safety Days" desc="Buffer days of stock to hold as safety (from product master)" />
                            <ColRow name="Lead Time" desc="Days from order to warehouse receipt (from product master)" />
                            <ColRow name="Order Processing" desc="Internal processing time before an order can be placed (default 10 days)" />
                            <ColRow name="Target Days" desc="Total coverage to target before reordering" formula="= Lead Time + Safety Days + Order Processing" />
                            <ColRow name="On-Hand Days Coverage" desc="How many days the current on-hand stock alone lasts" formula="= Total Stock (latest) ÷ DRR" />
                            <ColRow name="Stock in Transit 1 / 2 / 3" desc="Open PO line quantities, sorted by PO date ascending (Transit 1 = earliest open PO)" />
                            <ColRow name="Total Stock in Transit" desc="Sum of all three transit quantities" formula="= SIT 1 + SIT 2 + SIT 3" />
                            <ColRow name="Net Total Stock" desc="On-hand stock plus incoming stock" formula="= Total Stock (latest) + Total Stock in Transit" />
                            <ColRow
                                name="Current Days Coverage"
                                desc="Days of coverage including stock already on its way"
                                formula="= (Total Stock (latest) + Total Stock in Transit) ÷ DRR"
                            />
                            <ColRow name="Missed Sales" desc="Estimated units that could not be sold due to stockouts in the period" />
                            <ColRow
                                name="Missed Sales DRR"
                                desc="Daily missed-sales rate, capped at 50% of actual DRR to avoid over-ordering"
                                formula="= MIN(Missed Sales ÷ period_days, 0.5 × DRR)"
                            />
                            <ColRow name="Extra Qty" desc="Additional units to cover missed-sales demand during lead time" formula="= Missed Sales DRR × Lead Time" />
                            <ColRow
                                name="Net Target Days"
                                desc="How many more days of stock need to be ordered"
                                formula={
`IF(Current Days Coverage < Lead Time,
  Target Days,
  Target Days − Current Days Coverage)`
                                }
                            />
                            <ColRow
                                name="Confidence Multiplier"
                                desc="Scaling factor applied to Order Qty (hidden column). 0.5 for red rows (unreliable DRR), 1.0 for all others."
                            />
                            <ColRow
                                name="Excess / Order"
                                desc="Whether stock coverage is already sufficient"
                                formula={
`IF(DRR = 0, "NO MOVEMENT",
  IF(Current Days Coverage < Target Days, "ORDER", "EXCESS"))`
                                }
                            />
                            <ColRow
                                name="Order Qty"
                                desc="Units to order — formula differs by row colour"
                                formula={
`Green rows (demand override):
  IF(Excess/Order = "EXCESS", 0,
    Net Total Sales × Confidence Multiplier)

All other rows:
  IF(inactive, 0,
    MAX(0, Net Target Days × DRR) × Confidence Multiplier)`
                                }
                            />
                            <ColRow
                                name="DRR Flag"
                                desc="Advisory label explaining non-standard order treatment. Possible values:"
                                formula={
`(empty)            — standard calculation, no advisory
Current Period Sales — green row; order qty overridden to current-period net sales
Seasonal mismatch   — lookback period is in a different calendar quarter than the report
  (appended to other labels with ' · ' when combined)`
                                }
                            />
                            <ColRow name="Order Qty + Extra Qty" desc="Order Qty plus missed-sales recovery units. 0 for inactive or EXCESS items." />
                            <ColRow name="CBM" desc="Cubic metres per case (from product master)" />
                            <ColRow name="Case Pack" desc="Units per carton (from product master)" />
                            <ColRow
                                name="Order Qty + Extra Qty (Rounded)"
                                desc="Final order quantity. EXCESS → 0. ORDER with a result of 0 → bumped to 1 case pack (minimum meaningful order)."
                                formula={
`EXCESS  → 0
ORDER, FLOOR result > 0  → FLOOR(Order Qty + Extra Qty, Case Pack)
ORDER, FLOOR result = 0  → Case Pack  (1 case pack minimum)`
                                }
                            />
                            <ColRow name="Total CBM" desc="Volume of the full order" formula="= (Rounded Qty ÷ Case Pack) × CBM" />
                            <ColRow name="Days Current Order Lasts" desc="How long the order alone will last at the current DRR" formula="= Rounded Qty ÷ DRR" />
                            <ColRow
                                name="Days Total Inventory Lasts"
                                desc="Total coverage once the order arrives"
                                formula="= Current Days Coverage + Days Current Order Lasts"
                            />
                        </ColGroup>
                    </AccordionSection>

                    {/* Row colour legend accordion */}
                    <AccordionSection
                        title="Row Highlight Legend"
                        open={!!openSections['legend']}
                        onToggle={() => toggleSection('legend')}
                    >
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: '#90EE90' }} />
                                <span><span className="font-medium">Green</span> — Lookback DRR was used but current-period sales are <span className="font-medium">higher</span>. Order qty is overridden to current-period net sales × confidence multiplier.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: '#FFFF00' }} />
                                <span><span className="font-medium">Yellow</span> — DRR from a <span className="font-medium">lookback period (≤ 180 days ago)</span>. Insufficient sales in the selected window; historical velocity used.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: '#FFA500' }} />
                                <span><span className="font-medium">Orange</span> — DRR from a <span className="font-medium">lookback period &gt; 180 days ago</span>. Reference data is stale — treat order quantities with caution.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: '#FF6B6B' }} />
                                <span><span className="font-medium">Red</span> — SKU had <span className="font-medium">no days in stock</span> during the period. DRR is divided over full period length (unreliable); order qty dampened by 50%.</span>
                            </div>
                        </div>
                    </AccordionSection>

                    {/* Download button */}
                    <button
                        onClick={handleDownload}
                        disabled={downloading || !startDate || !endDate}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    >
                        {downloading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Generating report…
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {hasDraftOrder
                                    ? `Download Master + Draft Order (${selectedBrand})`
                                    : 'Download Master Report'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
