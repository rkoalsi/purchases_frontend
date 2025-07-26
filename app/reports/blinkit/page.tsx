'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import BlinkitSalesReport from '@/components/reports/BlinkitSalesVsInventoryReport';
import React from 'react';

function Page() {
  const { email, isLoading, accessToken, user } = useAuth();

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!accessToken) {
    return <p>Please log in to see this content.</p>;
  }
  return (
    <>
      <BlinkitSalesReport />
    </>
  );
}

export default Page;
