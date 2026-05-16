'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { RefreshCw, Package, Search, ChevronLeft, ChevronRight, Edit2, Check, X, Upload, Info, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/amazon`;
const MARGINS_API = `${process.env.NEXT_PUBLIC_API_URL}/vendor_po/margins`;
const PAGE_SIZE = 25;

async function buildSkuBrandMap(token: string): Promise<Map<string, string>> {
  const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/sku-brand-map`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return new Map<string, string>(Object.entries(res.data));
}

type SkuItem = {
  _id: string;
  item_id: string;
  sku_code: string;
  item_name: string;
  seller_sku?: string;
};

type MarginData = {
  asin: string;
  margin?: number | null;
  cost_price_wo_tax?: number | null;
  etrade_asp?: number | null;
};

type SyncResult = {
  message: string;
  inserted: number;
  updated: number;
  unchanged: number;
  total_sp_listings: number;
};

// ─── Inline edit cell ─────────────────────────────────────────────────────────

const EditableCell: React.FC<{
  value: number | null | undefined;
  onSave: (val: number) => Promise<void>;
  format: (v: number) => string;
  placeholder: string;
  validate: (v: number) => string | null;
  inputSuffix?: string;
  inputMin?: number;
  inputMax?: number;
  inputStep?: number;
}> = ({ value, onSave, format, placeholder, validate, inputSuffix, inputMin, inputMax, inputStep }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setVal(value != null ? String(value) : '');
    setEditing(true);
  };

  const save = async () => {
    const num = parseFloat(val);
    if (isNaN(num)) { toast.error('Enter a valid number'); return; }
    const err = validate(num);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      await onSave(num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group">
        <span className="text-sm text-gray-800 dark:text-zinc-200">
          {value != null ? format(value) : <span className="text-gray-400 dark:text-zinc-500 text-xs">{placeholder}</span>}
        </span>
        <button
          onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 transition-opacity"
        >
          <Edit2 size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="number"
        value={val}
        min={inputMin}
        max={inputMax}
        step={inputStep ?? 'any'}
        onChange={(e) => setVal(e.target.value)}
        className="w-20 px-1.5 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      {inputSuffix && <span className="text-xs text-gray-500">{inputSuffix}</span>}
      <button onClick={save} disabled={saving} className="p-0.5 text-green-600 hover:text-green-700">
        <Check size={12} />
      </button>
      <button onClick={() => setEditing(false)} className="p-0.5 text-red-500 hover:text-red-600">
        <X size={12} />
      </button>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AmazonSkuMappingPage() {
  const { accessToken } = useAuth();
  const [skuData, setSkuData] = useState<SkuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEtradeFormat, setShowEtradeFormat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const etradeFormatRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [allBrands, setAllBrands] = useState<{ value: string; label: string }[]>([]);
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [brand, setBrand] = useState('');
  const [skuBrandMap, setSkuBrandMap] = useState<Map<string, string>>(new Map());
  const [marginsByAsin, setMarginsByAsin] = useState<Map<string, MarginData>>(new Map());

  useEffect(() => {
    if (!accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setAllBrands(res.data.brands || []))
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    buildSkuBrandMap(accessToken).then(setSkuBrandMap);
  }, [accessToken]);

  useEffect(() => {
    if (skuData.length === 0 || skuBrandMap.size === 0 || allBrands.length === 0) return;
    const present = new Set(
      skuData.map((i) => skuBrandMap.get(i.sku_code)).filter((b): b is string => Boolean(b))
    );
    const relevant = allBrands.filter((b) => present.has(b.value));
    setBrands(relevant.length > 0 ? relevant : allBrands);
  }, [skuData, skuBrandMap, allBrands]);

  useEffect(() => { setPage(1); }, [brand]);
  useEffect(() => { setPage(1); }, [search]);

  const filtered = skuData.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (
      item.item_id.toLowerCase().includes(q) ||
      item.sku_code.toLowerCase().includes(q) ||
      item.item_name.toLowerCase().includes(q)
    );
    const matchesBrand = !brand || skuBrandMap.get(item.sku_code) === brand;
    return matchesSearch && matchesBrand;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { fetchSkuData(); fetchAllMargins(); }, []);

  useEffect(() => {
    if (!showEtradeFormat) return;
    const handler = (e: MouseEvent) => {
      if (etradeFormatRef.current && !etradeFormatRef.current.contains(e.target as Node)) {
        setShowEtradeFormat(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEtradeFormat]);

  const fetchSkuData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/get_amazon_sku_mapping`);
      setSkuData(res.data);
    } catch {
      toast.error('Failed to load SKU mapping data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMargins = async () => {
    try {
      const res = await axios.get<MarginData[]>(MARGINS_API);
      const map = new Map<string, MarginData>();
      for (const m of res.data) map.set(m.asin, m);
      setMarginsByAsin(map);
    } catch {
      // non-critical
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post<SyncResult>(`${API_BASE}/sync-sku-mapping`);
      const d = res.data;
      toast.success(`Sync complete — ${d.inserted} added, ${d.updated} updated, ${d.unchanged} unchanged`);
      await fetchSkuData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const saveMargin = async (asin: string, margin: number) => {
    await axios.put(`${MARGINS_API}/${asin}?margin=${margin / 100}`);
    setMarginsByAsin((prev) => {
      const next = new Map(prev);
      const existing = next.get(asin) ?? { asin };
      next.set(asin, { ...existing, margin: margin / 100 });
      return next;
    });
    toast.success('Margin saved');
  };

  const saveCostPrice = async (asin: string, costPrice: number) => {
    await axios.put(`${MARGINS_API}/${asin}?cost_price_wo_tax=${costPrice}`);
    setMarginsByAsin((prev) => {
      const next = new Map(prev);
      const existing = next.get(asin) ?? { asin };
      next.set(asin, { ...existing, cost_price_wo_tax: costPrice });
      return next;
    });
    toast.success('Cost price saved');
  };

  const saveEtradeAsp = async (asin: string, asp: number) => {
    await axios.put(`${MARGINS_API}/${asin}?etrade_asp=${asp}`);
    setMarginsByAsin((prev) => {
      const next = new Map(prev);
      const existing = next.get(asin) ?? { asin };
      next.set(asin, { ...existing, etrade_asp: asp });
      return next;
    });
    toast.success('eTrade ASP saved');
  };

  const handleTemplateDownload = async () => {
    try {
      const res = await axios.get(`${API_BASE}/download-etrade-margins-template`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'etrade_margins_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleEtradeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post<{ message: string; upserted: number; skipped: number }>(
        `${API_BASE}/upload-etrade-margins`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(res.data.message);
      await fetchAllMargins();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg'>
            <Package className='w-5 h-5 text-orange-600 dark:text-orange-400' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
              Amazon SKU Mapping
            </h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Manage ASIN → SKU code mappings synced from Amazon SP-API
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <input
            ref={fileInputRef}
            type='file'
            accept='.xlsx,.xls'
            className='hidden'
            onChange={handleEtradeUpload}
          />
          <div className='relative' ref={etradeFormatRef}>
            <div className='flex items-center gap-1'>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors'
              >
                <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                {uploading ? 'Uploading…' : 'Upload eTrade Margins'}
              </button>
              <button
                onClick={() => setShowEtradeFormat((v) => !v)}
                className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'
                title='View expected file format'
              >
                <Info className='w-4 h-4' />
              </button>
            </div>
            {showEtradeFormat && (
              <div className='absolute right-0 top-full mt-1 z-10 w-80 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-xs text-gray-700 dark:text-zinc-300'>
                <p className='font-semibold mb-2'>Expected Excel format</p>
                <table className='w-full border-collapse'>
                  <thead>
                    <tr className='bg-gray-50 dark:bg-zinc-700'>
                      <th className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-left font-mono'>ASIN</th>
                      <th className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-left font-mono'>ASP</th>
                      <th className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-left font-mono'>New Margin</th>
                      <th className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-left font-mono'>Cost Price w/o Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-gray-400'>B01ABC123</td>
                      <td className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-gray-400'>499.00</td>
                      <td className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-gray-400'>0.25</td>
                      <td className='border border-gray-200 dark:border-zinc-600 px-2 py-1 text-gray-400'>320.00</td>
                    </tr>
                  </tbody>
                </table>
                <p className='mt-2 text-gray-400 dark:text-zinc-500'>Upserts by ASIN. Blank cells are skipped.</p>
                <button
                  onClick={handleTemplateDownload}
                  className='mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium transition-colors'
                >
                  <Download className='w-3 h-3' />
                  Download template with existing data
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className='flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium text-sm transition-colors'
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Amazon'}
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap'>
          <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>All Mappings</h2>
          <div className='relative flex-1 min-w-[160px] max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by ASIN, SKU code or name…'
              className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
            />
          </div>
          {brands.length > 0 && (
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer'
            >
              <option value=''>All Brands</option>
              {brands.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          )}
          {!loading && (
            <span className='text-xs text-black dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full shrink-0'>
              {filtered.length}{filtered.length !== skuData.length ? ` / ${skuData.length}` : ''} items
            </span>
          )}
        </div>

        {loading ? (
          <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
            <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-orange-500' />
            Loading…
          </div>
        ) : skuData.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
            <Package className='w-10 h-10 mb-3 opacity-40' />
            <p className='font-medium'>No items yet</p>
            <p className='text-sm mt-1'>Sync from Amazon to populate mappings</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-12'>#</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Item Name</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>ASIN</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Margin %</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Cost Price w/o Tax (₹)</th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>eTrade ASP (₹)</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='px-6 py-10 text-center text-sm text-gray-400 dark:text-zinc-500'>
                      {search ? `No results for "${search}"` : 'No items yet'}
                    </td>
                  </tr>
                ) : paginated.map((item, index) => {
                  const asin = item.item_id;
                  const md = marginsByAsin.get(asin);
                  return (
                    <tr key={item._id} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                      <td className='px-6 py-3.5 text-sm text-gray-400 dark:text-zinc-500'>
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className='px-6 py-3.5 text-gray-800 dark:text-zinc-200'>
                        {item.item_name}
                      </td>
                      <td className='px-6 py-3.5'>
                        <span className='inline-block font-mono text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded'>
                          {item.sku_code}
                        </span>
                      </td>
                      <td className='px-6 py-3.5 font-mono text-xs text-gray-600 dark:text-zinc-300'>
                        {asin}
                      </td>
                      <td className='px-6 py-3.5'>
                        <EditableCell
                          value={md?.margin != null ? md.margin * 100 : null}
                          onSave={(v) => saveMargin(asin, v)}
                          format={(v) => `${v.toFixed(1)}%`}
                          placeholder='Not set'
                          validate={(v) => (v < 0 || v > 100) ? 'Margin must be 0–100' : null}
                          inputSuffix='%'
                          inputMin={0}
                          inputMax={100}
                          inputStep={0.1}
                        />
                      </td>
                      <td className='px-6 py-3.5'>
                        <EditableCell
                          value={md?.cost_price_wo_tax ?? null}
                          onSave={(v) => saveCostPrice(asin, v)}
                          format={(v) => `₹${v.toFixed(2)}`}
                          placeholder='Not set'
                          validate={(v) => v < 0 ? 'Must be ≥ 0' : null}
                          inputMin={0}
                          inputStep={0.01}
                        />
                      </td>
                      <td className='px-6 py-3.5'>
                        <EditableCell
                          value={md?.etrade_asp ?? null}
                          onSave={(v) => saveEtradeAsp(asin, v)}
                          format={(v) => `₹${v.toFixed(2)}`}
                          placeholder='Not set'
                          validate={(v) => v < 0 ? 'Must be ≥ 0' : null}
                          inputMin={0}
                          inputStep={0.01}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
            <p className='text-xs text-gray-400 dark:text-zinc-500'>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className='flex items-center gap-1'>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronLeft className='w-4 h-4' />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, page - 2);
                const actual = Math.max(1, Math.min(totalPages, start + i));
                return (
                  <button
                    key={actual}
                    onClick={() => setPage(actual)}
                    className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${page === actual ? 'bg-orange-600 text-white' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    {actual}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronRight className='w-4 h-4' />
              </button>
              <div className='flex items-center gap-1 ml-2 pl-2 border-l border-gray-200 dark:border-zinc-700'>
                <span className='text-xs text-gray-400 dark:text-zinc-500'>Go to</span>
                <input
                  type='number'
                  min={1}
                  max={totalPages}
                  placeholder='…'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = parseInt(e.currentTarget.value);
                      if (v >= 1 && v <= totalPages) {
                        setPage(v);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                  className='w-12 px-1.5 py-1 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                />
                <span className='text-xs text-gray-400 dark:text-zinc-500'>of {totalPages}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
