'use client';

import { useAuth } from '@/components/context/AuthContext';
import VendorPOReport from '@/components/reports/VendorPOReport';
import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Vendor Purchase Orders');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <VendorPOReport />;
}

export default Page;
