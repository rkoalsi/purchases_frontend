'use client';

import { useAuth } from '@/components/context/AuthContext';
import AmazonFBAShipmentQueue from '@/components/reports/AmazonFBAShipmentQueue';
import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Amazon FBA Shipment Queue');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <AmazonFBAShipmentQueue />;
}

export default Page;
