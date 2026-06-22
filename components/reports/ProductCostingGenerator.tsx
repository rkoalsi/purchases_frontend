'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/context/AuthContext';
import { BRAND_GROUPS, mergeBrandOptions } from '@/util/brandGroups';

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

// ── Existing Brands sub-component ────────────────────────────────────────────

function ExistingBrandsTab({
  allTabs, tabState, toggleTab, updateRate,
  includeLive, setIncludeLive,
  running, selectedCount, handleGenerate, succeeded, error,
}: {
  allTabs: PresetTab[];
  tabState: Record<string, TabState>;
  toggleTab: (id: string) => void;
  updateRate: (id: string, key: keyof ExchangeRates, val: number) => void;
  includeLive: boolean;
  setIncludeLive: React.Dispatch<React.SetStateAction<boolean>>;
  running: boolean;
  selectedCount: number;
  handleGenerate: () => void;
  succeeded: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedTabs = allTabs.filter((t) => tabState[t.id]?.selected);

  return (
    <>
      <div className='px-5 py-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800'>
        {/* Multi-select dropdown */}
        <div>
          <p className='text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-2'>
            Select brands
          </p>
          <div ref={ref} className='rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden'>
            {/* Trigger */}
            <button
              type='button'
              onClick={() => setOpen((v) => !v)}
              className='w-full flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-2 text-left text-sm focus:outline-none'
            >
              {selectedTabs.length === 0 ? (
                <span className='text-zinc-400 dark:text-zinc-500 flex-1'>Choose brands…</span>
              ) : (
                <span className='flex-1 flex flex-wrap gap-1.5'>
                  {selectedTabs.map((t) => (
                    <span
                      key={t.id}
                      className='inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium px-2 py-0.5'
                    >
                      {t.label}
                      <button
                        type='button'
                        onMouseDown={(e) => { e.stopPropagation(); toggleTab(t.id); }}
                        className='hover:text-emerald-600'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </span>
                  ))}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Inline checklist */}
            {open && (
              <div className='border-t border-zinc-200 dark:border-zinc-700'>
                {allTabs.map((preset) => {
                  const selected = tabState[preset.id]?.selected;
                  return (
                    <button
                      key={preset.id}
                      type='button'
                      onClick={() => toggleTab(preset.id)}
                      className='w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0'
                    >
                      <div className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                        selected ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {selected && (
                          <svg className='h-2.5 w-2.5 text-white' viewBox='0 0 10 10' fill='currentColor'>
                            <path d='M1.5 5l2.5 2.5 4.5-4.5' stroke='currentColor' strokeWidth='2' fill='none' strokeLinecap='round' strokeLinejoin='round' />
                          </svg>
                        )}
                      </div>
                      <span className='flex-1 text-left text-zinc-800 dark:text-zinc-200'>{preset.label}</span>
                      <span className='text-[10px] font-semibold text-zinc-400 dark:text-zinc-500'>{preset.currency}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Exchange rates per selected brand */}
        {selectedTabs.length > 0 && (
          <div className='space-y-2'>
            {selectedTabs.map((preset) => {
              const state = tabState[preset.id];
              return (
                <div key={preset.id} className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5'>
                  <p className='text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2'>{preset.label}</p>
                  <div className='flex flex-wrap gap-3'>
                    <RateInput label='Bank rate'    value={state.exchangeRates.bank}    onChange={(v) => updateRate(preset.id, 'bank', v)} />
                    <RateInput label='Customs rate' value={state.exchangeRates.customs} onChange={(v) => updateRate(preset.id, 'customs', v)} />
                    <RateInput label='Freight rate' value={state.exchangeRates.freight} onChange={(v) => updateRate(preset.id, 'freight', v)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Include live toggle */}
        <label className='flex items-center gap-3 cursor-pointer'>
          <div
            onClick={() => setIncludeLive((v) => !v)}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${includeLive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeLive ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Include live data</p>
            <p className='text-xs text-zinc-500 dark:text-zinc-400'>Appends Zoho stock + 3-month sales columns. Adds ~30s to generation time.</p>
          </div>
        </label>
      </div>

      {/* Generate button */}
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
            <><RefreshCw className='h-4 w-4 animate-spin' />Generating{includeLive ? ' (fetching live data…)' : '…'}</>
          ) : (
            <><Download className='h-4 w-4' />{selectedCount === 0 ? 'Select brands above' : `Generate & Download (${selectedCount} tab${selectedCount > 1 ? 's' : ''})`}</>
          )}
        </button>
        {succeeded && !running && (
          <div className='mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm'>
            <CheckCircle2 className='h-4 w-4' />File downloaded successfully.
          </div>
        )}
        {error && (
          <div className='mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm'>
            <AlertTriangle className='h-4 w-4 flex-shrink-0' />{error}
          </div>
        )}
      </div>
    </>
  );
}

// ── Order Wise Costing sub-component ─────────────────────────────────────────

interface BrandPO {
  po_number:     string;
  date:          string;
  currency_code: string;
  exchange_rate: number;
  vendor_name:   string;
  status:        string;
  total:         number;
  num_items:     number;
}

interface POSelection {
  selected: boolean;
  rates:    ExchangeRates;
}

function constituentBrands(label: string): string[] {
  return BRAND_GROUPS[label] ?? [label];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function downloadBlob(res: { data: any; headers: any }, fallback: string) {
  const url   = URL.createObjectURL(new Blob([res.data]));
  const link  = document.createElement('a');
  const cd    = res.headers['content-disposition'] ?? '';
  const match = cd.match(/filename="?([^"]+)"?/);
  link.href     = url;
  link.download = match ? match[1] : fallback;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function OrderWiseTab({ headers }: { headers: Record<string, string> }) {
  const [brandOptions, setBrandOptions] = useState<{ value: string; label: string }[]>([]);
  const [brand, setBrand]               = useState('');
  const [pos, setPos]                   = useState<BrandPO[]>([]);
  const [sel, setSel]                   = useState<Record<string, POSelection>>({});
  const [loadingPos, setLoadingPos]     = useState(false);
  const [includeLive, setIncludeLive]   = useState(false);
  const [running, setRunning]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [succeeded, setSucceeded]       = useState(false);

  // Load + merge brands once
  useEffect(() => {
    axios.get(`${API_URL}/product-costing/brands`, { headers })
      .then((res) => {
        const raw = (res.data.brands ?? []).map((b: string) => ({ value: b, label: b }));
        setBrandOptions(mergeBrandOptions(raw));
      })
      .catch(() => { /* keep empty */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When brand changes, fetch its POs
  useEffect(() => {
    if (!brand) { setPos([]); setSel({}); return; }
    setLoadingPos(true);
    setError(null);
    setSucceeded(false);
    const brandsParam = constituentBrands(brand).join(',');
    axios.get(`${API_URL}/product-costing/order-wise/pos`, {
      headers, params: { brands: brandsParam },
    })
      .then((res) => {
        const list: BrandPO[] = res.data.purchase_orders ?? [];
        setPos(list);
        const init: Record<string, POSelection> = {};
        for (const p of list) {
          const fx = p.exchange_rate > 0 ? p.exchange_rate : 96.0;
          init[p.po_number] = { selected: false, rates: { bank: fx, customs: fx, freight: fx } };
        }
        setSel(init);
      })
      .catch(() => { setPos([]); setSel({}); setError('Failed to load purchase orders.'); })
      .finally(() => setLoadingPos(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  function togglePO(po: string) {
    setSel((prev) => ({ ...prev, [po]: { ...prev[po], selected: !prev[po].selected } }));
  }
  function updatePORate(po: string, key: keyof ExchangeRates, val: number) {
    setSel((prev) => ({ ...prev, [po]: { ...prev[po], rates: { ...prev[po].rates, [key]: val } } }));
  }

  const selectedPOs = pos.filter((p) => sel[p.po_number]?.selected);

  async function handleGenerate() {
    if (!brand)              { toast.error('Select a brand.'); return; }
    if (!selectedPOs.length) { toast.error('Select at least one PO.'); return; }

    setRunning(true);
    setError(null);
    setSucceeded(false);

    const body = {
      brand_names: constituentBrands(brand),
      include_live_data: includeLive,
      pos: selectedPOs.map((p) => ({
        po_number:      p.po_number,
        currency_label: p.currency_code,
        exchange_rates: sel[p.po_number].rates,
      })),
    };

    try {
      const res = await axios.post(`${API_URL}/product-costing/order-wise/generate`, body, {
        headers, responseType: 'blob', timeout: 180_000,
      });
      downloadBlob(res, 'order_costing.xlsx');
      setSucceeded(true);
      toast.success('Order costing sheet downloaded.');
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
    <div className='px-5 py-4 space-y-4'>
      {/* Brand select */}
      <div>
        <p className='text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-2'>
          Brand
        </p>
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className='w-full max-w-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500'
        >
          <option value=''>Choose a brand…</option>
          {brandOptions.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>

      {/* PO list */}
      {loadingPos && (
        <div className='flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400'>
          <RefreshCw className='h-4 w-4 animate-spin' /> Loading purchase orders…
        </div>
      )}

      {!loadingPos && brand && pos.length === 0 && (
        <p className='text-sm text-zinc-500 dark:text-zinc-400'>No purchase orders found for this brand.</p>
      )}

      {!loadingPos && pos.length > 0 && (
        <div className='space-y-2'>
          <p className='text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide'>
            Purchase orders ({selectedPOs.length} selected)
          </p>
          {pos.map((p) => {
            const s = sel[p.po_number];
            return (
              <div key={p.po_number} className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'>
                <button
                  type='button'
                  onClick={() => togglePO(p.po_number)}
                  className='w-full flex items-center gap-3 px-3 py-2.5 text-left'
                >
                  <div className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    s?.selected ? 'border-blue-500 bg-blue-500' : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {s?.selected && (
                      <svg className='h-2.5 w-2.5 text-white' viewBox='0 0 10 10' fill='currentColor'>
                        <path d='M1.5 5l2.5 2.5 4.5-4.5' stroke='currentColor' strokeWidth='2' fill='none' strokeLinecap='round' strokeLinejoin='round' />
                      </svg>
                    )}
                  </div>
                  <span className='flex-1 min-w-0'>
                    <span className='text-sm font-medium text-zinc-800 dark:text-zinc-200'>{p.po_number}</span>
                    <span className='block text-[11px] text-zinc-500 dark:text-zinc-400 truncate'>
                      {p.date} · {p.num_items} items · {p.currency_code} {p.total.toLocaleString()} · {p.vendor_name}
                    </span>
                  </span>
                </button>
                {s?.selected && (
                  <div className='flex flex-wrap gap-3 px-3 pb-3 pl-10'>
                    <RateInput label='Bank rate'    value={s.rates.bank}    onChange={(v) => updatePORate(p.po_number, 'bank', v)} />
                    <RateInput label='Customs rate' value={s.rates.customs} onChange={(v) => updatePORate(p.po_number, 'customs', v)} />
                    <RateInput label='Freight rate' value={s.rates.freight} onChange={(v) => updatePORate(p.po_number, 'freight', v)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Include live toggle */}
      {pos.length > 0 && (
        <label className='flex items-center gap-3 cursor-pointer'>
          <div
            onClick={() => setIncludeLive((v) => !v)}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${includeLive ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeLive ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Include live data</p>
            <p className='text-xs text-zinc-500 dark:text-zinc-400'>Appends Zoho stock + 3-month sales columns. Adds ~30s.</p>
          </div>
        </label>
      )}

      {/* Generate */}
      <div>
        <button
          onClick={handleGenerate}
          disabled={running || selectedPOs.length === 0}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            running || selectedPOs.length === 0
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
          }`}
        >
          {running ? (
            <><RefreshCw className='h-4 w-4 animate-spin' />Generating{includeLive ? ' (fetching live data…)' : '…'}</>
          ) : (
            <><Download className='h-4 w-4' />{selectedPOs.length === 0 ? 'Select POs above' : `Generate & Download (${selectedPOs.length} PO${selectedPOs.length > 1 ? 's' : ''})`}</>
          )}
        </button>
        {succeeded && !running && (
          <div className='mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm'>
            <CheckCircle2 className='h-4 w-4' />File downloaded successfully.
          </div>
        )}
        {error && (
          <div className='mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm'>
            <AlertTriangle className='h-4 w-4 flex-shrink-0' />{error}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProductCostingGenerator() {
  const { accessToken } = useAuth();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [activeTab, setActiveTab] = useState<'existing' | 'new' | 'order'>('existing');

  // ── existing brands state ─────────────────────────────────────────────────
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

  // ── new brand upload state ────────────────────────────────────────────────
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
      {/* Tab bar */}
      <div className='flex border-b border-zinc-200 dark:border-zinc-800'>
        <button
          onClick={() => setActiveTab('existing')}
          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'existing'
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <FileSpreadsheet className='h-4 w-4' />
          Existing Brands
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'new'
              ? 'border-violet-500 text-violet-700 dark:text-violet-400 bg-violet-50/40 dark:bg-violet-900/10'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Upload className='h-4 w-4' />
          New Brands
        </button>
        <button
          onClick={() => setActiveTab('order')}
          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'order'
              ? 'border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-900/10'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <FileSpreadsheet className='h-4 w-4' />
          Order Wise Costing
        </button>
      </div>

      {/* ── Existing Brands tab ───────────────────────────────────────── */}
      {activeTab === 'existing' && (
        <ExistingBrandsTab
          allTabs={allTabs}
          tabState={tabState}
          toggleTab={toggleTab}
          updateRate={updateRate}
          includeLive={includeLive}
          setIncludeLive={setIncludeLive}
          running={running}
          selectedCount={selectedCount}
          handleGenerate={handleGenerate}
          succeeded={succeeded}
          error={error}
        />
      )}

      {/* ── New Brands tab ────────────────────────────────────────────── */}
      {activeTab === 'new' && (
        <>
          {/* Header row with template download */}
          <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
            <div>
              <p className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>Upload Vendor Price List</p>
              <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-0.5'>
                Fill in the template with vendor prices and generate a full costing sheet.
              </p>
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
            {/* Brand name + currency */}
            <div className='flex flex-wrap gap-4'>
              <label className='flex flex-col gap-0.5 flex-1 min-w-[160px]'>
                <span className='text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide'>
                  Brand name <span className='text-red-400'>*</span>
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
              <span className='text-[11px] font-medium text-zinc-500 dark:text-zinc-400 self-end pb-1'>Exchange rates:</span>
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
                <><RefreshCw className='h-4 w-4 animate-spin' />Generating…</>
              ) : (
                <><Download className='h-4 w-4' />Generate & Download</>
              )}
            </button>

            {uploadSucceeded && !uploadRunning && (
              <div className='flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm'>
                <CheckCircle2 className='h-4 w-4' />File downloaded successfully.
              </div>
            )}
            {uploadError && (
              <div className='flex items-center gap-2 text-red-600 dark:text-red-400 text-sm'>
                <AlertTriangle className='h-4 w-4 flex-shrink-0' />{uploadError}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Order Wise Costing tab ────────────────────────────────────── */}
      {activeTab === 'order' && <OrderWiseTab headers={headers} />}
    </div>
  );
}
