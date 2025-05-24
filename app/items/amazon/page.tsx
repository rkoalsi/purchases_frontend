'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SkuMappingComponent = () => {
  const [skuData, setSkuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const API_BASE_URL = `${process.env.api_url}/amazon`;

  // Fetch SKU mapping data on component mount
  useEffect(() => {
    fetchSkuData();
  }, []);

  const fetchSkuData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/get_amazon_sku_mapping`
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

  return (
    <div className='max-w-6xl mx-auto p-6 bg-white'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>
          SKU Mapping Management
        </h1>
        <p className='text-gray-600'>
          Upload and manage Amazon SKU mapping data
        </p>
      </div>

      {/* Upload Section */}
      <div className='bg-gray-50 rounded-lg p-6 mb-8'>
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
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
            <p className='text-sm text-gray-500 mt-1'>
              Expected columns: ASIN, SKU, Item Name
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

      {/* Message Display */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-md ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      {/* Data Table Section */}
      <div className='bg-white border border-gray-200 rounded-lg shadow-sm'>
        <div className='px-6 py-4 border-b border-gray-200 flex justify-between items-center'>
          <h2 className='text-xl font-semibold text-gray-800'>
            SKU Mapping Data
          </h2>
          <button
            onClick={refreshData}
            disabled={loading}
            className='px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50'
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className='p-8 text-center'>
            <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            <p className='mt-4 text-gray-600'>Loading SKU mapping data...</p>
          </div>
        ) : skuData.length === 0 ? (
          <div className='p-8 text-center text-gray-500'>
            <p>No SKU mapping data found.</p>
            <p className='text-sm'>Upload an Excel file to get started.</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    ASIN/Item ID
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    SKU Code
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Item Name
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {skuData.map((item: any, index) => (
                  <tr key={index} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {item.item_id}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {item.sku_code}
                    </td>
                    <td className='px-6 py-4 text-sm text-gray-900'>
                      {item.item_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {skuData.length > 0 && (
          <div className='px-6 py-3 border-t border-gray-200 bg-gray-50'>
            <p className='text-sm text-gray-600'>
              Total records: {skuData.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkuMappingComponent;
