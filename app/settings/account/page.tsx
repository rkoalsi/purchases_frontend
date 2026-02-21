'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState } from 'react';
import { User, Mail, Shield, Calendar, Edit2, Save, X } from 'lucide-react';
import capitalize from '@/util/capitalize';

function Page() {
  const { email, isLoading, accessToken, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser]: any = useState({});

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading user data...</p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-lg shadow-md text-center'>
          <Shield className='h-16 w-16 text-gray-400 mx-auto mb-4' />
          <p className='text-xl text-gray-700'>
            Please log in to see this content.
          </p>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    setIsEditing(true);
    setEditedUser({
      name: user?.name || '',
      email: email || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
    });
  };

  const handleSave = () => {
    // Here you would typically save the changes to your backend
    console.log('Saving user data:', editedUser);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser({});
  };

  const handleInputChange = (field: any, value: any) => {
    setEditedUser((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950 py-8'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 mb-6'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-zinc-800'>
            <div className='flex items-center justify-between'>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-zinc-100'>Settings</h1>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                >
                  <Edit2 className='h-4 w-4 mr-2' />
                  Edit Profile
                </button>
              ) : (
                <div className='flex space-x-2'>
                  <button
                    onClick={handleSave}
                    className='inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
                  >
                    <Save className='h-4 w-4 mr-2' />
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className='inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors'
                  >
                    <X className='h-4 w-4 mr-2' />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Information Card */}
        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 mb-6'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-zinc-800'>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center'>
              <User className='h-5 w-5 mr-2 text-blue-600' />
              User Information
            </h2>
          </div>
          <div className='px-6 py-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Name */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2'>
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type='text'
                    value={editedUser.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className='w-full text-black dark:text-zinc-100 dark:bg-zinc-800 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                ) : (
                  <p className='text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 px-3 py-2 rounded-md'>
                    {user?.name || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2 items-center'>
                  <Mail className='h-4 w-4 mr-1' />
                  Email Address
                </label>
                {isEditing ? (
                  <input
                    type='email'
                    value={editedUser.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className='w-full text-black dark:text-zinc-100 dark:bg-zinc-800 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                ) : (
                  <p className='text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 px-3 py-2 rounded-md'>
                    {email || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2'>
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type='tel'
                    value={editedUser.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className='w-full text-black dark:text-zinc-100 dark:bg-zinc-800 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='Enter phone number'
                  />
                ) : (
                  <p className='text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 px-3 py-2 rounded-md'>
                    {user?.phone || 'Not provided'}
                  </p>
                )}
              </div>
              {/* Created Date */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2 items-center'>
                  <Calendar className='h-4 w-4 mr-1' />
                  Role
                </label>
                <p className='text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800 px-3 py-2 rounded-md'>
                  {capitalize(user?.role.replace('_', ' '))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Status Card */}
        <div className='bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-zinc-800'>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center'>
              <Shield className='h-5 w-5 mr-2 text-green-600' />
              Account Status
            </h2>
          </div>
          <div className='px-6 py-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2'>
                  Account Status
                </label>
                <div className='flex items-center'>
                  <div className='h-3 w-3 bg-green-500 rounded-full mr-2'></div>
                  <span className='text-green-700 dark:text-green-400 font-medium'>Active</span>
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2'>
                  Authentication
                </label>
                <div className='flex items-center'>
                  <div className='h-3 w-3 bg-green-500 rounded-full mr-2'></div>
                  <span className='text-green-700 dark:text-green-400 font-medium'>
                    Authenticated
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
