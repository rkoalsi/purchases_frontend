// components/AdsUploadModal.tsx
'use client';

import React from 'react';

interface AdsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  adsFile: File | null;
  onAdsFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  uploading: boolean;
  title?: string;
  adsLabel?: string;
}

const AdsUploadModal: React.FC<AdsUploadModalProps> = ({
  isOpen,
  onClose,
  adsFile,
  onAdsFileChange,
  onUpload,
  uploading,
  title = "Upload Ads Data",
  adsLabel = "Ads Excel File"
}) => {
  if (!isOpen) return null;

  const fileUploaded = !!adsFile;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn'>
      <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg animate-slideUp border border-gray-100'>
        {/* Header */}
        <div className='flex justify-between items-center mb-8'>
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
                  d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                />
              </svg>
            </div>
            <div>
              <h3 className='text-xl font-bold text-gray-800'>{title}</h3>
              <p className='text-sm text-gray-500'>
                Upload your Excel file with PRODUCT_LISTING and PRODUCT_RECOMMENDATION sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className='text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all duration-200 disabled:opacity-50'
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

        {/* File Upload Section */}
        <div className='space-y-6'>
          <AdsFileInput
            label={adsLabel}
            description='Excel file (.xlsx, .xls) containing both PRODUCT_LISTING and PRODUCT_RECOMMENDATION sheets'
            file={adsFile}
            onChange={onAdsFileChange}
            accept='.xlsx, .xls'
            icon='📈'
          />
        </div>

        {/* File Info */}
        {adsFile && (
          <div className='mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100'>
            <div className='flex items-center gap-2 mb-2'>
              <svg className='w-4 h-4 text-blue-600' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z' clipRule='evenodd' />
              </svg>
              <span className='text-sm font-medium text-blue-800'>File Details</span>
            </div>
            <div className='text-sm text-blue-700 space-y-1'>
              <p><span className='font-medium'>Name:</span> {adsFile.name}</p>
              <p><span className='font-medium'>Size:</span> {(adsFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <p><span className='font-medium'>Type:</span> {adsFile.type || 'Excel file'}</p>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={onUpload}
          disabled={uploading || !fileUploaded}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg relative overflow-hidden group mt-6 ${
            uploading || !fileUploaded
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
                <span>Processing Upload...</span>
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
                <span>Upload & Process Data</span>
              </>
            )}
          </div>
          {!uploading && fileUploaded && (
            <div className='absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300'></div>
          )}
        </button>

        {/* Help Text */}
        <div className='mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100'>
          <div className='flex items-start gap-2'>
            <svg
              className='w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
            <div className='text-sm text-amber-800'>
              <p className='font-medium mb-1'>Required Excel Format:</p>
              <ul className='list-disc list-inside space-y-1 text-xs'>
                <li>File must contain two sheets: <code>PRODUCT_LISTING</code> and <code>PRODUCT_RECOMMENDATION</code></li>
                <li>Headers should match the expected campaign data structure</li>
                <li>Supported formats: .xlsx, .xls</li>
                <li>Maximum file size: 50MB</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {uploading && (
          <div className='mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200'>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 bg-blue-500 rounded-full animate-ping'></div>
              <span className='text-sm text-blue-800 font-medium'>
                Processing your ads data. This may take a few moments...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdsFileInput: React.FC<{
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
      <label className='block text-sm font-semibold text-gray-800 mb-2'>
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
          <div className='flex items-center justify-between p-6'>
            <div className='flex items-center gap-4 flex-1 min-w-0'>
              <div
                className={`text-3xl transition-transform group-hover:scale-110 ${
                  isSelected ? 'animate-bounce' : ''
                }`}
              >
                {isSelected ? '✅' : icon}
              </div>
              <div className='flex-1 min-w-0'>
                <p
                  className={`font-medium text-lg truncate ${
                    isSelected ? 'text-green-700' : 'text-gray-700'
                  }`}
                >
                  {file ? file.name : 'Choose Excel file...'}
                </p>
                <p className='text-sm text-gray-500 mt-1'>
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type || 'Excel file'}`
                    : 'Click to browse or drag & drop your ads data file'}
                </p>
              </div>
            </div>

            <div
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-green-200 text-green-800'
                  : 'bg-blue-100 text-blue-700 group-hover:bg-blue-200'
              }`}
            >
              {isSelected ? 'Ready' : 'Browse'}
            </div>
          </div>

          {/* Visual indicator for drag and drop */}
          <div className={`absolute inset-0 border-2 border-dashed rounded-xl transition-all duration-300 ${
            isSelected ? 'border-green-400' : 'border-transparent group-hover:border-blue-400'
          }`}></div>
        </div>
      </div>
    </div>
  );
};

export default AdsUploadModal;

{/* Add these CSS animations to your global CSS file if not already present */}
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
`}</style>