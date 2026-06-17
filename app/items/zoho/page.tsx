'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, BookOpen, Search, RefreshCw,
  ArrowDownUp, X, ZoomIn, Video, ExternalLink, Package,
  Upload, Download, CheckCircle, AlertCircle, Loader2, Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { BRAND_GROUPS, BRAND_CONSTITUENTS, mergeBrandOptions } from '@/util/brandGroups';

const API = `${process.env.NEXT_PUBLIC_API_URL}/zoho`;
const PAGE_SIZE = 10;

type Tab = 'products' | 'composites' | 'pis';

// ─── Image helpers ─────────────────────────────────────────────────────────────

function isGDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

function getAllDisplayableImages(p: any): string[] {
  const result: string[] = [];
  if (p.image_url && !isGDriveUrl(p.image_url)) result.push(p.image_url);
  const extra: any[] = Array.isArray(p.images) ? p.images : [];
  for (const img of extra) {
    const url = typeof img === 'string' ? img : img?.image_url ?? img?.url ?? '';
    if (url && !isGDriveUrl(url) && !result.includes(url)) result.push(url);
  }
  return result;
}

function getProductVideos(p: any): string[] {
  if (!Array.isArray(p.videos)) return [];
  return p.videos.filter(Boolean);
}

type Slide = { type: 'image'; url: string } | { type: 'video'; url: string };

