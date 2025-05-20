'use client';

import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  userEmail: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function DashboardLayout({
  children,
  onLogout,
  userEmail,
  darkMode,
  toggleDarkMode,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900'>
      {/* Mobile sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isMobile={true}
      />

      {/* Static sidebar for desktop */}
      <div className='hidden md:flex md:flex-shrink-0'>
        <div className='flex flex-col w-64'>
          <Sidebar isOpen={true} setIsOpen={() => {}} isMobile={false} />
        </div>
      </div>

      {/* Content area */}
      <div className='flex flex-col w-0 flex-1 overflow-hidden'>
        <Header
          onSidebarOpen={() => setSidebarOpen(true)}
          onLogout={onLogout}
          userEmail={userEmail}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />

        <main className='flex-1 relative overflow-y-auto focus:outline-none p-6'>
          {children}
        </main>
      </div>
    </div>
  );
}
