'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/context/AuthContext';
import {
  Package,
  Zap,
  Building2,
  SquareKanban,
  FileText,
  CheckSquare,
  ShoppingCart,
  Truck,
  Box,
  TrendingDown,
  TrendingUp,
  Store,
  Import,
  Code2,
  UsersIcon,
  UserCircle,
  User,
  ShoppingBag,
  Loader2,
} from 'lucide-react';

const AmazonIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 24 24' fill='currentColor'>
    <path d='M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.06.293.04.138.22-.293.523-.61.692-3.247 1.834-6.197 2.526-9.588 2.526-4.464 0-8.365-1.54-11.915-4.618-.138-.138-.2-.231-.16-.349M23.718 15.622c-.299-.41-1.96-.195-2.709-.098-.23.03-.268-.173-.06-.318 1.324-.93 3.499-.66 3.754-.35s-.067 2.48-1.309 3.515c-.195.165-.38.077-.294-.142.284-.715.919-2.315.618-2.607' />
  </svg>
);

// All leaf pages with their permission name, label, href, and icon
const ALL_PAGES = [
  { name: 'Amazon Items', href: '/items/amazon', permission: 'items_amazon', icon: AmazonIcon, group: 'Items' },
  { name: 'Blinkit Items', href: '/items/blinkit', permission: 'items_blinkit', icon: Zap, group: 'Items' },
  { name: 'Zoho Items', href: '/items/zoho', permission: 'items_zoho', icon: Building2, group: 'Items' },
  { name: 'Amazon PSR', href: '/reports/amazon', permission: 'reports_amazon', icon: AmazonIcon, group: 'Reports' },
  { name: 'Amazon Settlements', href: '/reports/amazon_settlements', permission: 'reports_amazon_settlements', icon: SquareKanban, group: 'Reports' },
  { name: 'VC POs', href: '/reports/vendor_po', permission: 'reports_vendor_po', icon: Truck, group: 'Reports' },
  { name: 'VC Shipment Summary', href: '/reports/etrade_shipment_summary', permission: 'reports_vendor_po', icon: Box, group: 'Reports' },
  { name: 'B2B VC Returns', href: '/reports/amazon_vendor_central_returns', permission: 'reports_amazon_vendor_central_returns', icon: AmazonIcon, group: 'Reports' },
  { name: 'Seller Flex Returns', href: '/reports/amazon_seller_flex_returns', permission: 'reports_amazon_seller_flex_returns', icon: AmazonIcon, group: 'Reports' },
  { name: 'FBA Returns', href: '/reports/amazon_fba_returns', permission: 'reports_amazon_fba_returns', icon: AmazonIcon, group: 'Reports' },
  { name: 'FBA Shipment Queue', href: '/reports/amazon_fba_shipment_queue', permission: 'reports_amazon_fba_shipment_queue', icon: AmazonIcon, group: 'Reports' },
  { name: 'Blinkit PSR', href: '/reports/blinkit', permission: 'reports_blinkit', icon: Zap, group: 'Reports' },
  { name: 'Blinkit Ads', href: '/reports/blinkit_ads', permission: 'reports_blinkit_ads', icon: Zap, group: 'Reports' },
  { name: 'Retail PSR', href: '/reports/zoho', permission: 'reports_zoho', icon: Building2, group: 'Reports' },
  { name: 'Master Report', href: '/reports/master', permission: 'reports_master', icon: SquareKanban, group: 'Reports' },
  { name: 'Seasonal DRR', href: '/reports/seasonal', permission: 'reports_seasonal', icon: TrendingUp, group: 'Reports' },
  { name: 'Estimates vs Invoices', href: '/reports/estimates_vs_invoices', permission: 'reports_estimates_vs_invoices', icon: FileText, group: 'Reports' },
  { name: 'Inventory Aging', href: '/reports/inventory_aging', permission: 'reports_inventory_aging', icon: TrendingDown, group: 'Reports' },
  { name: 'Sales By Customer', href: '/reports/sales_by_customer', permission: 'reports_sales_by_customer', icon: Store, group: 'Reports' },
  { name: 'PI vs CL', href: '/reports/PI_vs_CL', permission: 'reports_pi_vs_cl', icon: Import, group: 'Reports' },
  { name: 'Missed Sales', href: '/reports/missed_sales', permission: 'reports_missed_sales', icon: TrendingDown, group: 'Reports' },
  { name: 'Amazon Listing Validation', href: '/reports/amazon_listing_validation', permission: 'reports_amazon_listing_validation', icon: CheckSquare, group: 'Reports' },
  { name: 'Vendor Brand Mapping', href: '/vendors/vendor_brand_mapping', permission: 'vendors_brand_mapping', icon: UsersIcon, group: 'Vendors' },
  { name: 'Draft Orders', href: '/vendors/draft_orders', permission: 'vendors_draft_orders', icon: ShoppingCart, group: 'Vendors' },
  { name: 'Brand Orders', href: '/brand_orders', permission: 'brand_orders_view', icon: Package, group: 'Vendors' },
  { name: 'BB Code Generator', href: '/tools/bb_code_generator', permission: 'tools_bb_code_generator', icon: Code2, group: 'Tools' },
  { name: 'Manage Users', href: '/users', permission: 'users', icon: User, group: 'Settings' },
  { name: 'Brand Logistics', href: '/settings/brand-logistics', permission: 'settings_brand_logistics', icon: Truck, group: 'Settings' },
  { name: 'Product Logistics', href: '/settings/product-logistics', permission: 'settings_product_logistics', icon: Box, group: 'Settings' },
  { name: 'Account', href: '/settings/account', permission: null, icon: UserCircle, group: 'Settings' },
];

