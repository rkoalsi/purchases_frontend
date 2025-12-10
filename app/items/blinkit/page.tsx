'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import BlinkitItemsTable from '@/components/inventory/BlinkitItemsTable';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

function Page() {
  const { isLoading, accessToken } = useAuth();
  const [skuData, setSkuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    item_id: '',
    sku_code: '',
    item_name: '',
  });
  const [formErrors, setFormErrors]: any = useState({});

  const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/blinkit`;

  // Fetch SKU mapping data on component mount
  useEffect(() => {
    fetchSkuData();
  }, []);

  const fetchSkuData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/get_blinkit_sku_mapping`
      );
      setSkuData(response.data);
      setMessage('');
    } catch (error) {
      console.error('Error fetching SKU data:', error);
      setMessage('Failed to fetch SKU mapping data');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: any) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setMessage('Please select an Excel file (.xlsx or .xls)');
        setMessageType('error');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first');
      setMessageType('error');
      return;
    }

    try {
      setUploading(true);
      setMessage('');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(
        `${API_BASE_URL}/upload-sku-mapping`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setMessage(response.data.message || 'File uploaded successfully!');
      setMessageType('success');
      setSelectedFile(null);

      // Reset file input
      const fileInput: any = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';

      // Refresh the data
      await fetchSkuData();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const errorMessage =
        error.response?.data?.detail || 'Failed to upload file';
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  // Modal functions
  const openModal = () => {
    setIsModalOpen(true);
    setFormData({ item_id: '', sku_code: '', item_name: '' });
    setFormErrors({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ item_id: '', sku_code: '', item_name: '' });
    setFormErrors({});
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev: any) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const errors: any = {};

    if (!formData.item_id.trim()) {
      errors.item_id = 'Item ID is required';
    }

    if (!formData.sku_code.trim()) {
      errors.sku_code = 'SKU Code is required';
    }

    if (!formData.item_name.trim()) {
      errors.item_name = 'Item Name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateItem = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setCreating(true);

      const response = await axios.post(
        `${API_BASE_URL}/create_single_item`,
        formData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      setMessage(response.data.message || 'Item created successfully!');
      setMessageType('success');
      closeModal();

      // Refresh the data
      await fetchSkuData();
    } catch (error: any) {
      console.error('Error creating item:', error);
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create item';
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!accessToken) {
    return <p>Please log in to see this content.</p>;
  }

  return (
    <>
      <div className='bg-gray-50 rounded-lg p-6 mb-8'>
        <div className='mb-8 flex justify-between items-start'>
          <div>
            <h1 className='text-3xl font-bold text-black mb-2'>
              Blinkit SKU Mapping Management
            </h1>
            <p className='text-black'>
              Upload and manage Blinkit Item and Sku Codes
            </p>
          </div>
          <button
            onClick={openModal}
            className='bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors'
          >
            Create New Item
          </button>
        </div>

        {/* Display messages */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-md ${
              messageType === 'success'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-red-100 text-red-700 border border-red-300'
            }`}
          >
            {message}
          </div>
        )}

        <h2 className='text-xl font-semibold text-gray-800 mb-4'>
          Upload SKU Mapping
        </h2>
        <div className='flex flex-col sm:flex-row gap-4 items-start'>
          <div className='flex-1'>
            <input
              id='file-input'
              type='file'
              accept='.xlsx,.xls'
              onChange={handleFileSelect}
              className='w-full text-black px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
            <p className='text-sm text-gray-700 mt-1'>
              Expected columns: Item ID, SKU Code, Item Name
            </p>
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              !selectedFile || uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      <BlinkitItemsTable />

      {/* Modal */}
      {isModalOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-md mx-4'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>
                Create New Item
              </h3>
              <button
                onClick={closeModal}
                className='text-gray-400 hover:text-gray-600'
              >
                <svg
                  className='w-6 h-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateItem();
              }}
            >
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-black mb-1'>
                    Item ID
                  </label>
                  <input
                    type='text'
                    name='item_id'
                    value={formData.item_id}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-black border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.item_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder='Enter Item ID'
                  />
                  {formErrors.item_id && (
                    <p className='text-red-500 text-sm mt-1'>
                      {formErrors.item_id}
                    </p>
                  )}
                </div>

                <div>
                  <label className='block text-sm font-medium text-black mb-1'>
                    SKU Code
                  </label>
                  <input
                    type='text'
                    name='sku_code'
                    value={formData.sku_code}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-black border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.sku_code ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder='Enter SKU Code'
                  />
                  {formErrors.sku_code && (
                    <p className='text-red-500 text-sm mt-1'>
                      {formErrors.sku_code}
                    </p>
                  )}
                </div>

                <div>
                  <label className='block text-sm font-medium text-black mb-1'>
                    Item Name
                  </label>
                  <input
                    type='text'
                    name='item_name'
                    value={formData.item_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.item_name
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder='Enter Item Name'
                  />
                  {formErrors.item_name && (
                    <p className='text-red-500 text-sm mt-1'>
                      {formErrors.item_name}
                    </p>
                  )}
                </div>
              </div>

              <div className='flex gap-3 mt-6'>
                <button
                  type='button'
                  onClick={closeModal}
                  className='flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={creating}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    creating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {creating ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Page;
