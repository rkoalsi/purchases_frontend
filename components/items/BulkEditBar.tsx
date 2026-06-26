'use client';

import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Download, Upload, Loader2, X, CheckCircle2, AlertCircle, SkipForward } from 'lucide-react';

const DESIGN_API = `${process.env.NEXT_PUBLIC_API_URL}/design`;

type Change = { field: string; old: any; new: any };
type Updated = { identifier: string; product_name?: string; row: number; fields_changed: Change[] };
type PreviewResult = {
  summary: { total_rows: number; updated: number; not_found: number; skipped: number };
  updated: Updated[];
  not_found: { identifier: string; row: number }[];
  skipped: { identifier: string; row: number; reason: string }[];
};

/**
 * Bulk download / upload toolbar for the items pages. Download honors the
 * current page filters; upload shows a dry-run diff dialog before committing.
 */
export default function BulkEditBar({
  token,
  filterParams,
  label = 'Bulk edit',
  onApplied,
}: {
  token: string;
  filterParams?: Record<string, string | undefined>;
  label?: string;
  onApplied?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [tab, setTab] = useState<'updated' | 'not_found' | 'skipped'>('updated');
  const [error, setError] = useState<string | null>(null);

  const authHeader = { Authorization: `Bearer ${token}` };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filterParams || {}).forEach(([k, v]) => { if (v) params.append(k, v); });
      const r = await axios.get(`${DESIGN_API}/products/bulk-edit/download?${params.toString()}`, {
        headers: authHeader,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk_edit.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPendingFile(f);
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await axios.post(`${DESIGN_API}/products/bulk-edit/preview`, fd, { headers: authHeader });
      setPreview(r.data);
      setTab('updated');
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Preview failed');
      setPendingFile(null);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingFile) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      await axios.post(`${DESIGN_API}/products/bulk-edit/confirm`, fd, { headers: authHeader });
      closeDialog();
      onApplied?.();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Apply failed');
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => { setPreview(null); setPendingFile(null); };

  const fmt = (v: any) => (v === '' || v == null ? '—' : String(v));

  return (
    <>
      <div className='flex items-center gap-2'>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50'
          title={`${label} — download all matching products`}
        >
          {downloading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Download className='w-3.5 h-3.5' />}
          Download
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50'
          title={`${label} — upload edited file`}
        >
          {busy && !preview ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Upload className='w-3.5 h-3.5' />}
          Upload
        </button>
        <input ref={fileRef} type='file' accept='.xlsx' className='hidden' onChange={handleFile} />
      </div>

      {error && !preview && <p className='text-xs text-red-500 mt-1'>{error}</p>}

      {preview && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col'>
            <div className='flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800'>
              <div>
                <p className='text-sm font-semibold text-gray-800 dark:text-zinc-100'>Review changes</p>
                <p className='text-xs text-gray-500 dark:text-zinc-400'>
                  {preview.summary.updated} to update · {preview.summary.not_found} not found · {preview.summary.skipped} unchanged
                </p>
              </div>
              <button onClick={closeDialog} className='text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200'>
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='flex border-b border-gray-100 dark:border-zinc-800 px-3'>
              {([
                ['updated', 'Changes', preview.summary.updated, CheckCircle2],
                ['not_found', 'Not found', preview.summary.not_found, AlertCircle],
                ['skipped', 'Unchanged', preview.summary.skipped, SkipForward],
              ] as const).map(([k, lbl, n, Icon]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px ${
                    tab === k ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700'
                  }`}
                >
                  <Icon className='w-3.5 h-3.5' />{lbl} ({n})
                </button>
              ))}
            </div>

            <div className='flex-1 overflow-y-auto p-4 text-sm'>
              {tab === 'updated' && (
                preview.updated.length === 0
                  ? <p className='text-gray-400 text-center py-8'>No changes detected</p>
                  : <div className='space-y-3'>
                      {preview.updated.map((u, i) => (
                        <div key={i} className='border border-gray-100 dark:border-zinc-800 rounded-lg p-3'>
                          <p className='text-xs font-semibold text-gray-800 dark:text-zinc-100'>
                            {u.identifier} <span className='font-normal text-gray-400'>· {u.product_name || ''} · row {u.row}</span>
                          </p>
                          <div className='mt-2 space-y-1'>
                            {u.fields_changed.map((c, j) => (
                              <div key={j} className='grid grid-cols-[140px_1fr] gap-2 text-xs'>
                                <span className='text-gray-500 dark:text-zinc-400'>{c.field}</span>
                                <span>
                                  <span className='line-through text-red-400'>{fmt(c.old)}</span>
                                  <span className='mx-1 text-gray-400'>→</span>
                                  <span className='text-green-600 dark:text-green-400'>{fmt(c.new)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
              )}
              {tab === 'not_found' && (
                preview.not_found.length === 0
                  ? <p className='text-gray-400 text-center py-8'>All SKUs matched</p>
                  : <ul className='space-y-1'>{preview.not_found.map((n, i) => (
                      <li key={i} className='text-xs text-gray-600 dark:text-zinc-300'>Row {n.row}: <span className='font-medium'>{n.identifier}</span> — not found</li>
                    ))}</ul>
              )}
              {tab === 'skipped' && (
                preview.skipped.length === 0
                  ? <p className='text-gray-400 text-center py-8'>None</p>
                  : <ul className='space-y-1'>{preview.skipped.map((s, i) => (
                      <li key={i} className='text-xs text-gray-600 dark:text-zinc-300'>Row {s.row}: <span className='font-medium'>{s.identifier}</span> — {s.reason}</li>
                    ))}</ul>
              )}
            </div>

            {error && <p className='text-xs text-red-500 px-5'>{error}</p>}
            <div className='flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-zinc-800'>
              <button onClick={closeDialog} className='px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'>Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={busy || preview.summary.updated === 0}
                className='flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50'
              >
                {busy ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <CheckCircle2 className='w-3.5 h-3.5' />}
                Apply {preview.summary.updated} change{preview.summary.updated === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
