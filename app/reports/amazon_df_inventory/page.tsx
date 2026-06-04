'use client';

import { useAuth } from '@/components/context/AuthContext';
import AmazonDFInventory from '@/components/reports/AmazonDFInventory';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Page() {
  usePageTitle('Amazon DF Inventory');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p className='p-6'>Loading user data…</p>;
  if (!accessToken) return <p className='p-6'>Please log in to see this content.</p>;

  return <AmazonDFInventory />;
}
