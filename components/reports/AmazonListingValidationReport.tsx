'use client';

import React, { useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Upload,
  Download,
  RefreshCw,
  ShieldCheck,
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { TABLE_CLASSES } from './TableStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldStatus {
  file: string;
  db: string;
  match: boolean;
  issue?: string | null;
}

interface SCResult {
  source: 'Seller Central';
  sku: string;
  item_name: string;
  found: boolean;
  has_mismatch: boolean;
  hsn: FieldStatus | null;
  gst: FieldStatus | null;
  mrp: FieldStatus | null;
  sp: { file: string; mrp_file: string; match: boolean } | null;
}

interface VCResult {
  source: 'Vendor Central';
  sku: string;
  item_name: string;
  found: boolean;
  has_mismatch: boolean;
  hsn: FieldStatus | null;
  mrp: FieldStatus | null;
}

interface ValidationSummary {
  seller_central_rows: number;
  vendor_central_rows: number;
  seller_central_mismatches: number;
  vendor_central_mismatches: number;
}

type ActiveTab = 'seller_central' | 'vendor_central';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Field cell ───────────────────────────────────────────────────────────────

const FieldCell: React.FC<{ field: FieldStatus | null; found: boolean }> = ({ field, found }) => {
  if (!found || !field) {
    return (
      <span className='text-xs text-red-400 dark:text-red-500 font-mono'>—</span>
    );
  }
  const { file, db, match } = field;
  return (
    <div
      className={`inline-flex flex-col gap-0.5 px-2 py-1 rounded text-xs font-mono min-w-0 ${
        match
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
      }`}
    >
      <span className='font-medium truncate max-w-[160px]' title={file || '—'}>
        {file || '—'}
      </span>
      <span className='text-zinc-400 dark:text-zinc-500 font-normal truncate max-w-[160px]' title={db}>
        db: {db}
      </span>
    </div>
  );
};

// ─── File Upload Card ─────────────────────────────────────────────────────────

interface FileCardProps {
  label: string;
  subtitle: string;
  file: File | null;
  loading: boolean;
  downloading: boolean;
  onPickFile: () => void;
  onClear: () => void;
  onValidate: () => void;
  onDownload: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resultRows?: number;
  resultMismatches?: number;
  validated: boolean;
}

