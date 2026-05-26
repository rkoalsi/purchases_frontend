'use client';

import { useAuth } from '@/components/context/AuthContext';
import BlinkitShipmentProcessing from '@/components/reports/BlinkitShipmentProcessing';
import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Blinkit Shipment Processing');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <BlinkitShipmentProcessing />;
}

export default Page;
