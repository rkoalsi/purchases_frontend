'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Package,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  ShoppingBag,
  Zap,
  Building2,
  Store,
  Import,
} from 'lucide-react';
import capitalize from '@/util/capitalize';

const AmazonIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 24 24' fill='currentColor'>
    <path d='M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.06.293.04.138.22-.293.523-.61.692-3.247 1.834-6.197 2.526-9.588 2.526-4.464 0-8.365-1.54-11.915-4.618-.138-.138-.2-.231-.16-.349M23.718 15.622c-.299-.41-1.96-.195-2.709-.098-.23.03-.268-.173-.06-.318 1.324-.93 3.499-.66 3.754-.35s-.067 2.48-1.309 3.515c-.195.165-.38.077-.294-.142.284-.715.919-2.315.618-2.607' />
  </svg>
);
interface SidebarProps {
  isOpen: boolean;
  user: any;
  setIsOpen: (isOpen: boolean) => void;
  isMobile: boolean;
}

// Navigation items with proper Lucide icons
const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    name: 'Items',
    href: '/inventory',
    icon: Package,
    children: [
      { name: 'Amazon', href: '/items/amazon', icon: AmazonIcon },
      { name: 'Blinkit', href: '/items/blinkit', icon: Zap },
      { name: 'Zoho', href: '/items/zoho', icon: Building2 },
    ],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    children: [
      { name: 'Amazon', href: '/reports/amazon', icon: AmazonIcon },
      { name: 'Blinkit', href: '/reports/blinkit', icon: Zap },
      { name: 'Zoho', href: '/reports/zoho', icon: Building2 },
      {
        name: 'Sales By Customer',
        href: '/reports/sales_by_customer',
        icon: Store,
      },
      {
        name: 'PI vs CL',
        href: '/reports/PI_vs_CL',
        icon: Import,
      },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export default function Sidebar({
  isOpen,
  setIsOpen,
  isMobile,
  user,
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
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

    const checkNavItem = (items: any[]) => {
      items.forEach((item) => {
        if (item.children) {
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

          if (hasActiveChild || isActive(item.href)) {
            newExpandedItems.push(item.name);
          }

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
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    setExpandedItems((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  // Toggle collapse
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      setExpandedItems([]);
    }
  };

  if (isMobile && !isOpen) {
    return null;
  }

  // Recursive function to render navigation items
  const renderNavItems = (items: any[], level = 0) => {
    return items.map((item) => {
      const isItemActive = item.href && isActive(item.href);
      const isExpanded = expandedItems.includes(item.name);
      const IconComponent = item.icon;

      return (
        <div key={item.name} className={level > 0 ? 'ml-4' : ''}>
          {item.children ? (
            <div>
              <button
                onClick={() => toggleSubmenu(item.name)}
                className={`
                  group w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out
                  ${
                    isItemActive
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                      : isExpanded
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
                title={isCollapsed ? item.name : ''}
              >
                <div className='flex items-center min-w-0'>
                  {IconComponent && (
                    <IconComponent
                      className={`flex-shrink-0 w-5 h-5 ${
                        isCollapsed ? 'mr-0' : 'mr-3'
                      } ${
                        isItemActive
                          ? 'text-white'
                          : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                      }`}
                    />
                  )}
                  {!isCollapsed && (
                    <span className='truncate'>{item.name}</span>
                  )}
                </div>
                {!isCollapsed && (
                  <ChevronRight
                    className={`flex-shrink-0 w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90' : ''
                    } ${
                      isItemActive
                        ? 'text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                )}
              </button>

              {/* Submenu */}
              {!isCollapsed && (
                <div
                  className={`
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${
                      isExpanded
                        ? 'max-h-96 opacity-100 mt-1'
                        : 'max-h-0 opacity-0'
                    }
                  `}
                >
                  <div className='space-y-1'>
                    {renderNavItems(item.children, level + 1)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={item.href}
              className={`
                group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out
                ${
                  isItemActive
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg transform scale-[1.02]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white hover:transform hover:scale-[1.01]'
                }
              `}
              onClick={() => isMobile && setIsOpen(false)}
              title={isCollapsed ? item.name : ''}
            >
              {IconComponent && (
                <IconComponent
                  className={`flex-shrink-0 w-5 h-5 ${
                    isCollapsed ? 'mr-0' : 'mr-3'
                  } ${
                    isItemActive
                      ? 'text-white'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  }`}
                />
              )}
              {!isCollapsed && <span className='truncate'>{item.name}</span>}
              {isItemActive && !isCollapsed && (
                <div className='ml-auto w-2 h-2 bg-white rounded-full'></div>
              )}
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
          className='fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300'
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${
            isMobile
              ? 'relative flex-1 flex flex-col max-w-xs w-full transform transition-transform duration-300'
              : `flex-1 flex flex-col transition-all duration-300 ease-in-out ${
                  isCollapsed ? 'w-16' : 'w-64'
                }`
          }
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 h-full shadow-xl
        `}
      >
        {/* Header */}
        <div className='flex-shrink-0 px-4 py-6 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center min-w-0'>
              <div className='flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg'>
                <ShoppingBag className='w-5 h-5 text-white' />
              </div>
              {!isCollapsed && (
                <div className='ml-3 min-w-0'>
                  <h1 className='text-lg font-bold text-gray-900 dark:text-white truncate'>
                    Purchase App
                  </h1>
                  <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                    Inventory Management
                  </p>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            {isMobile ? (
              <button
                onClick={() => setIsOpen(false)}
                className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              >
                <X className='w-5 h-5' />
              </button>
            ) : (
              /* Desktop collapse button */
              <button
                onClick={toggleCollapse}
                className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? (
                  <ChevronRight className='w-4 h-4' />
                ) : (
                  <ChevronLeft className='w-4 h-4' />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className='flex-1 overflow-y-auto py-4'>
          <nav className='px-3 space-y-2'>{renderNavItems(navigation)}</nav>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className='flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700'>
            <div className='flex items-center'>
              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center'>
                <span className='text-xs font-medium text-white'>
                  {user?.name?.charAt(0)}
                </span>
              </div>
              <div className='ml-3'>
                <p className='text-sm font-medium text-gray-900 dark:text-white'>
                  {user?.name}
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {capitalize(user?.role.replace('_', ' '))}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
