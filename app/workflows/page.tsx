'use client';
import React, { useEffect, useState } from 'react';
import {
  Users,
  Edit3,
  Save,
  X,
  Shield,
  Plus,
  MoreHorizontal,
  Workflow,
} from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import capitalize from '@/util/capitalize';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm]: any = useState({});

  const getWorkflows = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/workflows`);
      const { data = {} } = response;
      const { workflows: workflowResponse = [] } = data;
      setWorkflows(workflowResponse);
    } catch (error: any) {
      console.log(error);
      toast.error(error.message);
    }
  };
  useEffect(() => {
    getWorkflows();
  }, []);
  const handleEditUser = (user: any) => {
    setEditingUser(user._id);
    setEditForm({ ...user });
  };

  const handleSaveUser = () => {
    setWorkflows(
      workflows.map((workflow: any) =>
        workflow._id === editingUser ? editForm : workflow
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

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='flex items-center gap-3 mb-2'>
                <Workflow className='h-8 w-8 text-blue-600' />
                <h1 className='text-3xl font-bold text-gray-900'>
                  Workflows Management
                </h1>
              </div>
              <p className='text-gray-600'>Manage workflows</p>
            </div>
            <button className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium'>
              <Plus className='h-5 w-5' />
              Add New Workflow
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
                    Name
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Status
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {workflows.map((workflow: any) => (
                  <React.Fragment key={workflow._id}>
                    <tr className='hover:bg-gray-50'>
                      {/* User Info */}
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='flex items-center'>
                          <div>
                            {editingUser === workflow._id ? (
                              <div className='space-y-1 flex flex-col'>
                                <input
                                  type='text'
                                  value={editForm.name}
                                  onChange={(e) =>
                                    handleInputChange('name', e.target.value)
                                  }
                                  className='text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 w-full'
                                />
                              </div>
                            ) : (
                              <div>
                                <div className='text-sm font-medium text-gray-900'>
                                  {workflow.name}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className='px-6 py-4 whitespace-nowrap'>
                        {editingUser === workflow._id ? (
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
                              workflow.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : workflow.status === 'inactive'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {capitalize(workflow.status)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                        {editingUser === workflow._id ? (
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
                            onClick={() => handleEditUser(workflow)}
                            className='text-blue-600 hover:text-blue-900 p-1'
                            title='Edit user'
                          >
                            <Edit3 className='h-4 w-4' />
                          </button>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table Footer */}
        <div className='mt-4 flex items-center justify-between text-sm text-gray-500'>
          <div>Showing {workflows.length} workflows</div>
        </div>
      </div>
    </div>
  );
}
