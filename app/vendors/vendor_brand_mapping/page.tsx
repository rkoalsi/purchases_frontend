'use client';

import { useAuth } from '@/components/context/AuthContext';
import VendorBrandMapping from '@/components/reports/VendorBrandMapping';
import React from 'react';

function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <VendorBrandMapping />;
}

export default Page;
