'use client';

import { useAuth } from '@/components/context/AuthContext';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

function buildYearPresets() {
    const currentYear = new Date().getFullYear();
    const presets = [];

    // This Year + prior years back to 2021: full Jan 1 – Dec 31
    const offsetLabels = ['This Year', 'Last Year', '2 Years Ago', '3 Years Ago', '4 Years Ago', '5 Years Ago'];
    for (let offset = 0; currentYear - offset >= 2021; offset++) {
        const yr = currentYear - offset;
        presets.push({
            label: offsetLabels[offset] || String(yr),
            year: yr,
            getDates: () => ({
                start: fmt(new Date(yr, 0, 1)),
                end: fmt(new Date(yr, 11, 31)),
            }),
        });
    }

    return presets;
}

const PRESETS = buildYearPresets();

function fmt(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function SeasonalReport() {
    const { accessToken } = useAuth();

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return fmt(d);
    });
    const [endDate, setEndDate] = useState(() => fmt(new Date()));

    const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch available brands
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
            const params: Record<string, string> = {
                start_date: startDate,
                end_date: endDate,
            };
            if (selectedBrand) params.brand = selectedBrand;

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/seasonal/download`,
                {
                    params,
                    headers: { Authorization: `Bearer ${accessToken}` },
                    responseType: 'blob',
                    timeout: 120000,
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            let filename = `seasonal_report_${startDate}_to_${endDate}`;
            if (selectedBrand) filename += `_${selectedBrand.replace(/\s+/g, '_')}`;
            filename += '.xlsx';
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
                    : err.response?.data?.detail || 'Failed to generate seasonal report';
            setError(msg);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Seasonal DRR Report
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Downloads an Excel file showing historical monthly averages, seasonal
                        indices, and seasonally-adjusted Daily Run Rates for each SKU.
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">

                    {/* Quick presets */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Select Year
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    onClick={() => applyPreset(p)}
                                    className="flex flex-col items-center px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group min-w-[72px]"
                                >
                                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 leading-tight">
                                        {p.year}
                                    </span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                                        {p.label}
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
                            Brand <span className="text-gray-400 font-normal">(optional)</span>
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
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* What's inside the report */}
                    <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 text-sm text-purple-800 dark:text-purple-300 space-y-1">
                        <p className="font-semibold mb-2">The Excel file contains (12 rows per SKU):</p>
                        <p>① Year Columns — Zoho invoice units for that calendar month in each respective year</p>
                        <p>② Monthly Avg — <code className="font-mono text-xs">= AVERAGE(year cols)</code> — average units for that month across years</p>
                        <p>③ Avg Monthly Demand — <code className="font-mono text-xs">= SUM(Jan Avg … Dec Avg) / 12</code> — average of the 12 monthly averages</p>
                        <p>④ Seasonal Index — <code className="font-mono text-xs">= Month Avg / Avg Monthly Demand</code> — (1.0 = normal; &gt;1.0 = above avg; &lt;1.0 = below avg)</p>
                        <p>⑤ Base DRR — total Zoho units sold in selected period / number of days in the period</p>
                        <p>⑥ Seasonal DRR — <code className="font-mono text-xs">= Base DRR × Seasonal Index</code> — projected daily run rate adjusted for seasonality</p>
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
                                Download Seasonal Report
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
