'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isMobile: boolean;
}

// Navigation items with expanded platform options
const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        className='h-5 w-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
        />
      </svg>
    ),
  },
  {
    name: 'Items',
    href: '/inventory',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        className='h-5 w-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
    ),
    children: [
      {
        name: 'Items by Platform',
        href: '/items',
        children: [
          { name: 'Amazon', href: '/items/amazon' },
          { name: 'Blinkit', href: '/items/blinkit' },
          { name: 'Zoho', href: '/items/zoho' },
        ],
      },
    ],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        className='h-5 w-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
        />
      </svg>
    ),
    children: [
      { name: 'Amazon', href: '/reports/amazon' },
      { name: 'Blinkit', href: '/reports/blinkit' },
      { name: 'Zoho', href: '/reports/zoho' },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        className='h-5 w-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
        />
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
        />
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen, setIsOpen, isMobile }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Check if a route is active
  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!isMobile) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, setIsOpen]);

  // Auto expand parent menus when child route is active
  useEffect(() => {
    if (!pathname) return;

    const newExpandedItems: string[] = [];

    // Helper function to check and add parent items
    const checkNavItem = (items: any[], parentPath: string = '') => {
      items.forEach((item) => {
        // Check if this item has children
        if (item.children) {
          // Check if any child is active
          const hasActiveChild = item.children.some((child: any) => {
            if (child.href && isActive(child.href)) {
              return true;
            }
            if (child.children) {
              return child.children.some((subChild: any) =>
                isActive(subChild.href)
              );
            }
            return false;
          });

          // If this item or any of its children is active, expand it
          if (hasActiveChild || isActive(item.href)) {
            newExpandedItems.push(item.name);
          }

          // Check if children have their own children
          item.children.forEach((child: any) => {
            if (
              child.children &&
              (isActive(child.href) ||
                child.children.some((subChild: any) => isActive(subChild.href)))
            ) {
              newExpandedItems.push(child.name);
            }
          });
        }
      });
    };

    checkNavItem(navigation);
    setExpandedItems(newExpandedItems);
  }, [pathname]);

  // Toggle submenu
  const toggleSubmenu = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  if (isMobile && !isOpen) {
    return null;
  }

  // Recursive function to render navigation items
  const renderNavItems = (items: any[], level = 0) => {
    return items.map((item) => {
      const isItemActive = item.href && isActive(item.href);
      const isExpanded = expandedItems.includes(item.name);

      return (
        <div key={item.name} className={level > 0 ? 'pl-4' : ''}>
          {item.children ? (
            <div>
              <button
                onClick={() => toggleSubmenu(item.name)}
                className={`
                  group w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
                  ${
                    isItemActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : isExpanded
                      ? 'bg-gray-100 dark:bg-gray-700/60 text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/40 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                {item.icon && (
                  <span
                    className={`mr-3 ${
                      isItemActive ? 'text-indigo-600 dark:text-indigo-400' : ''
                    }`}
                  >
                    {item.icon}
                  </span>
                )}
                <span>{item.name}</span>
                <svg
                  className={`
                    h-4 w-4 transform transition-transform duration-200 text-gray-500 dark:text-gray-400
                    ${isExpanded ? 'rotate-90' : ''}
                  `}
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                  aria-hidden='true'
                >
                  <path
                    fillRule='evenodd'
                    d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>

              {/* Submenu */}
              <div
                className={`
                  transition-all duration-200 ease-in-out overflow-hidden
                  ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                `}
              >
                <div className='py-1'>
                  {renderNavItems(item.children, level + 1)}
                </div>
              </div>
            </div>
          ) : (
            <Link
              href={item.href}
              className={`
                group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
                ${
                  isItemActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-l-4 border-indigo-600 dark:border-indigo-400 pl-2 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/40 hover:text-gray-900 dark:hover:text-white'
                }
              `}
              onClick={() => isMobile && setIsOpen(false)}
            >
              {item.icon && (
                <span
                  className={`mr-3 flex-shrink-0 ${
                    isItemActive ? 'text-indigo-600 dark:text-indigo-400' : ''
                  }`}
                >
                  {item.icon}
                </span>
              )}
              <span className='truncate'>{item.name}</span>
            </Link>
          )}
        </div>
      );
    });
  };

  return (
    <div
      ref={sidebarRef}
      className={`${
        isMobile
          ? 'fixed inset-0 z-40 flex'
          : 'relative inset-y-0 flex flex-col min-h-screen'
      }`}
    >
      {/* Overlay */}
      {isMobile && (
        <div
          className='fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity duration-300'
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${
            isMobile
              ? 'relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 transform transition-transform duration-300'
              : 'flex-1 flex flex-col pt-5 pb-4 w-64'
          }
          bg-white dark:bg-gray-800 shadow-lg h-full
        `}
      >
        {/* Close button (mobile only) */}
        {isMobile && (
          <div className='absolute top-0 right-0 -mr-12 pt-2'>
            <button
              className='ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white'
              onClick={() => setIsOpen(false)}
            >
              <span className='sr-only'>Close sidebar</span>
              <svg
                className='h-6 w-6 text-white'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        )}

        {/* Logo */}
        <div className='flex-shrink-0 flex items-center px-4 mb-6'>
          <div className='flex items-center'>
            <div className='h-8 w-8 rounded-md bg-indigo-600 flex items-center justify-center mr-2'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5 text-white'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
                />
              </svg>
            </div>
            <div className='text-xl font-bold text-indigo-600 dark:text-indigo-300'>
              Purchase App
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className='mx-4 mb-5 border-t border-gray-200 dark:border-gray-700'></div>

        {/* Navigation */}
        <div className='flex-1 h-0 overflow-y-auto px-3 space-y-1'>
          <nav className='space-y-1'>{renderNavItems(navigation)}</nav>
        </div>
      </div>
    </div>
  );
}
