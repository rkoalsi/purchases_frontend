'use client';

import { useAuth } from '@/components/context/AuthContext';
import FbaReturnsReport from '@/components/reports/FbaReturnsReport';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Amazon FBA Returns');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <FbaReturnsReport />;
}

export default Page;
