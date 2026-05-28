// components/UploadModal.tsx
'use client';

import React from 'react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordersFile: File | null;
  inventoryFile: File | null;
  onOrdersFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInventoryFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  uploading: boolean;
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  ordersFile,
  inventoryFile,
  onOrdersFileChange,
  onInventoryFileChange,
  onUpload,
  uploading,
}) => {
  if (!isOpen) return null;

  const selectedCount = [ordersFile, inventoryFile].filter(Boolean).length;
  const oneFileUploaded = selectedCount > 0;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn'>
      <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg animate-slideUp border border-gray-100'>
        {/* Header */}
        <div className='flex justify-between items-center mb-6'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center'>
              <svg
                className='w-5 h-5 text-blue-600'
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
            <div>
              <h3 className='text-xl font-bold text-gray-800'>Upload Blinkit SOA Files</h3>
              <p className='text-sm text-gray-500'>
                Upload files from the Monthly SOA zip
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all duration-200'
          >
            <svg
              className='w-5 h-5'
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

        {/* Download Instructions */}
        <div className='mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200'>
          <p className='text-sm font-semibold text-amber-900 mb-2 flex items-center gap-1.5'>
            <svg className='w-4 h-4 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
              <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z' clipRule='evenodd' />
            </svg>
            How to get these files
          </p>
          <ol className='text-xs text-amber-800 space-y-1.5 list-none'>
            <li className='flex gap-2'>
              <span className='font-bold shrink-0'>1.</span>
              <span>
                Go to{' '}
                <a
                  href='https://seller.blinkit.com/dashboard/billing'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline font-medium hover:text-amber-600'
                >
                  seller.blinkit.com/dashboard/billing
                </a>
              </span>
            </li>
            <li className='flex gap-2'>
              <span className='font-bold shrink-0'>2.</span>
              <span>Download <strong>Monthly SOA</strong> for the relevant month — you'll get a zip file (e.g. <code className='bg-amber-100 px-1 rounded'>payout_sheet_2026-04.zip</code>)</span>
            </li>
            <li className='flex gap-2'>
              <span className='font-bold shrink-0'>3.</span>
              <span>Unzip it and upload the files below</span>
            </li>
          </ol>
        </div>

        {/* File Upload Section */}
        <div className='space-y-5'>
          <EnhancedFileInput
            label='Forward & Return Cancelled Orders'
            description='Forward & Return Cancelled Orders.xlsx — contains both sales (Forward Orders sheet) and returns (Cancelled or Returned Orders sheet)'
            file={ordersFile}
            onChange={onOrdersFileChange}
            accept='.xlsx, .xls'
            icon='📊'
          />
          <EnhancedFileInput
            label='Storage Charges'
            description='Storage Charges.xlsx — daily ageing inventory by state'
            file={inventoryFile}
            onChange={onInventoryFileChange}
            accept='.xlsx, .xls'
            icon='📦'
          />
        </div>

        {/* Progress Indicator */}
        <div className='mt-6 mb-6'>
          <div className='flex items-center justify-between text-sm mb-2'>
            <span className='text-gray-600'>Files selected</span>
            <span className='text-gray-600'>
              {selectedCount}/2 files selected
            </span>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-2'>
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                selectedCount === 2
                  ? 'bg-green-500 w-full'
                  : selectedCount === 1
                  ? 'bg-blue-500 w-1/2'
                  : 'bg-gray-300 w-0'
              }`}
            ></div>
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={onUpload}
          disabled={uploading || !oneFileUploaded}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg relative overflow-hidden group ${
            uploading || !oneFileUploaded
              ? 'bg-gray-300 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:-translate-y-0.5'
          }`}
        >
          <div className='flex items-center justify-center gap-2'>
            {uploading ? (
              <>
                <svg
                  className='w-5 h-5 animate-spin'
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
                Processing Files...
              </>
            ) : (
              <>
                <svg
                  className='w-5 h-5 transition-transform group-hover:scale-110'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
                  />
                </svg>
                Upload Files
              </>
            )}
          </div>
          {!uploading && oneFileUploaded && (
            <div className='absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300'></div>
          )}
        </button>
      </div>
    </div>
  );
};

const EnhancedFileInput: React.FC<{
  label: string;
  description: string;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept: string;
  icon: string;
}> = ({ label, description, file, onChange, accept, icon }) => {
  const isSelected = !!file;

  return (
    <div className='group'>
      <label className='block text-sm font-semibold text-gray-800 mb-1'>
        {label}
      </label>
      <p className='text-xs text-gray-500 mb-3'>{description}</p>

      <div className='relative'>
        <input
          type='file'
          onChange={onChange}
          accept={accept}
          className='absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10'
        />

        <div
          className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 ${
            isSelected
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 group-hover:border-blue-500'
          }`}
        >
          <div className='flex items-center justify-between p-4'>
            <div className='flex items-center gap-3 flex-1 min-w-0'>
              <div
                className={`text-2xl transition-transform group-hover:scale-110 ${
                  isSelected ? 'animate-bounce' : ''
                }`}
              >
                {isSelected ? '✅' : icon}
              </div>
              <div className='flex-1 min-w-0'>
                <p
                  className={`font-medium truncate ${
                    isSelected ? 'text-green-700' : 'text-gray-700'
                  }`}
                >
                  {file ? file.name : 'Choose file...'}
                </p>
                <p className='text-xs text-gray-500 mt-1'>
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : 'Click to browse or drag & drop'}
                </p>
              </div>
            </div>

            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-green-200 text-green-800'
                  : 'bg-blue-100 text-blue-700 group-hover:bg-blue-200'
              }`}
            >
              {isSelected ? 'Selected' : 'Browse'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;

{
  /* Add these CSS animations to your global CSS file */
}
<style jsx global>{`
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.2s ease-out;
  }

  .animate-slideUp {
    animation: slideUp 0.3s ease-out;
  }
`}</style>;
