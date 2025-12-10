// components/SalesReport.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

// Define type for report data structure
interface ReportItem {
  _id: string;
  item_id: number;
  sku_code: string;
  hsn_code: string;
  item_name: string;
  quantity: number;
  city: string;
  order_date: string;
}

const SalesReport: React.FC = () => {
  // ===== STATE MANAGEMENT =====
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // File upload state
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Refs for file inputs
  const salesFileInputRef = useRef<HTMLInputElement>(null);
  const inventoryFileInputRef = useRef<HTMLInputElement>(null);

  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();
  const formattedDate = format(selectedDate, 'MMM yyyy');

  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchReportData();
  }, [selectedMonth, selectedYear]);

  const fetchReportData = async () => {
    setLoading(true);
    setReportData([]);
    setSelectedItems([]);

    if (!selectedMonth || !selectedYear) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('api_url environment variable is not set.');
      }

      const response = await fetch(
        `${apiUrl}/blinkit/get_sales_report?month=${selectedMonth}&year=${selectedYear}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      const data: ReportItem[] | { message: string } = await response.json();

      if (Array.isArray(data)) {
        setReportData(data);
      } else {
        console.warn('API returned a message instead of data:', data.message);
        setReportData([]);

        if (data.message.includes('No saved report found')) {
          toast.info(data.message);
        } else {
          toast.error(data.message);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch report data:', err);
      toast.error(`Failed to fetch report data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== FILE HANDLING =====
  const handleSalesFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setSalesFile(file);
      event.target.value = '';
    }
  };

  const handleInventoryFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setInventoryFile(file);
      event.target.value = '';
    }
  };

  // ===== UPLOAD LOGIC =====
  const handleUpload = async () => {
    if (!salesFile || !inventoryFile) {
      toast.warning('Please select both Sales and Inventory files.');
      return;
    }

    setUploading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error('API URL environment variable is not set.');
      setUploading(false);
      return;
    }

    try {
      // Create FormData objects
      const salesFormData = new FormData();
      salesFormData.append('file', salesFile);

      const inventoryFormData = new FormData();
      inventoryFormData.append('file', inventoryFile);

      // Upload both files concurrently
      const [salesResponse, inventoryResponse] = await Promise.all([
        fetch(`${apiUrl}/blinkit/upload_sales_data`, {
          method: 'POST',
          body: salesFormData,
        }),
        fetch(`${apiUrl}/blinkit/upload_inventory_data`, {
          method: 'POST',
          body: inventoryFormData,
        }),
      ]);

      // Check responses
      if (!salesResponse.ok) {
        const salesError = await salesResponse.json();
        throw new Error(
          `Sales upload failed: ${
            salesError.detail || salesResponse.statusText
          }`
        );
      }

      if (!inventoryResponse.ok) {
        const inventoryError = await inventoryResponse.json();
        throw new Error(
          `Inventory upload failed: ${
            inventoryError.detail || inventoryResponse.statusText
          }`
        );
      }

      // Both uploads successful, generate report
      toast.success('Files uploaded successfully. Generating report...');

      // Reset file inputs
      setSalesFile(null);
      setInventoryFile(null);
      if (salesFileInputRef.current) salesFileInputRef.current.value = '';
      if (inventoryFileInputRef.current)
        inventoryFileInputRef.current.value = '';

      toast.success('Report generated successfully!');

      // Fetch the updated report data
      fetchReportData();
    } catch (err: any) {
      console.error('Upload process failed:', err);
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ===== DOWNLOAD LOGIC =====
  const handleDownload = async () => {
    setDownloading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error('API URL environment variable is not set.');
      setDownloading(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/blinkit/download_report?month=${selectedMonth}&year=${selectedYear}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorText;
        } catch {
          errorDetail = errorText;
        }
        throw new Error(
          errorDetail || `Download failed with status: ${response.status}`
        );
      }

      // Process the downloaded file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;

      // Try to extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `sales_inventory_report_${format(
        selectedDate,
        'yyyy-MM'
      )}.xlsx`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/
        );
        if (filenameMatch && filenameMatch[1]) {
          try {
            filename = decodeURIComponent(filenameMatch[1]);
          } catch {
            filename = filenameMatch[1];
          }
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Clean up object URL after download
      setTimeout(() => window.URL.revokeObjectURL(url), 100);

      toast.success('Report downloaded successfully!');
    } catch (err: any) {
      console.error('Download failed:', err);
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  // ===== SELECTION HANDLING =====
  const handleItemSelect = (itemIdentifier: string, isSelected: boolean) => {
    setSelectedItems((prev) => {
      if (isSelected && !prev.includes(itemIdentifier)) {
        return [...prev, itemIdentifier];
      } else if (!isSelected) {
        return prev.filter((id) => id !== itemIdentifier);
      }
      return prev;
    });
  };

  // ===== COMPONENT RENDERING =====
  return (
    <div className='container mx-auto p-4 bg-gray-50'>
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h1 className='text-2xl font-bold text-gray-800 mb-6'>Sales Report</h1>

        {/* Controls Section */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          {/* Date Selection */}
          <div className='flex flex-col'>
            <label
              htmlFor='monthYearPicker'
              className='text-sm font-medium text-gray-700 mb-2'
            >
              Select Month and Year
            </label>
            <DatePicker
              id='monthYearPicker'
              selected={selectedDate}
              onChange={(date: Date | null) => date && setSelectedDate(date)}
              dateFormat='MMM yyyy'
              showMonthYearPicker
              className='w-full text-black p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
            />
          </div>

          {/* File Upload Controls */}
          <div className='flex flex-col'>
            <label className='text-sm font-medium text-gray-700 mb-2'>
              Upload Files
            </label>
            <div className='flex space-x-2'>
              <div className='flex-1'>
                <input
                  type='file'
                  ref={salesFileInputRef}
                  onChange={handleSalesFileChange}
                  accept='.xlsx, .xls'
                  className='hidden'
                  id='salesFileInput'
                />
                <label
                  htmlFor='salesFileInput'
                  className='w-full inline-flex justify-center items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 truncate'
                >
                  {salesFile
                    ? `${salesFile.name.substring(0, 12)}...`
                    : 'Sales File'}
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-col'>
            <label className='text-sm font-medium text-gray-700 mb-2'>
              Actions
            </label>
            <div className='flex space-x-2'>
              <button
                onClick={handleUpload}
                disabled={!salesFile || !inventoryFile || uploading}
                className={`flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                  ${
                    !salesFile || !inventoryFile || uploading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                  }`}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>

              <button
                onClick={handleDownload}
                disabled={downloading || reportData.length === 0}
                className={`flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                  ${
                    downloading || reportData.length === 0
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                  }`}
              >
                {downloading ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className='flex justify-center items-center py-12'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
            <span className='ml-3 text-blue-600'>Loading report data...</span>
          </div>
        )}

        {/* No Data State */}
        {!loading && reportData.length === 0 && (
          <div className='bg-gray-50 rounded-lg p-6 text-center'>
            <p className='text-gray-600'>
              No report data found for {formattedDate}. Please upload files to
              generate a report.
            </p>
          </div>
        )}
      </div>

      {/* Report Table */}
      {!loading && reportData.length > 0 && (
        <div className='bg-white rounded-lg shadow-md overflow-hidden'>
          <div className='p-4 bg-gray-50 border-b border-gray-200'>
            <h2 className='text-lg font-semibold text-gray-800'>
              Report Details
            </h2>
            <p className='text-sm text-gray-600'>
              Select items to compare metrics in the chart above
            </p>
          </div>

          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    #
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Sku Code
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    HSN Code
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Item Name
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    City
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {reportData.map((item, index) => {
                  const itemIdentifier = `${item._id}-${item.city}-${item.quantity}`;
                  const isItemSelected = selectedItems.includes(itemIdentifier);

                  return (
                    <tr
                      key={itemIdentifier}
                      className={
                        isItemSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }
                    >
                      <td className='px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900'>
                        {index + 1}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.sku_code}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.hsn_code}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900'>
                        {item.item_name}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.city}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium'>
                        {item.quantity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
