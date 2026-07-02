'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Check,
  Layers,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MASTER_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1tn_Lj3KR0zXY8B-8ZUkSznZgE4YzyjtAkcpdHzBCgt4/edit';
const VENDOR_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1EDPhQe3OwQacohdbVs194jQZU2L5MEJtA4jOswn8oW8/edit';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasterUpdateResult {
  success: boolean;
  message: string;
  updated: number;
  skipped_no_sku: number;
  skipped_no_product: number;
  skipped_no_product_skus: string[];
  skipped_no_stock: number;
  skipped_no_stock_skus: string[];
  stock_skus_resolved: number;
  stock_date: string;
  products_matched: number;
}

interface VendorTabResult {
  tab: string;
  success: boolean;
  message?: string;
  error?: string;
  updated: number;
  skipped_no_sku?: number;
  skipped_no_data?: number;
  skipped_no_data_skus?: string[];
  header_row?: number;
  header_sample?: string[];
}

interface VendorUpdateResult {
  success: boolean;
  message: string;
  date_range: { start_date: string; end_date: string; note?: string };
  zoho_stock_date?: string;
  sku_data_entries: number;
  tabs: VendorTabResult[];
}

interface AmazonComboResult {
  success: boolean;
  message: string;
  updated: number;
  skipped_no_sku: number;
  skipped_no_product: number;
  products_matched: number;
}

interface CombinedUpdateResult {
  success: boolean;
  message: string;
  stock_date: string;
  master: MasterUpdateResult;
  vendor: VendorUpdateResult;
  amazon_combo: AmazonComboResult;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = 'zinc',
}: {
  label: string;
  value: number | string;
  color?: 'green' | 'blue' | 'amber' | 'zinc' | 'red';
}) {
  const colorClass = {
    green: 'text-green-600 dark:text-green-400',
    blue:  'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    zinc:  'text-zinc-700 dark:text-zinc-300',
    red:   'text-red-600 dark:text-red-400',
  }[color];

  return (
    <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3'>
      <p className={`text-xl font-bold tabular-nums ${colorClass}`}>{value}</p>
      <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-0.5'>{label}</p>
    </div>
  );
}

// ─── Skipped SKU list ─────────────────────────────────────────────────────────

