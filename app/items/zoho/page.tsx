'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, BookOpen, Search, RefreshCw,
  ArrowDownUp, X, ZoomIn, Video, ExternalLink, Package,
} from 'lucide-react';

const API = `${process.env.NEXT_PUBLIC_API_URL}/zoho`;
const PAGE_SIZE = 10;

type Tab = 'products' | 'composites';

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

type DrawerTab = 'media' | 'details' | 'catalogue' | 'nutrition';

function ProductDetailDrawer({
  product,
  onClose,
  onOpenCarousel,
}: {
  product: any;
  onClose: () => void;
  onOpenCarousel: (idx: number) => void;
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
    { key: 'media',     label: 'Media' },
    { key: 'details',   label: 'Details' },
    { key: 'catalogue', label: 'Catalogue' },
    ...(hasNutrition ? [{ key: 'nutrition' as DrawerTab, label: 'Nutrition' }] : []),
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

        </div>
      </div>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ZohoItemsPage() {
  const { isLoading, accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('products');

  // Brands
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [prodBrand, setProdBrand] = useState('');

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodTotalPages, setProdTotalPages] = useState(1);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodZohoStatus, setProdZohoStatus] = useState('');
  const [prodPurchaseStatus, setProdPurchaseStatus] = useState('');
  const [prodLatestFirst, setProdLatestFirst] = useState(false);

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
      <div className='flex gap-1 border-b border-gray-200 dark:border-zinc-800'>
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
                                : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            <option value=''>— not set —</option>
                            <option value='active'>Active</option>
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
          <div className='px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4'>
            <h2 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider shrink-0'>Composite Items</h2>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' />
              <input
                type='text'
                value={compSearch}
                onChange={(e) => setCompSearch(e.target.value)}
                placeholder='Search by name or SKU…'
                className='w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
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
    </div>
  );
}
