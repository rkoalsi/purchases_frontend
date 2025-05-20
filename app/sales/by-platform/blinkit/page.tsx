'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import SalesReport from '@/components/reports/SalesReport';
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
      <SalesReport />
    </>
  );
}

export default Page;
