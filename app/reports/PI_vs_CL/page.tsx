'use client';
import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';

const FileUploader = ({
  handleSubmitClick = () => {},
  handleReset = () => {},
  setSelectedFile = '',
  selectedFile = '',
}: any) => {
  const fileInputRef: any = useRef(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [response, setResponse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // API helper functions
  const apiCall = async (url: any, options: any = {}) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return response;
    } catch (error) {
      console.error(`API call failed for ${url}:`, error);
      throw error;
    }
  };

  // Function to trigger the file input click
  const handleButtonClick = () => {
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDownloadButtonClick = async () => {
    try {
      setIsLoading(true);
      setError(''); // Clear any previous errors

      const response = await apiCall(
        `${process.env.api_url}/util/download_template`,
        {
          method: 'GET',
          headers: {
            Accept:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        }
      );

      // Check if the response is successful
      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        throw new Error('Empty file received from server');
      }

      const blob = await response.blob();

      // Verify blob has content
      if (blob.size === 0) {
        throw new Error('Empty file received');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from response headers if available, otherwise use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Template.xlsx'; // Default filename

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      link.style.display = 'none'; // Hide the link element

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Optional: Show success message
      console.log('Template downloaded successfully');
    } catch (error: any) {
      console.error('Download error:', error);

      // Set user-friendly error messages
      if (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError')
      ) {
        setError('Network error. Please check your connection and try again.');
      } else if (error.message.includes('Server error: 5')) {
        setError('Server error. Please try again later.');
      } else if (error.message.includes('Empty file')) {
        setError('Invalid file received. Please contact support.');
      } else {
        setError(error.message || 'Download failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  // File change handler
  const handleFileChange = (event: any) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      if (!uploadedFile.name.endsWith('.xlsx')) {
        setError('Please upload a valid Excel file (.xlsx)');
        return;
      }
      setError('');
      setSelectedFile(uploadedFile);
    } else {
      setError('Please upload a valid file');
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please upload a file before submitting');
      return;
    }

    setError('');
    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    handleSubmitClick();

    try {
      const response = await fetch(
        `${process.env.api_url}/util/upload_template`,
        {
          method: 'POST',
          body: formData,
        }
      );

      // Check if the response is successful
      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        throw new Error('Empty file received from server');
      }

      const blob = await response.blob();

      // Verify blob has content
      if (blob.size === 0) {
        throw new Error('Empty file received');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from response headers if available, otherwise use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Result.xlsx'; // Default filename

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      link.style.display = 'none'; // Hide the link element

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Optional: Show success message
      console.log('Result downloaded successfully');
    } catch (error: any) {
      console.error('Download error:', error);

      // Set user-friendly error messages
      if (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError')
      ) {
        setError('Network error. Please check your connection and try again.');
      } else if (error.message.includes('Server error: 5')) {
        setError('Server error. Please try again later.');
      } else if (error.message.includes('Empty file')) {
        setError('Invalid file received. Please contact support.');
      } else {
        setError(error.message || 'Download failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='w-full max-w-2xl mx-auto p-6 space-y-8'>
      {/* Error Message */}
      {error && (
        <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
          <div className='flex items-center'>
            <svg
              className='w-5 h-5 text-red-400 mr-3'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                clipRule='evenodd'
              />
            </svg>
            <p className='text-red-800 font-medium'>{error}</p>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      <div className='space-y-4'>
        <h2 className='text-2xl font-bold text-white-800'>Upload Excel File</h2>

        {/* Action Buttons */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <button
            onClick={handleButtonClick}
            disabled={isLoading}
            className='flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <svg
              className='w-5 h-5 mr-2'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
              />
            </svg>
            {isLoading ? 'Processing...' : 'Upload File'}
          </button>

          <button
            onClick={handleDownloadButtonClick}
            disabled={isLoading}
            className='flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg shadow-lg hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <svg
              className='w-5 h-5 mr-2'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
            Download Template
          </button>
        </div>

        {/* File Display */}
        {selectedFile && (
          <div className='p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg'>
            <div className='flex items-center space-x-4'>
              <div className='flex-shrink-0'>
                <svg
                  className='w-12 h-12 text-green-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  />
                </svg>
              </div>
              <div className='flex-1'>
                <h3 className='text-lg font-semibold text-gray-800'>
                  {selectedFile.name}
                </h3>
                <p className='text-sm text-gray-600'>
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {message && (
                  <p className='text-sm text-green-600 font-medium mt-1'>
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <input
          type='file'
          accept='.xlsx'
          onChange={handleFileChange}
          ref={fileInputRef}
          className='hidden'
        />
      </div>

      {/* Submit/Reset Buttons */}
      <div className='flex flex-col sm:flex-row gap-4 pt-6'>
        <button
          onClick={handleSubmit}
          disabled={response || isLoading || !selectedFile}
          className='flex-1 flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
        >
          {isLoading ? (
            <>
              <svg
                className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg
                className='w-5 h-5 mr-2'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                />
              </svg>
              Submit
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          disabled={isLoading}
          className='flex-1 flex items-center justify-center px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <svg
            className='w-5 h-5 mr-2'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            />
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
};

// Main Page Component
const Page = () => {
  const [data, setData] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile]: any = useState(null);

  const handleReset = () => {
    setLoading(true);
    setData(null);
    setSelectedFile(null);
    toast.success('Form reset.');
  };

  const handleSubmit = () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    toast.info('Submission in progress...');

    setTimeout(() => {
      setIsSubmitting(false);
      toast.success('Submission completed.');
    }, 3000);
  };

  //   if (isLoading) {
  //     return (
  //       <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center'>
  //         <div className='text-center'>
  //           <svg
  //             className='animate-spin h-12 w-12 text-blue-600 mx-auto mb-4'
  //             xmlns='http://www.w3.org/2000/svg'
  //             fill='none'
  //             viewBox='0 0 24 24'
  //           >
  //             <circle
  //               className='opacity-25'
  //               cx='12'
  //               cy='12'
  //               r='10'
  //               stroke='currentColor'
  //               strokeWidth='4'
  //             ></circle>
  //             <path
  //               className='opacity-75'
  //               fill='currentColor'
  //               d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
  //             ></path>
  //           </svg>
  //           <p className='text-lg text-gray-600'>Loading...</p>
  //         </div>
  //       </div>
  //     );
  //   }

  return (
    <div>
      {/* Content */}
      <div className='p-8'>
        <FileUploader
          handleSubmitClick={handleSubmit}
          handleReset={handleReset}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
        />
      </div>
    </div>
  );
};

export default Page;