const GROUP_ORDER = ['Items', 'Reports', 'Vendors', 'Tools', 'Settings'];

const GROUP_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  Items: { dot: 'bg-violet-500', badge: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300' },
  Reports: { dot: 'bg-blue-500', badge: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
  Vendors: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
  Tools: { dot: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
  Settings: { dot: 'bg-zinc-400', badge: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-300' },
};

export default function NoAccessPage() {
  const { user, accessToken } = useAuth();
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL!;

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API}/users/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((perms) => setAllPermissions(perms ?? []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [accessToken, API]);

  const userPermissionNames = useMemo(() => {
    if (!user?.permissions || !allPermissions.length) return new Set<string>();
    return new Set<string>(
      allPermissions
        .filter((p) => user.permissions.includes(p._id))
        .map((p) => p.name)
    );
  }, [user?.permissions, allPermissions]);

  const accessiblePages = useMemo(() => {
    return ALL_PAGES.filter(
      (p) => p.permission === null || userPermissionNames.has(p.permission)
    );
  }, [userPermissionNames]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof ALL_PAGES> = {};
    for (const page of accessiblePages) {
      if (!map[page.group]) map[page.group] = [];
      map[page.group].push(page);
    }
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({
      group: g,
      pages: map[g],
    }));
  }, [accessiblePages]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-zinc-950 flex flex-col'>
      {/* Hero strip */}
      <div className='border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'>
        <div className='max-w-5xl mx-auto px-6 py-10 flex items-start gap-5'>
          <div className='flex-shrink-0 w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20'>
            <ShoppingBag className='w-7 h-7 text-white' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-50'>
              Welcome back, {firstName}
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-zinc-400 max-w-xl'>
              You can the modules below.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 max-w-5xl mx-auto w-full px-6 py-8'>
        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='w-6 h-6 animate-spin text-blue-500' />
          </div>
        ) : grouped.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-center'>
            <div className='w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4'>
              <Package className='w-7 h-7 text-zinc-400 dark:text-zinc-500' />
            </div>
            <p className='text-base font-medium text-gray-700 dark:text-zinc-300'>
              No modules assigned yet
            </p>
            <p className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
              Contact an admin to get permissions added to your account.
            </p>
          </div>
        ) : (
          <div className='space-y-8'>
            {grouped.map(({ group, pages }) => {
              const colors = GROUP_COLORS[group];
              return (
                <section key={group}>
                  {/* Group header */}
                  <div className='flex items-center gap-2.5 mb-3'>
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <h2 className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400'>
                      {group}
                    </h2>
                  </div>

                  {/* Cards grid */}
                  <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
                    {pages.map((page) => {
                      const Icon = page.icon;
                      return (
                        <Link
                          key={page.href}
                          href={page.href}
                          className='group flex flex-col gap-3 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm hover:shadow-blue-500/10 transition-all duration-150'
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.badge} transition-colors`}
                          >
                            <Icon
                              className={`w-4 h-4 ${colors.text} flex-shrink-0`}
                            />
                          </div>
                          <span className='text-sm font-medium text-gray-800 dark:text-zinc-200 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'>
                            {page.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
