'use client';

import { useAuth } from '@/components/context/AuthContext';
import MissedSalesReport from '@/components/reports/MissedSalesReport';
import React from 'react';

function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!accessToken) {
    return <p>Please log in to see this content.</p>;
  }

  return <MissedSalesReport />;
}

export default Page;
