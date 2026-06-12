'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/components/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExchangeRates {
  bank:    number;
  customs: number;
  freight: number;
}

interface PresetTab {
  id:             string;
  label:          string;
  currency:       string;
  brandNames:     string[];
  currencyFilter?: string;
  defaultRates:   ExchangeRates;
}

interface TabState {
  selected:      boolean;
  exchangeRates: ExchangeRates;
}

// ── Preset brand configurations ───────────────────────────────────────────────

const PRESET_TABS: PresetTab[] = [
  {
    id: 'fofos', label: 'FOFOS', currency: 'USD',
    brandNames: ['FOFOS'],
    defaultRates: { bank: 96.0, customs: 92.0, freight: 92.0 },
  },
  {
    id: 'truelove_usd', label: 'Truelove USD', currency: 'USD',
    brandNames: ['Truelove'], currencyFilter: 'USD',
    defaultRates: { bank: 96.0, customs: 97.0, freight: 92.0 },
  },
  {
    id: 'truelove_rmb', label: 'Truelove RMB', currency: 'RMB',
    brandNames: ['Truelove'], currencyFilter: 'CNY',
    defaultRates: { bank: 11.9, customs: 14.25, freight: 86.2 },
  },
  {
    id: 'zippy_paws', label: 'Zippy Paws', currency: 'USD',
    brandNames: ['Zippy Paws'],
    defaultRates: { bank: 97.5, customs: 97.5, freight: 90.0 },
  },
  {
    id: 'petfest', label: 'Petfest', currency: 'USD',
    brandNames: ['Dogfest', 'Catfest'],
    defaultRates: { bank: 91.0, customs: 91.0, freight: 91.0 },
  },
  {
    id: 'joyser', label: 'Joyser', currency: 'USD',
    brandNames: ['Joyser'],
    defaultRates: { bank: 91.0, customs: 91.0, freight: 91.0 },
  },
];

// Brand names already handled by presets (won't be duplicated from DB)
const PRESET_COVERED = new Set(['FOFOS', 'Truelove', 'Zippy Paws', 'Joyser', 'Dogfest', 'Catfest']);

function makeDynamicTab(brandName: string): PresetTab {
  const id = `dynamic_${brandName.toLowerCase().replace(/\s+/g, '_')}`;
  return {
    id,
    label: brandName,
    currency: 'USD',
    brandNames: [brandName],
    defaultRates: { bank: 96.0, customs: 92.0, freight: 92.0 },
  };
}

function buildInitialState(tabs: PresetTab[]): Record<string, TabState> {
  const s: Record<string, TabState> = {};
  for (const t of tabs) {
    s[t.id] = { selected: false, exchangeRates: { ...t.defaultRates } };
  }
  return s;
}

// ── Rate input ─────────────────────────────────────────────────────────────────

function RateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className='flex flex-col gap-0.5'>
      <span className='text-[10px] font-medium text-zinc-500 dark:text-zinc-400'>{label}</span>
      <input
        type='number'
        step='0.01'
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className='w-20 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500'
      />
    </label>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProductCostingGenerator() {
  const { accessToken } = useAuth();
  const headers = { Authorization: `Bearer ${accessToken}` };

  // ── brand generator state ──────────────────────────────────────────────────
  const [allTabs, setAllTabs]           = useState<PresetTab[]>(PRESET_TABS);
  const [tabState, setTabState]         = useState<Record<string, TabState>>(() => buildInitialState(PRESET_TABS));
  const [includeLive, setIncludeLive]   = useState(true);
  const [running, setRunning]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [succeeded, setSucceeded]       = useState(false);

  // Fetch all brands from DB and merge with presets
  useEffect(() => {
    if (!accessToken) return;
    axios.get(`${API_URL}/product-costing/brands`, { headers })
      .then((res) => {
        const dbBrands: string[] = res.data.brands ?? [];
        const extra = dbBrands
          .filter((b) => !PRESET_COVERED.has(b))
          .map(makeDynamicTab);
        if (extra.length === 0) return;
        const merged = [...PRESET_TABS, ...extra];
        setAllTabs(merged);
        setTabState((prev) => {
          const next = { ...prev };
          for (const t of extra) {
            if (!next[t.id]) next[t.id] = { selected: false, exchangeRates: { ...t.defaultRates } };
          }
          return next;
        });
      })
      .catch(() => { /* silently keep presets */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── upload state ──────────────────────────────────────────────────────────
  const [uploadTabLabel,  setUploadTabLabel]  = useState('');
  const [uploadCurrency,  setUploadCurrency]  = useState('USD');
  const [uploadRates,     setUploadRates]     = useState<ExchangeRates>({ bank: 96.0, customs: 92.0, freight: 92.0 });
  const [uploadFile,      setUploadFile]      = useState<File | null>(null);
  const [uploadRunning,   setUploadRunning]   = useState(false);
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [uploadSucceeded, setUploadSucceeded] = useState(false);

  function toggleTab(id: string) {
    setTabState((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected },
    }));
  }

  function updateRate(id: string, key: keyof ExchangeRates, val: number) {
    setTabState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        exchangeRates: { ...prev[id].exchangeRates, [key]: val },
      },
    }));
  }

  const selectedCount = allTabs.filter((t) => tabState[t.id]?.selected).length;

  async function handleDownloadTemplate() {
    try {
      const res = await axios.get(`${API_URL}/product-costing/template`, {
        headers,
        responseType: 'blob',
      });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href     = url;
      link.download = 'product_costing_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template.');
    }
  }

  async function handleUpload() {
    if (!uploadFile) { toast.error('Select a file first.'); return; }
    if (!uploadTabLabel.trim()) { toast.error('Enter a tab label.'); return; }

    setUploadRunning(true);
    setUploadError(null);
    setUploadSucceeded(false);

    const form = new FormData();
    form.append('file', uploadFile);
    form.append('tab_label', uploadTabLabel.trim());
    form.append('currency_label', uploadCurrency);
    form.append('bank_rate',    String(uploadRates.bank));
    form.append('customs_rate', String(uploadRates.customs));
    form.append('freight_rate', String(uploadRates.freight));

    try {
      const res = await axios.post(`${API_URL}/product-costing/upload`, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        timeout: 60_000,
      });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      const cd   = res.headers['content-disposition'] ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      link.href     = url;
      link.download = match ? match[1] : 'product_costing.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setUploadSucceeded(true);
      toast.success('Costing sheet downloaded.');
    } catch (err: unknown) {
      let msg = 'Upload failed.';
      if (axios.isAxiosError(err)) {
        if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text();
          try { msg = JSON.parse(text)?.detail ?? msg; } catch { msg = text || msg; }
        } else {
          msg = err.response?.data?.detail ?? err.message;
        }
      }
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploadRunning(false);
    }
  }

  async function handleGenerate() {
    const selectedTabs = allTabs.filter((t) => tabState[t.id]?.selected);
    if (!selectedTabs.length) {
      toast.error('Select at least one brand.');
      return;
    }

    setRunning(true);
    setError(null);
    setSucceeded(false);

    const body = {
      include_live_data: includeLive,
      tabs: selectedTabs.map((t) => ({
        label:           t.label,
        brand_names:     t.brandNames,
        currency_label:  t.currency,
        currency_filter: t.currencyFilter ?? null,
        exchange_rates:  tabState[t.id].exchangeRates,
      })),
    };

    try {
      const res = await axios.post(`${API_URL}/product-costing/generate`, body, {
        headers,
        responseType: 'blob',
        timeout: 180_000,
      });

      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      const cd   = res.headers['content-disposition'] ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      link.href     = url;
      link.download = match ? match[1] : 'product_costing.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSucceeded(true);
      toast.success('Costing sheet downloaded.');
    } catch (err: unknown) {
      let msg = 'Generation failed.';
      if (axios.isAxiosError(err)) {
        if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text();
          try { msg = JSON.parse(text)?.detail ?? msg; } catch { msg = text || msg; }
        } else {
          msg = err.response?.data?.detail ?? err.message;
        }
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
      {/* Header */}
      <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
        <div className='flex items-center gap-3'>
          <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30'>
            <FileSpreadsheet className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>
              Product Costing Sheet Generator
            </h3>
            <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-0.5'>
              Generate a costing workbook with one tab per brand, pre-filled from the products
              database with formulas matching the vendor costing sheets.
            </p>
          </div>
        </div>
      </div>

      {/* Brand selection */}
      <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
        <p className='text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-3'>
          Select brands
        </p>

        <div className='space-y-2'>
          {allTabs.map((preset) => {
            const state    = tabState[preset.id];
            const selected = state.selected;
            return (
              <div
                key={preset.id}
                className={`rounded-lg border transition-colors ${
                  selected
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
                }`}
              >
                {/* Brand row */}
                <button
                  type='button'
                  onClick={() => toggleTab(preset.id)}
                  className='w-full flex items-center gap-3 px-4 py-3 text-left'
                >
                  <div
                    className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      selected
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {selected && (
                      <svg className='h-2.5 w-2.5 text-white' viewBox='0 0 10 10' fill='currentColor'>
                        <path d='M1.5 5l2.5 2.5 4.5-4.5' stroke='currentColor' strokeWidth='2' fill='none' strokeLinecap='round' strokeLinejoin='round' />
                      </svg>
                    )}
                  </div>
                  <span className='text-sm font-medium text-zinc-800 dark:text-zinc-200'>
                    {preset.label}
                  </span>
                  <span className='ml-auto rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300'>
                    {preset.currency}
                  </span>
                </button>

                {/* Exchange rate inputs (only when selected) */}
                {selected && (
                  <div className='flex flex-wrap items-end gap-4 px-4 pb-3 pt-0 border-t border-emerald-100 dark:border-emerald-800/50'>
                    <span className='text-[11px] font-medium text-zinc-500 dark:text-zinc-400 self-end pb-1 mr-1'>
                      Exchange rates:
                    </span>
                    <RateInput
                      label='Bank rate'
                      value={state.exchangeRates.bank}
                      onChange={(v) => updateRate(preset.id, 'bank', v)}
                    />
                    <RateInput
                      label='Customs rate'
                      value={state.exchangeRates.customs}
                      onChange={(v) => updateRate(preset.id, 'customs', v)}
                    />
                    <RateInput
                      label='Freight rate'
                      value={state.exchangeRates.freight}
                      onChange={(v) => updateRate(preset.id, 'freight', v)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className='px-5 py-3 border-b border-zinc-100 dark:border-zinc-800'>
        <label className='flex items-center gap-3 cursor-pointer'>
          <div
            onClick={() => setIncludeLive((v) => !v)}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
              includeLive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                includeLive ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
              Include live data
            </p>
            <p className='text-xs text-zinc-500 dark:text-zinc-400'>
              Appends Zoho stock + 3-month sales columns. Adds ~30s to generation time.
            </p>
          </div>
        </label>
      </div>

      {/* Footer — generate button */}
      <div className='px-5 py-4'>
        <button
          onClick={handleGenerate}
          disabled={running || selectedCount === 0}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            running || selectedCount === 0
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
          }`}
        >
          {running ? (
            <>
              <RefreshCw className='h-4 w-4 animate-spin' />
              Generating{includeLive ? ' (fetching live data…)' : '…'}
            </>
          ) : (
            <>
              <Download className='h-4 w-4' />
              {selectedCount === 0
                ? 'Select brands above'
                : `Generate & Download (${selectedCount} tab${selectedCount > 1 ? 's' : ''})`}
            </>
          )}
        </button>

        {succeeded && !running && (
          <div className='mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm'>
            <CheckCircle2 className='h-4 w-4' />
            File downloaded successfully.
          </div>
        )}
        {error && (
          <div className='mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm'>
            <AlertTriangle className='h-4 w-4 flex-shrink-0' />
            {error}
          </div>
        )}
      </div>

      {/* ── Upload section ─────────────────────────────────────────────── */}
      <div className='border-t border-zinc-100 dark:border-zinc-800'>
        {/* Upload header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
          <div className='flex items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30'>
              <Upload className='h-4 w-4 text-violet-600 dark:text-violet-400' />
            </div>
            <div>
              <h3 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>
                Upload Vendor Price List
              </h3>
              <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-0.5'>
                Fill in the template with vendor prices and generate a full costing sheet.
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className='flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors'
          >
            <Download className='h-3.5 w-3.5' />
            Template
          </button>
        </div>

        {/* Upload form */}
        <div className='px-5 py-4 space-y-4'>
          {/* Tab label + currency */}
          <div className='flex flex-wrap gap-4'>
            <label className='flex flex-col gap-0.5 flex-1 min-w-[160px]'>
              <span className='text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide'>
                Tab label <span className='text-red-400'>*</span>
              </span>
              <input
                type='text'
                placeholder='e.g. PETSHY, Fedem'
                value={uploadTabLabel}
                onChange={(e) => setUploadTabLabel(e.target.value)}
                className='rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500'
              />
            </label>
            <label className='flex flex-col gap-0.5'>
              <span className='text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide'>
                Currency
              </span>
              <select
                value={uploadCurrency}
                onChange={(e) => setUploadCurrency(e.target.value)}
                className='rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500'
              >
                <option value='USD'>USD</option>
                <option value='RMB'>RMB</option>
              </select>
            </label>
          </div>

          {/* Exchange rates */}
          <div className='flex flex-wrap items-end gap-4'>
            <span className='text-[11px] font-medium text-zinc-500 dark:text-zinc-400 self-end pb-1'>
              Exchange rates:
            </span>
            <RateInput label='Bank rate'    value={uploadRates.bank}    onChange={(v) => setUploadRates((r) => ({ ...r, bank: v }))} />
            <RateInput label='Customs rate' value={uploadRates.customs} onChange={(v) => setUploadRates((r) => ({ ...r, customs: v }))} />
            <RateInput label='Freight rate' value={uploadRates.freight} onChange={(v) => setUploadRates((r) => ({ ...r, freight: v }))} />
          </div>

          {/* File picker */}
          <div>
            <span className='block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5'>
              Price list file <span className='text-red-400'>*</span>
            </span>
            <label className='flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 hover:border-violet-400 dark:hover:border-violet-600 transition-colors'>
              <FileSpreadsheet className='h-5 w-5 text-zinc-400 dark:text-zinc-500 flex-shrink-0' />
              <span className='text-xs text-zinc-500 dark:text-zinc-400 truncate'>
                {uploadFile ? uploadFile.name : 'Click to choose .xlsx file'}
              </span>
              <input
                type='file'
                accept='.xlsx,.xls'
                className='hidden'
                onChange={(e) => {
                  setUploadFile(e.target.files?.[0] ?? null);
                  setUploadSucceeded(false);
                  setUploadError(null);
                }}
              />
            </label>
          </div>

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={uploadRunning || !uploadFile || !uploadTabLabel.trim()}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              uploadRunning || !uploadFile || !uploadTabLabel.trim()
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm'
            }`}
          >
            {uploadRunning ? (
              <>
                <RefreshCw className='h-4 w-4 animate-spin' />
                Generating…
              </>
            ) : (
              <>
                <Download className='h-4 w-4' />
                Generate & Download
              </>
            )}
          </button>

          {uploadSucceeded && !uploadRunning && (
            <div className='flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm'>
              <CheckCircle2 className='h-4 w-4' />
              File downloaded successfully.
            </div>
          )}
          {uploadError && (
            <div className='flex items-center gap-2 text-red-600 dark:text-red-400 text-sm'>
              <AlertTriangle className='h-4 w-4 flex-shrink-0' />
              {uploadError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
