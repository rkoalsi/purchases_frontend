'use client';

import { useAuth } from '@/components/context/AuthContext';
import BlinkitShipmentPlanning from '@/components/reports/BlinkitShipmentPlanning';
import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Blinkit Shipment Planning');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading user data...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <BlinkitShipmentPlanning />;
}

export default Page;
