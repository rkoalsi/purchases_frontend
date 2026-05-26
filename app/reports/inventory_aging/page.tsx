'use client';

import { useAuth } from '@/components/context/AuthContext';
import InventoryAgingReport from '@/components/reports/InventoryAgingReport';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Page() {
  usePageTitle('Inventory Aging');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <InventoryAgingReport />;
}
