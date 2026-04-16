'use client';

import { useAuth } from '@/components/context/AuthContext';
import AmazonListingValidationReport from '@/components/reports/AmazonListingValidationReport';
import React from 'react';

function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!accessToken) {
    return <p>Please log in to see this content.</p>;
  }

  return <AmazonListingValidationReport />;
}

export default Page;
