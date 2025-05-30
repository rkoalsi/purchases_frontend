'use client'; // This component needs to be client-side

import { useAuth } from '@/components/context/AuthContext';
import BlinkitItemsTable from '@/components/inventory/BlinkitItemsTable';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

function Page() {
  const { email, isLoading, accessToken, user } = useAuth();
  const [skuData, setSkuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const API_BASE_URL = `${process.env.api_url}/blinkit`;

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

  const refreshData = () => {
    fetchSkuData();
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
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-black mb-2'>
            Blinkit SKU Mapping Management
          </h1>
          <p className='text-black'>Upload and manage Blinkit ASIN and Sku's</p>
        </div>
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
    </>
  );
}

export default Page;
