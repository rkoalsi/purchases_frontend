'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LoginForm from './LoginForm';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Auth state interface
interface AuthState {
  accessToken: string | null;
  email: string | null;
  user?: Object | null;
}

interface AuthGuardProps {
  children: React.ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function AuthGuard({
  children,
  darkMode,
  toggleDarkMode,
}: AuthGuardProps) {
  // Consume the auth state and loading state from the context
  const { accessToken, email, isLoading, login, logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // Get current path

  // Check if the user is logged in based on the presence of an access token
  const isLoggedIn = !!accessToken;

  // Effect for redirection based on auth status and current path
  useEffect(() => {
    // Don't redirect during initial loading
    if (isLoading) {
      return;
    }

    // Define paths that don't require authentication
    const publicPaths = ['/login', '/signup', '/']; // Adjust as needed

    if (!isLoggedIn && !publicPaths.includes(pathname)) {
      // If not logged in and trying to access a protected path, redirect to login
      router.push('/login');
    } else if (
      isLoggedIn &&
      publicPaths.includes(pathname) &&
      pathname !== '/'
    ) {
      // Optional: If logged in and trying to access login/signup, redirect to dashboard
      // Adjust redirection logic as per your app flow
      if (pathname === '/login' || pathname === '/signup') {
        router.push('/dashboard');
      }
    }
  }, [isLoggedIn, isLoading, pathname, router]); // Re-run if these change

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='w-12 h-12 border-4 border-t-4 border-gray-200 border-t-blue-500 rounded-full animate-spin'></div>
      </div>
    );
  }

  // If currently on the login page and not logged in, render the LoginForm
  // We pass the login function from the context
  if (pathname === '/login' && !isLoggedIn) {
    return <LoginForm onLogin={login} />;
  }

  // If logged in OR on a public path that doesn't require login rendering, render children
  // This guards routes by redirecting via the useEffect above if needed
  // Only wrap with DashboardLayout if logged in
  if (isLoggedIn) {
    return (
      <DashboardLayout
        // Pass userEmail and logout function from context
        user={user}
        userEmail={email || ''} // Provide default if email is null
        onLogout={logout}
        darkMode={darkMode} // Pass dark mode props
        toggleDarkMode={toggleDarkMode}
      >
        {children}
      </DashboardLayout>
    );
  }

  // If not logged in and on a public path other than /login
  // (e.g., /, /signup), just render the content without the layout.
  // You might adjust this logic based on how your public pages look.
  return <>{children}</>;
}
