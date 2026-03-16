'use client';

import { useAuth } from '@/components/context/AuthContext';
import BlinkitItemsTable from '@/components/inventory/BlinkitItemsTable';
import axios from 'axios';
import { Zap } from 'lucide-react';
import React, { useState, useEffect } from 'react';

async function buildSkuBrandMap(token: string): Promise<Map<string, string>> {
  const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/sku-brand-map`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return new Map<string, string>(Object.entries(res.data));
}

export default function BlinkitItemsPage() {
  const { isLoading, accessToken } = useAuth();
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [brand, setBrand] = useState('');
  const [brandSkus, setBrandSkus] = useState<Set<string> | null>(null);
  const [skuBrandMap, setSkuBrandMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/master/brands`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setBrands(res.data.brands || []))
      .catch(() => {});
  }, [accessToken]);

  // Build sku→brand map from all Zoho products once on load
  useEffect(() => {
    if (!accessToken) return;
    buildSkuBrandMap(accessToken).then(setSkuBrandMap);
  }, [accessToken]);

  // When brand changes, derive brandSkus from map — no API call needed
  useEffect(() => {
    if (!brand || skuBrandMap.size === 0) { setBrandSkus(null); return; }
    const skus = new Set<string>();
    skuBrandMap.forEach((b, sku) => { if (b === brand) skus.add(sku); });
    setBrandSkus(skus);
  }, [brand, skuBrandMap]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-zinc-500'>
        <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-yellow-400' />
        Loading…
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='flex flex-col items-center justify-center py-24 text-gray-400 dark:text-zinc-500'>
        <div className='w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4'>
          <svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
              d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
          </svg>
        </div>
        <p className='font-medium'>Please log in to view this page</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div className='flex items-center gap-3'>
        <div className='p-2 rounded-lg' style={{ backgroundColor: 'rgba(255, 211, 76, 0.2)' }}>
          <Zap className='w-5 h-5' style={{ color: '#FFD34C' }} />
        </div>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>
            Blinkit SKU Mapping
          </h1>
          <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
            Manage Blinkit item ID → SKU code mappings
          </p>
        </div>
      </div>

      {/* Table */}
      <BlinkitItemsTable brand={brand} brands={brands} onBrandChange={setBrand} brandSkus={brandSkus} />
    </div>
  );
}
