'use client';

import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
  userEmail: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function DashboardLayout({
  children,
  user,
  onLogout,
  userEmail,
  darkMode,
  toggleDarkMode,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='h-screen flex overflow-hidden bg-zinc-50 dark:bg-zinc-950'>
      {/* Mobile sidebar overlay */}
      <div className='md:hidden'>
        <Sidebar
          user={user}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          isMobile={true}
        />
      </div>

      {/* Desktop sidebar - now responsive to collapse state */}
      <div className='hidden md:flex md:flex-shrink-0'>
        <Sidebar
          isOpen={true}
          setIsOpen={() => {}}
          isMobile={false}
          user={user}
        />
      </div>

      {/* Main content area */}
      <div className='flex flex-col flex-1 min-w-0 overflow-hidden'>
        {/* Header */}
        <Header
          onSidebarOpen={() => setSidebarOpen(true)}
          onLogout={onLogout}
          userEmail={userEmail}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />

        {/* Main content */}
        <main className='flex-1 relative overflow-y-auto focus:outline-none bg-zinc-50 dark:bg-zinc-950'>
          <div className='p-6'>
            <div className='max-w-7xl mx-auto'>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
