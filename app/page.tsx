// src/app/dashboard/page.tsx (assuming this is a protected page)
'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import { useRouter } from 'next/navigation';
import React from 'react';
// Import the useAuth hook

function Page() {
  // Consume the auth state from the context
  const { email, isLoading, accessToken, user } = useAuth();
  const router = useRouter();
  // You might want to show a loading state if auth is still loading
  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  // You might also want to handle the case where email is null after loading
  // Although the AuthGuard should redirect if accessToken is null,
  // email could theoretically be null if not stored/provided.
  if (!accessToken) {
    // This case should ideally not be reached if AuthGuard works correctly,
    // but can be a fallback or for pages that are sometimes public/sometimes private.
    return router.push('/login');
  }
  return (
    // Assuming email is available and not null if accessToken exists
    <p className='text-xl'>Welcome {user.name}, Homepage</p>
  );
}

export default Page;
