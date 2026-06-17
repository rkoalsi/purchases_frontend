'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, Palette, Search, X, ZoomIn,
  Video, Pencil, Plus, Trash2, Check, Loader2, Download,
  LayoutList, AlignJustify, ExternalLink, Zap, Image,
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, SkipForward,
  Star, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Package,
} from 'lucide-react';

const API = `${process.env.NEXT_PUBLIC_API_URL}/design`;
const PAGE_SIZE = 20;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (val?: string) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

function getProductOrderFormImages(p: any): string[] {
  if (!Array.isArray(p.images)) return [];
  return p.images.map((img: any) =>
    typeof img === 'string' ? img : img?.image_url ?? img?.url ?? ''
  ).filter(Boolean);
}

function getProductVideos(p: any): string[] {
  if (!Array.isArray(p.videos)) return [];
  return p.videos.filter(Boolean);
}

// All displayable (non-GDrive) images across image_url + images array
function getAllDisplayableImages(p: any): string[] {
  const result: string[] = [];
  if (p.image_url && !isGDriveUrl(p.image_url)) result.push(p.image_url);
  for (const img of getProductOrderFormImages(p)) {
    if (!isGDriveUrl(img) && !result.includes(img)) result.push(img);
  }
  return result;
}

type Slide = { type: 'image'; url: string } | { type: 'video'; url: string };

function getProductSlides(p: any): Slide[] {
  const slides: Slide[] = getAllDisplayableImages(p).map(url => ({ type: 'image', url }));
  for (const url of getProductVideos(p)) {
    if (url) slides.push({ type: 'video', url });
  }
  return slides;
}

function fmtDims(d: any) {
  if (!d) return null;
  const { length_cm: l, breadth_cm: b, height_cm: h } = d;
  if (!l && !b && !h) return null;
  return `${l ?? '?'} × ${b ?? '?'} × ${h ?? '?'} cm`;
}

// ─── Small shared UI ─────────────────────────────────────────────────────────

function Chip({ label, color = 'gray' }: { label: string; color?: 'gray' | 'purple' | 'emerald' | 'amber' | 'rose' | 'sky' }) {
  const cls: Record<string, string> = {
    gray:    'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
    purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    rose:    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    sky:     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls[color]}`}>{label}</span>;
}

function ViewToggle({ mode, onChange }: { mode: 'compact' | 'expanded'; onChange: (m: 'compact' | 'expanded') => void }) {
  return (
    <div className='flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg'>
      <button onClick={() => onChange('compact')}
        className={`p-1.5 rounded-md transition-colors ${mode === 'compact' ? 'bg-white dark:bg-zinc-900 shadow-sm text-gray-800 dark:text-zinc-100' : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'}`}
        title='Compact view'>
        <LayoutList className='w-4 h-4' />
      </button>
      <button onClick={() => onChange('expanded')}
        className={`p-1.5 rounded-md transition-colors ${mode === 'expanded' ? 'bg-white dark:bg-zinc-900 shadow-sm text-gray-800 dark:text-zinc-100' : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'}`}
        title='Expanded view'>
        <AlignJustify className='w-4 h-4' />
      </button>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onChange }: { currentPage: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = (() => {
    const arr: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  })();
  return (
    <div className='flex items-center gap-1'>
      <button onClick={() => onChange(currentPage - 1)} disabled={currentPage === 1}
        className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'>
        <ChevronLeft className='w-4 h-4' />
      </button>
      {pages.map(pg => (
        <button key={pg} onClick={() => onChange(pg)}
          className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${currentPage === pg ? 'bg-purple-600 text-white' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
          {pg}
        </button>
      ))}
      <button onClick={() => onChange(currentPage + 1)} disabled={currentPage === totalPages}
        className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'>
        <ChevronRight className='w-4 h-4' />
      </button>
      <div className='flex items-center gap-1 ml-2 pl-2 border-l border-gray-200 dark:border-zinc-700'>
        <span className='text-xs text-gray-400'>Go to</span>
        <input type='number' min={1} max={totalPages} placeholder='…'
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const v = parseInt(e.currentTarget.value);
              if (v >= 1 && v <= totalPages) { onChange(v); e.currentTarget.value = ''; }
            }
          }}
          className='w-12 px-1.5 py-1 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' />
        <span className='text-xs text-gray-400'>of {totalPages}</span>
      </div>
    </div>
  );
}

// ─── PIS Upload Result Modal ──────────────────────────────────────────────────

type PisResult = {
  summary: { total_rows: number; updated: number; not_found: number; skipped: number };
  updated: {
    bb_code: string;
    product_name: string;
    sheet: string;
    fields_updated: string[];
    fields_values: Record<string, any>;
  }[];
  not_found: { identifier: string; product_name: string | null; sheet: string }[];
  skipped: { row: number; sheet: string; reason: string }[];
  audit?: { uploaded_by: string; uploaded_at: string; s3_key: string | null };
};

