'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, Shield, Briefcase, CheckCircle2, KeyRound } from 'lucide-react';
import capitalize from '@/util/capitalize';

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className='flex items-start gap-4 py-4 border-b border-gray-100 dark:border-zinc-800 last:border-0'>
      <div className='flex-shrink-0 w-9 h-9 bg-blue-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center'>
        <Icon className='h-4 w-4 text-blue-600 dark:text-blue-400' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-0.5'>
          {label}
        </p>
        <p className='text-sm font-medium text-gray-900 dark:text-zinc-100 truncate'>{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <div className='flex items-center justify-between py-3.5 border-b border-gray-100 dark:border-zinc-800 last:border-0'>
      <span className='text-sm text-gray-700 dark:text-zinc-300'>{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          active
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
        {active ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}

function Page() {
  const { email, isLoading, accessToken, user } = useAuth();
  const [permNames, setPermNames] = useState<string[]>([]);
  const [permsOpen, setPermsOpen] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL!;

  useEffect(() => {
    if (!accessToken || !user?.permissions?.length) return;
    fetch(`${API}/users/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((all: { _id: string; name: string }[]) => {
        const names = all
          .filter((p) => user.permissions.includes(p._id))
          .map((p) => p.name);
        setPermNames(names);
      })
      .catch(() => {});
  }, [accessToken, user?.permissions]);

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3' />
          <p className='text-sm text-gray-500 dark:text-zinc-400'>Loading account…</p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <div className='bg-white dark:bg-zinc-900 p-10 rounded-xl shadow-md text-center'>
          <Shield className='h-14 w-14 text-gray-300 dark:text-zinc-600 mx-auto mb-4' />
          <p className='text-gray-700 dark:text-zinc-300 font-medium'>
            Please log in to view your account.
          </p>
        </div>
      </div>
    );
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (email?.[0] ?? '?').toUpperCase();

  const roleLabel = user?.role
    ? capitalize(user.role.replace(/_/g, ' '))
    : 'User';

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 py-8 px-4 sm:px-6'>
      <div className='max-w-2xl mx-auto space-y-5'>

        {/* Page title */}
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>Account</h1>
          <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>
            Your profile and account details
          </p>
        </div>

        {/* Profile header card */}
        <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden'>
          {/* Gradient banner */}
          <div className='h-24 bg-gradient-to-r from-blue-500 to-indigo-600' />
          <div className='px-6 pb-6'>
            {/* Avatar */}
            <div className='-mt-10 mb-4 flex items-end justify-between'>
              <div className='h-20 w-20 rounded-2xl border-4 border-white dark:border-zinc-900 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md'>
                <span className='text-2xl font-bold text-white tracking-tight'>{initials}</span>
              </div>
              <span className='mb-1 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full border border-blue-200 dark:border-blue-800'>
                <Briefcase className='h-3 w-3' />
                {roleLabel}
              </span>
            </div>
            <h2 className='text-xl font-bold text-gray-900 dark:text-zinc-100'>
              {user?.name || 'Unknown User'}
            </h2>
            <p className='text-sm text-gray-500 dark:text-zinc-400 mt-0.5'>{email}</p>
          </div>
        </div>

        {/* Profile details card */}
        <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm'>
          <div className='px-6 pt-5 pb-1 flex items-center gap-2'>
            <User className='h-4 w-4 text-gray-400 dark:text-zinc-500' />
            <h3 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide'>
              Profile Details
            </h3>
          </div>
          <div className='px-6'>
            <InfoRow icon={User} label='Full Name' value={user?.name || 'Not provided'} />
            <InfoRow icon={Mail} label='Email Address' value={email || 'Not provided'} />
            <InfoRow icon={Phone} label='Phone Number' value={user?.phone || 'Not provided'} />
            <InfoRow icon={Briefcase} label='Role' value={roleLabel} />
          </div>
        </div>

        {/* Account status card */}
        <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm'>
          <div className='px-6 pt-5 pb-1 flex items-center gap-2'>
            <Shield className='h-4 w-4 text-gray-400 dark:text-zinc-500' />
            <h3 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide'>
              Account Status
            </h3>
          </div>
          <div className='px-6'>
            <StatusBadge label='Account Status' active />
            <StatusBadge label='Session Authenticated' active={!!accessToken} />
            <div className='flex items-center justify-between py-3.5'>
              <span className='text-sm text-gray-700 dark:text-zinc-300'>Permissions</span>
              <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'>
                <KeyRound className='h-3 w-3' />
                {user?.permissions?.length ?? 0} granted
              </span>
            </div>
          </div>
        </div>

        {/* Permissions accordion */}
        {user?.permissions?.length > 0 && (
          <div className='bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden'>
            <button
              onClick={() => setPermsOpen((o) => !o)}
              className='w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors'
            >
              <div className='flex items-center gap-2'>
                <CheckCircle2 className='h-4 w-4 text-gray-400 dark:text-zinc-500' />
                <h3 className='text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide'>
                  Permissions
                </h3>
                <span className='ml-1 px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800'>
                  {permNames.length || user.permissions.length}
                </span>
              </div>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${permsOpen ? 'rotate-180' : ''}`}
                fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}
              >
                <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
              </svg>
            </button>
            {permsOpen && (
              <div className='px-6 pb-5 pt-1 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap gap-2'>
                {permNames.length > 0
                  ? permNames.map((name) => (
                      <span
                        key={name}
                        className='inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-md border border-gray-200 dark:border-zinc-700'
                      >
                        {name.replace(/_/g, ' ')}
                      </span>
                    ))
                  : user.permissions.map((id: string) => (
                      <span
                        key={id}
                        className='inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 rounded-md border border-gray-200 dark:border-zinc-700 font-mono'
                      >
                        {id}
                      </span>
                    ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Page;
