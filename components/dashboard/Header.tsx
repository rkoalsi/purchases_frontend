'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface HeaderProps {
  onSidebarOpen: () => void;
  onLogout: () => void;
  userEmail: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Header({
  onSidebarOpen,
  onLogout,
  userEmail,
  darkMode,
  toggleDarkMode,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className='sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800'>
      <div className='px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-14'>
          <div className='flex'>
            <button
              type='button'
              className='md:hidden px-4 text-zinc-500 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500'
              onClick={onSidebarOpen}
            >
              <span className='sr-only'>Open sidebar</span>
              <svg
                className='h-5 w-5'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 6h16M4 12h16M4 18h16'
                />
              </svg>
            </button>
          </div>
          <div className='flex items-center'>
            <div className='ml-4 relative flex-shrink-0' ref={dropdownRef}>
              <div>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className='flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full'
                >
                  <span className='sr-only'>Open user menu</span>
                  <div className='h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 text-sm font-semibold'>
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                </button>
              </div>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className='origin-top-right absolute right-0 mt-2 w-52 rounded-lg shadow-lg py-1 bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 focus:outline-none'>
                  <div className='px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800'>
                    <p className='text-xs text-zinc-500 dark:text-zinc-400'>Signed in as</p>
                    <p className='text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate'>{userEmail}</p>
                  </div>
                  <Link
                    href='/settings/account'
                    className='flex items-center px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'
                    onClick={() => setDropdownOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={toggleDarkMode}
                    className='flex w-full items-center px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'
                  >
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <div className='border-t border-zinc-100 dark:border-zinc-800 mt-1'>
                    <button
                      onClick={onLogout}
                      className='flex w-full items-center px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
