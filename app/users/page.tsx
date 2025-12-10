'use client';
import React, { useEffect, useState } from 'react';
import {
  Users,
  Edit3,
  Save,
  X,
  Mail,
  Shield,
  Plus,
  Trash2,
  UserCheck,
  Settings,
  Eye,
  FileEdit,
  Database,
  Globe,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm]: any = useState({});
  const [expandedPermissions, setExpandedPermissions]: any = useState({});
  const [availablePermissions, setAvailablePermissions]: any = useState([]);
  const getPermissions = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/permissions`
      );
      const { data = [] } = response;
      setAvailablePermissions(data);
    } catch (error: any) {
      console.log(error);
      toast.error(error.message);
    }
  };

  const getUsers = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`);
      const { data = [] } = response;
      setUsers(data);
    } catch (error: any) {
      console.log(error);
      toast.error(error.message);
    }
  };
  useEffect(() => {
    getUsers();
    getPermissions();
  }, []);
  const handleEditUser = (user: any) => {
    setEditingUser(user._id);
    setEditForm({ ...user });
  };

  const handleSaveUser = () => {
    setUsers(
      users.map((user: any) =>
        user._id === editingUser ? editForm : user
      ) as any
    );
    setEditingUser(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const togglePermissionExpansion = (userId: string) => {
    setExpandedPermissions((prev: any) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const addPermission = (userId: string, permissionId: string) => {
    setUsers(
      users.map((user: any) => {
        if (user._id === userId) {
          return {
            ...user,
            permissions: [...user.permissions, permissionId],
          };
        }
        return user;
      }) as any
    );
  };

  const removePermission = (userId: string, permissionId: string) => {
    setUsers(
      users.map((user: any) => {
        if (user._id === userId) {
          return {
            ...user,
            permissions: user.permissions.filter(
              (p: any) => p !== permissionId
            ),
          };
        }
        return user;
      }) as any
    );
  };

  const getPermissionDetails = (permissionId: string) => {
    return availablePermissions.find((p: any) => p._id === permissionId);
  };

  const getAvailablePermissionsForUser = (user: any) => {
    return availablePermissions.filter(
      (p: any) => !user.permissions.includes(p._id)
    );
  };

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='flex items-center gap-3 mb-2'>
                <Users className='h-8 w-8 text-blue-600' />
                <h1 className='text-3xl font-bold text-gray-900'>
                  User Management
                </h1>
              </div>
              <p className='text-gray-600'>
                Manage users, roles, and permissions for your organization
              </p>
            </div>
            <button className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium'>
              <Plus className='h-5 w-5' />
              Add New User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    User
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Role
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Status
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Permissions
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {users.map((user: any) => (
                  <React.Fragment key={user._id}>
                    <tr className='hover:bg-gray-50'>
                      {/* User Info */}
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='flex items-center'>
                          <div className='h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-4'>
                            {user.name
                              .split(' ')
                              .map((n: any) => n[0])
                              .join('')}
                          </div>
                          <div>
                            {editingUser === user._id ? (
                              <div className='space-y-1 flex flex-col'>
                                <input
                                  type='text'
                                  value={editForm.name}
                                  onChange={(e) =>
                                    handleInputChange('name', e.target.value)
                                  }
                                  className='text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 w-full'
                                />
                                <input
                                  type='email'
                                  value={editForm.email}
                                  onChange={(e) =>
                                    handleInputChange('email', e.target.value)
                                  }
                                  className='text-sm text-gray-500 bg-white border border-gray-300 rounded px-2 py-1 w-full'
                                />
                              </div>
                            ) : (
                              <div>
                                <div className='text-sm font-medium text-gray-900'>
                                  {user.name}
                                </div>
                                <div className='text-sm text-gray-500'>
                                  {user.email}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className='px-6 py-4 whitespace-nowrap'>
                        {editingUser === user._id ? (
                          <select
                            value={editForm.role}
                            onChange={(e) =>
                              handleInputChange('role', e.target.value)
                            }
                            className='border border-gray-300 rounded-md px-2 py-1 text-sm text-black'
                          >
                            <option value='admin'>Admin</option>
                            <option value='purchase_admin'>
                              Purchase admin
                            </option>
                            <option value='purchase'>Purchase</option>
                            <option value='design'>Design</option>
                            <option value='User'>User</option>
                          </select>
                        ) : (
                          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                            {`${user.role
                              .replace('_', ' ')
                              .charAt(0)
                              .toUpperCase()}${user.role
                              .replace('_', ' ')
                              .slice(1)}`}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className='px-6 py-4 whitespace-nowrap'>
                        {editingUser === user._id ? (
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              handleInputChange('status', e.target.value)
                            }
                            className='border border-gray-300 rounded-md px-2 py-1 text-sm text-black'
                          >
                            <option value='active'>Active</option>
                            <option value='inactive'>Inactive</option>
                            <option value='pending'>Pending</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : user.status === 'inactive'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {user.status}
                          </span>
                        )}
                      </td>

                      {/* Permissions */}
                      <td className='px-6 py-4'>
                        <div className='flex items-center gap-2'>
                          <div className='flex flex-wrap gap-1 max-w-xs'>
                            {user.permissions.map((permissionId: any) => {
                              const permission =
                                getPermissionDetails(permissionId);
                              if (!permission) return null;
                              return (
                                <span
                                  key={permissionId}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-black`}
                                >
                                  {/* <IconComponent className='h-3 w-3' /> */}
                                  {permission.name}
                                </span>
                              );
                            })}
                            {user.permissions.length > 2 && (
                              <span className='text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded'>
                                +{user.permissions.length - 2} more
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => togglePermissionExpansion(user._id)}
                            className='text-blue-600 hover:text-blue-800 p-1'
                            title='Manage permissions'
                          >
                            <MoreHorizontal className='h-4 w-4' />
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                        {editingUser === user._id ? (
                          <div className='flex items-center justify-end gap-2'>
                            <button
                              onClick={handleSaveUser}
                              className='text-green-600 hover:text-green-900 p-1'
                              title='Save changes'
                            >
                              <Save className='h-4 w-4' />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className='text-gray-400 hover:text-gray-600 p-1'
                              title='Cancel'
                            >
                              <X className='h-4 w-4' />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditUser(user)}
                            className='text-blue-600 hover:text-blue-900 p-1'
                            title='Edit user'
                          >
                            <Edit3 className='h-4 w-4' />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Permissions Row */}
                    {expandedPermissions[user._id] && (
                      <tr>
                        <td colSpan={6} className='px-6 py-4 bg-gray-50'>
                          <div className='space-y-4'>
                            {/* All Current Permissions */}
                            <div>
                              <h4 className='text-sm font-medium text-gray-900 mb-2 flex items-center gap-2'>
                                <Shield className='h-4 w-4' />
                                Current Permissions ({user.permissions.length})
                              </h4>
                              <div className='flex flex-wrap gap-2'>
                                {user.permissions.map((permissionId: any) => {
                                  const permission =
                                    getPermissionDetails(permissionId);
                                  return (
                                    <span
                                      key={permissionId}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-black`}
                                    >
                                      {/* <IconComponent className='h-3.5 w-3.5' /> */}
                                      {permission.name}
                                      <button
                                        onClick={() =>
                                          removePermission(
                                            user._id,
                                            permissionId
                                          )
                                        }
                                        className='ml-1 hover:bg-red-200 rounded-full p-0.5 transition-colors'
                                      >
                                        <X className='h-3 w-3' />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Available Permissions */}
                            {getAvailablePermissionsForUser(user).length >
                              0 && (
                              <div>
                                <h4 className='text-sm font-medium text-gray-900 mb-2'>
                                  Add Permissions
                                </h4>
                                <div className='flex flex-wrap gap-2'>
                                  {getAvailablePermissionsForUser(user).map(
                                    (permission: any) => {
                                      const IconComponent = permission.icon;

                                      return (
                                        <button
                                          key={permission._id}
                                          onClick={() =>
                                            addPermission(
                                              user._id,
                                              permission._id
                                            )
                                          }
                                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors'
                                        >
                                          <Plus className='h-3.5 w-3.5' />
                                          {/* <IconComponent className='h-3.5 w-3.5' /> */}
                                          {permission.name}
                                        </button>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table Footer */}
        <div className='mt-4 flex items-center justify-between text-sm text-gray-500'>
          <div>Showing {users.length} users</div>
          <div>Total permissions: {availablePermissions.length}</div>
        </div>
      </div>
    </div>
  );
}
