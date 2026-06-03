'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageSquare, RefreshCw, UserPlus, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/components/context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL;
const POLL_INTERVAL = 30_000;

interface AppNotification {
  _id: string;
  source: string;
  task_id?: string;
  task_title?: string;
  order_id?: string;
  brand?: string;
  order_name?: string;
  type: string;
  actor_name: string;
  snippet: string;
  read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  comment_added: <MessageSquare className='h-3.5 w-3.5 text-blue-500' />,
  status_changed: <RefreshCw className='h-3.5 w-3.5 text-amber-500' />,
  assigned_to_names_changed: <UserPlus className='h-3.5 w-3.5 text-green-500' />,
  brand_order_created: <Package className='h-3.5 w-3.5 text-purple-500' />,
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const fetchNotifications = useCallback(async () => {
    if (!user?._id || !accessToken) return;
    try {
      const { data } = await axios.get(`${API}/notifications`, {
        params: { user_id: user._id },
        headers: authHeaders,
      });
      setItems(data.items);
      setUnread(data.unread_count);
    } catch { /* non-critical — silent fail */ }
  }, [user?._id, accessToken]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const markRead = async (notifId?: string) => {
    if (!user?._id || !accessToken) return;
    try {
      await axios.post(
        `${API}/notifications/read`,
        { user_id: user._id, ...(notifId ? { notification_id: notifId } : {}) },
        { headers: authHeaders },
      );
      if (notifId) {
        setItems(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
        setUnread(prev => Math.max(0, prev - 1));
      } else {
        setItems(prev => prev.map(n => ({ ...n, read: true })));
        setUnread(0);
      }
    } catch { /* silent */ }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) markRead(n._id);
    setOpen(false);
    if (n.source === 'brand_order') {
      router.push('/brand_orders');
    } else {
      router.push(`/tasks?open=${n.task_id}`);
    }
  };

  return (
    <div className='relative mr-2' ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className='relative flex items-center justify-center h-8 w-8 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none'
        aria-label='Notifications'
      >
        <Bell className='h-[18px] w-[18px]' />
        {unread > 0 && (
          <span className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white leading-none pointer-events-none'>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className='absolute right-0 mt-2 w-80 rounded-lg shadow-xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 z-50 overflow-hidden'>
          {/* Header */}
          <div className='flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800'>
            <span className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markRead()}
                className='text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className='max-h-[420px] overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800/60'>
            {items.length === 0 ? (
              <div className='py-10 text-center'>
                <Bell className='h-6 w-6 text-zinc-300 dark:text-zinc-600 mx-auto mb-2' />
                <p className='text-xs text-zinc-400 dark:text-zinc-500'>No notifications yet</p>
              </div>
            ) : (
              items.map(n => (
                <button
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    !n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {/* Type icon */}
                  <span className='mt-0.5 flex-shrink-0'>
                    {TYPE_ICON[n.type] ?? <Bell className='h-3.5 w-3.5 text-zinc-400' />}
                  </span>

                  {/* Content */}
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs leading-snug text-zinc-800 dark:text-zinc-200'>
                      <span className='font-semibold'>{n.actor_name}</span>{' '}
                      <span className='text-zinc-600 dark:text-zinc-400'>{n.snippet}</span>
                    </p>
                    <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate font-medium'>
                      {n.task_title}
                    </p>
                    <p className='text-[10px] text-zinc-400 dark:text-zinc-500 mt-1'>
                      {fmtRelative(n.created_at)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className='mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0' />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