function SkippedList({ label, skus }: { label: string; skus: string[] }) {
  const [open, setOpen] = useState(false);
  if (!skus || skus.length === 0) return null;
  return (
    <div className='mt-2'>
      <button
        onClick={() => setOpen((v) => !v)}
        className='flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200'
      >
        {open ? <ChevronUp className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
        {label} ({skus.length} SKU{skus.length !== 1 ? 's' : ''})
      </button>
      {open && (
        <div className='mt-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 max-h-48 overflow-y-auto'>
          <div className='flex flex-wrap gap-1.5'>
            {skus.map((sku) => (
              <span
                key={sku}
                className='inline-block rounded px-2 py-0.5 text-xs font-mono bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-700 text-zinc-700 dark:text-zinc-300'
              >
                {sku}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result renderers ─────────────────────────────────────────────────────────

function MasterResult({ result }: { result: MasterUpdateResult }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2 text-green-700 dark:text-green-400'>
        <CheckCircle2 className='h-4 w-4 flex-shrink-0' />
        <span className='text-sm font-medium'>{result.message}</span>
      </div>
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'>
        <StatCard label='Rows updated' value={result.updated} color='green' />
        <StatCard label='Products matched' value={result.products_matched} color='blue' />
        <StatCard label='Stock SKUs resolved' value={result.stock_skus_resolved} color='blue' />
        <StatCard label='Stock date' value={result.stock_date || '—'} color='blue' />
        <StatCard label='Skipped (no SKU)' value={result.skipped_no_sku} color='zinc' />
        <StatCard label='Skipped (no product)' value={result.skipped_no_product} color='amber' />
        <StatCard label='Skipped (no stock)' value={result.skipped_no_stock} color='amber' />
      </div>
      <SkippedList label='No matching product in DB' skus={result.skipped_no_product_skus ?? []} />
      <SkippedList label='No stock found in Zoho'    skus={result.skipped_no_stock_skus ?? []} />
    </div>
  );
}

function VendorResult({ result }: { result: VendorUpdateResult }) {
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const totalSkipped = result.tabs.reduce((s, t) => s + (t.skipped_no_data ?? 0), 0);

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2 text-green-700 dark:text-green-400'>
        <CheckCircle2 className='h-4 w-4 flex-shrink-0' />
        <span className='text-sm font-medium'>{result.message}</span>
      </div>

      <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400'>
        <span>
          Period:{' '}
          <strong className='text-zinc-700 dark:text-zinc-200'>
            {result.date_range.start_date} → {result.date_range.end_date}
          </strong>
          {result.date_range.note && (
            <span className='ml-1 text-zinc-400'>({result.date_range.note})</span>
          )}
        </span>
        <span>•</span>
        <span>
          SKUs in report:{' '}
          <strong className='text-zinc-700 dark:text-zinc-200'>{result.sku_data_entries}</strong>
        </span>
        {result.zoho_stock_date && (
          <>
            <span>•</span>
            <span>
              Stock date:{' '}
              <strong className='text-zinc-700 dark:text-zinc-200'>{result.zoho_stock_date}</strong>
            </span>
          </>
        )}
      </div>

      <div className='rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 overflow-x-auto'>
        <table className='w-full text-sm min-w-[480px]'>
          <thead>
            <tr className='bg-zinc-50 dark:bg-zinc-800 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400'>
              <th className='px-4 py-2'>Tab</th>
              <th className='px-4 py-2 text-center'>Status</th>
              <th className='px-4 py-2 text-right'>Updated</th>
              <th className='px-4 py-2 text-right'>Skipped (no SKU)</th>
              <th className='px-4 py-2 text-right'>Skipped (no data)</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800'>
            {result.tabs.map((tab) => (
              <tr key={tab.tab} className='bg-white dark:bg-zinc-900'>
                <td className='px-4 py-2 font-medium text-zinc-800 dark:text-zinc-200'>{tab.tab}</td>
                <td className='px-4 py-2 text-center'>
                  {tab.success ? (
                    <span className='inline-flex items-center gap-1 text-green-600 dark:text-green-400'>
                      <CheckCircle2 className='h-3.5 w-3.5' /> OK
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-1 text-red-600 dark:text-red-400'>
                      <AlertTriangle className='h-3.5 w-3.5' />
                      <span className='truncate max-w-[160px]' title={tab.error}>{tab.error ?? 'Error'}</span>
                    </span>
                  )}
                </td>
                <td className='px-4 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300'>{tab.updated}</td>
                <td className='px-4 py-2 text-right tabular-nums text-zinc-400 dark:text-zinc-500'>{tab.skipped_no_sku ?? '—'}</td>
                <td className='px-4 py-2 text-right tabular-nums text-zinc-400 dark:text-zinc-500'>{tab.skipped_no_data ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalSkipped > 0 && (
        <div>
          <button
            onClick={() => setSkippedOpen((v) => !v)}
            className='flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200'
          >
            {skippedOpen ? <ChevronUp className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
            Show skipped SKUs ({totalSkipped} across all tabs)
          </button>
          {skippedOpen && (
            <div className='mt-2 space-y-1'>
              {result.tabs.map((tab) =>
                tab.skipped_no_data_skus?.length ? (
                  <SkippedList key={tab.tab} label={`${tab.tab} — no report data`} skus={tab.skipped_no_data_skus} />
                ) : null,
              )}
            </div>
          )}
        </div>
      )}

      {result.tabs.some((t) => !t.success) && (
        <div>
          <button
            onClick={() => setDebugOpen((v) => !v)}
            className='flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          >
            {debugOpen ? <ChevronUp className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
            {debugOpen ? 'Hide' : 'Show'} column-detection debug for failed tabs
          </button>
          {debugOpen && (
            <div className='mt-2 space-y-2'>
              {result.tabs
                .filter((t) => !t.success && t.header_sample)
                .map((tab) => (
                  <div
                    key={tab.tab}
                    className='rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs'
                  >
                    <p className='font-medium text-zinc-700 dark:text-zinc-300 mb-1'>
                      {tab.tab} — header row {tab.header_row}
                    </p>
                    <p className='text-zinc-500 dark:text-zinc-400 break-all'>
                      {tab.header_sample?.join(' | ')}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Combined result renderer ─────────────────────────────────────────────────

function CombinedResult({ result }: { result: CombinedUpdateResult }) {
  const [masterOpen, setMasterOpen] = useState(true);

  const masterUpdated = result.master?.updated ?? 0;
  const comboUpdated  = result.amazon_combo?.updated ?? 0;

  return (
    <div className='space-y-3'>
      {/* Summary bar */}
      <div className='flex items-center gap-2 text-green-700 dark:text-green-400'>
        <CheckCircle2 className='h-4 w-4 flex-shrink-0' />
        <span className='text-sm font-medium'>{result.message}</span>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
        <StatCard label='Masters rows updated'        value={masterUpdated} color='green' />
        <StatCard label='Amazon Combo rows updated'   value={comboUpdated}  color='blue' />
      </div>

      {/* Masters accordion */}
      <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden'>
        <button
          onClick={() => setMasterOpen((v) => !v)}
          className='w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors'
        >
          <div className='flex items-center gap-2'>
            <FileSpreadsheet className='h-4 w-4 text-zinc-500' />
            <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
              Masters Workbook
            </span>
            <span className='text-xs text-zinc-400'>— {masterUpdated} rows updated</span>
          </div>
          {masterOpen ? <ChevronUp className='h-4 w-4 text-zinc-400' /> : <ChevronDown className='h-4 w-4 text-zinc-400' />}
        </button>
        {masterOpen && (
          <div className='p-4 border-t border-zinc-100 dark:border-zinc-800'>
            <MasterResult result={result.master} />
          </div>
        )}
      </div>

      {/* Vendor accordion */}
      {/* <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden'>
        <button
          onClick={() => setVendorOpen((v) => !v)}
          className='w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors'
        >
          <div className='flex items-center gap-2'>
            <FileSpreadsheet className='h-4 w-4 text-zinc-500' />
            <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
              Product Costing Workbook
            </span>
            <span className='text-xs text-zinc-400'>
              — {tabsOk}/{vendorTabs.length} tabs, {vendorUpdated} rows updated
            </span>
          </div>
          {vendorOpen ? <ChevronUp className='h-4 w-4 text-zinc-400' /> : <ChevronDown className='h-4 w-4 text-zinc-400' />}
        </button>
        {vendorOpen && (
          <div className='p-4 border-t border-zinc-100 dark:border-zinc-800'>
            <VendorResult result={result.vendor} />
          </div>
        )}
      </div> */}
    </div>
  );
}

// ─── Sheet URL editor ─────────────────────────────────────────────────────────

function SheetUrlEditor({
  jobId,
  defaultUrl,
  label,
  savedUrl,
  onSave,
}: {
  jobId: string;
  defaultUrl: string;
  label: string;
  savedUrl: string;
  onSave: (jobId: string, url: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveUrl = savedUrl || defaultUrl;
  const isCustom = !!savedUrl && savedUrl !== defaultUrl;

  const startEdit = () => {
    setDraft(savedUrl || defaultUrl);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const confirm = async () => {
    const trimmed = draft.trim();
    const value = trimmed === defaultUrl ? '' : trimmed;
    setSaving(true);
    try {
      await onSave(jobId, value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => setEditing(false);
  const reset  = () => onSave(jobId, '');

  if (editing) {
    return (
      <div className='flex items-center gap-1.5'>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel(); }}
          className='flex-1 text-xs px-2 py-1 rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none min-w-0'
          placeholder='Paste Google Sheet URL or sheet ID…'
          autoFocus
        />
        <button
          onClick={confirm}
          disabled={saving}
          className='text-green-600 hover:text-green-700 dark:text-green-400 disabled:opacity-50'
        >
          {saving ? <RefreshCw className='h-4 w-4 animate-spin' /> : <Check className='h-4 w-4' />}
        </button>
        <button onClick={cancel} className='text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'>
          <X className='h-4 w-4' />
        </button>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-2 flex-wrap'>
      <a
        href={effectiveUrl}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline'
      >
        <ExternalLink className='h-3 w-3' />
        {label}
      </a>
      {isCustom && (
        <span className='rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs px-2 py-0.5'>
          custom
        </span>
      )}
      <button
        onClick={startEdit}
        className='inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
        title='Change target sheet'
      >
        <Pencil className='h-3 w-3' /> Change
      </button>
      {isCustom && (
        <button
          onClick={reset}
          className='text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400'
        >
          Reset
        </button>
      )}
    </div>
  );
}

// ─── Run button ───────────────────────────────────────────────────────────────

function RunButton({
  running,
  onClick,
  label = 'Run Update',
  variant = 'default',
}: {
  running: boolean;
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'primary';
}) {
  const base = variant === 'primary'
    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <button
      onClick={onClick}
      disabled={running}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${base} disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition-colors flex-shrink-0`}
    >
      <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
      {running ? 'Updating…' : label}
    </button>
  );
}

// ─── Error display ────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className='flex items-start gap-2 text-red-600 dark:text-red-400'>
      <AlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
      <span className='text-sm'>{message}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SheetsUpdater() {
  const { accessToken } = useAuth();

  // combined job state
  const [combinedRunning, setCombinedRunning] = useState(false);
  const [combinedResult, setCombinedResult] = useState<CombinedUpdateResult | null>(null);
  const [combinedError, setCombinedError] = useState<string | null>(null);

  // individual job state
  const [masterRunning, setMasterRunning] = useState(false);
  const [masterResult, setMasterResult]   = useState<MasterUpdateResult | null>(null);
  const [masterError, setMasterError]     = useState<string | null>(null);

  const [vendorRunning, setVendorRunning] = useState(false);
  const [vendorResult, setVendorResult]   = useState<VendorUpdateResult | null>(null);
  const [vendorError, setVendorError]     = useState<string | null>(null);

  const [comboRunning, setComboRunning] = useState(false);
  const [comboResult, setComboResult]   = useState<AmazonComboResult | null>(null);
  const [comboError, setComboError]     = useState<string | null>(null);

  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});

  const headers = { Authorization: `Bearer ${accessToken}` };

  useEffect(() => {
    axios
      .get(`${API_URL}/sheets/config`, { headers })
      .then((res) => setSavedUrls(res.data ?? {}))
      .catch(() => {});
  }, []);

  const handleSaveUrl = useCallback(async (jobId: string, url: string) => {
    await axios.put(`${API_URL}/sheets/config/${jobId}`, { sheet_url: url }, { headers });
    setSavedUrls((prev) => ({ ...prev, [jobId]: url }));
    toast.success(url ? 'Custom sheet URL saved' : 'Reset to default sheet');
  }, [accessToken]);

  const resolvedMasterUrl = savedUrls['master-stock'] || MASTER_SHEET_URL;
  const resolvedVendorUrl = savedUrls['vendor-sheets'] || '';

  // ── Combined run ────────────────────────────────────────────────────────────
  const handleRunAll = async () => {
    setCombinedRunning(true);
    setCombinedResult(null);
    setCombinedError(null);

    const body: Record<string, string> = {};
    if (resolvedMasterUrl) body.master_sheet_id = resolvedMasterUrl;

    try {
      const res = await axios.post(
        `${API_URL}/sheets/update-all`,
        body,
        { headers, timeout: 600_000 },
      );
      setCombinedResult(res.data);
      toast.success(res.data.message);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? err.message)
        : String(err);
      setCombinedError(msg);
      toast.error(`Update failed: ${msg}`);
    } finally {
      setCombinedRunning(false);
    }
  };

  // ── Master run ──────────────────────────────────────────────────────────────
  const handleRunMaster = async () => {
    setMasterRunning(true);
    setMasterResult(null);
    setMasterError(null);

    try {
      const res = await axios.post(
        `${API_URL}/sheets/update-master-stock`,
        resolvedMasterUrl ? { sheet_id: resolvedMasterUrl } : {},
        { headers, timeout: 600_000 },
      );
      setMasterResult(res.data);
      toast.success(res.data.message);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? err.message)
        : String(err);
      setMasterError(msg);
      toast.error(`Update failed: ${msg}`);
    } finally {
      setMasterRunning(false);
    }
  };

  // ── Vendor run ──────────────────────────────────────────────────────────────
  const handleRunVendor = async () => {
    setVendorRunning(true);
    setVendorResult(null);
    setVendorError(null);

    try {
      const res = await axios.post(
        `${API_URL}/sheets/update-vendor-sheets`,
        resolvedVendorUrl ? { sheet_id: resolvedVendorUrl } : {},
        { headers, timeout: 600_000 },
      );
      setVendorResult(res.data);
      toast.success(res.data.message);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? err.message)
        : String(err);
      setVendorError(msg);
      toast.error(`Update failed: ${msg}`);
    } finally {
      setVendorRunning(false);
    }
  };

  // ── Amazon ComboProducts run ────────────────────────────────────────────────
  const handleRunAmazonCombo = async () => {
    setComboRunning(true);
    setComboResult(null);
    setComboError(null);
    try {
      const res = await axios.post(
        `${API_URL}/sheets/update-amazon-combo-status`,
        {},
        { headers, timeout: 120_000 },
      );
      setComboResult(res.data);
      toast.success(res.data.message);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? err.message)
        : String(err);
      setComboError(msg);
      toast.error(`Update failed: ${msg}`);
    } finally {
      setComboRunning(false);
    }
  };

  const anyRunning = combinedRunning || masterRunning || vendorRunning || comboRunning;

  return (
    <div className='space-y-6 p-4 sm:p-6 max-w-6xl'>

      {/* Page header */}
      <div>
        <h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>Product Costing</h1>
        <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
          Push live data from Zoho and the master report into Google Sheets workbooks.
        </p>
      </div>

      {/* ── Update All card (primary) ─────────────────────────────────────────── */}
      <div className='rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
        {/* Header */}
        <div className='px-5 py-4 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900'>
          <div className='flex flex-wrap items-start justify-between gap-2 sm:gap-4'>
            <div className='flex items-start gap-3'>
              <div className='rounded-lg bg-indigo-100 dark:bg-indigo-900/60 p-2 flex-shrink-0'>
                <Layers className='h-5 w-5 text-indigo-600 dark:text-indigo-400' />
              </div>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <h2 className='font-semibold text-zinc-900 dark:text-zinc-100'>
                    Update Both Workbooks
                  </h2>
                  <span className='inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 font-medium'>
                    <Zap className='h-3 w-3' /> Recommended
                  </span>
                </div>
                <p className='mt-0.5 text-sm text-zinc-500 dark:text-zinc-400'>
                  Fetches Zoho stock and runs the master report once, then writes all sheets in parallel — faster than running them separately.
                </p>
              </div>
            </div>
            <RunButton
              running={combinedRunning || anyRunning && !combinedRunning}
              onClick={handleRunAll}
              label='Run Both'
              variant='primary'
            />
          </div>
        </div>

        {/* Sheet targets */}
        <div className='px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 border-b border-zinc-100 dark:border-zinc-800'>
          <div>
            <p className='text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'>Masters Workbook</p>
            <SheetUrlEditor
              jobId='master-stock'
              defaultUrl={resolvedMasterUrl}
              label='Masters Workbook → Master + Amazon ComboProducts'
              savedUrl={savedUrls['master-stock'] ?? ''}
              onSave={handleSaveUrl}
            />
          </div>
          {/* <div>
            <p className='text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'>Product Costing Workbook</p>
            <SheetUrlEditor
              jobId='vendor-sheets'
              defaultUrl={VENDOR_SHEET_URL}
              label='Product Costing → all brand tabs'
              savedUrl={savedUrls['vendor-sheets'] ?? ''}
              onSave={handleSaveUrl}
            />
          </div> */}
        </div>

        {/* Columns written */}
        <div className='px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800'>
          <div>
            <p className='text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-1.5'>Masters writes</p>
            <div className='flex flex-wrap gap-1.5'>
              {[
                { name: 'Col CS', source: 'Zoho stock (live API)' },
                { name: 'Status', source: 'products.purchase_status' },
              ].map((col) => (
                <div key={col.name} className='rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1'>
                  <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300'>{col.name}</span>
                  <span className='text-xs text-zinc-400 ml-1.5'>← {col.source}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className='text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-1.5'>Amazon ComboProducts writes</p>
            <div className='flex flex-wrap gap-1.5'>
              {[{ name: 'Status', source: 'products.purchase_status' }].map((col) => (
                <div key={col.name} className='rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1'>
                  <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300'>{col.name}</span>
                  <span className='text-xs text-zinc-400 ml-1.5'>← {col.source}</span>
                </div>
              ))}
            </div>
          </div>
          {/* <div>
            <p className='text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-1.5'>Product Costing writes</p>
            <div className='flex flex-wrap gap-1.5'>
              {[
                { name: 'Total Sales (3 mo)', source: 'Master report' },
                { name: 'Days in Stock (3 mo)', source: 'Master report' },
                { name: 'Zoho Stock', source: 'Live API' },
                { name: 'Avg Sales/day', source: '=formula' },
              ].map((col) => (
                <div key={col.name} className='rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1'>
                  <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300'>{col.name}</span>
                  <span className='text-xs text-zinc-400 ml-1.5'>← {col.source}</span>
                </div>
              ))}
            </div>
          </div> */}
        </div>

        {/* Combined result */}
        {(combinedResult || combinedError) && (
          <div className='p-5 border-t border-zinc-100 dark:border-zinc-800'>
            {combinedError  && <ErrorBanner message={combinedError} />}
            {combinedResult && <CombinedResult result={combinedResult} />}
          </div>
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────────── */}
      <div className='flex items-center gap-3'>
        <div className='flex-1 h-px bg-zinc-200 dark:bg-zinc-700' />
        <span className='text-xs text-zinc-400 dark:text-zinc-500 font-medium'>or run individually</span>
        <div className='flex-1 h-px bg-zinc-200 dark:bg-zinc-700' />
      </div>

      {/* ── Individual cards (2-column grid) ─────────────────────────────────── */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>

        {/* Masters card */}
        <div className='rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
          <div className='p-4 border-b border-zinc-100 dark:border-zinc-800'>
            <div className='flex flex-wrap items-start justify-between gap-2 sm:gap-3'>
              <div className='flex items-start gap-2.5'>
                <FileSpreadsheet className='mt-0.5 h-5 w-5 text-green-600 flex-shrink-0' />
                <div>
                  <h3 className='font-semibold text-sm text-zinc-900 dark:text-zinc-100'>
                    Masters Workbook
                  </h3>
                  <p className='mt-0.5 text-xs text-zinc-500 dark:text-zinc-400'>
                    Stock and purchase status — column CS + status column.
                  </p>
                  <div className='mt-1.5'>
                    <SheetUrlEditor
                      jobId='master-stock'
                      defaultUrl={resolvedMasterUrl}
                      label='Masters Workbook → Master sheet'
                      savedUrl={savedUrls['master-stock'] ?? ''}
                      onSave={handleSaveUrl}
                    />
                  </div>
                </div>
              </div>
              <RunButton running={masterRunning} onClick={handleRunMaster} />
            </div>
          </div>

          <div className='px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-1.5'>
            {[
              { name: 'Col CS', source: 'Zoho stock' },
              { name: 'Status', source: 'DB' },
            ].map((col) => (
              <div key={col.name} className='rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1'>
                <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300'>{col.name}</span>
                <span className='text-xs text-zinc-400 ml-1'>← {col.source}</span>
              </div>
            ))}
            <span className='ml-auto text-xs text-zinc-400 self-center'>~30 sec</span>
          </div>

          {(masterResult || masterError) && (
            <div className='p-4'>
              {masterError  && <ErrorBanner message={masterError} />}
              {masterResult && <MasterResult result={masterResult} />}
            </div>
          )}
        </div>

        {/* Vendor / Product Costing card — hidden for now */}
        {/* <div className='rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
          ...Product Costing Workbook card...
        </div> */}

        {/* Amazon ComboProducts card */}
        <div className='rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
          <div className='p-4 border-b border-zinc-100 dark:border-zinc-800'>
            <div className='flex flex-wrap items-start justify-between gap-2 sm:gap-3'>
              <div className='flex items-start gap-2.5'>
                <FileSpreadsheet className='mt-0.5 h-5 w-5 text-green-600 flex-shrink-0' />
                <div>
                  <h3 className='font-semibold text-sm text-zinc-900 dark:text-zinc-100'>
                    Amazon ComboProducts
                  </h3>
                  <p className='mt-0.5 text-xs text-zinc-500 dark:text-zinc-400'>
                    Masters Workbook → "Amazon ComboProducts" sheet. Writes purchase status per SKU.
                  </p>
                </div>
              </div>
              <RunButton running={comboRunning} onClick={handleRunAmazonCombo} />
            </div>
          </div>

          <div className='px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-1.5'>
            {[{ name: 'Status', source: 'products.purchase_status' }].map((col) => (
              <div key={col.name} className='rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1'>
                <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300'>{col.name}</span>
                <span className='text-xs text-zinc-400 ml-1'>← {col.source}</span>
              </div>
            ))}
            <span className='ml-auto text-xs text-zinc-400 self-center'>~15 sec</span>
          </div>

          {(comboResult || comboError) && (
            <div className='p-4'>
              {comboError && <ErrorBanner message={comboError} />}
              {comboResult && (
                <div className='flex flex-wrap gap-3'>
                  <StatCard label='Updated' value={comboResult.updated} color='green' />
                  <StatCard label='Skipped (no product)' value={comboResult.skipped_no_product} color={comboResult.skipped_no_product > 0 ? 'amber' : 'zinc'} />
                  <StatCard label='Products matched' value={comboResult.products_matched} color='blue' />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
