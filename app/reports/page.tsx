'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import SalesVSInventoryReport from '@/components/reports/BlinkitSalesVsInventoryReport';
import React from 'react';

function Page() {
  // Consume the auth state from the context
  const { email, isLoading, accessToken, user } = useAuth();

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!accessToken) {
    return <p>Please log in to see this content.</p>; // Or redirect here if needed
  }
  return <SalesVSInventoryReport />;
}

export default Page;
