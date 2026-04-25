'use client';

import { useAuth } from '@/components/context/AuthContext';
import VendorCentralReturnsReport from '@/components/reports/VendorCentralReturnsReport';

function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <VendorCentralReturnsReport />;
}

export default Page;
