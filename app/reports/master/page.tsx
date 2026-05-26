'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import MasterReport from '@/components/reports/MasterReport';
import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

function Page() {
  usePageTitle('Master Report');
  const { email, isLoading, accessToken, user } = useAuth();

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!accessToken) {
    return <p>Please log in to see this content.</p>;
  }
  return (
    <>
      <MasterReport />
    </>
  );
}

export default Page;
