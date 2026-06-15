'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Download, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function InventoryAgingReport() {
  const { accessToken } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [toDate, setToDate] = useState(today);
  const [prevDate, setPrevDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!toDate || !prevDate) {
      toast.error('Please select both dates.');
      return;
    }
    if (prevDate >= toDate) {
      toast.error('Previous period date must be earlier than the current date.');
      return;
    }
    setLoading(true);
    try {
      const resp = await axios.get(`${API_URL}/inventory_aging/download`, {
        params: { to_date: toDate, prev_date: prevDate },
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Inventory_Aging_${toDate}_vs_${prevDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully.');
    } catch (err: any) {
      const msg =
        err?.response?.data instanceof Blob
          ? await err.response.data.text()
          : err?.message ?? 'Unknown error';
      toast.error(`Failed to generate report: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 dark:text-white">Inventory Aging Report</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Generates an Excel file comparing inventory across four aging buckets (60-day intervals) for two periods, plus brand-wise collection value.
      </p>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 sm:p-5 shadow-sm space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Calendar className="inline w-4 h-4 mr-1.5 -mt-0.5" />
            Current Period Date
          </label>
          <input
            type="date"
            value={toDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Calendar className="inline w-4 h-4 mr-1.5 -mt-0.5" />
            Previous Period Date
          </label>
          <input
            type="date"
            value={prevDate}
            max={toDate || today}
            onChange={(e) => setPrevDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Must be earlier than the current period date.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={loading || !toDate || !prevDate}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-2.5 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Report…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Report
            </>
          )}
        </button>
      </div>

      {/* Aging bucket legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: 'Fast Mover', range: '0–60 days', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
          { label: 'Medium Mover', range: '60–120 days', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
          { label: 'Slow Mover', range: '120–180 days', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
          { label: 'Dead Stock', range: '180+ days', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
        ].map(({ label, range, bg, text, dot }) => (
          <div key={label} className={`rounded-lg px-3 py-2 ${bg} flex items-center gap-2`}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
            <div>
              <p className={`text-xs font-semibold ${text}`}>{label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{range}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Report sheets (13 total):</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <span className="font-medium text-green-600 dark:text-green-400">Fast Movers</span>
            {' '}— items aged 0–60 days (summary + current + previous)
          </li>
          <li>
            <span className="font-medium text-blue-600 dark:text-blue-400">Medium Movers</span>
            {' '}— items aged 60–120 days (summary + current + previous)
          </li>
          <li>
            <span className="font-medium text-orange-600 dark:text-orange-400">Slow Movers</span>
            {' '}— items aged 120–180 days (summary + current + previous)
          </li>
          <li>
            <span className="font-medium text-purple-600 dark:text-purple-400">Deadstock</span>
            {' '}— items aged 180+ days (summary + current + previous)
          </li>
          <li>
            <span className="font-medium text-blue-600 dark:text-blue-400">Brand wise collection value</span>
            {' '}— total stock, slow movers and deadstock per brand
          </li>
        </ul>
      </div>
    </div>
  );
}
