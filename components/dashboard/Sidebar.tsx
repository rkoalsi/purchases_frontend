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
  SquareKanban,
  ZapIcon,
  FileText,
  CheckSquare,
  ShoppingCart,
  Truck,
  Box,
  UserCircle,
  TrendingDown,
  TrendingUp,
  Code2,
  UsersIcon,
  Palette,
  Sparkles,
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
// null = always visible (parent groups derive visibility from their children)
const PERMISSION_REQUIREMENTS = {
  DASHBOARD: { name: 'dashboard' },
  USERS: { name: 'users' },
  SETTINGS: null,
  // Item-specific permissions
  AMAZON_ITEMS: { name: 'items_amazon' },
  BLINKIT_ITEMS: { name: 'items_blinkit' },
  ZOHO_ITEMS: { name: 'items_zoho' },
  // Report-specific permissions
  AMAZON_REPORTS: { name: 'reports_amazon' },
  AMAZON_SETTLEMENTS: { name: 'reports_amazon_settlements' },
  BLINKIT_REPORTS: { name: 'reports_blinkit' },
  BLINKIT_ADS_REPORTS: { name: 'reports_blinkit_ads' },
  ZOHO_REPORTS: { name: 'reports_zoho' },
  MASTER_REPORTS: { name: 'reports_master' },
  SEASONAL_REPORTS: { name: 'reports_seasonal' },
  ESTIMATES_VS_INVOICES: { name: 'reports_estimates_vs_invoices' },
  SALES_REPORTS: { name: 'reports_sales_by_customer' },
  PI_CL_REPORTS: { name: 'reports_pi_vs_cl' },
  MISSED_SALES: { name: 'reports_missed_sales' },
  AMAZON_LISTING_VALIDATION: { name: 'reports_amazon_listing_validation' },
  VENDOR_PO: { name: 'reports_vendor_po' },
  ETRADE_SHIPMENT_SUMMARY: { name: 'reports_vendor_po' },
  SELLER_FLEX_RETURNS: { name: 'reports_amazon_seller_flex_returns' },
  FBA_RETURNS: { name: 'reports_amazon_fba_returns' },
  VENDOR_CENTRAL_RETURNS: { name: 'reports_amazon_vendor_central_returns' },
  INVENTORY_AGING: { name: 'reports_inventory_aging' },
  BB_CODE_GENERATOR: { name: 'tools_bb_code_generator' },
  VENDOR_BRAND_MAPPING: { name: 'vendors_brand_mapping' },
  DRAFT_ORDERS: { name: 'vendors_draft_orders' },
  BRAND_ORDERS: { anyOf: ['vendors_brand_orders_view', 'vendors_brand_orders_edit'] },
  BRAND_LOGISTICS: { name: 'settings_brand_logistics' },
  PRODUCT_LOGISTICS: { name: 'settings_product_logistics' },
  DESIGN_NEW_ITEMS: { name: 'design_new_items' },
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
    requiredPermission: null, // visible if any child is accessible
    children: [
      {
        name: 'Amazon Items',
        href: '/items/amazon',
        icon: AmazonIcon,
        requiredPermission: PERMISSION_REQUIREMENTS.AMAZON_ITEMS,
      },
      {
        name: 'Blinkit Items',
        href: '/items/blinkit',
        icon: Zap,
        requiredPermission: PERMISSION_REQUIREMENTS.BLINKIT_ITEMS,
      },
      {
        name: 'Zoho Items',
        href: '/items/zoho',
        icon: Building2,
        requiredPermission: PERMISSION_REQUIREMENTS.ZOHO_ITEMS,
      },
    ],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    requiredPermission: null, // visible if any child is accessible
    children: [
      {
        name: 'Amazon Reports',
        icon: AmazonIcon,
        requiredPermission: null,
        children: [
          {
            name: 'Amazon PSR',
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
          {
            name: 'VC POs',
            href: '/reports/vendor_po',
            icon: Truck,
            requiredPermission: PERMISSION_REQUIREMENTS.VENDOR_PO,
          },
          {
            name: 'VC Shipment Summary',
            href: '/reports/etrade_shipment_summary',
            icon: Box,
            requiredPermission: PERMISSION_REQUIREMENTS.ETRADE_SHIPMENT_SUMMARY,
          },
          {
            name: 'B2B VC Returns',
            href: '/reports/amazon_vendor_central_returns',
            icon: AmazonIcon,
            requiredPermission: PERMISSION_REQUIREMENTS.VENDOR_CENTRAL_RETURNS,
          },
          {
            name: 'Seller Flex Returns',
            href: '/reports/amazon_seller_flex_returns',
            icon: AmazonIcon,
            requiredPermission: PERMISSION_REQUIREMENTS.SELLER_FLEX_RETURNS,
          },
          {
            name: 'FBA Returns',
            href: '/reports/amazon_fba_returns',
            icon: AmazonIcon,
            requiredPermission: PERMISSION_REQUIREMENTS.FBA_RETURNS,
          },

        ],
      },
      {
        name: 'Blinkit Reports',
        icon: Zap,
        requiredPermission: null,
        children: [
          {
            name: 'Blinkit PSR',
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
        requiredPermission: null,
        children: [
          {
            name: 'Retail PSR',
            href: '/reports/zoho',
            icon: Building2,
            requiredPermission: PERMISSION_REQUIREMENTS.ZOHO_REPORTS,
          },
          {
            name: 'Master Report',
            href: '/reports/master',
            icon: SquareKanban,
            requiredPermission: PERMISSION_REQUIREMENTS.MASTER_REPORTS,
          },
          {
            name: 'Seasonal DRR',
            href: '/reports/seasonal',
            icon: TrendingUp,
            requiredPermission: PERMISSION_REQUIREMENTS.SEASONAL_REPORTS,
          },
          {
            name: 'Estimates vs Invoices',
            href: '/reports/estimates_vs_invoices',
            icon: FileText,
            requiredPermission: PERMISSION_REQUIREMENTS.ESTIMATES_VS_INVOICES,
          },
          {
            name: 'Inventory Aging',
            href: '/reports/inventory_aging',
            icon: TrendingDown,
            requiredPermission: PERMISSION_REQUIREMENTS.INVENTORY_AGING,
          },
        ],
      },
      {
        name: 'Verification Reports',
        icon: CheckSquare,
        requiredPermission: null,
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
          {
            name: 'Missed Sales',
            href: '/reports/missed_sales',
            icon: TrendingDown,
            requiredPermission: PERMISSION_REQUIREMENTS.MISSED_SALES,
          },
          {
            name: 'Amazon Listing Validation',
            href: '/reports/amazon_listing_validation',
            icon: CheckSquare,
            requiredPermission: PERMISSION_REQUIREMENTS.AMAZON_LISTING_VALIDATION,
          },
        ],
      },
    ],
  },
  {
    name: 'Vendors',
    href: '/vendors',
    icon: UsersIcon,
    requiredPermission: null,
    children: [
      {
        name: 'Vendor Brand Mapping',
        href: '/vendors/vendor_brand_mapping',
        icon: UsersIcon,
        requiredPermission: PERMISSION_REQUIREMENTS.VENDOR_BRAND_MAPPING,
      },
      {
        name: 'Draft Orders',
        href: '/vendors/draft_orders',
        icon: ShoppingCart,
        requiredPermission: PERMISSION_REQUIREMENTS.DRAFT_ORDERS,
      },
      {
        name: 'Brand Orders',
        href: '/brand_orders',
        icon: Package,
        requiredPermission: PERMISSION_REQUIREMENTS.BRAND_ORDERS,
      },
    ],
  },
  {
    name: 'Design',
    href: '/design',
    icon: Palette,
    requiredPermission: null,
    children: [
      {
        name: 'New Items',
        href: '/design/new-items',
        icon: Sparkles,
        requiredPermission: PERMISSION_REQUIREMENTS.DESIGN_NEW_ITEMS,
      },
    ],
  },
  {
    name: 'Tools',
    href: '/tools',
    icon: Code2,
    requiredPermission: null,
    children: [
      {
        name: 'BB Code Generator',
        href: '/tools/bb_code_generator',
        icon: Code2,
        requiredPermission: PERMISSION_REQUIREMENTS.BB_CODE_GENERATOR,
      },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    requiredPermission: null, // visible if any child is accessible
    children: [
      {
        name: 'Account',
        href: '/settings/account',
        icon: UserCircle,
        requiredPermission: null,
      },
      {
        name: 'Brand Logistics',
        href: '/settings/brand-logistics',
        icon: Truck,
        requiredPermission: PERMISSION_REQUIREMENTS.BRAND_LOGISTICS,
      },
      {
        name: 'Product Logistics',
        href: '/settings/product-logistics',
        icon: Box,
        requiredPermission: PERMISSION_REQUIREMENTS.PRODUCT_LOGISTICS,
      },
      {
        name: 'Manage Users/Permissions',
        href: '/users',
        icon: User,
        requiredPermission: PERMISSION_REQUIREMENTS.USERS,
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
    requiredPermission: { name: string } | { anyOf: string[] } | null
  ): boolean => {
    // If no permission required (like Settings), always allow
    if (requiredPermission === null) return true;

    // If still loading permissions, deny access for now
    if (permissionsLoading) return false;

    // If user has no permissions array, deny access
    if (!user?.permissions || !Array.isArray(user.permissions)) return false;

    if ('anyOf' in requiredPermission) {
      return getUserPermissions?.some((permission) =>
        requiredPermission.anyOf.includes(permission.name)
      ) ?? false;
    }
    const hasAccess = getUserPermissions?.some((permission) => {
      return permission.name === requiredPermission.name;
    });
    return hasAccess;
  };

  // Filter navigation items based on permissions.
  // Parent groups are visible only if they have at least one accessible child.
  // Leaf items are visible only if the user has the required permission.
  const filteredNavigation = useMemo(() => {
    if (permissionsLoading) return []; // Hide navigation while loading

    const filterItems = (items: any[]): any[] => {
      return items
        .map((item) => {
          if (item.children) {
            const filteredChildren = filterItems(item.children);
            // Parent is shown only when it has accessible children
            if (filteredChildren.length === 0) return null;
            return { ...item, children: filteredChildren };
          }
          // Leaf item: check permission
          return hasPermission(item.requiredPermission) ? item : null;
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

  // Toggle submenu — collapse sibling groups at the same level when expanding
  const toggleSubmenu = (name: string, siblings: string[] = []) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    setExpandedItems((prev) => {
      if (prev.includes(name)) {
        return prev.filter((item) => item !== name);
      }
      return [...prev.filter((item) => !siblings.includes(item)), name];
    });
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
    const siblingNames = items
      .filter((i) => i.children && i.children.length > 0)
      .map((i) => i.name);

    return items.map((item) => {
      const isItemActive = item.href && isActive(item.href);
      const isExpanded = expandedItems.includes(item.name);
      const IconComponent = item.icon;
      const isGroup = level === 1 && item.children && item.children.length > 0;

      return (
        <div key={item.name} className={level > 0 ? 'ml-1.5' : ''}>
          {item.children && item.children.length > 0 ? (
            <div className={isGroup ? 'mb-3' : ''}>
              <button
                onClick={() => toggleSubmenu(item.name, siblingNames)}
                className={`
                  group w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 ease-in-out
                  ${isGroup
                    ? isExpanded
                      ? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-50 border-l-2 border-blue-500'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                    : isItemActive
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                      : isExpanded
                        ? 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-800 dark:text-zinc-200'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }
                `}
                title={isCollapsed ? item.name : ''}
              >
                <div className='flex items-center min-w-0'>
                  {IconComponent && (
                    <IconComponent
                      className={`flex-shrink-0 ${isGroup ? 'w-4 h-4' : 'w-5 h-5'} ${isCollapsed ? 'mr-0' : 'mr-3'
                        } ${isItemActive
                          ? 'text-blue-500 dark:text-blue-400'
                          : isGroup && isExpanded
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
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
                        ? 'text-zinc-700 dark:text-zinc-200'
                        : isGroup && isExpanded
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-zinc-400 dark:text-zinc-500'
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
                  <div className={`space-y-0.5 ${isGroup ? 'pl-2 border-l border-zinc-200 dark:border-zinc-800' : ''}`}>
                    {renderNavItems(item.children, level + 1)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={item.href}
              className={`
                group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 ease-in-out
                ${isItemActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                }
              `}
              onClick={() => isMobile && setIsOpen(false)}
              title={isCollapsed ? item.name : ''}
            >
              {IconComponent && (
                <IconComponent
                  className={`flex-shrink-0 w-4 h-4 ${isCollapsed ? 'mr-0' : 'mr-3'
                    } ${isItemActive
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                    }`}
                />
              )}
              {!isCollapsed && <span className='truncate text-sm'>{item.name}</span>}
              {isItemActive && !isCollapsed && (
                <div className='ml-auto w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full'></div>
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
          className='fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300'
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
          bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 h-full
        `}
      >
        {/* Header */}
        <div className='flex-shrink-0 px-4 py-5 border-b border-zinc-200 dark:border-zinc-800'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center min-w-0'>
              <div className='flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center'>
                <ShoppingBag className='w-4 h-4 text-white' />
              </div>
              {!isCollapsed && (
                <div className='ml-3 min-w-0'>
                  <h1 className='text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate'>
                    Purchase App
                  </h1>
                  <p className='text-xs text-zinc-500 dark:text-zinc-400 truncate'>
                    Inventory Management
                  </p>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            {isMobile ? (
              <button
                onClick={() => setIsOpen(false)}
                className='p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            ) : (
              /* Desktop collapse button */
              <button
                onClick={toggleCollapse}
                className='p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
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
          <nav className='px-3 space-y-1'>
            {permissionsLoading ? (
              <div className='text-center py-8'>
                {!isCollapsed && (
                  <div className='space-y-2'>
                    <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto'></div>
                    <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                      Loading...
                    </p>
                  </div>
                )}
              </div>
            ) : filteredNavigation.length > 0 ? (
              renderNavItems(filteredNavigation)
            ) : (
              <div className='text-center py-8'>
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                  {!isCollapsed && 'No accessible pages'}
                </p>
              </div>
            )}
          </nav>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className='flex-shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800'>
            <div className='flex items-center'>
              <div className='w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center'>
                <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-200'>
                  {user?.name?.charAt(0)}
                </span>
              </div>
              <div className='ml-3'>
                <p className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                  {user?.name}
                </p>
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
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
