'use client';

import { useAuth } from '@/components/context/AuthContext';
import SellerFlexReturnsReport from '@/components/reports/SellerFlexReturnsReport';

function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <SellerFlexReturnsReport />;
}

export default Page;
