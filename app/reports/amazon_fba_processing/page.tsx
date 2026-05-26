'use client';

import { useAuth } from '@/components/context/AuthContext';
import AmazonFBAProcessing from '@/components/reports/AmazonFBAProcessing';
import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Amazon FBA Processing');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <AmazonFBAProcessing />;
}

export default Page;
