'use client';
import FileUploader from '@/components/common/FileUploader';
import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';

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
    toast.success('Form reset.', { autoClose: 2000 });
  };

  const handleSubmit = () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    toast.info('Submission in progress...', { autoClose: 2000 });

    setTimeout(() => {
      setIsSubmitting(false);
      toast.success('Submission completed.', { autoClose: 2000 });
    }, 2500);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.info('Proccessing', { autoClose: 2000 });
    }, 4500);
  };

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
