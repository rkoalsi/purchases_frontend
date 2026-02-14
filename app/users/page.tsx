'use client';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Edit3,
  Save,
  X,
  Shield,
  Plus,
  Loader2,
  UserX,
  ChevronDown,
  ChevronUp,
  Check,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useAuth } from '@/components/context/AuthContext';

export default function UserManagementPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [expandedPermissions, setExpandedPermissions] = useState<
    Record<string, boolean>
  >({});
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const [savingPermissions, setSavingPermissions] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active',
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  // Create permission modal
  const [showCreatePermission, setShowCreatePermission] = useState(false);
  const [newPermission, setNewPermission] = useState({
    name: '',
    description: '',
    is_active: true,
  });
  const [creatingPermission, setCreatingPermission] = useState(false);

  const authHeaders = {
    headers: { Authorization: `Bearer ${accessToken}` },
  };

  const isAdminOrPurchaseAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'purchase_admin';

  const activePermissions = useMemo(
    () => availablePermissions.filter((p) => p.is_active !== false),
    [availablePermissions]
  );

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const getPermissions = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/permissions`,
        authHeaders
      );
      setAvailablePermissions(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch permissions:', error);
      toast.error('Failed to load permissions');
    }
  };

  const getUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        authHeaders
      );
      setUsers(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      getUsers();
      getPermissions();
    }
  }, [accessToken]);

  const handleEditUser = (user: any) => {
    setEditingUser(user._id);
    setEditForm({ ...user });
  };

  const handleSaveUser = async () => {
    setSavingUser(editingUser);
    try {
      const { name, email, role, status } = editForm;
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${editingUser}`,
        { name, email, role, status },
        authHeaders
      );
      setUsers(
        users.map((user: any) =>
          user._id === editingUser ? { ...user, ...editForm } : user
        )
      );
      toast.success('User updated');
    } catch (error: any) {
      console.error('Failed to save user:', error);
      toast.error('Failed to update user');
    } finally {
      setEditingUser(null);
      setEditForm({});
      setSavingUser(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const togglePermissionExpansion = (userId: string) => {
    setExpandedPermissions((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const saveUserPermissions = async (userId: string, permissions: string[]) => {
    setSavingPermissions(userId);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/permissions`,
        { permissions },
        authHeaders
      );
      toast.success('Permissions updated');
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      toast.error('Failed to update permissions');
    } finally {
      setSavingPermissions(null);
    }
  };

  const addPermission = (userId: string, permissionId: string) => {
    const updatedUsers = users.map((user: any) => {
      if (user._id === userId) {
        const newPermissions = [...user.permissions, permissionId];
        saveUserPermissions(userId, newPermissions);
        return { ...user, permissions: newPermissions };
      }
      return user;
    });
    setUsers(updatedUsers);
  };

  const removePermission = (userId: string, permissionId: string) => {
    const updatedUsers = users.map((user: any) => {
      if (user._id === userId) {
        const newPermissions = user.permissions.filter(
          (p: string) => p !== permissionId
        );
        saveUserPermissions(userId, newPermissions);
        return { ...user, permissions: newPermissions };
      }
      return user;
    });
    setUsers(updatedUsers);
  };

  const getPermissionDetails = (permissionId: string) => {
    return availablePermissions.find((p: any) => p._id === permissionId);
  };

  const getAvailablePermissionsForUser = (user: any) => {
    return activePermissions.filter(
      (p: any) => !user.permissions?.includes(p._id)
    );
  };

  const handleCreateUser = async () => {
    if (!newUser.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!newUser.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!newUser.password.trim()) {
      toast.error('Password is required');
      return;
    }
    setCreatingUser(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        newUser,
        authHeaders
      );
      setUsers((prev) => [...prev, response.data]);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'user',
        status: 'active',
      });
      setShowCreateUser(false);
      toast.success('User created successfully');
    } catch (error: any) {
      console.error('Failed to create user:', error);
      toast.error(
        error.response?.data?.detail || 'Failed to create user'
      );
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreatePermission = async () => {
    if (!newPermission.name.trim()) {
      toast.error('Permission name is required');
      return;
    }
    setCreatingPermission(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/permissions`,
        newPermission,
        authHeaders
      );
      setAvailablePermissions((prev) => [...prev, response.data]);
      setNewPermission({ name: '', description: '', is_active: true });
      setShowCreatePermission(false);
      toast.success('Permission created');
    } catch (error: any) {
      console.error('Failed to create permission:', error);
      toast.error(
        error.response?.data?.detail || 'Failed to create permission'
      );
    } finally {
      setCreatingPermission(false);
    }
  };

  const togglePermissionActive = async (permission: any) => {
    if (!isAdminOrPurchaseAdmin) {
      toast.error('Only admins can toggle permission status');
      return;
    }
    const newActive = !permission.is_active;
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/permissions/${permission._id}`,
        { is_active: newActive },
        authHeaders
      );
      setAvailablePermissions((prev) =>
        prev.map((p) =>
          p._id === permission._id ? { ...p, is_active: newActive } : p
        )
      );
      toast.success(
        `Permission ${newActive ? 'activated' : 'deactivated'}`
      );
    } catch (error: any) {
      console.error('Failed to toggle permission:', error);
      toast.error('Failed to update permission');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'purchase_admin':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'purchase':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'design':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'inactive':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatRole = (role: string) => {
    return role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <div className='flex flex-col items-center gap-3'>
          <Loader2 className='h-8 w-8 animate-spin text-indigo-600' />
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            Loading users...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-4 sm:p-6'>
      <div className='max-w-7xl mx-auto space-y-6'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <div className='p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
                <Users className='h-5 w-5 text-indigo-600 dark:text-indigo-400' />
              </div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                User Management
              </h1>
            </div>
            <p className='text-sm text-gray-500 dark:text-gray-400 ml-12'>
              Manage users, roles, and permissions
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={() => setShowCreateUser(true)}
              className='inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm'
            >
              <UserPlus className='h-4 w-4' />
              New User
            </button>
            <button
              onClick={() => setShowCreatePermission(true)}
              className='inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm'
            >
              <Plus className='h-4 w-4' />
              New Permission
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
          <input
            type='text'
            placeholder='Search users by name, email, or role...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm'
          />
        </div>

        {/* Create User Modal */}
        {showCreateUser && (
          <div className='fixed inset-0 z-50 flex items-center justify-center'>
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={() => setShowCreateUser(false)}
            />
            <div className='relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6'>
              <div className='flex items-center justify-between mb-5'>
                <div className='flex items-center gap-2'>
                  <div className='p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
                    <UserPlus className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                  </div>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Create New User
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateUser(false)}
                  className='p-1 text-gray-400 hover:text-gray-600 rounded'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    Full Name
                  </label>
                  <input
                    type='text'
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder='John Doe'
                    className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    Email
                  </label>
                  <input
                    type='email'
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder='john@example.com'
                    className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    Password
                  </label>
                  <div className='relative'>
                    <input
                      type={showNewUserPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder='Min 6 characters'
                      className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        setShowNewUserPassword(!showNewUserPassword)
                      }
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                    >
                      {showNewUserPassword ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </button>
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                      Role
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                      className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none'
                    >
                      <option value='admin'>Admin</option>
                      <option value='purchase_admin'>Purchase Admin</option>
                      <option value='purchase'>Purchase</option>
                      <option value='design'>Design</option>
                      <option value='user'>User</option>
                    </select>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                      Status
                    </label>
                    <select
                      value={newUser.status}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none'
                    >
                      <option value='active'>Active</option>
                      <option value='inactive'>Inactive</option>
                      <option value='pending'>Pending</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className='flex justify-end gap-2 mt-6'>
                <button
                  onClick={() => setShowCreateUser(false)}
                  className='px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={
                    creatingUser ||
                    !newUser.name.trim() ||
                    !newUser.email.trim() ||
                    !newUser.password.trim()
                  }
                  className='inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50'
                >
                  {creatingUser ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <UserPlus className='h-4 w-4' />
                  )}
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Permission Modal */}
        {showCreatePermission && (
          <div className='fixed inset-0 z-50 flex items-center justify-center'>
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={() => setShowCreatePermission(false)}
            />
            <div className='relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6'>
              <div className='flex items-center justify-between mb-5'>
                <div className='flex items-center gap-2'>
                  <div className='p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
                    <Shield className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                  </div>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Create Permission
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreatePermission(false)}
                  className='p-1 text-gray-400 hover:text-gray-600 rounded'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    Name
                  </label>
                  <input
                    type='text'
                    value={newPermission.name}
                    onChange={(e) =>
                      setNewPermission((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder='e.g. reports, items, dashboard'
                    className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    Description
                  </label>
                  <input
                    type='text'
                    value={newPermission.description}
                    onChange={(e) =>
                      setNewPermission((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder='Optional description'
                    className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div className='flex items-center justify-between py-1'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    Active
                  </label>
                  <button
                    type='button'
                    onClick={() =>
                      setNewPermission((prev) => ({
                        ...prev,
                        is_active: !prev.is_active,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      newPermission.is_active
                        ? 'bg-indigo-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        newPermission.is_active
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className='flex justify-end gap-2 mt-6'>
                <button
                  onClick={() => setShowCreatePermission(false)}
                  className='px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePermission}
                  disabled={creatingPermission || !newPermission.name.trim()}
                  className='inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50'
                >
                  {creatingPermission ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Plus className='h-4 w-4' />
                  )}
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredUsers.length === 0 && !loading ? (
          <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12'>
            <div className='flex flex-col items-center justify-center text-center'>
              <div className='p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-4'>
                <UserX className='h-8 w-8 text-gray-400' />
              </div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                {searchQuery ? 'No users found' : 'No users yet'}
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Create a new user to get started.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Users - Card layout for better spacing */}
            <div className='space-y-3'>
              {filteredUsers.map((user: any) => (
                <div
                  key={user._id}
                  className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'
                >
                  {/* User Row */}
                  <div className='p-4 sm:p-5'>
                    {editingUser === user._id ? (
                      /* Edit Mode */
                      <div className='space-y-4'>
                        <div className='flex items-center justify-between'>
                          <h3 className='text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                            Editing User
                          </h3>
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={handleSaveUser}
                              disabled={savingUser === user._id}
                              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50'
                            >
                              {savingUser === user._id ? (
                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                              ) : (
                                <Save className='h-3.5 w-3.5' />
                              )}
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
                            >
                              <X className='h-3.5 w-3.5' />
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                          <div>
                            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                              Name
                            </label>
                            <input
                              type='text'
                              value={editForm.name}
                              onChange={(e) =>
                                handleInputChange('name', e.target.value)
                              }
                              className='w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                            />
                          </div>
                          <div>
                            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                              Email
                            </label>
                            <input
                              type='email'
                              value={editForm.email}
                              onChange={(e) =>
                                handleInputChange('email', e.target.value)
                              }
                              className='w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                            />
                          </div>
                          <div>
                            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                              Role
                            </label>
                            <select
                              value={editForm.role}
                              onChange={(e) =>
                                handleInputChange('role', e.target.value)
                              }
                              className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none'
                            >
                              <option value='admin'>Admin</option>
                              <option value='purchase_admin'>
                                Purchase Admin
                              </option>
                              <option value='purchase'>Purchase</option>
                              <option value='design'>Design</option>
                              <option value='user'>User</option>
                            </select>
                          </div>
                          <div>
                            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                              Status
                            </label>
                            <select
                              value={editForm.status}
                              onChange={(e) =>
                                handleInputChange('status', e.target.value)
                              }
                              className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none'
                            >
                              <option value='active'>Active</option>
                              <option value='inactive'>Inactive</option>
                              <option value='pending'>Pending</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-4 min-w-0'>
                          <div className='h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0'>
                            {user.name
                              ?.split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div className='min-w-0'>
                            <div className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
                              {user.name}
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                              {user.email}
                            </div>
                          </div>
                          <div className='hidden sm:flex items-center gap-2 ml-2'>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                            >
                              {formatRole(user.role)}
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(user.status)}`}
                            >
                              {user.status}
                            </span>
                          </div>
                        </div>
                        <div className='flex items-center gap-2 shrink-0'>
                          {/* Permission count badge */}
                          <button
                            onClick={() =>
                              togglePermissionExpansion(user._id)
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              expandedPermissions[user._id]
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                            }`}
                          >
                            <Shield className='h-3 w-3' />
                            {user.permissions?.length || 0}
                            {expandedPermissions[user._id] ? (
                              <ChevronUp className='h-3 w-3' />
                            ) : (
                              <ChevronDown className='h-3 w-3' />
                            )}
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className='p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors'
                            title='Edit user'
                          >
                            <Edit3 className='h-4 w-4' />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mobile badges - shown below name on small screens */}
                    {editingUser !== user._id && (
                      <div className='flex items-center gap-2 mt-2 sm:hidden'>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                        >
                          {formatRole(user.role)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(user.status)}`}
                        >
                          {user.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Permissions */}
                  {expandedPermissions[user._id] && (
                    <div className='px-4 sm:px-5 pb-4 sm:pb-5 pt-0'>
                      <div className='border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4'>
                        {savingPermissions === user._id && (
                          <div className='flex items-center gap-2 text-xs text-indigo-600'>
                            <Loader2 className='h-3 w-3 animate-spin' />
                            Saving permissions...
                          </div>
                        )}

                        {/* Current Permissions */}
                        <div>
                          <h4 className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5'>
                            <Shield className='h-3.5 w-3.5' />
                            Assigned Permissions (
                            {user.permissions?.length || 0})
                          </h4>
                          <div className='flex flex-wrap gap-2'>
                            {user.permissions?.map(
                              (permissionId: string) => {
                                const permission =
                                  getPermissionDetails(permissionId);
                                if (!permission) return null;
                                return (
                                  <span
                                    key={permissionId}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                      permission.is_active !== false
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                        : 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                                    }`}
                                  >
                                    <Check className='h-3 w-3' />
                                    {permission.name}
                                    {permission.is_active === false && (
                                      <span className='text-[10px] opacity-60'>
                                        (inactive)
                                      </span>
                                    )}
                                    <button
                                      onClick={() =>
                                        removePermission(
                                          user._id,
                                          permissionId
                                        )
                                      }
                                      className='ml-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full p-0.5 transition-colors'
                                    >
                                      <X className='h-2.5 w-2.5' />
                                    </button>
                                  </span>
                                );
                              }
                            )}
                            {(!user.permissions ||
                              user.permissions.length === 0) && (
                              <span className='text-xs text-gray-400 italic'>
                                No permissions assigned
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Available Permissions to Add */}
                        {getAvailablePermissionsForUser(user).length >
                          0 && (
                          <div>
                            <h4 className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5'>
                              Available Permissions
                            </h4>
                            <div className='flex flex-wrap gap-2'>
                              {getAvailablePermissionsForUser(
                                user
                              ).map((permission: any) => (
                                <button
                                  key={permission._id}
                                  onClick={() =>
                                    addPermission(
                                      user._id,
                                      permission._id
                                    )
                                  }
                                  className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/10 transition-colors'
                                >
                                  <Plus className='h-3 w-3' />
                                  {permission.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Stats */}
            <div className='flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 px-1'>
              <span>
                {filteredUsers.length}
                {searchQuery ? ` of ${users.length}` : ''} user
                {filteredUsers.length !== 1 ? 's' : ''}
              </span>
              <span>
                {activePermissions.length} active permission
                {activePermissions.length !== 1 ? 's' : ''} /{' '}
                {availablePermissions.length} total
              </span>
            </div>
          </>
        )}

        {/* All Permissions Overview */}
        {availablePermissions.length > 0 && (
          <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
            <div className='px-5 py-4 border-b border-gray-200 dark:border-gray-700'>
              <h2 className='text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
                <Shield className='h-4 w-4 text-indigo-500' />
                All Permissions
              </h2>
            </div>
            <div className='p-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5'>
                {availablePermissions.map((permission: any) => (
                  <div
                    key={permission._id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      permission.is_active !== false
                        ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                        : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 opacity-60'
                    }`}
                  >
                    <div className='min-w-0'>
                      <div
                        className={`text-sm font-medium truncate ${
                          permission.is_active !== false
                            ? 'text-gray-900 dark:text-white'
                            : 'text-red-500 dark:text-red-400 line-through'
                        }`}
                      >
                        {permission.name}
                      </div>
                      {permission.description && (
                        <div className='text-xs text-gray-400 truncate mt-0.5'>
                          {permission.description}
                        </div>
                      )}
                    </div>
                    {isAdminOrPurchaseAdmin ? (
                      <button
                        onClick={() => togglePermissionActive(permission)}
                        className={`shrink-0 ml-3 p-1.5 rounded-lg transition-colors ${
                          permission.is_active !== false
                            ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        title={
                          permission.is_active !== false
                            ? 'Deactivate'
                            : 'Activate'
                        }
                      >
                        {permission.is_active !== false ? (
                          <ToggleRight className='h-5 w-5' />
                        ) : (
                          <ToggleLeft className='h-5 w-5' />
                        )}
                      </button>
                    ) : (
                      <span
                        className={`shrink-0 ml-3 p-1.5 ${
                          permission.is_active !== false
                            ? 'text-emerald-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        {permission.is_active !== false ? (
                          <ToggleRight className='h-5 w-5' />
                        ) : (
                          <ToggleLeft className='h-5 w-5' />
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