function PisFieldTooltipBody({ field, value }: { field: string; value: any }) {
  if (value === null || value === undefined) return <span className='text-zinc-400'>—</span>;

  if (field === 'features' && Array.isArray(value)) {
    return (
      <ul className='mt-1 space-y-1'>
        {value.map((f: string, i: number) => (
          <li key={i} className='flex gap-2'><span className='text-zinc-500 shrink-0'>•</span><span>{f}</span></li>
        ))}
      </ul>
    );
  }

  if (field === 'image_links' && Array.isArray(value)) {
    return <span>{value.length} link{value.length !== 1 ? 's' : ''}</span>;
  }

  if (field === 'dimensions' && typeof value === 'object') {
    const wp  = value.with_packaging;
    const wop = value.without_packaging;
    return (
      <div className='mt-1 space-y-2.5'>
        {wp && (
          <div>
            <div className='text-zinc-400 text-[10px] uppercase tracking-wide mb-0.5'>With packaging</div>
            {(wp.length_cm || wp.breadth_cm || wp.height_cm) && (
              <div>{wp.length_cm ?? '?'} × {wp.breadth_cm ?? '?'} × {wp.height_cm ?? '?'} cm</div>
            )}
            {wp.gross_weight_g != null && <div>{wp.gross_weight_g} g</div>}
          </div>
        )}
        {wop && (
          <div>
            <div className='text-zinc-400 text-[10px] uppercase tracking-wide mb-0.5'>Without packaging</div>
            {(wop.length_cm || wop.breadth_cm || wop.height_cm) && (
              <div>{wop.length_cm ?? '?'} × {wop.breadth_cm ?? '?'} × {wop.height_cm ?? '?'} cm</div>
            )}
            {wop.net_weight_g != null && <div>{wop.net_weight_g} g</div>}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  return <span>{String(value)}</span>;
}

function PisFieldChip({ field, value }: { field: string; value: any }) {
  return (
    <div className='relative group/chip'>
      <span className='text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full cursor-default select-none'>
        {field}
      </span>
      <div className='pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover/chip:block'>
        <div className='bg-gray-900 dark:bg-zinc-800 text-white text-[11px] rounded-xl px-3 py-2.5 min-w-[150px] max-w-[280px] shadow-2xl'>
          <div className='font-semibold text-zinc-300 border-b border-zinc-700 pb-1 mb-1'>{field}</div>
          <PisFieldTooltipBody field={field} value={value} />
        </div>
        <div className='absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900 dark:border-t-zinc-800' />
      </div>
    </div>
  );
}

function PisModal({
  result, mode, onClose, onConfirm, confirming,
}: {
  result: PisResult;
  mode: 'preview' | 'result';
  onClose: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
}) {
  const [tab, setTab] = useState<'updated' | 'not_found' | 'skipped'>('updated');
  const { summary } = result;
  const isPreview = mode === 'preview';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
      <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800'>
          <div className='flex items-center gap-3'>
            <FileSpreadsheet className='w-5 h-5 text-purple-600' />
            <div>
              <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100'>
                {isPreview ? 'PIS Upload Preview' : 'PIS Upload Results'}
              </h2>
              {isPreview && (
                <p className='text-xs text-amber-600 dark:text-amber-400 mt-0.5'>
                  Review changes below, then confirm to apply
                </p>
              )}
              {!isPreview && result.audit && (
                <p className='text-xs text-gray-400 dark:text-zinc-500 mt-0.5'>
                  Uploaded by {result.audit.uploaded_by}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Summary tiles */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-100 dark:border-zinc-800'>
          {[
            { label: 'Total Rows', value: summary.total_rows, color: 'text-gray-700 dark:text-zinc-200', bg: 'bg-gray-50 dark:bg-zinc-800' },
            { label: isPreview ? 'Will Update' : 'Updated', value: summary.updated, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Not Found', value: summary.not_found, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
            { label: 'Skipped', value: summary.skipped, color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className='text-xs text-gray-500 dark:text-zinc-400 mt-0.5'>{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className='flex gap-1 px-6 pt-3'>
          {([
            { key: 'updated', label: isPreview ? 'Will Update' : 'Updated', icon: CheckCircle2, count: result.updated.length, color: 'text-emerald-600' },
            { key: 'not_found', label: 'Not Found', icon: AlertCircle, count: result.not_found.length, color: 'text-red-500' },
            { key: 'skipped', label: 'Skipped', icon: SkipForward, count: result.skipped.length, color: 'text-amber-500' },
          ] as const).map(({ key, label, icon: Icon, count, color }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-purple-500 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              {label}
              <span className='text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-normal'>{count}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className='flex-1 overflow-y-auto px-6 py-3'>
          {tab === 'updated' && (
            result.updated.length === 0
              ? <p className='text-sm text-gray-400 py-6 text-center'>{isPreview ? 'No products matched' : 'No products updated'}</p>
              : <table className='w-full text-sm'>
                  <thead>
                    <tr className='text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800'>
                      <th className='text-left pb-2 font-medium'>BB Code</th>
                      <th className='text-left pb-2 font-medium'>Product Name</th>
                      <th className='text-left pb-2 font-medium'>Sheet</th>
                      <th className='text-left pb-2 font-medium'>Fields</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-50 dark:divide-zinc-800/60'>
                    {result.updated.map((r, i) => (
                      <tr key={i} className='align-top'>
                        <td className='py-2 pr-3 font-mono text-xs text-purple-700 dark:text-purple-300 whitespace-nowrap'>{r.bb_code}</td>
                        <td className='py-2 pr-3 text-gray-700 dark:text-zinc-300 text-xs'>{r.product_name || '—'}</td>
                        <td className='py-2 pr-3 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap'>{r.sheet}</td>
                        <td className='py-2'>
                          <div className='flex flex-wrap gap-1'>
                            {r.fields_updated.map(f => (
                              <PisFieldChip key={f} field={f} value={r.fields_values?.[f]} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
          {tab === 'not_found' && (
            result.not_found.length === 0
              ? <p className='text-sm text-gray-400 py-6 text-center'>All rows matched</p>
              : <table className='w-full text-sm'>
                  <thead>
                    <tr className='text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800'>
                      <th className='text-left pb-2 font-medium'>Identifier</th>
                      <th className='text-left pb-2 font-medium'>Product Name</th>
                      <th className='text-left pb-2 font-medium'>Sheet</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-50 dark:divide-zinc-800/60'>
                    {result.not_found.map((r, i) => (
                      <tr key={i}>
                        <td className='py-2 pr-3 font-mono text-xs text-red-600 dark:text-red-400 whitespace-nowrap'>{r.identifier}</td>
                        <td className='py-2 pr-3 text-gray-600 dark:text-zinc-400 text-xs max-w-[220px] truncate'>{r.product_name || '—'}</td>
                        <td className='py-2 text-gray-500 dark:text-zinc-400 text-xs'>{r.sheet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
          {tab === 'skipped' && (
            result.skipped.length === 0
              ? <p className='text-sm text-gray-400 py-6 text-center'>No rows skipped</p>
              : <table className='w-full text-sm'>
                  <thead>
                    <tr className='text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800'>
                      <th className='text-left pb-2 font-medium'>Row</th>
                      <th className='text-left pb-2 font-medium'>Sheet</th>
                      <th className='text-left pb-2 font-medium'>Reason</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-50 dark:divide-zinc-800/60'>
                    {result.skipped.map((r, i) => (
                      <tr key={i}>
                        <td className='py-2 pr-3 text-gray-500 dark:text-zinc-400 text-xs'>{r.row}</td>
                        <td className='py-2 pr-3 text-gray-500 dark:text-zinc-400 text-xs'>{r.sheet}</td>
                        <td className='py-2 text-amber-600 dark:text-amber-400 text-xs'>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
        </div>

        <div className='px-6 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
          {isPreview ? (
            <>
              <button onClick={onClose}
                className='px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors'>
                Cancel
              </button>
              <button onClick={onConfirm} disabled={confirming || summary.updated === 0}
                className='flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors'>
                {confirming && <Loader2 className='w-3.5 h-3.5 animate-spin' />}
                {confirming ? 'Applying…' : `Confirm & Apply (${summary.updated} products)`}
              </button>
            </>
          ) : (
            <div className='ml-auto'>
              <button onClick={onClose}
                className='px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors'>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Image Carousel Modal ─────────────────────────────────────────────────────

function ImageCarouselModal({ slides, productName, initialIndex, onClose }: {
  slides: Slide[]; productName: string; initialIndex: number; onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent(c => (c + 1) % slides.length);
      if (e.key === 'ArrowLeft') setCurrent(c => (c - 1 + slides.length) % slides.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length, onClose]);

  const slide = slides[current];

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
      <div className='relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden'>
        <div className='flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800'>
          <p className='text-sm font-medium text-gray-800 dark:text-zinc-200 truncate max-w-[80%]'>{productName}</p>
          <div className='flex items-center gap-3'>
            {slides.length > 1 && <span className='text-xs text-gray-400'>{current + 1} / {slides.length}</span>}
            <button onClick={onClose} className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'>
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>
        <div className='relative bg-gray-50 dark:bg-zinc-950 flex items-center justify-center' style={{ minHeight: 320 }}>
          {slide.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.url} alt={productName} className='max-h-[60vh] max-w-full object-contain p-4' />
          ) : (
            <div className='flex flex-col items-center justify-center gap-4 p-8'>
              <Video className='w-12 h-12 text-gray-300 dark:text-zinc-600' />
              <a href={slide.url} target='_blank' rel='noreferrer'
                className='flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors'>
                <ExternalLink className='w-4 h-4' /> Open Video
              </a>
              <p className='text-xs text-gray-400 truncate max-w-xs'>{slide.url}</p>
            </div>
          )}
          {slides.length > 1 && (
            <>
              <button onClick={() => setCurrent(c => (c - 1 + slides.length) % slides.length)}
                className='absolute left-3 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow text-gray-600 dark:text-zinc-300 hover:bg-white transition-colors'>
                <ChevronLeft className='w-5 h-5' />
              </button>
              <button onClick={() => setCurrent(c => (c + 1) % slides.length)}
                className='absolute right-3 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow text-gray-600 dark:text-zinc-300 hover:bg-white transition-colors'>
                <ChevronRight className='w-5 h-5' />
              </button>
            </>
          )}
        </div>
        {slides.length > 1 && (
          <div className='flex gap-2 px-5 py-3 overflow-x-auto border-t border-gray-100 dark:border-zinc-800'>
            {slides.map((s, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors flex items-center justify-center bg-gray-100 dark:bg-zinc-800 ${i === current ? 'border-purple-500' : 'border-transparent hover:border-gray-300 dark:hover:border-zinc-600'}`}>
                {s.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt='' className='w-full h-full object-cover' />
                ) : (
                  <Video className='w-5 h-5 text-gray-400' />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row thumbnail ────────────────────────────────────────────────────────────

function ProductThumbnail({ product, onOpenCarousel }: { product: any; onOpenCarousel: () => void }) {
  const images = getAllDisplayableImages(product);
  const [imgError, setImgError] = useState(false);
  if (images.length > 0 && !imgError) {
    return (
      <button onClick={onOpenCarousel}
        className='group relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 shrink-0 bg-gray-50 dark:bg-zinc-800 hover:ring-2 hover:ring-purple-400 transition-all'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt={product.name} className='w-full h-full object-cover' onError={() => setImgError(true)} />
        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center'>
          <ZoomIn className='w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity' />
        </div>
      </button>
    );
  }
  return (
    <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shrink-0'>
      <span className='text-white text-xs font-semibold'>{(product.name || 'P').charAt(0).toUpperCase()}</span>
    </div>
  );
}

// ─── Status badges ────────────────────────────────────────────────────────────

const ZOHO_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' },
  inactive: { label: 'Inactive', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' },
};
const PURCHASE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800' },
  inactive: { label: 'Inactive', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' },
  'discontinued until stock lasts': { label: 'Disc. until stock lasts', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
};

function StatusBadge({ value, config }: { value?: string; config: Record<string, { label: string; className: string }> }) {
  if (!value) return <span className='inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700'>—</span>;
  const cfg = config[value] ?? { label: value, className: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${cfg.className}`}>{cfg.label}</span>;
}

// ─── Sheet image helpers ──────────────────────────────────────────────────────

const SHEETS_API = `${process.env.NEXT_PUBLIC_API_URL}/sheets`;

const SLOT_LABELS: Record<number, string> = {
  1:  'Landing image with dog',
  2:  'Landing image without dog · OF #1',
  3:  'Chewing Style · OF #8',
  4:  'Features 1 · OF #3',
  5:  'Features 2 · OF #4',
  6:  'Features 3 · OF #5',
  7:  'Features 4 · OF #6',
  8:  'Features 5 · OF #7',
  9:  'Why Chew / Plush / Teething etc Toys',
  10: 'Safety First',
  11: 'Customer Service',
  12: 'Sizing image · OF #2',
  13: 'Groupshot',
  14: 'Lifestyle 2 (Dog & Cat)',
  15: 'Image URL 15',
  16: 'Image URL 16',
};

function extractGDriveId(url: string): string | null {
  const patterns = [/[?&]id=([A-Za-z0-9_-]+)/, /\/file\/d\/([A-Za-z0-9_-]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function toDisplayUrl(url: string): string {
  if (!url) return '';
  if (isGDriveUrl(url)) {
    const id = extractGDriveId(url);
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
  }
  return url;
}

function SlotImageCard({
  slot, url, isUploading, onUploadClick, onClear, label,
}: {
  slot: string; url: string; isUploading: boolean;
  onUploadClick: () => void; onClear: () => void; label?: string;
}) {
  const displayUrl = toDisplayUrl(url);
  const isDrive    = url ? isGDriveUrl(url) : false;
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [url]);

  return (
    <div className='flex flex-col gap-1'>
    {label && <p className='text-[9px] font-medium text-gray-500 dark:text-zinc-400 truncate' title={label}>{label}</p>}
    <div className='relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700'>
      {url ? (
        <>
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt='' className='w-full h-full object-cover' onError={() => setImgError(true)} />
          ) : (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 p-2'>
              <Package className='w-5 h-5 text-gray-300 dark:text-zinc-600' />
              <a href={url} target='_blank' rel='noreferrer' className='text-[8px] text-purple-500 hover:underline text-center'>Open link</a>
            </div>
          )}
          <button onClick={onClear}
            className='absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-colors' title='Clear'>
            <X className='w-3 h-3' />
          </button>
          <button onClick={onUploadClick}
            className='absolute bottom-5 right-1 w-5 h-5 rounded-full bg-purple-500/90 text-white flex items-center justify-center hover:bg-purple-600 transition-colors' title='Replace'>
            <Upload className='w-3 h-3' />
          </button>
          {isDrive && !imgError && (
            <a href={url} target='_blank' rel='noreferrer'
              className='absolute bottom-5 left-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors' title='Open in Drive'>
              <ExternalLink className='w-2.5 h-2.5' />
            </a>
          )}
        </>
      ) : isUploading ? (
        <div className='absolute inset-0 flex items-center justify-center'>
          <Loader2 className='w-5 h-5 animate-spin text-purple-500' />
        </div>
      ) : (
        <button onClick={onUploadClick}
          className='absolute inset-0 flex items-center justify-center hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors' title='Upload image'>
          <Upload className='w-4 h-4 text-gray-300 dark:text-zinc-600' />
        </button>
      )}
      <span className='absolute bottom-1 left-1 text-[9px] font-bold bg-black/50 text-white px-1 py-px rounded leading-none'>{slot}</span>
    </div>
    </div>
  );
}

// ─── Unified Edit Modal ───────────────────────────────────────────────────────


function UnifiedEditModal({ product, accessToken, onClose, onSaved, initialSection = 'media', initialMediaTab = 'images' }: {
  product: any;
  accessToken: string;
  onClose: () => void;
  onSaved: (updated: any) => void;
  initialSection?: 'media' | 'details' | 'nutrition' | 'sheet_images';
  initialMediaTab?: 'images' | 'videos' | 'drive';
}) {
  const cat = product.catalogue || {};
  const bb_code: string | undefined = cat.bb_code;

  // Unified images list: [image_url, ...images]. First = main image.
  const initAllImages = (): string[] => {
    const main = product.image_url && !isGDriveUrl(product.image_url) ? [product.image_url as string] : [];
    return [...main, ...getProductOrderFormImages(product).filter((u: string) => u !== product.image_url)];
  };

  const [allImages, setAllImages] = useState<string[]>(initAllImages);
  const [videos, setVideos]       = useState<string[]>(getProductVideos(product));
  const [driveLinks, setDriveLinks]   = useState<string[]>(cat.image_links || []);
  const [newDriveLink, setNewDriveLink] = useState('');

  const [features, setFeatures] = useState<string[]>((cat.features || []).map((f: any) => f ?? ''));
  const [catFields, setCatFields] = useState({
    age_group:            cat.age_group            || '',
    pet_size:             cat.pet_size             || '',
    chewing_style:        cat.chewing_style        || '',
    material:             cat.material             || '',
    size_chart:           cat.size_chart           || '',
    ingredient_list:      cat.ingredient_list      || '',
    nutritional_analysis: cat.nutritional_analysis || '',
    squeaker: cat.squeaker ?? false,
    catnip:   cat.catnip   ?? false,
  });

  // Editable dimensions state
  type DimRow = { length_cm: string; breadth_cm: string; height_cm: string; net_weight_g: string };
  const parseDimRow = (d: any): DimRow => ({
    length_cm:    String(d?.length_cm    ?? ''),
    breadth_cm:   String(d?.breadth_cm   ?? ''),
    height_cm:    String(d?.height_cm    ?? ''),
    net_weight_g: String(d?.net_weight_g ?? ''),
  });
  const [dims, setDims] = useState<{ without_packaging: DimRow; with_packaging: DimRow }>({
    without_packaging: parseDimRow(cat.dimensions?.without_packaging),
    with_packaging:    parseDimRow(cat.dimensions?.with_packaging),
  });

  const [activeSection, setActiveSection] = useState<'media' | 'details' | 'nutrition' | 'sheet_images'>(initialSection);
  const [mediaTab, setMediaTab] = useState<'images' | 'videos' | 'drive'>(initialMediaTab);

  // Sheet images state
  const [sheetLoading,        setSheetLoading]        = useState(false);
  const [sheetSaving,         setSheetSaving]          = useState(false);
  const [sheetSaved,          setSheetSaved]           = useState(false);
  const [sheetOrderFormSynced, setSheetOrderFormSynced] = useState(false);
  const [sheetError,          setSheetError]           = useState<string | null>(null);
  const [sheetName,           setSheetName]            = useState('Master');
  const [sheetImages,         setSheetImages]          = useState<Record<string, string>>(
    () => Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i + 1), '']))
  );
  const [sheetUploadingSlot, setSheetUploadingSlot] = useState<string | null>(null);
  const [sheetFetched,       setSheetFetched]       = useState(false);
  const sheetFileInputRef = useRef<HTMLInputElement>(null);
  const sheetPendingSlot  = useRef<string | null>(null);

  useEffect(() => {
    if (activeSection !== 'sheet_images' || sheetFetched) return;
    const sku = product.cf_sku_code || product.sku || '';
    if (!sku) return;
    setSheetLoading(true);
    setSheetError(null);
    axios.get(`${SHEETS_API}/product-images/${encodeURIComponent(sku)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => { setSheetImages(r.data.images || {}); setSheetName(r.data.sheet || 'Master'); setSheetFetched(true); })
      .catch(e => setSheetError(e.response?.data?.detail || e.message))
      .finally(() => setSheetLoading(false));
  }, [activeSection, sheetFetched, product, accessToken]);

  const prevSection = useRef<string>(initialSection);
  useEffect(() => {
    const leaving = prevSection.current;
    prevSection.current = activeSection;
    if (leaving !== 'sheet_images' || activeSection !== 'media') return;
    // Re-fetch product images when switching from Sheet Images → Media
    axios.get(`${API}/products/${product._id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(r => {
      const p = r.data;
      const main  = p.image_url && !isGDriveUrl(p.image_url) ? [p.image_url as string] : [];
      const rest  = (p.images || []).filter((u: string) => u && u !== p.image_url && !isGDriveUrl(u));
      setAllImages([...main, ...rest]);
    }).catch((err) => { console.error('[design/new-items] media re-fetch failed:', err?.response?.data || err?.message); });
  }, [activeSection]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSheetUploadClick = (slot: string) => {
    sheetPendingSlot.current = slot;
    sheetFileInputRef.current?.click();
  };

  const handleSheetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = sheetPendingSlot.current;
    e.target.value = '';
    if (!file || !slot) return;
    setSheetUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('item_id', product.item_id || product._id || '');
      const r = await axios.post(`${SHEETS_API}/product-images/upload`, fd, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSheetImages(prev => ({ ...prev, [slot]: r.data.url }));
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Upload failed');
    } finally {
      setSheetUploadingSlot(null);
    }
  };

  const handleSheetSave = async () => {
    setSheetSaving(true);
    const sku = product.cf_sku_code || product.sku || '';
    try {
      const r = await axios.put(`${SHEETS_API}/product-images/${encodeURIComponent(sku)}`,
        { sheet: sheetName, images: sheetImages },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setSheetSaved(true);
      if (r.data.order_form_synced) setSheetOrderFormSynced(true);
      setTimeout(() => { setSheetSaved(false); setSheetOrderFormSynced(false); }, 3000);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Save failed');
    } finally {
      setSheetSaving(false);
    }
  };

  const handleSheetSwap = (slot: string, dir: -1 | 1) => {
    const other = String(parseInt(slot) + dir);
    if (parseInt(other) < 1 || parseInt(other) > 16) return;
    setSheetImages(prev => { const n = { ...prev }; [n[slot], n[other]] = [n[other], n[slot]]; return n; });
  };
  const [imgCarouselIdx, setImgCarouselIdx] = useState(0);
  const [vidCarouselIdx, setVidCarouselIdx] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingVid, setUploadingVid] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500';
  const labelCls = 'block text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1';
  const dimInputCls = `${inputCls} text-center`;

  const addToList = (list: string[], setList: (v: string[]) => void, val: string, setVal: (v: string) => void) => {
    const u = val.trim();
    if (u && !list.includes(u)) { setList([...list, u]); setVal(''); }
  };

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/products/${product._id}/upload-image`, fd, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      });
      setAllImages(prev => [...prev, res.data.url]);
    } catch { /* error shown to user via browser */ }
    finally { setUploadingImg(false); }
  };

  const uploadVideo = async (file: File) => {
    setUploadingVid(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/products/${product._id}/upload-video`, fd, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      });
      setVideos(prev => [...prev, res.data.url]);
    } catch { /* error shown to user via browser */ }
    finally { setUploadingVid(false); }
  };

  const serializeDimRow = (d: DimRow): Record<string, number | null> | null => {
    const num = (v: string) => v.trim() === '' ? null : Number(v);
    const vals = { length_cm: num(d.length_cm), breadth_cm: num(d.breadth_cm), height_cm: num(d.height_cm), net_weight_g: num(d.net_weight_g) };
    return Object.values(vals).every(v => v === null) ? null : vals;
  };

  const save = async () => {
    setSaving(true);
    try {
      const [mainImg, ...restImgs] = allImages;
      const wp = serializeDimRow(dims.with_packaging);
      const np = serializeDimRow(dims.without_packaging);
      await Promise.all([
        axios.patch(
          `${API}/products/${product._id}/images`,
          { image_url: mainImg || null, images: restImgs, videos },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
        axios.patch(
          `${API}/products/${product._id}/catalogue-details`,
          {
            image_links: driveLinks,
            features: features.map(f => f.trim() || null),
            dimensions: (wp || np) ? { without_packaging: np, with_packaging: wp } : undefined,
            ...catFields,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      ]);
      const [newMain, ...newRest] = allImages;
      onSaved({
        ...product,
        image_url: newMain || undefined,
        images: newRest,
        videos,
        catalogue: { ...cat, image_links: driveLinks, features, ...catFields },
      });
      onClose();
    } finally { setSaving(false); }
  };

  const treatsAttrs = cat.treats_attributes || {};
  const hasTreatsAttrs = Object.keys(treatsAttrs).length > 0;
  const hasNutrition = !!(cat.ingredient_list || cat.nutritional_analysis || hasTreatsAttrs);
  const SECTIONS: { key: 'media' | 'details' | 'nutrition' | 'sheet_images'; label: string }[] = [
    { key: 'media',         label: 'Media' },
    { key: 'details',       label: 'Details' },
    ...(hasNutrition ? [{ key: 'nutrition' as const, label: 'Nutrition' }] : []),
    { key: 'sheet_images',  label: 'Sheet Images' },
  ];

  const MEDIA_TABS = [
    { key: 'images', label: 'Order Form Images' },
    { key: 'videos', label: 'Order Form Videos' },
    { key: 'drive',  label: 'Drive Links' },
  ] as const;

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'>
      <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden'>

        {/* Header */}
        <div className='flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0'>
          <div>
            <div className='flex items-center gap-2 mb-0.5 flex-wrap'>
              {(bb_code || product.cf_sku_code) && (
                <span className='font-mono text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded'>{bb_code || product.cf_sku_code}</span>
              )}
              {product.rate != null && (
                <span className='text-sm font-semibold text-gray-800 dark:text-zinc-200'>{fmt(product.rate)}</span>
              )}
            </div>
            <h2 className='text-sm font-bold text-gray-900 dark:text-zinc-100'>{product.name || 'Product'}</h2>
          </div>
          <button onClick={onClose} className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0 ml-4'>
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Top-level section tabs */}
        <div className='flex gap-1 px-6 pt-3 border-b border-gray-100 dark:border-zinc-800 shrink-0'>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-b-2 ${activeSection === s.key ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className='overflow-y-auto flex-1 px-6 py-5'>

          {/* ── Media section ── */}
          {activeSection === 'media' && (
            <div className='space-y-4'>
              {/* Media sub-tabs */}
              <div className='flex gap-1 border-b border-gray-100 dark:border-zinc-800 -mx-6 px-6 pb-0'>
                {MEDIA_TABS.map(t => (
                  <button key={t.key} onClick={() => setMediaTab(t.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-md capitalize transition-colors border-b-2 ${mediaTab === t.key ? 'border-purple-400 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Images (unified main + OF) */}
              {mediaTab === 'images' && (
                <div className='space-y-3 pt-1'>
                  {/* Mini carousel */}
                  {allImages.length > 0 && (
                    <div className='relative bg-gray-50 dark:bg-zinc-800 rounded-xl overflow-hidden' style={{ minHeight: 180 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={allImages[imgCarouselIdx]} alt=''
                        className='w-full object-contain max-h-48 mx-auto block' />
                      {allImages.length > 1 && (
                        <>
                          <button onClick={() => setImgCarouselIdx(i => (i - 1 + allImages.length) % allImages.length)}
                            className='absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 dark:bg-zinc-700/90 shadow text-gray-600 dark:text-zinc-300 hover:bg-white transition-colors'>
                            <ChevronLeft className='w-4 h-4' />
                          </button>
                          <button onClick={() => setImgCarouselIdx(i => (i + 1) % allImages.length)}
                            className='absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 dark:bg-zinc-700/90 shadow text-gray-600 dark:text-zinc-300 hover:bg-white transition-colors'>
                            <ChevronRight className='w-4 h-4' />
                          </button>
                          <span className='absolute bottom-2 right-3 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded'>
                            {imgCarouselIdx + 1} / {allImages.length}
                          </span>
                        </>
                      )}
                      {imgCarouselIdx === 0 && (
                        <span className='absolute top-2 left-2 text-[9px] font-semibold bg-purple-600 text-white px-1.5 py-0.5 rounded'>PRIMARY</span>
                      )}
                    </div>
                  )}
                  {/* Thumbnail strip */}
                  {allImages.length > 1 && (
                    <div className='flex gap-1.5 overflow-x-auto pb-1'>
                      {allImages.map((url, i) => (
                        <button key={i} onClick={() => setImgCarouselIdx(i)}
                          className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === imgCarouselIdx ? 'border-purple-500' : 'border-transparent hover:border-gray-300 dark:hover:border-zinc-600'} bg-gray-100 dark:bg-zinc-700`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt='' className='w-full h-full object-cover' />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className='text-xs text-gray-500 dark:text-zinc-400'>First image is the primary thumbnail. Upload to add more.</p>
                  {allImages.length === 0 && <p className='text-sm text-gray-400 text-center py-4'>No images yet</p>}
                  {allImages.map((url, i) => (
                    <div key={i} className='flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2'>
                      <a href={url} target='_blank' rel='noreferrer'
                        className='w-12 h-12 rounded overflow-hidden border border-gray-200 dark:border-zinc-700 shrink-0 bg-white hover:ring-2 hover:ring-purple-400 transition-all block'>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt='' className='w-full h-full object-cover' />
                      </a>
                      {i === 0
                        ? <span className='text-[9px] font-semibold bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5'><Star className='w-2.5 h-2.5' />PRIMARY</span>
                        : <button
                            onClick={() => setAllImages(prev => [prev[i], ...prev.filter((_, j) => j !== i)])}
                            className='p-1 rounded text-gray-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors shrink-0'
                            title='Make primary'>
                            <Star className='w-3.5 h-3.5' />
                          </button>
                      }
                      <a href={url} target='_blank' rel='noreferrer'
                        className='flex-1 text-xs text-blue-600 dark:text-blue-400 truncate hover:underline'>{url}</a>
                      <div className='flex items-center gap-0.5 shrink-0'>
                        <button onClick={() => setAllImages(prev => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; })}
                          disabled={i === 0}
                          className='p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-20 transition-colors'
                          title='Move up'>
                          <ArrowUp className='w-3.5 h-3.5' />
                        </button>
                        <button onClick={() => setAllImages(prev => { const n = [...prev]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; })}
                          disabled={i === allImages.length - 1}
                          className='p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-20 transition-colors'
                          title='Move down'>
                          <ArrowDown className='w-3.5 h-3.5' />
                        </button>
                        <button onClick={() => setAllImages(prev => prev.filter((_, j) => j !== i))}
                          className='p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                          title='Delete'>
                          <Trash2 className='w-3.5 h-3.5' />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* hidden file input */}
                  <input ref={imgInputRef} type='file' accept='image/*' className='hidden'
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
                  <button onClick={() => imgInputRef.current?.click()} disabled={uploadingImg}
                    className='w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-500 dark:text-zinc-400 hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50'>
                    {uploadingImg ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
                    {uploadingImg ? 'Uploading…' : 'Upload image'}
                  </button>
                </div>
              )}

              {/* Videos */}
              {mediaTab === 'videos' && (
                <div className='space-y-3 pt-1'>
                  {/* Video carousel (link-based) */}
                  {videos.length > 0 && (
                    <div className='bg-gray-50 dark:bg-zinc-800 rounded-xl p-5 flex flex-col items-center gap-3'>
                      <Video className='w-10 h-10 text-gray-300 dark:text-zinc-600' />
                      <a href={videos[vidCarouselIdx]} target='_blank' rel='noreferrer'
                        className='flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors'>
                        <ExternalLink className='w-4 h-4' /> Open Video {videos.length > 1 ? `${vidCarouselIdx + 1}` : ''}
                      </a>
                      <p className='text-xs text-gray-400 truncate max-w-xs'>{videos[vidCarouselIdx]}</p>
                      {videos.length > 1 && (
                        <div className='flex items-center gap-2 mt-1'>
                          <button onClick={() => setVidCarouselIdx(i => (i - 1 + videos.length) % videos.length)}
                            className='p-1 rounded-full bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-500 hover:text-purple-600 transition-colors'>
                            <ChevronLeft className='w-4 h-4' />
                          </button>
                          <span className='text-xs text-gray-400'>{vidCarouselIdx + 1} / {videos.length}</span>
                          <button onClick={() => setVidCarouselIdx(i => (i + 1) % videos.length)}
                            className='p-1 rounded-full bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-500 hover:text-purple-600 transition-colors'>
                            <ChevronRight className='w-4 h-4' />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className='text-xs text-gray-500 dark:text-zinc-400'>Upload video files (mp4, mov, webm). Displayed as links in the order form.</p>
                  {videos.length === 0 && <p className='text-sm text-gray-400 text-center py-4'>No videos yet</p>}
                  {videos.map((url, i) => (
                    <div key={i} className='flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2'>
                      <Video className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                      <a href={url} target='_blank' rel='noreferrer'
                        className='flex-1 text-xs text-blue-600 dark:text-blue-400 truncate hover:underline'>{url}</a>
                      <div className='flex items-center gap-0.5 shrink-0'>
                        <button onClick={() => setVideos(prev => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; })}
                          disabled={i === 0}
                          className='p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-20 transition-colors'
                          title='Move up'>
                          <ArrowUp className='w-3.5 h-3.5' />
                        </button>
                        <button onClick={() => setVideos(prev => { const n = [...prev]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; })}
                          disabled={i === videos.length - 1}
                          className='p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-20 transition-colors'
                          title='Move down'>
                          <ArrowDown className='w-3.5 h-3.5' />
                        </button>
                        <button onClick={() => setVideos(prev => prev.filter((_, j) => j !== i))}
                          className='p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                          title='Delete'>
                          <Trash2 className='w-3.5 h-3.5' />
                        </button>
                      </div>
                    </div>
                  ))}
                  <input ref={vidInputRef} type='file' accept='video/mp4,video/quicktime,video/webm,video/x-msvideo'
                    className='hidden'
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ''; }} />
                  <button onClick={() => vidInputRef.current?.click()} disabled={uploadingVid}
                    className='w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-500 dark:text-zinc-400 hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50'>
                    {uploadingVid ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
                    {uploadingVid ? 'Uploading…' : 'Upload video'}
                  </button>
                </div>
              )}

              {/* Drive Links */}
              {mediaTab === 'drive' && (
                <div className='space-y-3 pt-1'>
                  <p className='text-xs text-gray-500 dark:text-zinc-400'>Google Drive image links — stored in the catalogue entry. Shown as links only.</p>
                  {driveLinks.length === 0 && <p className='text-sm text-gray-400 text-center py-4'>No drive links yet</p>}
                  {driveLinks.map((url, i) => (
                    <div key={i} className='flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2'>
                      <Image className='w-3.5 h-3.5 text-blue-400 shrink-0' />
                      <a href={url} target='_blank' rel='noreferrer'
                        className='flex-1 text-xs text-blue-600 dark:text-blue-400 truncate hover:underline flex items-center gap-1'>
                        {url} <ExternalLink className='w-3 h-3 shrink-0' />
                      </a>
                      <button onClick={() => setDriveLinks(prev => prev.filter((_, j) => j !== i))}
                        className='p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0'>
                        <Trash2 className='w-3.5 h-3.5' />
                      </button>
                    </div>
                  ))}
                  <div className='flex gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800'>
                    <input value={newDriveLink} onChange={e => setNewDriveLink(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addToList(driveLinks, setDriveLinks, newDriveLink, setNewDriveLink)}
                      placeholder='Paste Google Drive link and press Enter…' className={inputCls} />
                    <button onClick={() => addToList(driveLinks, setDriveLinks, newDriveLink, setNewDriveLink)}
                      className='p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shrink-0'>
                      <Plus className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Details section ── */}
          {activeSection === 'details' && (
            <div className='space-y-4'>
              {/* Status pills */}
              <div className='flex flex-wrap gap-2'>
                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                  product.status === 'active' || product.is_active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
                }`}>
                  Zoho: {product.status === 'active' || product.is_active ? 'Active' : 'Inactive'}
                </span>
                {product.purchase_status && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                    product.purchase_status === 'active'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                      : product.purchase_status === 'inactive'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  }`}>
                    Purchase: {product.purchase_status === 'discontinued until stock lasts' ? 'Disc. until stock lasts' : product.purchase_status}
                  </span>
                )}
              </div>
              {/* Key metrics */}
              <div className='grid grid-cols-2 gap-4 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3'>
                <div>
                  <p className={labelCls}>Price (MRP)</p>
                  <p className='text-base font-bold text-gray-800 dark:text-zinc-100'>
                    {product.rate != null ? fmt(product.rate) : '—'}
                  </p>
                </div>
                <div>
                  <p className={labelCls}>Stock</p>
                  <p className='text-base font-bold text-gray-800 dark:text-zinc-100'>{product.stock ?? product.stock_on_hand ?? 0}</p>
                </div>
              </div>
              {/* Read-only product info */}
              <div className='grid grid-cols-2 gap-x-4 gap-y-3'>
                {[
                  ['Brand', product.brand],
                  ['Category', cat.product_category || product.category_name || product.category],
                  ['Sub-category', cat.sub_category || product.sub_category],
                  ['Series', cat.series || product.series],
                  ['Item Type', product.item_type],
                  ['Unit', product.unit],
                  ['HSN / SAC', product.hsn_or_sac],
                  ['Tax Rate', product.tax_percentage != null ? `${product.tax_percentage}%` : null],
                  ['Reorder Point', product.reorder_level],
                  ['Item ID', product.item_id],
                  ['BB Code', cat.bb_code || product.cf_sku_code],
                ].map(([label, value]) => value != null && value !== '' ? (
                  <div key={label as string}>
                    <p className={labelCls}>{label}</p>
                    <p className='text-sm text-gray-700 dark:text-zinc-300'>{value}</p>
                  </div>
                ) : null)}
              </div>
              {product.description && (
                <div>
                  <p className={labelCls}>Description</p>
                  <p className='text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{product.description}</p>
                </div>
              )}
              {product.created_at && (
                <div className='pt-2 border-t border-gray-100 dark:border-zinc-800'>
                  <p className={labelCls}>Created</p>
                  <p className='text-sm text-gray-700 dark:text-zinc-300'>{new Date(product.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              )}
              {/* Catalogue details */}
              <div className='flex items-center gap-2 pt-2'>
                <span className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider'>Catalogue Details</span>
                <div className='flex-1 h-px bg-gray-100 dark:bg-zinc-800' />
              </div>
              {/* Editable dimensions */}
              <div className='space-y-3'>
                <label className={labelCls}>Dimensions</label>
                {(['without_packaging', 'with_packaging'] as const).map(variant => (
                  <div key={variant} className='bg-gray-50 dark:bg-zinc-800 rounded-lg px-4 py-3 space-y-2'>
                    <p className='text-[10px] font-medium text-gray-400 uppercase tracking-wider'>{variant.replace(/_/g, ' ')}</p>
                    <div className='grid grid-cols-4 gap-2'>
                      {(['length_cm', 'breadth_cm', 'height_cm', 'net_weight_g'] as const).map(field => (
                        <div key={field}>
                          <label className='block text-[9px] text-gray-400 dark:text-zinc-500 text-center mb-1'>
                            {field === 'net_weight_g' ? 'Weight (g)' : field.replace('_cm', '').charAt(0).toUpperCase() + field.replace('_cm', '').slice(1) + ' (cm)'}
                          </label>
                          <input type='number'
                            value={dims[variant][field]}
                            onChange={e => setDims(d => ({ ...d, [variant]: { ...d[variant], [field]: e.target.value } }))}
                            placeholder='—'
                            className={dimInputCls} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-2 gap-3'>
                {(['age_group', 'pet_size', 'chewing_style', 'material', 'size_chart'] as const).map(k => (
                  <div key={k}>
                    <label className={labelCls}>{k.replace(/_/g, ' ')}</label>
                    <input value={catFields[k] as string}
                      onChange={e => setCatFields(f => ({ ...f, [k]: e.target.value }))}
                      className={inputCls} />
                  </div>
                ))}
                <div className='flex gap-4 items-center pt-5'>
                  {(['squeaker', 'catnip'] as const).map(k => (
                    <label key={k} className='flex items-center gap-2 cursor-pointer'>
                      <input type='checkbox' checked={!!catFields[k]}
                        onChange={e => setCatFields(f => ({ ...f, [k]: e.target.checked }))}
                        className='w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500' />
                      <span className='text-sm text-gray-700 dark:text-zinc-300 capitalize'>{k}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Features (1–8)</label>
                <div className='space-y-1.5'>
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className='flex items-center gap-2'>
                      <span className='shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center'>{i + 1}</span>
                      <input value={features[i] ?? ''}
                        onChange={e => setFeatures(f => { const n = [...f]; n[i] = e.target.value; return n; })}
                        placeholder={`Feature ${i + 1}…`}
                        className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Sheet Images section ── */}
          {activeSection === 'sheet_images' && (
            <div className='space-y-4'>
              <input type='file' accept='image/*' ref={sheetFileInputRef} className='hidden' onChange={handleSheetFileChange} />
              {/* header */}
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-xs font-semibold text-gray-700 dark:text-zinc-200'>Master Sheet Images</p>
                  {sheetLoading
                    ? <p className='text-[10px] text-gray-400 mt-0.5'>Loading…</p>
                    : <p className='text-[10px] text-gray-400 mt-0.5'>{sheetName}</p>
                  }
                </div>
                <div className='flex flex-col items-end gap-1'>
                  <div className='flex items-center gap-2'>
                    {sheetError && <span className='text-[10px] text-red-500'>{sheetError}</span>}
                    {sheetSaved && <span className='text-[10px] text-green-600'>Saved!</span>}
                    <button
                      onClick={handleSheetSave}
                      disabled={sheetSaving || sheetLoading}
                      className='px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors'
                    >
                      {sheetSaving ? <Loader2 className='w-3 h-3 animate-spin' /> : <Check className='w-3 h-3' />}
                      Save to Sheet
                    </button>
                  </div>
                  {sheetOrderFormSynced && (
                    <span className='text-[9px] text-green-600 dark:text-green-400'>✓ Order Form synced</span>
                  )}
                </div>
              </div>
              {sheetLoading ? (
                <div className='flex items-center justify-center py-12'>
                  <Loader2 className='w-6 h-6 animate-spin text-purple-500' />
                </div>
              ) : (
                <div className='grid grid-cols-3 gap-3'>
                  {Array.from({ length: 16 }, (_, i) => String(i + 1)).map(slot => (
                    <div key={slot} className='flex flex-col gap-1'>
                      <div className='flex items-center justify-between'>
                        <button
                          onClick={() => handleSheetSwap(slot, -1)}
                          disabled={parseInt(slot) <= 1}
                          className='p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-20 transition-colors'
                          title='Move left'
                        >
                          <ArrowLeft className='w-3 h-3 text-gray-500' />
                        </button>
                        <button
                          onClick={() => handleSheetSwap(slot, 1)}
                          disabled={parseInt(slot) >= 16}
                          className='p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-20 transition-colors'
                          title='Move right'
                        >
                          <ArrowRight className='w-3 h-3 text-gray-500' />
                        </button>
                      </div>
                      <SlotImageCard
                        slot={slot}
                        url={sheetImages[slot] || ''}
                        isUploading={sheetUploadingSlot === slot}
                        onUploadClick={() => handleSheetUploadClick(slot)}
                        onClear={() => setSheetImages(prev => ({ ...prev, [slot]: '' }))}
                        label={SLOT_LABELS[parseInt(slot)]}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Nutrition section ── */}
          {activeSection === 'nutrition' && (
            <div className='space-y-4'>
              <div>
                <label className={labelCls}>Ingredient List</label>
                <textarea rows={5} value={catFields.ingredient_list}
                  onChange={e => setCatFields(f => ({ ...f, ingredient_list: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className={labelCls}>Nutritional Analysis</label>
                <textarea rows={5} value={catFields.nutritional_analysis}
                  onChange={e => setCatFields(f => ({ ...f, nutritional_analysis: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </div>
              {hasTreatsAttrs && (
                <div className='border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-3'>
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider'>Treats Info (from PIS)</p>
                  {(() => {
                    const boolFields: [string, string][] = [
                      ['natural_ingredients', 'Natural Ingredients'],
                      ['grain_free', 'Grain Free'],
                      ['gluten_free', 'Gluten Free'],
                      ['human_grade_ingredients', 'Human Grade'],
                    ];
                    const hasBools = boolFields.some(([k]) => treatsAttrs[k] != null);
                    return hasBools ? (
                      <div className='flex flex-wrap gap-1.5'>
                        {boolFields.map(([k, label]) => treatsAttrs[k] != null ? (
                          <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${treatsAttrs[k] ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 line-through'}`}>
                            {label}
                          </span>
                        ) : null)}
                      </div>
                    ) : null;
                  })()}
                  <div className='grid grid-cols-2 gap-3'>
                    {([
                      ['functional_treat', 'Functional Treat'],
                      ['main_animal_source', 'Main Animal Source'],
                      ['form_used', 'Form Used'],
                      ['source_of_ingredients', 'Source of Ingredients'],
                      ['starch_source', 'Starch Source'],
                      ['plant_protein_source', 'Plant Protein Source'],
                      ['glycerin_type_source', 'Glycerin Type & Source'],
                      ['other_animal_source', 'Other Animal Source'],
                      ['shelf_life', 'Shelf Life'],
                    ] as [string, string][]).map(([k, label]) => treatsAttrs[k] ? (
                      <div key={k}>
                        <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5'>{label}</p>
                        <p className='text-sm text-gray-800 dark:text-zinc-200'>{treatsAttrs[k]}</p>
                      </div>
                    ) : null)}
                  </div>
                  {treatsAttrs.special_additives && (
                    <div>
                      <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1'>Special Additives</p>
                      <div className='bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2'>
                        <p className='text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{treatsAttrs.special_additives}</p>
                      </div>
                    </div>
                  )}
                  {treatsAttrs.animal_body_parts_used && (
                    <div>
                      <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5'>Animal Body Parts Used</p>
                      <p className='text-sm text-gray-800 dark:text-zinc-200'>{treatsAttrs.animal_body_parts_used}</p>
                    </div>
                  )}
                  {treatsAttrs.feeding_guide && (
                    <div>
                      <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1'>Feeding Guide</p>
                      <div className='bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2'>
                        <p className='text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{treatsAttrs.feeding_guide}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0'>
          <button onClick={onClose} className='px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors'>Cancel</button>
          <button onClick={save} disabled={saving}
            className='px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2'>
            {saving ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Check className='w-3.5 h-3.5' />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function DesignNewItemsPage() {
  const { isLoading, accessToken } = useAuth();

  const [products, setProducts]         = useState<any[]>([]);
  const [search, setSearch]             = useState('');
  const [brand, setBrand]               = useState('');
  const [category, setCategory]         = useState('');
  const [zohoStatus, setZohoStatus]     = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [brands, setBrands]             = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories]     = useState<string[]>([]);
  const [page, setPage]                 = useState(1);
  const [total, setTotal]               = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [loading, setLoading]           = useState(false);
  const [viewMode, setViewMode]         = useState<'compact' | 'expanded'>('compact');
  const [carousel, setCarousel]         = useState<{ product: any } | null>(null);
  const [editing, setEditing]           = useState<any | null>(null);
  const [editingSection, setEditingSection] = useState<'media' | 'details' | 'nutrition'>('media');
  const [editingMediaTab, setEditingMediaTab] = useState<'images' | 'videos' | 'drive'>('images');
  const [downloading, setDownloading]   = useState(false);
  const [pisUploading, setPisUploading]   = useState(false);
  const [pisConfirming, setPisConfirming] = useState(false);
  const [pisFile, setPisFile]             = useState<File | null>(null);
  const [pisPreview, setPisPreview]       = useState<PisResult | null>(null);
  const [pisResult, setPisResult]         = useState<PisResult | null>(null);
  const pisInputRef                       = useRef<HTMLInputElement>(null);

  const uploadPis = async (file: File) => {
    if (!accessToken) return;
    setPisUploading(true);
    setPisFile(file);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(`${API}/new-items/upload-pis`, form, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      });
      setPisPreview(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Preview failed');
      setPisFile(null);
    } finally {
      setPisUploading(false);
      if (pisInputRef.current) pisInputRef.current.value = '';
    }
  };

  const confirmPis = async () => {
    if (!accessToken || !pisFile) return;
    setPisConfirming(true);
    try {
      const form = new FormData();
      form.append('file', pisFile);
      const res = await axios.post(`${API}/new-items/confirm-pis`, form, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      });
      setPisPreview(null);
      setPisFile(null);
      setPisResult(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Apply failed');
    } finally {
      setPisConfirming(false);
    }
  };

  const downloadPisTemplate = async () => {
    if (!accessToken) return;
    const res = await axios.get(`${API}/new-items/pis-template`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'PIS_Template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const openEditor = (p: any, section: 'media' | 'details' | 'nutrition' = 'media', mediaTab: 'images' | 'videos' | 'drive' = 'images') => {
    setEditing(p);
    setEditingSection(section);
    setEditingMediaTab(mediaTab);
  };

  useEffect(() => {
    if (!accessToken) return;
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(res => setBrands(res.data.brands || [])).catch(() => {});
    axios.get(`${API}/catalogue-items/categories`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(res => setCategories(res.data.categories || [])).catch(() => {});
  }, [accessToken]);

  const fetchProducts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/new-items`, {
        params: {
          page, limit: PAGE_SIZE,
          search: search || undefined,
          brand: brand || undefined,
          category: category || undefined,
          zoho_status: zohoStatus || undefined,
          purchase_status: purchaseStatus || undefined,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setProducts(res.data.products);
      setTotal(res.data.pagination.totalProducts);
      setTotalPages(res.data.pagination.totalPages);
    } finally { setLoading(false); }
  }, [page, search, brand, category, zohoStatus, purchaseStatus, accessToken]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search, brand, category, zohoStatus, purchaseStatus]);

  const downloadXlsx = async () => {
    if (!accessToken) return;
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/new-items/download`, {
        params: {
          search: search || undefined,
          brand: brand || undefined,
          category: category || undefined,
          zoho_status: zohoStatus || undefined,
          purchase_status: purchaseStatus || undefined,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = 'products.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  if (isLoading)
    return (
      <div className='flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-500'>
        <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-purple-500' />Loading…
      </div>
    );
  if (!accessToken)
    return (
      <div className='flex flex-col items-center justify-center py-24 text-gray-400 dark:text-zinc-500'>
        <Palette className='w-10 h-10 mb-3 opacity-40' /><p className='font-medium'>Please log in to view this page</p>
      </div>
    );

  return (
    <div className='space-y-5'>
      {/* Page header */}
      <div className='flex items-center gap-3'>
        <div className='p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg'>
          <Palette className='w-5 h-5 text-purple-600 dark:text-purple-400' />
        </div>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>New Items</h1>
          <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>Product catalogue and latest additions</p>
        </div>
      </div>

      {/* Hidden PIS file input */}
      <input ref={pisInputRef} type='file' accept='.xlsx,.xls' className='hidden'
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPis(f); }} />

      {/* PIS preview modal (dry-run, before applying) */}
      {pisPreview && (
        <PisModal result={pisPreview} mode='preview' onClose={() => { setPisPreview(null); setPisFile(null); }}
          onConfirm={confirmPis} confirming={pisConfirming} />
      )}
      {/* PIS result modal (after applying) */}
      {pisResult && (
        <PisModal result={pisResult} mode='result' onClose={() => { setPisResult(null); fetchProducts(); }} />
      )}

      {/* Modals */}
      {carousel && (
        <ImageCarouselModal slides={getProductSlides(carousel.product)} productName={carousel.product.name || 'Product'}
          initialIndex={0} onClose={() => setCarousel(null)} />
      )}
      {editing && (
        <UnifiedEditModal product={editing} accessToken={accessToken} initialSection={editingSection} initialMediaTab={editingMediaTab}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setProducts(prev => prev.map(p => p._id === updated._id ? updated : p));
          }} />
      )}

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative flex-1 min-w-[180px] max-w-sm'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
          <input type='text' value={search} onChange={e => setSearch(e.target.value)}
            placeholder='Search name, SKU, or BB code…'
            className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent' />
        </div>
        {brands.length > 0 && (
          <select value={brand} onChange={e => setBrand(e.target.value)}
            className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'>
            <option value=''>All Brands</option>
            {brands.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        )}
        {categories.length > 0 && (
          <select value={category} onChange={e => setCategory(e.target.value)}
            className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'>
            <option value=''>All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={zohoStatus} onChange={e => setZohoStatus(e.target.value)}
          className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'>
          <option value=''>All Zoho Statuses</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
        <select value={purchaseStatus} onChange={e => setPurchaseStatus(e.target.value)}
          className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'>
          <option value=''>All Purchase Statuses</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
          <option value='discontinued until stock lasts'>Disc. until stock lasts</option>
        </select>
        {total > 0 && (
          <span className='text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full'>{total} products</span>
        )}
        <div className='ml-auto flex flex-wrap items-center gap-2'>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <button onClick={downloadXlsx} disabled={downloading}
            className='flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors'>
            {downloading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Download className='w-3.5 h-3.5' />}
            Download Products XLSX
          </button>
          {/* <button onClick={downloadPisTemplate}
            className='flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors'
            title='Download empty PIS template'>
            <FileSpreadsheet className='w-3.5 h-3.5' />
            PIS Template
          </button>
          <button onClick={() => pisInputRef.current?.click()} disabled={pisUploading}
            className='flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors'
            title='Upload Product Information Sheet'>
            {pisUploading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Upload className='w-3.5 h-3.5' />}
            Upload PIS
          </button> */}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className='flex items-center justify-center py-24 gap-3 text-gray-400'>
          <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-purple-500' />Loading…
        </div>
      ) : products.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-24 text-gray-400'>
          <Palette className='w-10 h-10 mb-3 opacity-40' />
          <p className='font-medium'>{search ? `No results for "${search}"` : 'No products found'}</p>
        </div>
      ) : (
        <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10'>#</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Image</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Product</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>BB Code</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Brand</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Category</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>MRP</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Zoho</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Purchase</th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Attributes</th>
                  {viewMode === 'expanded' && (
                    <>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Dims</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Material</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Features</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Drive Links</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Nutrition</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Created</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Updated</th>
                    </>
                  )}
                  <th className='px-4 py-3 w-10'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                {products.map((p: any, i) => {
                  const cat = p.catalogue || {};
                  const features = (cat.features || []).filter(Boolean);
                  const driveLinks: string[] = cat.image_links || [];
                  const dimsNo = cat.dimensions?.without_packaging;

                  return (
                    <tr key={p._id || i} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                      <td className='px-4 py-3 text-xs text-gray-400'>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className='px-4 py-3'>
                        <div className='flex flex-col items-center gap-0.5'>
                          <ProductThumbnail product={p}
                            onOpenCarousel={() => {
                              if (getProductSlides(p).length) setCarousel({ product: p });
                            }} />
                          {(() => { const n = getAllDisplayableImages(p).length + getProductVideos(p).length; return n > 0 ? <span className='text-[9px] text-gray-400'>{n} {n === 1 ? 'item' : 'items'}</span> : null; })()}
                        </div>
                      </td>
                      <td className='px-4 py-3 max-w-[240px]'>
                        <p className='font-medium text-gray-800 dark:text-zinc-200 text-sm leading-snug'>{p.name || 'Unnamed'}</p>
                      </td>
                      <td className='px-4 py-3'>
                        {(cat.bb_code || p.cf_sku_code) ? (
                          <span className='font-mono text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded'>{cat.bb_code || p.cf_sku_code}</span>
                        ) : (
                          <span className='text-gray-400'>—</span>
                        )}
                      </td>
                      <td className='px-4 py-3 text-gray-600 dark:text-zinc-300 text-sm'>{p.brand || '—'}</td>
                      <td className='px-4 py-3'>
                        <p className='text-xs text-gray-600 dark:text-zinc-400 whitespace-nowrap'>{cat.product_category || p.category || '—'}</p>
                        {(cat.sub_category || p.sub_category) && <p className='text-[10px] text-gray-400 dark:text-zinc-500'>{cat.sub_category || p.sub_category}</p>}
                      </td>
                      <td className='px-4 py-3 font-medium text-gray-800 dark:text-zinc-200 whitespace-nowrap text-sm'>
                        {p.rate != null ? fmt(p.rate) : '—'}
                      </td>
                      <td className='px-4 py-3'><StatusBadge value={p.status} config={ZOHO_STATUS_CONFIG} /></td>
                      <td className='px-4 py-3'><StatusBadge value={p.purchase_status} config={PURCHASE_STATUS_CONFIG} /></td>
                      <td className='px-4 py-3'>
                        <button onClick={() => openEditor(p, 'details')} className='flex flex-wrap gap-1 text-left hover:opacity-75 transition-opacity'>
                          {cat.squeaker && <Chip label='Squeaker' color='sky' />}
                          {cat.catnip   && <Chip label='Catnip' color='emerald' />}
                          {cat.age_group && <Chip label={cat.age_group} color='purple' />}
                          {cat.pet_size  && <Chip label={cat.pet_size} color='amber' />}
                          {!cat.squeaker && !cat.catnip && !cat.age_group && !cat.pet_size && (
                            <span className='text-xs text-gray-400'>—</span>
                          )}
                        </button>
                      </td>
                      {viewMode === 'expanded' && (
                        <>
                          <td className='px-4 py-3'>
                            {dimsNo ? (
                              <button onClick={() => openEditor(p, 'details')}
                                className='text-left text-xs text-gray-500 dark:text-zinc-400 hover:text-purple-600 whitespace-nowrap'>
                                {fmtDims(dimsNo)}
                                {dimsNo?.net_weight_g != null && <span className='block text-[10px] text-gray-400'>{dimsNo.net_weight_g}g</span>}
                              </button>
                            ) : <span className='text-xs text-gray-400'>—</span>}
                          </td>
                          <td className='px-4 py-3 text-xs text-gray-500 dark:text-zinc-400'>{cat.material || '—'}</td>
                          <td className='px-4 py-3'>
                            {features.length > 0 ? (
                              <button onClick={() => openEditor(p, 'details')}
                                className='flex items-center gap-0.5 text-xs text-gray-500 hover:text-purple-600'>
                                <Zap className='w-3 h-3' />{features.length}
                              </button>
                            ) : <span className='text-xs text-gray-400'>—</span>}
                          </td>
                          <td className='px-4 py-3'>
                            {driveLinks.length > 0 ? (
                              <button onClick={() => openEditor(p, 'media', 'drive')}
                                className='flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700'>
                                <ExternalLink className='w-3 h-3' />{driveLinks.length}
                              </button>
                            ) : <span className='text-xs text-gray-400'>—</span>}
                          </td>
                          <td className='px-4 py-3'>
                            {(cat.ingredient_list || cat.nutritional_analysis) ? (
                              <button onClick={() => openEditor(p, 'nutrition')}
                                className='text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium'>
                                View
                              </button>
                            ) : <span className='text-xs text-gray-400'>—</span>}
                          </td>
                          <td className='px-4 py-3 text-gray-500 text-xs whitespace-nowrap'>{fmtDate(p.created_at)}</td>
                          <td className='px-4 py-3 text-gray-500 text-xs whitespace-nowrap'>{fmtDate(p.updated_at)}</td>
                        </>
                      )}
                      <td className='px-4 py-3'>
                        <button onClick={() => openEditor(p)}
                          className='p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors'
                          title='Edit product'>
                          <Pencil className='w-3.5 h-3.5' />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
            <p className='text-xs text-gray-400'>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</p>
            <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
