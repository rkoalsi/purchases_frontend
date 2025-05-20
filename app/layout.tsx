'use client';

import { useState, useEffect } from 'react';
import { Inter } from 'next/font/google';
import AuthGuard from '@/components/auth/AuthGuard';
import './globals.css';
import { AuthProvider } from '@/components/context/AuthContext';
import 'react-datepicker/dist/react-datepicker.css';
import { toast, ToastContainer } from 'react-toastify'; // Import toast and ToastContainer
import 'react-toastify/dist/ReactToastify.css'; // Import Toastify CSS
const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We'll use this to toggle dark mode
  const [darkMode, setDarkMode] = useState(false);

  // Check for darkMode preference on mount
  useEffect(() => {
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    }
  };

  return (
    <html lang='en' className={darkMode ? 'dark' : ''}>
      <head>
        <title>Dashboard Application</title>
        <meta
          name='description'
          content='Modern dashboard application built with Next.js and Tailwind CSS'
        />
      </head>
      <body
        className={`${inter.className} bg-gray-50 dark:bg-gray-900 min-h-screen`}
      >
        <AuthProvider>
          <AuthGuard darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
            <ToastContainer />
            {children}
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
