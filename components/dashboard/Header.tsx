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
    <header className='sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'>
      <div className='px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-16'>
          <div className='flex'>
            <button
              type='button'
              className='md:hidden px-4 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500'
              onClick={onSidebarOpen}
            >
              <span className='sr-only'>Open sidebar</span>
              <svg
                className='h-6 w-6'
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
                  className='bg-white dark:bg-gray-800 rounded-full flex focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                >
                  <span className='sr-only'>Open user menu</span>
                  <div className='h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-500 dark:text-indigo-300'>
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                </button>
              </div>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className='origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none'>
                  <div className='px-4 py-2 text-sm text-gray-700 dark:text-gray-300'>
                    Signed in as
                    <br />
                    <span className='font-medium'>{userEmail}</span>
                  </div>
                  <hr className='border-gray-200 dark:border-gray-700' />
                  <Link
                    href='/settings'
                    className='block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  >
                    Settings
                  </Link>
                  <button
                    onClick={onLogout}
                    className='block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
