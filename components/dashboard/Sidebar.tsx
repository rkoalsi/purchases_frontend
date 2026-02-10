'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
  User,
  WorkflowIcon,
  SquareKanban,
  ZapIcon,
  FileText,
  CheckSquare,
  ShoppingCart,
  Truck,
  Box,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import capitalize from '@/util/capitalize';
import { useAuth } from '@/components/context/AuthContext';

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

// Permission requirements for navigation items
// Format: { permissionName: requiredAction } or null for always accessible
const PERMISSION_REQUIREMENTS = {
  DASHBOARD: { name: 'dashboard' },
  INVENTORY: { name: 'items' },
  REPORTS: { name: 'reports' },
  USERS: { name: 'users' },
  WORKFLOWS: { name: 'workflows' },
  SETTINGS: null, // null means always visible
  // Item-specific permissions
  AMAZON_ITEMS: { name: 'items' },
  BLINKIT_ITEMS: { name: 'items' },
  ZOHO_ITEMS: { name: 'items' },
  // Report-specific permissions
  AMAZON_REPORTS: { name: 'reports' },
  AMAZON_SETTLEMENTS: { name: 'reports' },
  BLINKIT_REPORTS: { name: 'reports' },
  BLINKIT_ADS_REPORTS: { name: 'reports' },
  ZOHO_REPORTS: { name: 'reports' },
  MASTER_REPORTS: { name: 'reports' },
  SALES_REPORTS: { name: 'reports' },
  PI_CL_REPORTS: { name: 'reports' },
  ESTIMATES_VS_INVOICES: { name: 'reports' },
};

// Navigation items with required permissions
const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
    requiredPermission: PERMISSION_REQUIREMENTS.DASHBOARD,
  },
  {
    name: 'Items',
    href: '/inventory',
    icon: Package,
    requiredPermission: PERMISSION_REQUIREMENTS.INVENTORY,
    children: [
      {
        name: 'Amazon',
        href: '/items/amazon',
        icon: AmazonIcon,
        requiredPermission: PERMISSION_REQUIREMENTS.INVENTORY,
      },
      {
        name: 'Blinkit',
        href: '/items/blinkit',
        icon: Zap,
        requiredPermission: PERMISSION_REQUIREMENTS.INVENTORY,
      },
      {
        name: 'Zoho',
        href: '/items/zoho',
        icon: Building2,
        requiredPermission: PERMISSION_REQUIREMENTS.INVENTORY,
      },
    ],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    requiredPermission: PERMISSION_REQUIREMENTS.REPORTS,
    children: [
      {
        name: 'Amazon Reports',
        icon: AmazonIcon,
        requiredPermission: PERMISSION_REQUIREMENTS.REPORTS,
        children: [
          {
            name: 'Amazon',
            href: '/reports/amazon',
            icon: AmazonIcon,
            requiredPermission: PERMISSION_REQUIREMENTS.AMAZON_REPORTS,
          },
          {
            name: 'Amazon Settlements',
            href: '/reports/amazon_settlements',
            icon: SquareKanban,
            requiredPermission: PERMISSION_REQUIREMENTS.AMAZON_SETTLEMENTS,
          },
        ],
      },
      {
        name: 'Blinkit Reports',
        icon: Zap,
        requiredPermission: PERMISSION_REQUIREMENTS.REPORTS,
        children: [
          {
            name: 'Blinkit',
            href: '/reports/blinkit',
            icon: Zap,
            requiredPermission: PERMISSION_REQUIREMENTS.BLINKIT_REPORTS,
          },
          {
            name: 'Blinkit Ads',
            href: '/reports/blinkit_ads',
            icon: ZapIcon,
            requiredPermission: PERMISSION_REQUIREMENTS.BLINKIT_ADS_REPORTS,
          },
        ],
      },
      {
        name: 'Retail Reports',
        icon: ShoppingCart,
        requiredPermission: PERMISSION_REQUIREMENTS.REPORTS,
        children: [
          {
            name: 'Retail',
            href: '/reports/zoho',
            icon: Building2,
            requiredPermission: PERMISSION_REQUIREMENTS.ZOHO_REPORTS,
          },
          {
            name: 'Master',
            href: '/reports/master',
            icon: SquareKanban,
            requiredPermission: PERMISSION_REQUIREMENTS.MASTER_REPORTS,
          },
          {
            name: 'Estimates vs Invoices',
            href: '/reports/estimates_vs_invoices',
            icon: FileText,
            requiredPermission: PERMISSION_REQUIREMENTS.ESTIMATES_VS_INVOICES,
          },
        ],
      },
      {
        name: 'Verification Reports',
        icon: CheckSquare,
        requiredPermission: PERMISSION_REQUIREMENTS.REPORTS,
        children: [
          {
            name: 'Sales By Customer',
            href: '/reports/sales_by_customer',
            icon: Store,
            requiredPermission: PERMISSION_REQUIREMENTS.SALES_REPORTS,
          },
          {
            name: 'PI vs CL',
            href: '/reports/PI_vs_CL',
            icon: Import,
            requiredPermission: PERMISSION_REQUIREMENTS.PI_CL_REPORTS,
          },
        ],
      },
    ],
  },
  {
    name: 'Users',
    href: '/users',
    icon: User,
    requiredPermission: PERMISSION_REQUIREMENTS.USERS,
  },
  {
    name: 'Workflows',
    href: '/workflows',
    icon: WorkflowIcon,
    requiredPermission: PERMISSION_REQUIREMENTS.WORKFLOWS,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    requiredPermission: PERMISSION_REQUIREMENTS.SETTINGS, // null - always visible
    children: [
      {
        name: 'Brand Logistics',
        href: '/settings/brand-logistics',
        icon: Truck,
        requiredPermission: PERMISSION_REQUIREMENTS.SETTINGS,
      },
      {
        name: 'Product Logistics',
        href: '/settings/product-logistics',
        icon: Box,
        requiredPermission: PERMISSION_REQUIREMENTS.SETTINGS,
      },
    ],
  },
];

