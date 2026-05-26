'use client';

import { useAuth } from '@/components/context/AuthContext';
import GeneralTasks from '@/components/tasks/GeneralTasks';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Page() {
  usePageTitle('Tasks');
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <GeneralTasks />;
}