const FileCard: React.FC<FileCardProps> = ({
  label,
  subtitle,
  file,
  loading,
  downloading,
  onPickFile,
  onClear,
  onValidate,
  onDownload,
  inputRef,
  onFileChange,
  resultRows,
  resultMismatches,
  validated,
}) => {
  const canRun = !!file && !loading;

  return (
    <div className='bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden'>
      {/* Card header */}
      <div className='px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0'>
              <FileSpreadsheet className='w-5 h-5 text-zinc-500 dark:text-zinc-400' />
            </div>
            <div>
              <p className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>{label}</p>
              <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-0.5'>{subtitle}</p>
            </div>
          </div>

          {/* Status badge after validation */}
          {validated && resultMismatches !== undefined && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                resultMismatches === 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {resultMismatches === 0 ? (
                <CheckCircle2 className='w-3 h-3' />
              ) : (
                <AlertTriangle className='w-3 h-3' />
              )}
              {resultMismatches === 0
                ? 'All matched'
                : `${resultMismatches} mismatch${resultMismatches !== 1 ? 'es' : ''}`}
            </div>
          )}
        </div>
      </div>

      {/* Upload zone */}
      <div className='px-5 py-4 flex-1'>
        <input
          ref={inputRef}
          type='file'
          accept='.xlsm,.xlsx,.xls'
          className='hidden'
          onChange={onFileChange}
        />

        {file ? (
          <div className='flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'>
            <FileSpreadsheet className='w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0' />
            <span
              className='text-sm text-blue-700 dark:text-blue-300 truncate flex-1 font-medium'
              title={file.name}
            >
              {file.name}
            </span>
            <button
              onClick={onClear}
              className='text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors flex-shrink-0'
              title='Remove file'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        ) : (
          <button
            onClick={onPickFile}
            className='w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-colors'
          >
            <Upload className='w-5 h-5' />
            <span className='text-xs font-medium'>Click to choose file</span>
            <span className='text-xs text-zinc-300 dark:text-zinc-600'>.xlsm / .xlsx</span>
          </button>
        )}

        {validated && resultRows !== undefined && (
          <p className='mt-2 text-xs text-zinc-400 dark:text-zinc-500'>
            {resultRows} row{resultRows !== 1 ? 's' : ''} parsed
          </p>
        )}
      </div>

      {/* Actions */}
      <div className='px-5 pb-5 flex gap-2'>
        <button
          onClick={onDownload}
          disabled={!canRun || downloading}
          className='flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          title='Download full validation report as Excel'
        >
          {downloading ? (
            <RefreshCw className='w-3.5 h-3.5 animate-spin' />
          ) : (
            <Download className='w-3.5 h-3.5' />
          )}
          {downloading ? 'Downloading…' : 'Download'}
        </button>

        <button
          onClick={onValidate}
          disabled={!canRun}
          className='flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
        >
          {loading ? (
            <RefreshCw className='w-3.5 h-3.5 animate-spin' />
          ) : (
            <ShieldCheck className='w-3.5 h-3.5' />
          )}
          {loading ? 'Validating…' : 'Run Validation'}
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AmazonListingValidationReport: React.FC = () => {
  const [sellerFile, setSellerFile] = useState<File | null>(null);
  const [vendorFile, setVendorFile] = useState<File | null>(null);

  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [scResults, setScResults] = useState<SCResult[]>([]);
  const [vcResults, setVcResults] = useState<VCResult[]>([]);

  const [scLoading, setScLoading] = useState(false);
  const [vcLoading, setVcLoading] = useState(false);
  const [scDownloading, setScDownloading] = useState(false);
  const [vcDownloading, setVcDownloading] = useState(false);
  const [scValidated, setScValidated] = useState(false);
  const [vcValidated, setVcValidated] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('seller_central');
  const [search, setSearch] = useState('');
  const [mismatchOnly, setMismatchOnly] = useState(false);

  const sellerInputRef = useRef<HTMLInputElement>(null);
  const vendorInputRef = useRef<HTMLInputElement>(null);

  // ── Shared helpers ────────────────────────────────────────────────────────

  const callValidate = async (formData: FormData) => {
    const res = await axios.post(
      `${API_URL}/amazon_listing_validation/validate`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data as {
      summary: ValidationSummary;
      seller_central: SCResult[];
      vendor_central: VCResult[];
    };
  };

  const callDownload = async (formData: FormData, filename: string) => {
    const res = await axios.post(
      `${API_URL}/amazon_listing_validation/validate/download`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // ── Seller Central ────────────────────────────────────────────────────────

  const handleValidateSC = async () => {
    if (!sellerFile) return;
    setScLoading(true);
    try {
      const fd = new FormData();
      fd.append('seller_central_file', sellerFile);
      const data = await callValidate(fd);
      setSummary((prev) => ({
        seller_central_rows: data.summary.seller_central_rows,
        seller_central_mismatches: data.summary.seller_central_mismatches,
        vendor_central_rows: prev?.vendor_central_rows ?? 0,
        vendor_central_mismatches: prev?.vendor_central_mismatches ?? 0,
      }));
      setScResults(data.seller_central);
      setScValidated(true);
      setActiveTab('seller_central');
      const n = data.summary.seller_central_mismatches;
      if (n === 0) toast.success('Seller Central: all listings match!');
      else toast.warning(`Seller Central: ${n} mismatch${n !== 1 ? 'es' : ''} found.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Seller Central validation failed.');
    } finally {
      setScLoading(false);
    }
  };

  const handleDownloadSC = async () => {
    if (!sellerFile) return;
    setScDownloading(true);
    try {
      const fd = new FormData();
      fd.append('seller_central_file', sellerFile);
      await callDownload(fd, 'seller_central_validation.xlsx');
      toast.success('Downloaded.');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Download failed.');
    } finally {
      setScDownloading(false);
    }
  };

  // ── Vendor Central ────────────────────────────────────────────────────────

  const handleValidateVC = async () => {
    if (!vendorFile) return;
    setVcLoading(true);
    try {
      const fd = new FormData();
      fd.append('vendor_central_file', vendorFile);
      const data = await callValidate(fd);
      setSummary((prev) => ({
        vendor_central_rows: data.summary.vendor_central_rows,
        vendor_central_mismatches: data.summary.vendor_central_mismatches,
        seller_central_rows: prev?.seller_central_rows ?? 0,
        seller_central_mismatches: prev?.seller_central_mismatches ?? 0,
      }));
      setVcResults(data.vendor_central);
      setVcValidated(true);
      setActiveTab('vendor_central');
      const n = data.summary.vendor_central_mismatches;
      if (n === 0) toast.success('Vendor Central: all listings match!');
      else toast.warning(`Vendor Central: ${n} mismatch${n !== 1 ? 'es' : ''} found.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Vendor Central validation failed.');
    } finally {
      setVcLoading(false);
    }
  };

  const handleDownloadVC = async () => {
    if (!vendorFile) return;
    setVcDownloading(true);
    try {
      const fd = new FormData();
      fd.append('vendor_central_file', vendorFile);
      await callDownload(fd, 'vendor_central_validation.xlsx');
      toast.success('Downloaded.');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Download failed.');
    } finally {
      setVcDownloading(false);
    }
  };

  // ── Table data ────────────────────────────────────────────────────────────

  const activeData = activeTab === 'seller_central' ? scResults : vcResults;

  const filteredData = useMemo(() => {
    let data = activeData as (SCResult | VCResult)[];
    if (mismatchOnly) data = data.filter((r) => r.has_mismatch);
    const term = search.toLowerCase();
    if (!term) return data;
    return data.filter(
      (r) =>
        r.sku.toLowerCase().includes(term) ||
        r.item_name.toLowerCase().includes(term)
    );
  }, [activeData, search, mismatchOnly]);

  const hasAnyResults = scValidated || vcValidated;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center'>
          <ShieldCheck className='w-5 h-5 text-orange-600 dark:text-orange-400' />
        </div>
        <div>
          <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>
            Amazon Listing Validation
          </h1>
          <p className='text-sm text-zinc-500 dark:text-zinc-400'>
            Validate Seller Central &amp; Vendor Central listings against the database
          </p>
        </div>
      </div>

      {/* Two independent file cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <FileCard
          label='Seller Central'
          subtitle='Validates HSN · GST · MRP'
          file={sellerFile}
          loading={scLoading}
          downloading={scDownloading}
          onPickFile={() => sellerInputRef.current?.click()}
          onClear={() => {
            setSellerFile(null);
            setScValidated(false);
            setScResults([]);
            setSummary((prev) =>
              prev ? { ...prev, seller_central_rows: 0, seller_central_mismatches: 0 } : null
            );
          }}
          onValidate={handleValidateSC}
          onDownload={handleDownloadSC}
          inputRef={sellerInputRef}
          onFileChange={(e) => setSellerFile(e.target.files?.[0] ?? null)}
          resultRows={scValidated ? summary?.seller_central_rows : undefined}
          resultMismatches={scValidated ? summary?.seller_central_mismatches : undefined}
          validated={scValidated}
        />

        <FileCard
          label='Vendor Central'
          subtitle='Validates HSN · MRP'
          file={vendorFile}
          loading={vcLoading}
          downloading={vcDownloading}
          onPickFile={() => vendorInputRef.current?.click()}
          onClear={() => {
            setVendorFile(null);
            setVcValidated(false);
            setVcResults([]);
            setSummary((prev) =>
              prev ? { ...prev, vendor_central_rows: 0, vendor_central_mismatches: 0 } : null
            );
          }}
          onValidate={handleValidateVC}
          onDownload={handleDownloadVC}
          inputRef={vendorInputRef}
          onFileChange={(e) => setVendorFile(e.target.files?.[0] ?? null)}
          resultRows={vcValidated ? summary?.vendor_central_rows : undefined}
          resultMismatches={vcValidated ? summary?.vendor_central_mismatches : undefined}
          validated={vcValidated}
        />
      </div>

      {/* Results table */}
      {hasAnyResults && (
        <div className={TABLE_CLASSES.container}>
          {/* Tabs – only show validated sources */}
          <div className='flex border-b border-zinc-200 dark:border-zinc-800'>
            {(
              [
                {
                  key: 'seller_central' as ActiveTab,
                  label: 'Seller Central',
                  mismatches: summary?.seller_central_mismatches ?? 0,
                  total: summary?.seller_central_rows ?? 0,
                  show: scValidated,
                },
                {
                  key: 'vendor_central' as ActiveTab,
                  label: 'Vendor Central',
                  mismatches: summary?.vendor_central_mismatches ?? 0,
                  total: summary?.vendor_central_rows ?? 0,
                  show: vcValidated,
                },
              ] as const
            )
              .filter((t) => t.show)
              .map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSearch('');
                    setMismatchOnly(false);
                  }}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      tab.mismatches > 0
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {tab.mismatches > 0 ? `${tab.mismatches} / ${tab.total}` : tab.total}
                  </span>
                </button>
              ))}
          </div>

          {/* Toolbar */}
          <div className={TABLE_CLASSES.headerSection}>
            <div className='flex items-center justify-between gap-3 flex-wrap'>
              <div className='flex items-center gap-3'>
                <span className='text-sm text-zinc-500 dark:text-zinc-400'>
                  {filteredData.length} of {activeData.length} row{activeData.length !== 1 ? 's' : ''}
                  {mismatchOnly && (
                    <span className='ml-1 text-red-500 dark:text-red-400'>(mismatches only)</span>
                  )}
                </span>
                <button
                  onClick={() => setMismatchOnly((v) => !v)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    mismatchOnly
                      ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {mismatchOnly ? 'Mismatches only' : 'Show all'}
                </button>
              </div>
              <input
                type='text'
                placeholder='Search SKU or item name…'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64'
              />
            </div>
          </div>

          {filteredData.length === 0 ? (
            <div className='py-16 text-center'>
              <CheckCircle2 className='w-12 h-12 text-green-400 mx-auto mb-3' />
              <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                {mismatchOnly ? 'No mismatches found' : 'No rows to display'}
              </p>
            </div>
          ) : activeTab === 'seller_central' ? (
            <div className={TABLE_CLASSES.overflow}>
              <table className={TABLE_CLASSES.table}>
                <thead className={TABLE_CLASSES.thead}>
                  <tr>
                    <th className={TABLE_CLASSES.th}>SKU</th>
                    <th className={TABLE_CLASSES.th}>Item Name</th>
                    <th className={TABLE_CLASSES.th}>Status</th>
                    <th className={TABLE_CLASSES.th}>HSN</th>
                    <th className={TABLE_CLASSES.th}>GST</th>
                    <th className={TABLE_CLASSES.th}>MRP</th>
                    <th className={TABLE_CLASSES.th}>SP (File)</th>
                  </tr>
                </thead>
                <tbody className={TABLE_CLASSES.tbody}>
                  {(filteredData as SCResult[]).map((row, idx) => (
                    <tr
                      key={idx}
                      className={`${TABLE_CLASSES.tr} ${
                        row.has_mismatch
                          ? 'bg-red-50/40 dark:bg-red-900/10'
                          : ''
                      }`}
                    >
                      <td className={TABLE_CLASSES.td}>
                        <span className='font-mono text-xs text-zinc-900 dark:text-zinc-100'>
                          {row.sku}
                        </span>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <span className='text-sm text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate block'>
                          {row.item_name || '—'}
                        </span>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        {!row.found ? (
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                            <AlertTriangle className='w-3 h-3' />
                            Not Found
                          </span>
                        ) : row.has_mismatch ? (
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                            <AlertTriangle className='w-3 h-3' />
                            Mismatch
                          </span>
                        ) : (
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                            <CheckCircle2 className='w-3 h-3' />
                            Match
                          </span>
                        )}
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <FieldCell field={row.hsn} found={row.found} />
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <FieldCell field={row.gst} found={row.found} />
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <FieldCell field={row.mrp} found={row.found} />
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        {row.found && row.sp ? (
                          <div
                            className={`inline-flex flex-col gap-0.5 px-2 py-1 rounded text-xs font-mono ${
                              row.sp.match
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            }`}
                          >
                            <span className='font-medium'>{row.sp.file || '—'}</span>
                            <span className='text-zinc-400 dark:text-zinc-500 font-normal'>
                              mrp: {row.sp.mrp_file || '—'}
                            </span>
                          </div>
                        ) : (
                          <span className='text-xs text-zinc-400 dark:text-zinc-500 font-mono'>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={TABLE_CLASSES.overflow}>
              <table className={TABLE_CLASSES.table}>
                <thead className={TABLE_CLASSES.thead}>
                  <tr>
                    <th className={TABLE_CLASSES.th}>SKU</th>
                    <th className={TABLE_CLASSES.th}>Item Name</th>
                    <th className={TABLE_CLASSES.th}>Status</th>
                    <th className={TABLE_CLASSES.th}>HSN</th>
                    <th className={TABLE_CLASSES.th}>MRP</th>
                  </tr>
                </thead>
                <tbody className={TABLE_CLASSES.tbody}>
                  {(filteredData as VCResult[]).map((row, idx) => (
                    <tr
                      key={idx}
                      className={`${TABLE_CLASSES.tr} ${
                        row.has_mismatch
                          ? 'bg-red-50/40 dark:bg-red-900/10'
                          : ''
                      }`}
                    >
                      <td className={TABLE_CLASSES.td}>
                        <span className='font-mono text-xs text-zinc-900 dark:text-zinc-100'>
                          {row.sku}
                        </span>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <span className='text-sm text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate block'>
                          {row.item_name || '—'}
                        </span>
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        {!row.found ? (
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                            <AlertTriangle className='w-3 h-3' />
                            Not Found
                          </span>
                        ) : row.has_mismatch ? (
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                            <AlertTriangle className='w-3 h-3' />
                            Mismatch
                          </span>
                        ) : (
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                            <CheckCircle2 className='w-3 h-3' />
                            Match
                          </span>
                        )}
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <FieldCell field={row.hsn} found={row.found} />
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <FieldCell field={row.mrp} found={row.found} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasAnyResults && (
        <div className='bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 py-16 text-center'>
          <ShieldCheck className='w-12 h-12 text-zinc-200 dark:text-zinc-700 mx-auto mb-3' />
          <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
            Upload a file and click <strong>Run Validation</strong>
          </p>
          <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-1'>
            Each source can be validated independently
          </p>
        </div>
      )}
    </div>
  );
};

export default AmazonListingValidationReport;
