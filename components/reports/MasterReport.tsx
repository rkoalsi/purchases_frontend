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

export default function MasterReport() {
    const { accessToken } = useAuth();

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
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

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">

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
                    <div className="grid grid-cols-2 gap-4">
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

                    {/* What's inside the report */}
                    <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 text-sm text-purple-800 dark:text-purple-300 space-y-2">
                        <p className="font-semibold mb-1">The Excel file contains:</p>
                        <p>
                            <span className="font-medium">① Master Sheet</span> — one row per SKU
                            with purchase status, sales metrics (units sold, returns, net sales),
                            DRR, stock levels (Pupscribe WH + FBA), order quantity calculations,
                            CBM, case pack, movement class, and unit price from the latest
                            purchase order.
                        </p>
                        {hasDraftOrder ? (
                            <p>
                                <span className="font-medium">② Draft Order Sheet</span> — filtered
                                to <span className="font-semibold">{selectedBrand}</span> SKUs, same
                                row order as the master sheet. Columns:{' '}
                                <code className="font-mono text-xs">Manufacturer Code</code>,{' '}
                                <code className="font-mono text-xs">BBCode</code>,{' '}
                                <code className="font-mono text-xs">Item Name</code>,{' '}
                                <code className="font-mono text-xs">Qty</code> (fill in),{' '}
                                <code className="font-mono text-xs">Unit Price</code>,{' '}
                                <code className="font-mono text-xs">Total</code>,{' '}
                                <code className="font-mono text-xs">Case Pack</code>,{' '}
                                <code className="font-mono text-xs">Cartons</code>,{' '}
                                <code className="font-mono text-xs">CBM</code>,{' '}
                                <code className="font-mono text-xs">Total CBM</code>. Formula
                                columns (Total, Cartons, Total CBM) update automatically when you
                                enter Qty.
                            </p>
                        ) : (
                            <p className="text-purple-600 dark:text-purple-400 italic">
                                Select a specific brand above to add a Draft Order sheet to the workbook.
                            </p>
                        )}
                    </div>

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