export default function Sidebar({
  isOpen,
  setIsOpen,
  isMobile,
  user,
}: SidebarProps) {
  const { accessToken } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Fetch permissions from API
  const getPermissions = async () => {
    if (!accessToken) {
      console.warn('No access token available for permissions request');
      setPermissionsLoading(false);
      return;
    }

    try {
      setPermissionsLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/permissions`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const { data = [] } = response;
      setAvailablePermissions(data);
    } catch (error: any) {
      console.log('Error fetching permissions:', error);
      toast.error('Failed to load permissions');
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Load permissions when accessToken is available
  useEffect(() => {
    getPermissions();
  }, [accessToken]);

  // Get user's permission details from their permission IDs
  const getUserPermissions = useMemo(() => {
    if (
      !user?.permissions ||
      !Array.isArray(user.permissions) ||
      availablePermissions?.length === 0
    ) {
      return [];
    }

    return availablePermissions?.filter((permission) =>
      user.permissions.includes(permission._id)
    );
  }, [user?.permissions, availablePermissions]);

  // Check if user has a specific permission with required action
  const hasPermission = (
    requiredPermission: { name: string } | null
  ): boolean => {
    // If no permission required (like Settings), always allow
    if (requiredPermission === null) return true;

    // If still loading permissions, deny access for now
    if (permissionsLoading) return false;

    // If user has no permissions array, deny access
    if (!user?.permissions || !Array.isArray(user.permissions)) return false;

    // Debug logging
    console.log('Checking permission:', requiredPermission);
    console.log('User permissions:', getUserPermissions);
    console.log('Available permissions:', availablePermissions);

    // Check if user has the required permission with the required action
    const hasAccess = getUserPermissions?.some((permission) => {
      const nameMatch = permission.name === requiredPermission.name;
      console.log(`Permission ${permission.name}: nameMatch=${nameMatch}`);
      return nameMatch;
    });

    console.log('Has access:', hasAccess);
    return hasAccess;
  };

  // Filter navigation items based on permissions
  const filteredNavigation = useMemo(() => {
    if (permissionsLoading) return []; // Hide navigation while loading

    const filterItems = (items: any[]): any[] => {
      return items
        .filter((item) => hasPermission(item.requiredPermission))
        .map((item) => {
          if (item.children) {
            const filteredChildren = filterItems(item.children);
            // Only show parent if it has accessible children or if the parent itself is accessible
            if (filteredChildren.length > 0) {
              return { ...item, children: filteredChildren };
            }
            // If parent has permission but no accessible children, show it without children
            return hasPermission(item.requiredPermission)
              ? { ...item, children: [] }
              : null;
          }
          return item;
        })
        .filter(Boolean);
    };

    return filterItems(navigation);
  }, [user?.permissions, availablePermissions, permissionsLoading]);

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
    if (!pathname || filteredNavigation.length === 0) return;

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

    checkNavItem(filteredNavigation);
    setExpandedItems(newExpandedItems);
  }, [pathname, filteredNavigation]);

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
    return items.map((item, index) => {
      const isItemActive = item.href && isActive(item.href);
      const isExpanded = expandedItems.includes(item.name);
      const IconComponent = item.icon;
      const isGroup = level === 1 && item.children && item.children.length > 0;

      return (
        <div key={item.name} className={level > 0 ? 'ml-2' : ''}>
          {item.children && item.children.length > 0 ? (
            <div className={isGroup ? 'mb-3' : ''}>
              <button
                onClick={() => toggleSubmenu(item.name)}
                className={`
                  group w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out
                  ${isGroup
                    ? isExpanded
                      ? 'bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 text-gray-900 dark:text-white border-l-2 border-indigo-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
                    : isItemActive
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
                      className={`flex-shrink-0 ${isGroup ? 'w-4 h-4' : 'w-5 h-5'} ${isCollapsed ? 'mr-0' : 'mr-3'
                        } ${isItemActive
                          ? 'text-white'
                          : isGroup && isExpanded
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                        }`}
                    />
                  )}
                  {!isCollapsed && (
                    <span className={`truncate ${isGroup ? 'text-xs font-semibold uppercase tracking-wider' : ''}`}>
                      {item.name}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <ChevronRight
                    className={`flex-shrink-0 w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''
                      } ${isItemActive
                        ? 'text-white'
                        : isGroup && isExpanded
                          ? 'text-indigo-500 dark:text-indigo-400'
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
                    ${isExpanded
                      ? 'max-h-[500px] opacity-100 mt-1'
                      : 'max-h-0 opacity-0'
                    }
                  `}
                >
                  <div className={`space-y-0.5 ${isGroup ? 'pl-2 border-l border-gray-200 dark:border-gray-700' : ''}`}>
                    {renderNavItems(item.children, level + 1)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={item.href}
              className={`
                group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out
                ${isItemActive
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg transform scale-[1.02]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700/50 hover:text-indigo-700 dark:hover:text-white hover:transform hover:translate-x-0.5'
                }
              `}
              onClick={() => isMobile && setIsOpen(false)}
              title={isCollapsed ? item.name : ''}
            >
              {IconComponent && (
                <IconComponent
                  className={`flex-shrink-0 w-4 h-4 ${isCollapsed ? 'mr-0' : 'mr-3'
                    } ${isItemActive
                      ? 'text-white'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                    }`}
                />
              )}
              {!isCollapsed && <span className='truncate text-sm'>{item.name}</span>}
              {isItemActive && !isCollapsed && (
                <div className='ml-auto w-1.5 h-1.5 bg-white rounded-full'></div>
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
      className={`${isMobile
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
          ${isMobile
            ? 'relative flex-1 flex flex-col max-w-xs w-full transform transition-transform duration-300'
            : `flex-1 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'
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
          <nav className='px-3 space-y-2'>
            {permissionsLoading ? (
              <div className='text-center py-8'>
                {!isCollapsed && (
                  <div className='space-y-2'>
                    <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto'></div>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      Loading permissions...
                    </p>
                  </div>
                )}
              </div>
            ) : filteredNavigation.length > 0 ? (
              renderNavItems(filteredNavigation)
            ) : (
              <div className='text-center py-8'>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {!isCollapsed && 'No accessible pages'}
                </p>
              </div>
            )}
          </nav>
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
                  {capitalize(user?.role?.replace('_', ' ') || '')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
