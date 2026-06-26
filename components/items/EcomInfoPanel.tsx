'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, CheckCircle, Sparkles } from 'lucide-react';

const SHEETS_API = `${process.env.NEXT_PUBLIC_API_URL}/sheets`;
const FEATURE_COUNT = 9;

/**
 * Editable "Ecom Information" panel — Amazon Title, Description, Features 1-9.
 * Saving writes to design_catalogue AND the Master sheet (cols Z, BC-BK, BL)
 * via PUT /sheets/ecom-info/{sku}. Shared by /design/new-items and /items/zoho.
 */
export default function EcomInfoPanel({
  product,
  token,
  onSaved,
}: {
  product: any;
  token: string;
  onSaved?: (vals: { amazon_title: string; amazon_description: string; amazon_features: string[] }) => void;
}) {
  const sku = product?.cf_sku_code || product?.sku || '';
  const cat = product?.catalogue || {};
  const initialFeats: string[] = [
    ...((cat.amazon_features || []) as any[]).map((f) => (f ?? '').toString()),
    ...Array(FEATURE_COUNT).fill(''),
  ].slice(0, FEATURE_COUNT);

  const [title, setTitle] = useState<string>(cat.amazon_title || '');
  const [description, setDescription] = useState<string>(cat.amazon_description || '');
  const [features, setFeatures] = useState<string[]>(initialFeats);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string>('');

  // Pull live values from the Updated Masters sheet (cols Z, BC-BK, BL).
  useEffect(() => {
    if (!sku) return;
    setLoading(true);
    axios
      .get(`${SHEETS_API}/ecom-info/${encodeURIComponent(sku)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        setTitle(r.data.amazon_title || '');
        setDescription(r.data.amazon_description || '');
        const f: string[] = [
          ...((r.data.amazon_features || []) as any[]).map((x) => (x ?? '').toString()),
          ...Array(FEATURE_COUNT).fill(''),
        ].slice(0, FEATURE_COUNT);
        setFeatures(f);
        setSource(r.data.source || '');
      })
      .catch((e) => setError(e.response?.data?.detail || e.message || 'Failed to load'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku]);

  const setFeat = (i: number, v: string) =>
    setFeatures((f) => { const n = [...f]; n[i] = v; return n; });

  const handleSave = async () => {
    if (!sku) { setError('No SKU code on this product'); return; }
    setSaving(true);
    setError(null);
    const amazon_features = features.map((f) => f.trim());
    try {
      await axios.put(
        `${SHEETS_API}/ecom-info/${encodeURIComponent(sku)}`,
        { amazon_title: title.trim(), amazon_description: description.trim(), amazon_features },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Ecom information saved to sheet');
      onSaved?.({ amazon_title: title.trim(), amazon_description: description.trim(), amazon_features });
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Save failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1';
  const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

  return (
    <div className='space-y-4 px-1 py-2 sm:px-2'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Sparkles className='w-4 h-4 text-amber-500' />
          <p className='text-xs font-semibold text-gray-700 dark:text-zinc-200'>Ecom Information</p>
          {loading && <Loader2 className='w-3.5 h-3.5 animate-spin text-gray-400' />}
          {!loading && source === 'master_sheet' && (
            <span className='text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded'>from Masters sheet</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
            saved ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          {saving ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : saved ? <CheckCircle className='w-3.5 h-3.5' /> : null}
          {saved ? 'Saved!' : 'Save to Sheet'}
        </button>
      </div>

      {error && <p className='text-xs text-red-500'>{error}</p>}

      <div>
        <label className={labelCls}>Amazon Title</label>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Amazon listing title' />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea className={`${inputCls} min-h-[90px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Amazon product description' />
      </div>

      <div>
        <label className={labelCls}>Features (1–9) · Feature 1 is Primary</label>
        <div className='space-y-2'>
          {features.map((f, i) => (
            <div key={i} className='flex items-center gap-2'>
              <span className='w-5 text-[10px] font-semibold text-gray-400 dark:text-zinc-500'>{i + 1}</span>
              <input
                className={inputCls}
                value={f}
                onChange={(e) => setFeat(i, e.target.value)}
                placeholder={i === 0 ? 'Primary feature' : `Feature ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
