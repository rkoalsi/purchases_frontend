'use client';

import { Suspense } from 'react';
import { useAuth } from '@/components/context/AuthContext';
import BrandOrders from '@/components/reports/BrandOrders';
import { usePageTitle } from '@/hooks/usePageTitle';

function BrandOrdersPage() {
  usePageTitle('Brand Orders');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <BrandOrders />;
}

export default function Page() {
  return (
    <Suspense>
      <BrandOrdersPage />
    </Suspense>
  );
}
