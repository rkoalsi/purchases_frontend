'use client';

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Code2,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';
import { TABLE_CLASSES } from './TableStyles';
import { useAuth } from '@/components/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface BBCodeResult {
  row: number;
  brand: string;
  series: string;
  is_wand_toy: string;
  animal_type: string;
  item_type: string;
  size: string;
  item_name: string;
  color: string;
  bb_code: string | null;
  error: string | null;
}

export default function BBCodeGenerator() {
  const { accessToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BBCodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = { Authorization: `Bearer ${accessToken}` };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API_URL}/bb_code_generator/template`, {
        headers,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'bb_code_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResults([]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!file) {
      toast.error('Please select the filled template file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/bb_code_generator/generate`,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );
      setResults(response.data.results ?? []);
      const successCount = response.data.results.filter(
        (r: BBCodeResult) => r.bb_code
      ).length;
      const errorCount = response.data.results.filter(
        (r: BBCodeResult) => r.error
      ).length;
      if (errorCount > 0) {
        toast.warning(
          `Generated ${successCount} code(s) with ${errorCount} error(s)`
        );
      } else {
        toast.success(`Successfully generated ${successCount} BB code(s)`);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ?? 'Failed to generate BB codes'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResults = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setDownloading(true);
    try {
      const response = await axios.post(
        `${API_URL}/bb_code_generator/generate/download`,
        formData,
        {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' },
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'bb_codes_output.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download results');
    } finally {
      setDownloading(false);
    }
  };

  const successCount = results.filter((r) => r.bb_code).length;
  const errorCount = results.filter((r) => r.error).length;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0'>
          <Code2 className='w-5 h-5 text-white' />
        </div>
        <div>
          <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
            BB Code Generator
          </h1>
          <p className='text-sm text-zinc-500 dark:text-zinc-400'>
            Generate product BB codes by uploading the filled template
          </p>
        </div>
      </div>

      {/* Step 1 – Download Template */}
      <div className='bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5'>
        <h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-1'>
          Step 1 — Download Template
        </h2>
        <p className='text-xs text-zinc-500 dark:text-zinc-400 mb-4'>
          Download the XLSX template, fill in your product details, then upload
          it below to generate codes.
        </p>

        <div className='bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 mb-4 text-xs text-zinc-600 dark:text-zinc-400 space-y-1'>
          <p className='font-medium text-zinc-700 dark:text-zinc-300 mb-2'>
            Code structure: <span className='font-mono text-blue-600 dark:text-blue-400'>BBSSNNIICC</span>
          </p>
          <p><span className='font-mono font-semibold text-zinc-700 dark:text-zinc-200'>BB</span> — Brand (2-letter initials)</p>
          <p><span className='font-mono font-semibold text-zinc-700 dark:text-zinc-200'>SS</span> — Series (first 2 letters of series name, or WA for wand toys)</p>
          <p><span className='font-mono font-semibold text-zinc-700 dark:text-zinc-200'>NN</span> — Size: 00–08 for regular (cats always 00); 01–08 for shoes/boots (shoe size 1–8)</p>
          <p><span className='font-mono font-semibold text-zinc-700 dark:text-zinc-200'>II</span> — Item name (first 2 letters of item name)</p>
          <p><span className='font-mono font-semibold text-zinc-700 dark:text-zinc-200'>CC</span> — Color (2-letter initials)</p>
          <p className='pt-1 text-zinc-500 dark:text-zinc-500'>
            Example: <span className='font-mono'>Zippy Paws + Squeakie Can + Small + Zippy Cola + Red White</span>{' '}
            → <span className='font-mono font-semibold text-blue-600 dark:text-blue-400'>ZPSQ04ZIRW</span>
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors'
        >
          <Download className='w-4 h-4' />
          Download Template
        </button>
      </div>

      {/* Step 2 – Upload & Generate */}
      <div className='bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5'>
        <h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-1'>
          Step 2 — Upload Filled Template
        </h2>
        <p className='text-xs text-zinc-500 dark:text-zinc-400 mb-4'>
          Select the completed template and click Generate.
        </p>

        <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
          {/* File input */}
          <label className='flex items-center gap-2 px-4 py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50'>
            <FileSpreadsheet className='w-4 h-4 text-zinc-400' />
            <span>{file ? file.name : 'Choose .xlsx file'}</span>
            <input
              ref={fileInputRef}
              type='file'
              accept='.xlsx'
              className='hidden'
              onChange={handleFileChange}
            />
          </label>

          {file && (
            <button
              onClick={handleRemoveFile}
              className='p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={!file || loading}
            className='inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? (
              <RefreshCw className='w-4 h-4 animate-spin' />
            ) : (
              <Upload className='w-4 h-4' />
            )}
            {loading ? 'Generating…' : 'Generate Codes'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className='bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-4'>
              <h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>
                Results
              </h2>
              <div className='flex items-center gap-3 text-xs'>
                {successCount > 0 && (
                  <span className='inline-flex items-center gap-1 text-green-600 dark:text-green-400'>
                    <CheckCircle2 className='w-3.5 h-3.5' />
                    {successCount} generated
                  </span>
                )}
                {errorCount > 0 && (
                  <span className='inline-flex items-center gap-1 text-red-500 dark:text-red-400'>
                    <AlertTriangle className='w-3.5 h-3.5' />
                    {errorCount} error(s)
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleDownloadResults}
              disabled={downloading}
              className='inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50'
            >
              {downloading ? (
                <RefreshCw className='w-3.5 h-3.5 animate-spin' />
              ) : (
                <Download className='w-3.5 h-3.5' />
              )}
              Download Results
            </button>
          </div>

          <div className='overflow-x-auto'>
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  <th className={TABLE_CLASSES.th}>Brand</th>
                  <th className={TABLE_CLASSES.th}>Series</th>
                  <th className={TABLE_CLASSES.th}>Wand?</th>
                  <th className={TABLE_CLASSES.th}>Animal</th>
                  <th className={TABLE_CLASSES.th}>Item Type</th>
                  <th className={TABLE_CLASSES.th}>Size</th>
                  <th className={TABLE_CLASSES.th}>Item Name</th>
                  <th className={TABLE_CLASSES.th}>Color</th>
                  <th className={TABLE_CLASSES.th}>BB Code</th>
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {results.map((r) => (
                  <tr key={r.row} className={TABLE_CLASSES.tr}>
                    <td className={TABLE_CLASSES.td}>{r.brand || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.series || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.is_wand_toy || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.animal_type || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.item_type || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.size || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.item_name || '—'}</td>
                    <td className={TABLE_CLASSES.td}>{r.color || '—'}</td>
                    <td className={TABLE_CLASSES.td}>
                      {r.bb_code ? (
                        <span className='inline-block font-mono font-bold text-sm px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'>
                          {r.bb_code}
                        </span>
                      ) : (
                        <span
                          className='inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400'
                          title={r.error ?? ''}
                        >
                          <AlertTriangle className='w-3.5 h-3.5 flex-shrink-0' />
                          {r.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
