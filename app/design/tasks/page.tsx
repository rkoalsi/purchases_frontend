'use client';

import { useAuth } from '@/components/context/AuthContext';
import DesignTasks from '@/components/design/DesignTasks';

export default function Page() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) return <p>Loading...</p>;
  if (!accessToken) return <p>Please log in to see this content.</p>;

  return <DesignTasks />;
}
