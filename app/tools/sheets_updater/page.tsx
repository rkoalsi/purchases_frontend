'use client';

import { useAuth } from '@/components/context/AuthContext';
import SheetsUpdater from '@/components/reports/SheetsUpdater';

export default function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p className='p-6'>Loading user data…</p>;
  if (!accessToken) return <p className='p-6'>Please log in to see this content.</p>;

  return <SheetsUpdater />;
}
