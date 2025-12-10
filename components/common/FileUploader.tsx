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
  const [dragOver, setDragOver] = useState(false);

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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx')) {
        setError('');
        setSelectedFile(file);
      } else {
        setError('Please upload a valid Excel file (.xlsx)');
      }
    }
  };

  const handleDownloadButtonClick = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await apiCall(
        `${process.env.NEXT_PUBLIC_API_URL}/util/download_template`,
        {
          method: 'GET',
          headers: {
            Accept:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        throw new Error('Empty file received from server');
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('Empty file received');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Template.xlsx';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('Template downloaded successfully');
    } catch (error: any) {
      console.error('Download error:', error);

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
        `${process.env.NEXT_PUBLIC_API_URL}/util/upload_template`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        throw new Error('Empty file received from server');
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('Empty file received');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Result.xlsx';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('File generated successfully', { autoClose: 2000 });
    } catch (error: any) {
      console.error('Download error:', error);

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
    <div>
      <div className='max-w-4xl mx-auto'>
        {/* Header Section */}
        <div className='text-center mb-8'>
          <h1 className='text-3xl sm:text-4xl font-bold text-white mb-2'>
            PI Vs CL Checker
          </h1>
          <div className='max-w-3xl mx-auto space-y-3'>
            <p className='text-lg text-white-700 leading-relaxed'>
              Download the template, paste manufacturer data, and upload to
              check against Zoho
            </p>
            <div className='flex items-center justify-center space-x-4 text-sm text-white-600'>
              <div className='flex items-center space-x-2'>
                <div className='w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center'>
                  <span className='text-xs font-semibold text-blue-600'>1</span>
                </div>
                <span>Download template</span>
              </div>
              <svg
                className='w-4 h-4 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <div className='flex items-center space-x-2'>
                <div className='w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center'>
                  <span className='text-xs font-semibold text-blue-600'>2</span>
                </div>
                <span>Add your data</span>
              </div>
              <svg
                className='w-4 h-4 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <div className='flex items-center space-x-2'>
                <div className='w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center'>
                  <span className='text-xs font-semibold text-blue-600'>3</span>
                </div>
                <span>Upload & process</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div>
          {/* Error Message */}
          {error && (
            <div className='m-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <svg
                    className='w-5 h-5 text-red-400'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='ml-3'>
                  <p className='text-sm font-medium text-red-800'>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className='p-6 sm:p-8'>
            {/* Quick Actions */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
              {/* Download Template Card */}
              <div className='group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white transition-all duration-300 hover:shadow-2xl hover:scale-105'>
                <div className='absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300'></div>
                <div className='relative z-10'>
                  <div className='flex items-center justify-between mb-4'>
                    <div className='w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center'>
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
                          d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                        />
                      </svg>
                    </div>
                  </div>
                  <h3 className='text-xl font-semibold mb-2'>
                    Download Template
                  </h3>
                  <p className='text-emerald-100 mb-4 text-sm'>
                    Get the Excel template with the correct format and structure
                  </p>
                  <button
                    onClick={handleDownloadButtonClick}
                    disabled={isLoading}
                    className='w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20'
                  >
                    {isLoading ? (
                      <span className='flex items-center justify-center'>
                        <svg
                          className='animate-spin -ml-1 mr-3 h-4 w-4'
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
                        Downloading...
                      </span>
                    ) : (
                      'Download Template'
                    )}
                  </button>
                </div>
              </div>

              {/* Upload File Card */}
              <div
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  dragOver ? 'ring-4 ring-blue-300 scale-105' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className='absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300'></div>
                <div className='relative z-10'>
                  <div className='flex items-center justify-between mb-4'>
                    <div className='w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center'>
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
                          d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                        />
                      </svg>
                    </div>
                  </div>
                  <h3 className='text-xl font-semibold mb-2'>
                    Upload Excel File
                  </h3>
                  <p className='text-blue-100 mb-4 text-sm'>
                    Drag & drop your .xlsx file here or click to browse
                  </p>
                  <button
                    onClick={handleButtonClick}
                    disabled={isLoading}
                    className='w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20'
                  >
                    {isLoading ? 'Processing...' : 'Choose File'}
                  </button>
                </div>
              </div>
            </div>

            {/* File Display */}
            {selectedFile && (
              <div className='mb-8'>
                <div className='bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200'>
                  <div className='flex items-start space-x-4'>
                    <div className='flex-shrink-0'>
                      <div className='w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg'>
                        <svg
                          className='w-8 h-8 text-white'
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
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center space-x-2 mb-1'>
                        <h3 className='text-lg font-semibold text-gray-900 truncate'>
                          {selectedFile.name}
                        </h3>
                        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                          Ready
                        </span>
                      </div>
                      <p className='text-sm text-gray-600 mb-2'>
                        Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {message && (
                        <p className='text-sm text-emerald-600 font-medium'>
                          {message}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className='flex-shrink-0 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200'
                    >
                      <svg
                        className='w-4 h-4 text-gray-600'
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
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className='flex flex-col sm:flex-row gap-4'>
              <button
                onClick={handleSubmit}
                disabled={response || isLoading || !selectedFile}
                className='flex-1 relative group bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-4 px-8 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-lg'
              >
                <span className='relative z-10 flex items-center justify-center'>
                  {isLoading ? (
                    <>
                      <svg
                        className='animate-spin -ml-1 mr-3 h-5 w-5'
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
                      Processing File...
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
                      Process File
                    </>
                  )}
                </span>
                <div className='absolute inset-0 bg-gradient-to-r from-purple-700 to-indigo-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200'></div>
              </button>

              <button
                onClick={handleReset}
                disabled={isLoading}
                className='flex-1 sm:flex-initial bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-8 rounded-2xl shadow-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200'
              >
                <span className='flex items-center justify-center'>
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
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          type='file'
          accept='.xlsx'
          onChange={handleFileChange}
          ref={fileInputRef}
          className='hidden'
        />
      </div>
    </div>
  );
};

export default FileUploader;
