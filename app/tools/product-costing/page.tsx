'use client';

import { useAuth } from '@/components/context/AuthContext';
import ProductCostingGenerator from '@/components/reports/ProductCostingGenerator';

export default function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p className='p-6'>Loading user data…</p>;
  if (!accessToken) return <p className='p-6'>Please log in to see this content.</p>;

  return (
    <div className='p-4 sm:p-6 max-w-3xl mx-auto'>
      <ProductCostingGenerator />
    </div>
  );
}
