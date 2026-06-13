'use client';

import { useAuth } from '@/components/context/AuthContext';
import DesignCatalogues from '@/components/reports/DesignCatalogues';

export default function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <DesignCatalogues />;
}
