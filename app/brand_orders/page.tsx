'use client';

import { useAuth } from '@/components/context/AuthContext';
import BrandOrders from '@/components/reports/BrandOrders';

export default function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <BrandOrders />;
}
