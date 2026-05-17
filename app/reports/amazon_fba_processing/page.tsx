'use client';

import { useAuth } from '@/components/context/AuthContext';
import AmazonFBAProcessing from '@/components/reports/AmazonFBAProcessing';
import React from 'react';

function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <AmazonFBAProcessing />;
}

export default Page;