function getProductSlides(p: any): Slide[] {
  const slides: Slide[] = getAllDisplayableImages(p).map(url => ({ type: 'image', url }));
  for (const url of getProductVideos(p)) slides.push({ type: 'video', url });
  return slides;
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const pages = (() => {
    const arr: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  })();

  return (
    <div className='flex items-center gap-1'>
      <button
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        className='p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
      >
        <ChevronLeft className='w-4 h-4' />
      </button>
      {pages.map((pg) => (
        <button
          key={pg}
          onClick={() => onChange(pg)}
          className={`w-8 h-8 text-sm rounded-md font-medium transition-colors ${
            currentPage === pg
              ? 'bg-blue-600 text-white'
              : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          {pg}
        </button>
      ))}
      <button
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
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
                onChange(v);
                e.currentTarget.value = '';
              }
            }
          }}
          className='w-12 px-1.5 py-1 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        />
        <span className='text-xs text-gray-400 dark:text-zinc-500'>of {totalPages}</span>
      </div>
    </div>
  );
}

// ─── Image Carousel Modal ──────────────────────────────────────────────────────

function ImageCarouselModal({
  slides,
  productName,
  initialIndex,
  onClose,
}: {
  slides: Slide[];
  productName: string;
  initialIndex: number;
  onClose: () => void;
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
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
    >
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
              <a
                href={slide.url}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors'
              >
                <ExternalLink className='w-4 h-4' /> Open Video
              </a>
              <p className='text-xs text-gray-400 truncate max-w-xs'>{slide.url}</p>
            </div>
          )}
          {slides.length > 1 && (
            <>
              <button
                onClick={() => setCurrent(c => (c - 1 + slides.length) % slides.length)}
                className='absolute left-3 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow text-gray-600 dark:text-zinc-300 hover:bg-white transition-colors'
              >
                <ChevronLeft className='w-5 h-5' />
              </button>
              <button
                onClick={() => setCurrent(c => (c + 1) % slides.length)}
                className='absolute right-3 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow text-gray-600 dark:text-zinc-300 hover:bg-white transition-colors'
              >
                <ChevronRight className='w-5 h-5' />
              </button>
            </>
          )}
        </div>
        {slides.length > 1 && (
          <div className='flex gap-2 px-5 py-3 overflow-x-auto border-t border-gray-100 dark:border-zinc-800'>
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors flex items-center justify-center bg-gray-100 dark:bg-zinc-800 ${
                  i === current ? 'border-blue-500' : 'border-transparent hover:border-gray-300 dark:hover:border-zinc-600'
                }`}
              >
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

// ─── Product Thumbnail ─────────────────────────────────────────────────────────

function ProductThumbnail({ product, onOpenCarousel }: { product: any; onOpenCarousel: () => void }) {
  const images = getAllDisplayableImages(product);
  const [imgError, setImgError] = useState(false);

  if (images.length > 0 && !imgError) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onOpenCarousel(); }}
        className='group relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 shrink-0 bg-gray-50 dark:bg-zinc-800 hover:ring-2 hover:ring-blue-400 transition-all'
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt={product.name} className='w-full h-full object-cover' onError={() => setImgError(true)} />
        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center'>
          <ZoomIn className='w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity' />
        </div>
      </button>
    );
  }
  return (
    <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0'>
      <span className='text-white text-xs font-semibold'>{(product.name || 'P').charAt(0).toUpperCase()}</span>
    </div>
  );
}

// ─── Product Detail Drawer ─────────────────────────────────────────────────────

type DrawerTab = 'media' | 'details' | 'catalogue' | 'nutrition' | 'master_images';

function ProductDetailDrawer({
  product,
  onClose,
  onOpenCarousel,
  token,
}: {
  product: any;
  onClose: () => void;
  onOpenCarousel: (idx: number) => void;
  token: string;
}) {
  const cat = product.catalogue || {};
  const images = getAllDisplayableImages(product);
  const videos = getProductVideos(product);
  const driveLinks: string[] = cat.image_links || [];
  const features: string[] = (cat.features || []).filter(Boolean);
  const hasNutrition = !!(cat.ingredient_list || cat.nutritional_analysis);

  const [activeImg, setActiveImg] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('media');

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'media',         label: 'Media' },
    { key: 'details',       label: 'Details' },
    { key: 'catalogue',     label: 'Catalogue' },
    ...(hasNutrition ? [{ key: 'nutrition' as DrawerTab, label: 'Nutrition' }] : []),
    { key: 'master_images', label: 'Images' },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fmtINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const Field = ({ label, value }: { label: string; value?: string | number | null }) =>
    value != null && value !== '' ? (
      <div>
        <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5'>{label}</p>
        <p className='text-sm text-gray-800 dark:text-zinc-200'>{value}</p>
      </div>
    ) : null;

  const fmtDims = (d: any) => {
    if (!d) return null;
    const { length_cm: l, breadth_cm: b, height_cm: h } = d;
    if (!l && !b && !h) return null;
    return `${l ?? '?'} × ${b ?? '?'} × ${h ?? '?'} cm`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className='fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]' onClick={onClose} />

      {/* Drawer — fixed full height, flex column so tabs + content never overflow */}
      <div className='fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col'>

        {/* Header — shrink-0 so it never scrolls away */}
        <div className='flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0'>
          <div className='flex-1 min-w-0 pr-3'>
            <p className='text-xs font-mono text-blue-600 dark:text-blue-400 mb-0.5'>{product.cf_sku_code || product.sku || '—'}</p>
            <h2 className='text-base font-bold text-gray-900 dark:text-zinc-100 leading-snug'>{product.name || 'Unnamed'}</h2>
          </div>
          <button
            onClick={onClose}
            className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Tab bar — shrink-0 so always visible */}
        <div className='flex gap-0 border-b border-gray-100 dark:border-zinc-800 shrink-0 px-5'>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content — fills remaining space */}
        <div className='flex-1 overflow-y-auto min-h-0'>

          {/* ── Media tab ── */}
          {activeTab === 'media' && (
            <div>
              {/* Main image */}
              {images.length > 0 ? (
                <div className='border-b border-gray-100 dark:border-zinc-800'>
                  <div className='relative bg-gray-50 dark:bg-zinc-950 flex items-center justify-center h-56'>
                    {!imgError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={images[activeImg]}
                        alt={product.name}
                        className='max-h-full max-w-full object-contain p-4'
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className='flex flex-col items-center gap-2 text-gray-300 dark:text-zinc-600'>
                        <Package className='w-10 h-10' />
                        <p className='text-xs'>Image not available</p>
                      </div>
                    )}
                    <button
                      onClick={() => onOpenCarousel(activeImg)}
                      className='absolute top-3 right-3 p-1.5 rounded-lg bg-white/90 dark:bg-zinc-800/90 shadow text-gray-500 hover:text-blue-600 transition-colors'
                      title='View fullscreen'
                    >
                      <ZoomIn className='w-4 h-4' />
                    </button>
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => { setImgError(false); setActiveImg(i => (i - 1 + images.length) % images.length); }}
                          className='absolute left-3 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow text-gray-600 hover:bg-white transition-colors'
                        >
                          <ChevronLeft className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => { setImgError(false); setActiveImg(i => (i + 1) % images.length); }}
                          className='absolute right-3 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow text-gray-600 hover:bg-white transition-colors'
                        >
                          <ChevronRight className='w-4 h-4' />
                        </button>
                        <span className='absolute bottom-2 right-3 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded'>
                          {activeImg + 1} / {images.length}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Thumbnail strip */}
                  {images.length > 1 && (
                    <div className='flex gap-2 px-4 py-3 overflow-x-auto'>
                      {images.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => { setImgError(false); setActiveImg(i); }}
                          className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors bg-gray-100 dark:bg-zinc-800 ${
                            i === activeImg ? 'border-blue-500' : 'border-transparent hover:border-gray-300 dark:hover:border-zinc-600'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt='' className='w-full h-full object-cover' />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex flex-col items-center gap-2 py-10 border-b border-gray-100 dark:border-zinc-800 text-gray-300 dark:text-zinc-600'>
                  <Package className='w-10 h-10' />
                  <p className='text-xs text-gray-400 dark:text-zinc-500'>No images available</p>
                </div>
              )}

              {/* Videos */}
              <div className='px-5 py-4 space-y-3'>
                <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider'>
                  Videos {videos.length > 0 && <span className='ml-1 text-blue-500'>{videos.length}</span>}
                </p>
                {videos.length === 0 ? (
                  <p className='text-xs text-gray-400 dark:text-zinc-500'>No videos</p>
                ) : (
                  <div className='space-y-1.5'>
                    {videos.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
                      >
                        <Video className='w-3.5 h-3.5 shrink-0' />
                        <span className='truncate flex-1'>{url}</span>
                        <ExternalLink className='w-3 h-3 shrink-0' />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Drive links */}
              {driveLinks.length > 0 && (
                <div className='px-5 pb-4 space-y-2 border-t border-gray-100 dark:border-zinc-800'>
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider pt-4'>
                    Drive Links <span className='ml-1 text-blue-500'>{driveLinks.length}</span>
                  </p>
                  <div className='space-y-1.5'>
                    {driveLinks.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
                      >
                        <ExternalLink className='w-3.5 h-3.5 shrink-0' />
                        <span className='truncate flex-1'>{url}</span>
                        <ExternalLink className='w-3 h-3 shrink-0' />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Details tab ── */}
          {activeTab === 'details' && (
            <div className='px-5 py-4 space-y-4'>
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
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5'>Price (MRP)</p>
                  <p className='text-base font-bold text-gray-800 dark:text-zinc-100'>
                    {product.rate != null ? fmtINR(product.rate) : '—'}
                  </p>
                </div>
                <div>
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5'>Stock</p>
                  <p className='text-base font-bold text-gray-800 dark:text-zinc-100'>{product.stock ?? product.stock_on_hand ?? 0}</p>
                </div>
              </div>

              {/* Zoho fields */}
              <div className='grid grid-cols-2 gap-x-4 gap-y-3'>
                <Field label='Brand' value={product.brand} />
                <Field label='Category' value={product.category_name || product.category} />
                <Field label='Sub-category' value={cat.sub_category || product.sub_category} />
                <Field label='Series' value={cat.series || product.series} />
                <Field label='Item Type' value={product.item_type} />
                <Field label='Unit' value={product.unit} />
                <Field label='HSN / SAC' value={product.hsn_or_sac} />
                <Field label='Tax Rate' value={product.tax_percentage != null ? `${product.tax_percentage}%` : null} />
                <Field label='Reorder Point' value={product.reorder_level} />
                <Field label='Item ID' value={product.item_id} />
                <Field label='BB Code' value={cat.bb_code || product.cf_sku_code} />
              </div>

              {product.description && (
                <div>
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1'>Description</p>
                  <p className='text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{product.description}</p>
                </div>
              )}

              {product.created_at && (
                <div className='pt-2 border-t border-gray-100 dark:border-zinc-800'>
                  <Field label='Created' value={new Date(product.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                </div>
              )}
            </div>
          )}

          {/* ── Catalogue tab ── */}
          {activeTab === 'catalogue' && (
            <div className='px-5 py-4 space-y-5'>

              {/* Attributes */}
              <div>
                <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3'>Attributes</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-3'>
                  <Field label='Age Group' value={cat.age_group} />
                  <Field label='Pet Size' value={cat.pet_size} />
                  <Field label='Chewing Style' value={cat.chewing_style} />
                  <Field label='Material' value={cat.material} />
                  <Field label='Size Chart' value={cat.size_chart} />
                  <Field label='Product Category' value={cat.product_category} />
                </div>
                {(cat.squeaker || cat.catnip) && (
                  <div className='flex gap-2 mt-3'>
                    {cat.squeaker && (
                      <span className='inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200 dark:border-sky-800'>Squeaker</span>
                    )}
                    {cat.catnip && (
                      <span className='inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'>Catnip</span>
                    )}
                  </div>
                )}
                {!cat.age_group && !cat.pet_size && !cat.chewing_style && !cat.material && !cat.size_chart && !cat.product_category && !cat.squeaker && !cat.catnip && (
                  <p className='text-xs text-gray-400 dark:text-zinc-500'>No attributes recorded</p>
                )}
              </div>

              {/* Dimensions */}
              <div>
                <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3'>Dimensions</p>
                {(['without_packaging', 'with_packaging'] as const).map(variant => {
                  const d = cat.dimensions?.[variant];
                  const dims = fmtDims(d);
                  if (!dims && !d?.net_weight_g) return null;
                  return (
                    <div key={variant} className='bg-gray-50 dark:bg-zinc-800 rounded-lg px-4 py-3 mb-2'>
                      <p className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2'>{variant.replace(/_/g, ' ')}</p>
                      <div className='grid grid-cols-4 gap-2 text-center'>
                        {dims && (
                          <>
                            <div>
                              <p className='text-[9px] text-gray-400 mb-0.5'>L (cm)</p>
                              <p className='text-sm font-medium text-gray-800 dark:text-zinc-200'>{d?.length_cm ?? '—'}</p>
                            </div>
                            <div>
                              <p className='text-[9px] text-gray-400 mb-0.5'>B (cm)</p>
                              <p className='text-sm font-medium text-gray-800 dark:text-zinc-200'>{d?.breadth_cm ?? '—'}</p>
                            </div>
                            <div>
                              <p className='text-[9px] text-gray-400 mb-0.5'>H (cm)</p>
                              <p className='text-sm font-medium text-gray-800 dark:text-zinc-200'>{d?.height_cm ?? '—'}</p>
                            </div>
                          </>
                        )}
                        {d?.net_weight_g != null && (
                          <div>
                            <p className='text-[9px] text-gray-400 mb-0.5'>Weight (g)</p>
                            <p className='text-sm font-medium text-gray-800 dark:text-zinc-200'>{d.net_weight_g}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!cat.dimensions?.without_packaging && !cat.dimensions?.with_packaging && (
                  <p className='text-xs text-gray-400 dark:text-zinc-500'>No dimensions recorded</p>
                )}
              </div>

              {/* Features */}
              <div>
                <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3'>
                  Features {features.length > 0 && <span className='ml-1 text-blue-500'>{features.length}</span>}
                </p>
                {features.length === 0 ? (
                  <p className='text-xs text-gray-400 dark:text-zinc-500'>No features recorded</p>
                ) : (
                  <ol className='space-y-1.5'>
                    {features.map((f, i) => (
                      <li key={i} className='flex items-start gap-2'>
                        <span className='shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5'>{i + 1}</span>
                        <p className='text-sm text-gray-700 dark:text-zinc-300 leading-snug'>{f}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          {/* ── Nutrition tab ── */}
          {activeTab === 'nutrition' && (
            <div className='px-5 py-4 space-y-4'>
              {cat.ingredient_list && (
                <div>
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2'>Ingredient List</p>
                  <div className='bg-gray-50 dark:bg-zinc-800 rounded-lg px-4 py-3'>
                    <p className='text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{cat.ingredient_list}</p>
                  </div>
                </div>
              )}
              {cat.nutritional_analysis && (
                <div>
                  <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2'>Nutritional Analysis</p>
                  <div className='bg-gray-50 dark:bg-zinc-800 rounded-lg px-4 py-3'>
                    <p className='text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{cat.nutritional_analysis}</p>
                  </div>
                </div>
              )}
              {!cat.ingredient_list && !cat.nutritional_analysis && (
                <p className='text-sm text-gray-400 text-center py-8'>No nutrition information recorded</p>
              )}
            </div>
          )}

          {/* ── Master Images tab ── */}
          {activeTab === 'master_images' && (
            <MasterImagesTab product={product} token={token} />
          )}

        </div>
      </div>
    </>
  );
}

// ─── Master Sheet Images Tab ───────────────────────────────────────────────────

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
  // drive.google.com/open?id=ID  or  /file/d/ID/  or  uc?id=ID
  const patterns = [
    /[?&]id=([A-Za-z0-9_-]+)/,
    /\/file\/d\/([A-Za-z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
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

function SlotCard({
  slot, url, displayUrl, isDrive, isUploading, onUploadClick, onClear, label,
}: {
  slot: string; url: string; displayUrl: string; isDrive: boolean;
  isUploading: boolean; onUploadClick: () => void; onClear: () => void; label?: string;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [url]);

  return (
    <>
    {label && <p className='text-[9px] font-medium text-gray-500 dark:text-zinc-400 truncate mb-0.5' title={label}>{label}</p>}
    <div className='relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700'>
      {url ? (
        <>
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt=''
              className='w-full h-full object-cover'
              onError={() => setImgError(true)}
            />
          ) : (
            /* Broken image fallback — show link icon + open button */
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 p-2'>
              <Package className='w-5 h-5 text-gray-300 dark:text-zinc-600' />
              <a
                href={url}
                target='_blank'
                rel='noreferrer'
                className='text-[8px] text-blue-500 hover:underline text-center leading-tight line-clamp-2 break-all'
                title={url}
              >
                Open link
              </a>
            </div>
          )}
          <button
            onClick={onClear}
            className='absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-colors'
            title='Clear'
          >
            <X className='w-3 h-3' />
          </button>
          <button
            onClick={onUploadClick}
            className='absolute bottom-5 right-1 w-5 h-5 rounded-full bg-blue-500/90 text-white flex items-center justify-center hover:bg-blue-600 transition-colors'
            title={isDrive ? 'Replace with upload' : 'Replace'}
          >
            <Upload className='w-3 h-3' />
          </button>
          {isDrive && !imgError && (
            <a
              href={url}
              target='_blank'
              rel='noreferrer'
              className='absolute bottom-5 left-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors'
              title='Open in Drive'
            >
              <ExternalLink className='w-2.5 h-2.5' />
            </a>
          )}
        </>
      ) : isUploading ? (
        <div className='absolute inset-0 flex items-center justify-center'>
          <Loader2 className='w-5 h-5 animate-spin text-blue-500' />
        </div>
      ) : (
        <button
          onClick={onUploadClick}
          className='absolute inset-0 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
          title='Upload image'
        >
          <Upload className='w-4 h-4 text-gray-300 dark:text-zinc-600' />
        </button>
      )}
      <span className='absolute bottom-1 left-1 text-[9px] font-bold bg-black/50 text-white px-1 py-px rounded leading-none'>
        {slot}
      </span>
    </div>
    </>
  );
}

function MasterImagesTab({ product, token }: { product: any; token: string }) {
  const sku    = product.cf_sku_code || product.sku || '';
  const itemId = product.item_id || '';

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [orderFormSynced, setOrderFormSynced] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [sheet,         setSheet]         = useState('Master');
  const [images,        setImages]        = useState<Record<string, string>>(
    () => Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i + 1), '']))
  );
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot  = useRef<string | null>(null);

  useEffect(() => {
    if (!sku) return;
    setLoading(true);
    setError(null);
    axios.get(`${SHEETS_API}/product-images/${encodeURIComponent(sku)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        setImages(r.data.images || {});
        setSheet(r.data.sheet  || 'Master');
      })
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, [sku, token]);

  const handleUploadClick = (slot: string) => {
    pendingSlot.current = slot;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = pendingSlot.current;
    e.target.value = '';
    if (!file || !slot) return;
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('item_id', itemId);
      const r = await axios.post(`${SHEETS_API}/product-images/upload`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setImages(prev => ({ ...prev, [slot]: r.data.url }));
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleClear = (slot: string) =>
    setImages(prev => ({ ...prev, [slot]: '' }));

  const handleSwap = (slot: string, dir: -1 | 1) => {
    const other = String(parseInt(slot) + dir);
    if (parseInt(other) < 1 || parseInt(other) > 16) return;
    setImages(prev => {
      const next = { ...prev };
      [next[slot], next[other]] = [next[other], next[slot]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await axios.put(
        `${SHEETS_API}/product-images/${encodeURIComponent(sku)}`,
        { sheet, images },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSaved(true);
      if (r.data.order_form_synced) setOrderFormSynced(true);
      setTimeout(() => { setSaved(false); setOrderFormSynced(false); }, 3000);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className='flex items-center justify-center py-16'>
      <Loader2 className='w-6 h-6 animate-spin text-blue-500' />
    </div>
  );

  if (error) return (
    <div className='px-5 py-8 text-center'>
      <p className='text-sm text-red-500'>{error}</p>
    </div>
  );

  return (
    <div className='px-5 py-4'>
      {/* Header row */}
      <div className='flex items-center justify-between mb-4'>
        <p className='text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider'>
          Sheet: <span className='text-blue-500 dark:text-blue-400'>{sheet}</span>
        </p>
        <div className='flex flex-col items-end gap-1'>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? (
              <Loader2 className='w-3.5 h-3.5 animate-spin' />
            ) : saved ? (
              <CheckCircle className='w-3.5 h-3.5' />
            ) : (
              <Upload className='w-3.5 h-3.5' />
            )}
            {saved ? 'Saved!' : 'Save to Sheet'}
          </button>
          {orderFormSynced && (
            <span className='text-[9px] text-green-600 dark:text-green-400'>✓ Order Form synced</span>
          )}
        </div>
      </div>

      <input
        type='file'
        accept='image/*'
        ref={fileInputRef}
        className='hidden'
        onChange={handleFileChange}
      />

      {/* 3-column grid */}
      <div className='grid grid-cols-3 gap-3'>
        {Array.from({ length: 16 }, (_, i) => {
          const slot        = String(i + 1);
          const url         = images[slot] || '';
          const displayUrl  = toDisplayUrl(url);
          const isDrive     = url ? isGDriveUrl(url) : false;
          const isUploading = uploadingSlot === slot;

          return (
            <div key={slot} className='flex flex-col gap-1'>
              {/* Image card */}
              <SlotCard
                slot={slot}
                url={url}
                displayUrl={displayUrl}
                isDrive={isDrive}
                isUploading={isUploading}
                onUploadClick={() => handleUploadClick(slot)}
                onClear={() => handleClear(slot)}
                label={SLOT_LABELS[parseInt(slot)]}
              />

              {/* Swap arrows */}
              <div className='flex gap-1'>
                <button
                  onClick={() => handleSwap(slot, -1)}
                  disabled={slot === '1' || !url}
                  className='flex-1 h-5 rounded text-[9px] bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-25 transition-colors'
                  title='Swap with previous'
                >←</button>
                <button
                  onClick={() => handleSwap(slot, 1)}
                  disabled={slot === '16' || !url}
                  className='flex-1 h-5 rounded text-[9px] bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-25 transition-colors'
                  title='Swap with next'
                >→</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PIS Upload Modal ──────────────────────────────────────────────────────────

type PisResult = {
  summary: { total_rows: number; updated: number; not_found: number; skipped: number };
  updated: { bb_code: string; product_name: string; sheet: string; fields_updated: string[]; fields_values: Record<string, any> }[];
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
  if (field === 'image_links' && Array.isArray(value)) return <span>{value.length} link{value.length !== 1 ? 's' : ''}</span>;
  if (field === 'dimensions' && typeof value === 'object') {
    const wp = value.with_packaging;
    const wop = value.without_packaging;
    return (
      <div className='mt-1 space-y-2.5'>
        {wp && <div><div className='text-zinc-400 text-[10px] uppercase tracking-wide mb-0.5'>With packaging</div>{(wp.length_cm || wp.breadth_cm || wp.height_cm) && <div>{wp.length_cm ?? '?'} × {wp.breadth_cm ?? '?'} × {wp.height_cm ?? '?'} cm</div>}{wp.gross_weight_g != null && <div>{wp.gross_weight_g} g</div>}</div>}
        {wop && <div><div className='text-zinc-400 text-[10px] uppercase tracking-wide mb-0.5'>Without packaging</div>{(wop.length_cm || wop.breadth_cm || wop.height_cm) && <div>{wop.length_cm ?? '?'} × {wop.breadth_cm ?? '?'} × {wop.height_cm ?? '?'} cm</div>}{wop.net_weight_g != null && <div>{wop.net_weight_g} g</div>}</div>}
      </div>
    );
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  return <span>{String(value)}</span>;
}

function PisFieldChip({ field, value }: { field: string; value: any }) {
  return (
    <div className='relative group/chip'>
      <span className='text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full cursor-default select-none'>{field}</span>
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
  const [activeTab, setActiveTab] = useState<'updated' | 'not_found' | 'skipped'>('updated');
  const { summary } = result;
  const isPreview = mode === 'preview';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
      <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800'>
          <div className='flex items-center gap-3'>
            <FileSpreadsheet className='w-5 h-5 text-purple-600' />
            <div>
              <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100'>
                {isPreview ? 'PIS Upload Preview' : 'PIS Upload Results'}
              </h2>
              {isPreview && <p className='text-xs text-amber-600 dark:text-amber-400 mt-0.5'>Review changes below, then confirm to apply</p>}
              {!isPreview && result.audit && <p className='text-xs text-gray-400 dark:text-zinc-500 mt-0.5'>Uploaded by {result.audit.uploaded_by}</p>}
            </div>
          </div>
          <button onClick={onClose} className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Summary pills */}
        <div className='flex flex-wrap gap-2 px-6 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50'>
          <span className='text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'>{summary.total_rows} rows</span>
          <span className='text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium'>{summary.updated} updated</span>
          {summary.not_found > 0 && <span className='text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium'>{summary.not_found} not found</span>}
          {summary.skipped > 0 && <span className='text-xs px-2.5 py-1 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400 font-medium'>{summary.skipped} skipped</span>}
        </div>

        {/* Tabs */}
        <div className='flex gap-0 border-b border-gray-100 dark:border-zinc-800 px-6 shrink-0'>
          {(['updated', 'not_found', 'skipped'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${activeTab === t ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700'}`}>
              {t === 'updated' ? `Updated (${result.updated.length})` : t === 'not_found' ? `Not Found (${result.not_found.length})` : `Skipped (${result.skipped.length})`}
            </button>
          ))}
        </div>

        <div className='flex-1 overflow-y-auto min-h-0 px-6 py-4'>
          {activeTab === 'updated' && (
            result.updated.length === 0
              ? <p className='text-sm text-gray-400 dark:text-zinc-500 text-center py-8'>No items would be updated</p>
              : <div className='space-y-2'>
                  {result.updated.map((item, i) => (
                    <div key={i} className='border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3'>
                      <div className='flex items-start justify-between gap-3 mb-2'>
                        <div>
                          <span className='text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded'>{item.bb_code}</span>
                          <span className='ml-2 text-sm font-medium text-gray-800 dark:text-zinc-200'>{item.product_name}</span>
                        </div>
                        <span className='text-[10px] text-gray-400 dark:text-zinc-500 shrink-0'>{item.sheet}</span>
                      </div>
                      <div className='flex flex-wrap gap-1.5'>
                        {item.fields_updated.map(f => <PisFieldChip key={f} field={f} value={item.fields_values?.[f]} />)}
                      </div>
                    </div>
                  ))}
                </div>
          )}
          {activeTab === 'not_found' && (
            result.not_found.length === 0
              ? <p className='text-sm text-gray-400 dark:text-zinc-500 text-center py-8'>No unmatched items</p>
              : <div className='space-y-1.5'>
                  {result.not_found.map((item, i) => (
                    <div key={i} className='flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30'>
                      <AlertCircle className='w-3.5 h-3.5 text-amber-500 shrink-0' />
                      <span className='text-xs font-mono text-amber-700 dark:text-amber-400'>{item.identifier}</span>
                      {item.product_name && <span className='text-xs text-gray-500 dark:text-zinc-400'>({item.product_name})</span>}
                      <span className='text-[10px] text-gray-400 dark:text-zinc-500 ml-auto'>{item.sheet}</span>
                    </div>
                  ))}
                </div>
          )}
          {activeTab === 'skipped' && (
            result.skipped.length === 0
              ? <p className='text-sm text-gray-400 dark:text-zinc-500 text-center py-8'>No skipped rows</p>
              : <div className='space-y-1.5'>
                  {result.skipped.map((item, i) => (
                    <div key={i} className='flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700'>
                      <span className='text-xs text-gray-400 dark:text-zinc-500'>Row {item.row}</span>
                      <span className='text-xs text-gray-600 dark:text-zinc-300'>{item.reason}</span>
                      <span className='text-[10px] text-gray-400 dark:text-zinc-500 ml-auto'>{item.sheet}</span>
                    </div>
                  ))}
                </div>
          )}
        </div>

        {isPreview && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 flex justify-end gap-3'>
            <button onClick={onClose} className='px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'>Cancel</button>
            <button onClick={onConfirm} disabled={confirming || summary.updated === 0}
              className='px-6 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'>
              {confirming && <Loader2 className='w-4 h-4 animate-spin' />}
              Apply {summary.updated > 0 ? `${summary.updated} update${summary.updated !== 1 ? 's' : ''}` : '(nothing to update)'}
            </button>
          </div>
        )}
        {!isPreview && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 flex justify-end'>
            <button onClick={onClose} className='px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors'>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Upload Modal ─────────────────────────────────────────────────────────

type UploadStep = 'idle' | 'validating' | 'validated' | 'creating' | 'done';

interface ValidatedComponent {
  sku_code: string;
  quantity: number;
  name: string | null;
  item_id: string | null;
  product_id: string | null;
}

interface ValidatedRow {
  row: number;
  name: string;
  sku_code: string;
  rate: number;
  components: ValidatedComponent[];
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationResult {
  rows: ValidatedRow[];
  valid_count: number;
  error_count: number;
  total_count: number;
}

interface CreateResult {
  sku_code: string;
  name: string;
  success: boolean;
  composite_item_id?: string;
  error?: string;
}

function BulkUploadModal({
  accessToken,
  onClose,
  onCreated,
}: {
  accessToken: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<UploadStep>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [createResults, setCreateResults] = useState<CreateResult[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 'creating') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  const downloadTemplate = async () => {
    const res = await fetch(`${API}/composite-upload/template`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'composite_items_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setValidation(null);
    setError(null);
    setStep('idle');
  };

  const handleValidate = async () => {
    if (!file) return;
    setStep('validating');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(`${API}/composite-upload/validate`, form, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      });
      setValidation(res.data);
      setStep('validated');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Validation failed');
      setStep('idle');
    }
  };

  const handleCreate = async () => {
    if (!validation) return;
    const validItems = validation.rows.filter(r => r.valid);
    setStep('creating');
    setError(null);
    try {
      const res = await axios.post(
        `${API}/composite-upload/create`,
        { items: validItems },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setCreateResults(res.data.results);
      setCreatedCount(res.data.created_count);
      setFailedCount(res.data.failed_count);
      setStep('done');
      if (res.data.created_count > 0) onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Creation failed');
      setStep('validated');
    }
  };

  const isDone = step === 'done';
  const isCreating = step === 'creating';

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current && !isCreating) onClose(); }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
    >
      <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30'>
              <Upload className='w-4 h-4 text-blue-600 dark:text-blue-400' />
            </div>
            <div>
              <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100'>Bulk Create Composite Items</h2>
              <p className='text-xs text-gray-500 dark:text-zinc-400'>Upload a filled template to create items in Zoho Inventory</p>
            </div>
          </div>
          {!isCreating && (
            <button onClick={onClose} className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'>
              <X className='w-5 h-5' />
            </button>
          )}
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-5'>

          {/* Step 1 — Template + Upload */}
          {(step === 'idle' || step === 'validating' || step === 'validated') && (
            <div className='space-y-4'>
              {/* Download template */}
              <div className='flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'>
                <div>
                  <p className='text-sm font-medium text-blue-800 dark:text-blue-300'>Step 1 — Download Template</p>
                  <p className='text-xs text-blue-600 dark:text-blue-400 mt-0.5'>Fill in composite name, SKU, rate, and component SKUs + quantities</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className='flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0'
                >
                  <Download className='w-4 h-4' /> Template
                </button>
              </div>

              {/* File upload */}
              <div>
                <p className='text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2'>Step 2 — Upload Filled Template</p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    file
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                      : 'border-gray-300 dark:border-zinc-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                  }`}
                >
                  {file ? (
                    <div className='flex items-center justify-center gap-2 text-green-700 dark:text-green-400'>
                      <CheckCircle className='w-5 h-5' />
                      <span className='text-sm font-medium'>{file.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleFileChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className='ml-1 p-0.5 rounded text-green-600 hover:text-red-500 transition-colors'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    </div>
                  ) : (
                    <div className='text-gray-400 dark:text-zinc-500 space-y-1'>
                      <Upload className='w-8 h-8 mx-auto opacity-50' />
                      <p className='text-sm'>Drop your .xlsx file here or click to browse</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type='file' accept='.xlsx' className='hidden' onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
              </div>

              {error && (
                <div className='flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm'>
                  <AlertCircle className='w-4 h-4 shrink-0 mt-0.5' />
                  {error}
                </div>
              )}

              {file && step !== 'validating' && (
                <button
                  onClick={handleValidate}
                  className='w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors'
                >
                  Validate File
                </button>
              )}

              {step === 'validating' && (
                <div className='flex items-center justify-center gap-2 py-4 text-gray-500 dark:text-zinc-400'>
                  <Loader2 className='w-5 h-5 animate-spin' /> Validating…
                </div>
              )}
            </div>
          )}

          {/* Validation results */}
          {step === 'validated' && validation && (
            <div className='space-y-4'>
              {/* Summary pills */}
              <div className='flex flex-wrap gap-3'>
                <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium'>
                  <CheckCircle className='w-3.5 h-3.5' />
                  {validation.valid_count} valid
                </div>
                {validation.error_count > 0 && (
                  <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium'>
                    <AlertCircle className='w-3.5 h-3.5' />
                    {validation.error_count} with errors
                  </div>
                )}
                <button
                  onClick={() => setShowOnlyErrors(v => !v)}
                  className={`ml-auto text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    showOnlyErrors
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400'
                  }`}
                >
                  {showOnlyErrors ? 'Show all' : 'Show errors only'}
                </button>
              </div>

              {/* Rows table */}
              <div className='border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden'>
                <div className='overflow-x-auto max-h-72'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>
                        <th className='px-3 py-2.5 text-left w-6'>#</th>
                        <th className='px-3 py-2.5 text-left'>Status</th>
                        <th className='px-3 py-2.5 text-left'>Name</th>
                        <th className='px-3 py-2.5 text-left'>SKU</th>
                        <th className='px-3 py-2.5 text-left'>Rate</th>
                        <th className='px-3 py-2.5 text-left'>Components</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                      {validation.rows
                        .filter(r => !showOnlyErrors || !r.valid)
                        .map(r => (
                          <tr key={r.row} className={r.valid ? '' : 'bg-red-50/50 dark:bg-red-900/10'}>
                            <td className='px-3 py-2.5 text-gray-400'>{r.row}</td>
                            <td className='px-3 py-2.5'>
                              {r.valid ? (
                                <CheckCircle className='w-4 h-4 text-green-500' />
                              ) : (
                                <AlertCircle className='w-4 h-4 text-red-500' />
                              )}
                            </td>
                            <td className='px-3 py-2.5 font-medium text-gray-800 dark:text-zinc-200 max-w-[180px]'>
                              <div className='truncate'>{r.name}</div>
                              {r.errors.length > 0 && (
                                <div className='text-red-500 dark:text-red-400 text-[10px] mt-0.5 space-y-0.5'>
                                  {r.errors.map((e, i) => <div key={i}>• {e}</div>)}
                                </div>
                              )}
                              {r.warnings.length > 0 && (
                                <div className='text-amber-500 text-[10px] mt-0.5 space-y-0.5'>
                                  {r.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                                </div>
                              )}
                            </td>
                            <td className='px-3 py-2.5'>
                              <span className='font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px]'>
                                {r.sku_code || '—'}
                              </span>
                            </td>
                            <td className='px-3 py-2.5 text-gray-600 dark:text-zinc-400'>
                              {r.rate > 0 ? `₹${r.rate.toLocaleString('en-IN')}` : <span className='text-amber-500'>—</span>}
                            </td>
                            <td className='px-3 py-2.5'>
                              <div className='flex flex-wrap gap-1'>
                                {r.components.map((c, ci) => (
                                  <span
                                    key={ci}
                                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      c.item_id
                                        ? 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {c.sku_code}{c.quantity !== 1 ? ` ×${c.quantity}` : ''}
                                    {!c.item_id && ' ✗'}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className='flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm'>
                  <AlertCircle className='w-4 h-4 shrink-0 mt-0.5' />
                  {error}
                </div>
              )}

              {validation.valid_count > 0 ? (
                <button
                  onClick={handleCreate}
                  className='w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2'
                >
                  <Plus className='w-4 h-4' />
                  Create {validation.valid_count} Composite Item{validation.valid_count !== 1 ? 's' : ''} in Zoho
                </button>
              ) : (
                <p className='text-center text-sm text-red-500 py-2'>Fix all errors before proceeding</p>
              )}
            </div>
          )}

          {/* Creating */}
          {step === 'creating' && (
            <div className='flex flex-col items-center justify-center py-12 gap-4 text-gray-500 dark:text-zinc-400'>
              <Loader2 className='w-10 h-10 animate-spin text-blue-500' />
              <p className='text-sm font-medium'>Creating composite items in Zoho Inventory…</p>
              <p className='text-xs text-gray-400'>This may take a moment</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className='space-y-4'>
              <div className={`flex items-center gap-3 p-4 rounded-xl ${
                failedCount === 0
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
              }`}>
                <CheckCircle className={`w-6 h-6 shrink-0 ${failedCount === 0 ? 'text-green-600' : 'text-amber-600'}`} />
                <div>
                  <p className={`text-sm font-semibold ${failedCount === 0 ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {createdCount} item{createdCount !== 1 ? 's' : ''} created successfully
                    {failedCount > 0 && `, ${failedCount} failed`}
                  </p>
                  <p className='text-xs text-gray-500 dark:text-zinc-400 mt-0.5'>The Composite Items list has been refreshed</p>
                </div>
              </div>

              {createResults.length > 0 && (
                <div className='border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden'>
                  <div className='overflow-x-auto max-h-64'>
                    <table className='w-full text-xs'>
                      <thead>
                        <tr className='bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>
                          <th className='px-3 py-2.5 text-left'>Status</th>
                          <th className='px-3 py-2.5 text-left'>SKU</th>
                          <th className='px-3 py-2.5 text-left'>Name</th>
                          <th className='px-3 py-2.5 text-left'>Zoho ID</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                        {createResults.map((r, i) => (
                          <tr key={i} className={r.success ? '' : 'bg-red-50/50 dark:bg-red-900/10'}>
                            <td className='px-3 py-2.5'>
                              {r.success
                                ? <CheckCircle className='w-4 h-4 text-green-500' />
                                : <AlertCircle className='w-4 h-4 text-red-500' />}
                            </td>
                            <td className='px-3 py-2.5 font-mono text-blue-700 dark:text-blue-300'>{r.sku_code}</td>
                            <td className='px-3 py-2.5 text-gray-700 dark:text-zinc-300 max-w-[200px]'>
                              <div className='truncate'>{r.name}</div>
                              {r.error && <div className='text-red-500 text-[10px]'>{r.error}</div>}
                            </td>
                            <td className='px-3 py-2.5 font-mono text-gray-400 text-[10px]'>{r.composite_item_id || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {isDone && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 flex justify-end'>
            <button
              onClick={onClose}
              className='px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors'
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────


export default function ZohoItemsPage() {
  usePageTitle('Zoho Items');
  const { isLoading, accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('products');

  // Brands
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [prodBrand, setProdBrand] = useState('');

  // PIS brand dropdown: constituent brands merged into group entries
  const pisBrands = useMemo(() => mergeBrandOptions(brands), [brands]);

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodTotalPages, setProdTotalPages] = useState(1);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodZohoStatus, setProdZohoStatus] = useState('');
  const [prodPurchaseStatus, setProdPurchaseStatus] = useState('');
  const [prodLatestFirst, setProdLatestFirst] = useState(true);

  // Drawer + carousel state
  const [drawerProduct, setDrawerProduct] = useState<any | null>(null);
  const [carousel, setCarousel] = useState<{ product: any; idx: number } | null>(null);

  // Purchase status updating
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  const updatePurchaseStatus = async (itemId: string, newStatus: string) => {
    setUpdatingStatus((prev) => ({ ...prev, [itemId]: true }));
    try {
      await axios.patch(
        `${API}/products/${itemId}/purchase-status`,
        { purchase_status: newStatus },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setProducts((prev) =>
        prev.map((p) => (p._id === itemId ? { ...p, purchase_status: newStatus } : p))
      );
      if (drawerProduct?._id === itemId) {
        setDrawerProduct((d: any) => d ? { ...d, purchase_status: newStatus } : d);
      }
    } catch {
      // silently ignore
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // Composite state
  const [composites, setComposites] = useState<any[]>([]);
  const [compSearch, setCompSearch] = useState('');
  const [compPage, setCompPage] = useState(1);
  const [compTotal, setCompTotal] = useState(0);
  const [compTotalPages, setCompTotalPages] = useState(1);
  const [compLoading, setCompLoading] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // PIS state
  const [pisUploading, setPisUploading] = useState(false);
  const [pisConfirming, setPisConfirming] = useState(false);
  const [pisFile, setPisFile] = useState<File | null>(null);
  const [pisPreview, setPisPreview] = useState<PisResult | null>(null);
  const [pisResult, setPisResult] = useState<PisResult | null>(null);
  const pisInputRef = useRef<HTMLInputElement>(null);
  const pisDragRef = useRef<HTMLDivElement>(null);
  const [pisDragging, setPisDragging] = useState(false);

  // PIS order selection
  const [pisSelectedBrand, setPisSelectedBrand] = useState('');
  const [pisOrders, setPisOrders] = useState<{ _id: string; name: string; brand: string }[]>([]);
  const [pisOrdersLoading, setPisOrdersLoading] = useState(false);
  const [pisSelectedOrderId, setPisSelectedOrderId] = useState('');

  // Fetch brands
  useEffect(() => {
    if (!accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setBrands(res.data.brands || []))
      .catch(() => {});
  }, [accessToken]);

  const fetchProducts = useCallback(async () => {
    setProdLoading(true);
    try {
      const res = await axios.get(`${API}/products`, {
        params: {
          page: prodPage,
          limit: PAGE_SIZE,
          search: prodSearch || undefined,
          status: prodZohoStatus || undefined,
          purchase_status: prodPurchaseStatus || undefined,
          brand: prodBrand || undefined,
          sort_by: prodLatestFirst ? 'created_date' : 'name',
          sort_order: prodLatestFirst ? 'desc' : 'asc',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setProducts(res.data.products);
      setProdTotal(res.data.pagination.totalProducts);
      setProdTotalPages(res.data.pagination.totalPages);
    } finally {
      setProdLoading(false);
    }
  }, [prodPage, prodSearch, prodZohoStatus, prodPurchaseStatus, prodBrand, prodLatestFirst, accessToken]);

  const fetchComposites = useCallback(async () => {
    setCompLoading(true);
    try {
      const res = await axios.get(`${API}/composite-products`, {
        params: { page: compPage, limit: PAGE_SIZE, search: compSearch || undefined },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setComposites(res.data.items);
      setCompTotal(res.data.pagination.totalItems);
      setCompTotalPages(res.data.pagination.totalPages);
    } finally {
      setCompLoading(false);
    }
  }, [compPage, compSearch, accessToken]);

  useEffect(() => { if (accessToken) fetchProducts(); }, [fetchProducts, accessToken]);
  useEffect(() => { if (accessToken) fetchComposites(); }, [fetchComposites, accessToken]);

  // Reset to page 1 when filters change
  useEffect(() => { setProdPage(1); }, [prodSearch, prodZohoStatus, prodPurchaseStatus, prodBrand, prodLatestFirst]);
  useEffect(() => { setCompPage(1); }, [compSearch]);

  // Fetch brand orders when PIS brand selection changes.
  // For grouped brands (Petfest, Barkbutler/FOFOS) fan out to each constituent brand in parallel.
  useEffect(() => {
    if (!pisSelectedBrand || !accessToken) { setPisOrders([]); setPisSelectedOrderId(''); return; }
    setPisOrdersLoading(true);
    setPisSelectedOrderId('');
    const constituents = BRAND_GROUPS[pisSelectedBrand] ?? [pisSelectedBrand];
    Promise.all(
      constituents.map(brand =>
        axios
          .get(`${process.env.NEXT_PUBLIC_API_URL}/brand_orders`, {
            params: { brand },
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .then(res => (res.data as any[]) || [])
          .catch(() => [] as any[])
      )
    )
      .then(results => setPisOrders(results.flat().sort((a: any, b: any) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb !== ta ? tb - ta : b._id.localeCompare(a._id);
      })))
      .finally(() => setPisOrdersLoading(false));
  }, [pisSelectedBrand, accessToken]);

  const uploadPis = async (file: File) => {
    if (!accessToken) return;
    setPisUploading(true);
    setPisFile(file);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(`${API}/upload-pis`, form, {
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
    if (!accessToken || !pisFile || !pisSelectedOrderId) return;
    setPisConfirming(true);
    try {
      const form = new FormData();
      form.append('file', pisFile);
      form.append('order_id', pisSelectedOrderId);
      const res = await axios.post(`${API}/confirm-pis`, form, {
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
    const res = await axios.get(`${API}/pis-template`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'PIS_Template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  if (isLoading) return (
    <div className='flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-500'>
      <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-500' />
      Loading…
    </div>
  );

  if (!accessToken) return (
    <div className='flex flex-col items-center justify-center py-24 text-gray-400 dark:text-zinc-500'>
      <BookOpen className='w-10 h-10 mb-3 opacity-40' />
      <p className='font-medium'>Please log in to view this page</p>
    </div>
  );

  return (
    <div className='space-y-6'>
      {/* Bulk upload modal */}
      {showBulkUpload && accessToken && (
        <BulkUploadModal
          accessToken={accessToken}
          onClose={() => setShowBulkUpload(false)}
          onCreated={() => { fetchComposites(); setTab('composites'); }}
        />
      )}

      {/* Carousel modal */}
      {carousel && (
        <ImageCarouselModal
          slides={getProductSlides(carousel.product)}
          productName={carousel.product.name || 'Product'}
          initialIndex={carousel.idx}
          onClose={() => setCarousel(null)}
        />
      )}

      {/* Product detail drawer */}
      {drawerProduct && !carousel && (
        <ProductDetailDrawer
          product={drawerProduct}
          onClose={() => setDrawerProduct(null)}
          onOpenCarousel={idx => setCarousel({ product: drawerProduct, idx })}
          token={accessToken || ''}
        />
      )}

      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg'>
            <BookOpen className='w-5 h-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>Zoho Products</h1>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
              Synced from Zoho Books
            </p>
          </div>
        </div>
        <div className='flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-1.5 rounded-full'>
          <RefreshCw className='w-3 h-3' />
          Updated daily
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto overflow-y-hidden flex-nowrap'>
        {([['products', 'Products', prodTotal], ['composites', 'Composite Items', compTotal]] as const).map(([id, label, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setTab('pis')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
            tab === 'pis'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
              : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
          }`}
        >
          <FileSpreadsheet className='w-3.5 h-3.5' />
          PIS Upload
        </button>
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap'>
            <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>Products</h2>

            {/* Search */}
            <div className='relative flex-1 min-w-[160px] max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
              <input
                type='text'
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder='Search by name or SKU…'
                className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>

            {/* Brand */}
            {brands.length > 0 && (
              <select
                value={prodBrand}
                onChange={(e) => setProdBrand(e.target.value)}
                className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
              >
                <option value=''>All Brands</option>
                {brands.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            )}

            {/* Zoho Status filter */}
            <select
              value={prodZohoStatus}
              onChange={(e) => setProdZohoStatus(e.target.value)}
              className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
            >
              <option value=''>All Zoho Statuses</option>
              <option value='active'>Zoho: Active</option>
              <option value='inactive'>Zoho: Inactive</option>
            </select>

            {/* Purchase Status filter */}
            <select
              value={prodPurchaseStatus}
              onChange={(e) => setProdPurchaseStatus(e.target.value)}
              className='shrink-0 pl-3 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
            >
              <option value=''>All Purchase Statuses</option>
              <option value='active'>Purchase: Active</option>
              <option value='inactive'>Purchase: Inactive</option>
              <option value='discontinued until stock lasts'>Disc. until stock lasts</option>
            </select>

            {/* Latest First toggle */}
            <button
              onClick={() => setProdLatestFirst((v) => !v)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                prodLatestFirst
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              <ArrowDownUp className='w-3.5 h-3.5' />
              Latest First
            </button>
          </div>

          {prodLoading ? (
            <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
              <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-500' />
              Loading…
            </div>
          ) : products.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
              <BookOpen className='w-10 h-10 mb-3 opacity-40' />
              <p className='font-medium'>{prodSearch ? `No results for "${prodSearch}"` : 'No products found'}</p>
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-10'>#</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-14'>Image</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Product</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Price</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Stock</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Zoho Status</th>
                      <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Purchase Status</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                    {products.map((p: any, i) => (
                      <tr
                        key={p._id || i}
                        onClick={() => setDrawerProduct(p)}
                        className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer'
                      >
                        <td className='px-4 py-3 text-sm text-gray-400 dark:text-zinc-500'>{(prodPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td className='px-4 py-3'>
                          <div className='flex flex-col items-center gap-0.5'>
                            <ProductThumbnail
                              product={p}
                              onOpenCarousel={() => setCarousel({ product: p, idx: 0 })}
                            />
                            {(() => {
                              const n = getAllDisplayableImages(p).length + getProductVideos(p).length;
                              return n > 1 ? <span className='text-[9px] text-gray-400'>{n}</span> : null;
                            })()}
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <span className='font-medium text-gray-800 dark:text-zinc-200'>{p.name || 'Unnamed'}</span>
                        </td>
                        <td className='px-4 py-3'>
                          <span className='inline-block font-mono text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded'>
                            {p.cf_sku_code || '—'}
                          </span>
                        </td>
                        <td className='px-4 py-3 font-medium text-gray-800 dark:text-zinc-200'>{fmt(p.rate || p.price)}</td>
                        <td className='px-4 py-3 text-gray-600 dark:text-zinc-300'>{p.stock ?? 0}</td>
                        <td className='px-4 py-3'>
                          <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            p.status === 'active' || p.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {p.status === 'active' || p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className='px-4 py-3' onClick={e => e.stopPropagation()}>
                          <select
                            value={p.purchase_status || ''}
                            disabled={updatingStatus[p._id]}
                            onChange={(e) => updatePurchaseStatus(p._id, e.target.value)}
                            className={`text-xs rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                              p.purchase_status === 'active'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                : p.purchase_status === 'inactive'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                : p.purchase_status === 'discontinued until stock lasts'
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                : p.purchase_status === 'active - combo'
                                ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400'
                                : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            <option value=''>— not set —</option>
                            <option value='active'>Active</option>
                            <option value='active - combo'>Active - Combo</option>
                            <option value='inactive'>Inactive</option>
                            <option value='discontinued until stock lasts'>Discontinued until stock lasts</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
                <p className='text-xs text-gray-400 dark:text-zinc-500'>
                  {(prodPage - 1) * PAGE_SIZE + 1}–{Math.min(prodPage * PAGE_SIZE, prodTotal)} of {prodTotal}
                </p>
                <Pagination currentPage={prodPage} totalPages={prodTotalPages} onChange={setProdPage} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Composite items tab */}
      {tab === 'composites' && (
        <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4 flex-wrap'>
            <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>Composite Items</h2>
            <div className='relative flex-1 min-w-[160px] max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
              <input
                type='text'
                value={compSearch}
                onChange={(e) => setCompSearch(e.target.value)}
                placeholder='Search by name or SKU…'
                className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
            <button
              onClick={() => setShowBulkUpload(true)}
              className='shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors'
            >
              <Upload className='w-3.5 h-3.5' /> Bulk Upload
            </button>
          </div>

          {compLoading ? (
            <div className='flex items-center justify-center py-16 gap-3 text-gray-400 dark:text-zinc-500'>
              <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-500' />
              Loading…
            </div>
          ) : composites.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500'>
              <BookOpen className='w-10 h-10 mb-3 opacity-40' />
              <p className='font-medium'>{compSearch ? `No results for "${compSearch}"` : 'No composite items found'}</p>
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-50 dark:bg-zinc-800/60'>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider w-12'>#</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Name</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>SKU Code</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Components</th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider'>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100 dark:divide-zinc-800'>
                    {composites.map((c: any, i) => (
                      <tr key={c._id || i} className='hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors'>
                        <td className='px-6 py-3.5 text-sm text-gray-400 dark:text-zinc-500'>{(compPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td className='px-6 py-3.5 font-medium text-gray-800 dark:text-zinc-200'>{c.name}</td>
                        <td className='px-6 py-3.5'>
                          <span className='inline-block font-mono text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded'>
                            {c.sku_code || '—'}
                          </span>
                        </td>
                        <td className='px-6 py-3.5'>
                          <div className='flex flex-wrap gap-1'>
                            {(c.components || []).map((comp: any, ci: number) => (
                              <span key={ci} className='text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-2 py-0.5 rounded'>
                                {comp.name}{comp.quantity > 1 ? ` ×${comp.quantity}` : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className='px-6 py-3.5 text-xs text-gray-400 dark:text-zinc-500'>
                          {c.last_updated ? new Date(c.last_updated).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between'>
                <p className='text-xs text-gray-400 dark:text-zinc-500'>
                  {(compPage - 1) * PAGE_SIZE + 1}–{Math.min(compPage * PAGE_SIZE, compTotal)} of {compTotal}
                </p>
                <Pagination currentPage={compPage} totalPages={compTotalPages} onChange={setCompPage} />
              </div>
            </>
          )}
        </div>
      )}

      {/* PIS tab */}
      {tab === 'pis' && (
        <>
          {/* Hidden file input */}
          <input
            ref={pisInputRef}
            type='file'
            accept='.xlsx,.xls'
            className='hidden'
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPis(f); }}
          />

          {/* PIS modals */}
          {pisPreview && (
            <PisModal
              result={pisPreview}
              mode='preview'
              onClose={() => { setPisPreview(null); setPisFile(null); }}
              onConfirm={confirmPis}
              confirming={pisConfirming}
            />
          )}
          {pisResult && (
            <PisModal
              result={pisResult}
              mode='result'
              onClose={() => setPisResult(null)}
            />
          )}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>

            {/* Left: Template + Upload */}
            <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
              <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800'>
                <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider'>Product Information Sheet</h2>
                <p className='text-xs text-gray-500 dark:text-zinc-400 mt-1'>Select an order on the right, then download the template, fill it in, and upload.</p>
              </div>
              <div className='p-6 space-y-5'>

                {/* Step 1 — Download */}
                <div className='flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'>
                  <div>
                    <p className='text-sm font-medium text-blue-800 dark:text-blue-300'>Step 1 — Download Template</p>
                    <p className='text-xs text-blue-600 dark:text-blue-400 mt-0.5'>5 sheets: Toys, Hygiene, Outdoor Gear, Treats, Grooming</p>
                  </div>
                  <button
                    onClick={downloadPisTemplate}
                    className='flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0'
                  >
                    <Download className='w-4 h-4' /> Template
                  </button>
                </div>

                {/* Step 2 — Upload */}
                <div>
                  <p className='text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2'>Step 2 — Upload Filled PIS</p>
                  <div
                    ref={pisDragRef}
                    onClick={() => { if (pisSelectedOrderId) pisInputRef.current?.click(); }}
                    onDragOver={e => { if (pisSelectedOrderId) { e.preventDefault(); setPisDragging(true); } }}
                    onDragLeave={() => setPisDragging(false)}
                    onDrop={e => { e.preventDefault(); setPisDragging(false); if (pisSelectedOrderId) { const f = e.dataTransfer.files[0]; if (f) uploadPis(f); } }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      !pisSelectedOrderId
                        ? 'border-gray-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                        : pisDragging
                        ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-900/10 cursor-pointer'
                        : 'border-gray-300 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 cursor-pointer'
                    }`}
                  >
                    {pisUploading ? (
                      <div className='flex flex-col items-center gap-2 text-purple-600 dark:text-purple-400'>
                        <Loader2 className='w-8 h-8 animate-spin' />
                        <p className='text-sm font-medium'>Analysing…</p>
                      </div>
                    ) : !pisSelectedOrderId ? (
                      <div className='flex flex-col items-center gap-2 text-gray-400 dark:text-zinc-500'>
                        <FileSpreadsheet className='w-10 h-10 opacity-40' />
                        <p className='text-sm'>Select a brand and order first</p>
                      </div>
                    ) : (
                      <div className='flex flex-col items-center gap-2 text-gray-400 dark:text-zinc-500'>
                        <FileSpreadsheet className='w-10 h-10 opacity-50' />
                        <p className='text-sm'>Drop your filled PIS here or click to browse</p>
                        <p className='text-xs'>.xlsx or .xls</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Right: Order Association */}
            <div className='bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden'>
              <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800'>
                <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider'>Attach to Order</h2>
                <p className='text-xs text-gray-500 dark:text-zinc-400 mt-1'>Required. The PIS file will be saved under this order and appear in both Brand Orders and Design Orders pages.</p>
              </div>
              <div className='p-6 space-y-4'>

                {/* Brand select */}
                <div>
                  <label className='block text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5'>Brand</label>
                  <select
                    value={pisSelectedBrand}
                    onChange={e => setPisSelectedBrand(e.target.value)}
                    className='w-full pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'
                  >
                    <option value=''>— no brand selected —</option>
                    {pisBrands.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>

                {/* Order select */}
                <div>
                  <label className='block text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5'>Order</label>
                  {pisOrdersLoading ? (
                    <div className='flex items-center gap-2 py-2 text-sm text-gray-400 dark:text-zinc-500'>
                      <Loader2 className='w-4 h-4 animate-spin' /> Loading orders…
                    </div>
                  ) : (
                    <select
                      value={pisSelectedOrderId}
                      onChange={e => setPisSelectedOrderId(e.target.value)}
                      disabled={!pisSelectedBrand || pisOrders.length === 0}
                      className='w-full pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <option value=''>
                        {!pisSelectedBrand ? '— select a brand first —' : pisOrders.length === 0 ? '— no orders found —' : '— select an order —'}
                      </option>
                      {pisOrders.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                    </select>
                  )}
                </div>

                {pisSelectedOrderId ? (
                  <div className='flex items-start gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300'>
                    <CheckCircle className='w-3.5 h-3.5 shrink-0 mt-0.5' />
                    Order selected — the PIS file will be saved here and visible in both Brand Orders and Design Orders. You can delete it from either page.
                  </div>
                ) : (
                  <div className='flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400'>
                    <AlertCircle className='w-3.5 h-3.5 shrink-0 mt-0.5' />
                    Select a brand and order above before uploading.
                  </div>
                )}

              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
