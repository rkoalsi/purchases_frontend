// components/SalesReport.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { toast } from 'react-toastify';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define type for report data structure
interface ReportItem {
  year: number;
  month: number;
  generated_at: string;
  sku_code: string;
  city: string;
  item_name: string;
  item_id: number;
  warehouse: string;
  metrics: {
    avg_daily_on_stock_days: number;
    avg_weekly_on_stock_days: number;
    avg_monthly_on_stock_days: number;
    total_sales_in_period: number;
    days_of_coverage: number;
    days_with_inventory: number;
    closing_stock: number;
  };
}

// Extend ReportItem with UI-specific fields
interface EnhancedReportItem extends ReportItem {
  uniqueId: string;
  label: string;
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
      const apiUrl = process.env.api_url;
      if (!apiUrl) {
        throw new Error('api_url environment variable is not set.');
      }

      const response = await fetch(
        `${apiUrl}/blinkit/get_saved_report?month=${selectedMonth}&year=${selectedYear}`
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

    const apiUrl = process.env.api_url;
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

      const generateResponse = await fetch(
        `${apiUrl}/blinkit/generate_report?month=${selectedMonth}&year=${selectedYear}`
      );

      if (!generateResponse.ok) {
        const generateError = await generateResponse.json();
        throw new Error(
          `Report generation failed: ${
            generateError.detail || generateResponse.statusText
          }`
        );
      }

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

    const apiUrl = process.env.api_url;
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

  // ===== CHART DATA PREPARATION =====
  const chartData = useMemo(() => {
    if (!reportData || reportData.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Enhance report items with UI identifiers
    const enhancedItems: EnhancedReportItem[] = reportData.map((item) => ({
      ...item,
      uniqueId: `${item.item_id}-${item.city}`,
      label: `${item.item_name} (${item.city})`,
    }));

    if (selectedItems.length === 0) {
      // Case 1: No items selected - Show Avg Daily Sales per item
      // Calculate average daily sales (total sales / days in month)
      // Sort by avg daily sales descending
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      const sortedItems = [...enhancedItems].sort((a, b) => {
        const avgDailySalesA = a.metrics.total_sales_in_period / daysInMonth;
        const avgDailySalesB = b.metrics.total_sales_in_period / daysInMonth;
        return avgDailySalesB - avgDailySalesA;
      });

      return {
        labels: sortedItems.map((item) => item.label),
        datasets: [
          {
            label: `Avg Daily Sales (${formattedDate})`,
            data: sortedItems.map(
              (item) => item.metrics.total_sales_in_period / daysInMonth
            ),
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      };
    } else {
      // Case 2: Items selected - Compare key metrics for selected items
      const filteredItems = enhancedItems.filter((item) =>
        selectedItems.includes(item.uniqueId)
      );

      filteredItems.sort((a, b) => a.label.localeCompare(b.label));

      // Calculate average daily sales
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      const metricsToShow = [
        {
          key: 'avg_daily_sales',
          label: 'Avg Daily Sales',
          color: 'rgba(54, 162, 235, 0.8)',
          getValue: (item: EnhancedReportItem) =>
            item.metrics.total_sales_in_period / daysInMonth,
        },
        {
          key: 'avg_daily_on_stock_days',
          label: 'Avg Daily Stock Days',
          color: 'rgba(255, 99, 132, 0.8)',
          getValue: (item: EnhancedReportItem) =>
            item.metrics.avg_daily_on_stock_days,
        },
        {
          key: 'closing_stock',
          label: 'Closing Stock',
          color: 'rgba(255, 206, 86, 0.8)',
          getValue: (item: EnhancedReportItem) => item.metrics.closing_stock,
        },
        {
          key: 'days_of_coverage',
          label: 'Days of Coverage',
          color: 'rgba(153, 102, 255, 0.8)',
          getValue: (item: EnhancedReportItem) => item.metrics.days_of_coverage,
        },
        {
          key: 'days_with_inventory',
          label: 'Days with Inventory',
          color: 'rgba(75, 192, 192, 0.8)',
          getValue: (item: EnhancedReportItem) =>
            item.metrics.days_with_inventory,
        },
      ];

      if (filteredItems.length === 0) {
        return { labels: [], datasets: [] };
      }

      return {
        labels: filteredItems.map((item) => item.label),
        datasets: metricsToShow.map((metric) => ({
          label: metric.label,
          data: filteredItems.map((item) => metric.getValue(item)),
          backgroundColor: metric.color,
          borderColor: metric.color.replace('0.8', '1'),
          borderWidth: 1,
        })),
      };
    }
  }, [reportData, selectedItems, selectedDate, selectedMonth, selectedYear]);

  // ===== CHART OPTIONS =====
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // plugins: {
    //   legend: {
    //     position: 'top' as const,
    //   },
    //   title: {
    //     display: true,
    //     text:
    //       selectedItems.length === 0
    //         ? `Average Daily Sales per Item (${formattedDate})`
    //         : `Metric Comparison for Selected Items (${formattedDate})`,
    //     font: {
    //       size: 16,
    //       weight: 'bold',
    //     },
    //   },
    //   tooltip: {
    //     callbacks: {
    //       label: function (context: any) {
    //         let label = context.dataset.label || '';
    //         if (label) {
    //           label += ': ';
    //         }
    //         if (context.parsed.y !== null) {
    //           label += new Intl.NumberFormat('en-IN', {
    //             maximumFractionDigits: 2,
    //           }).format(context.parsed.y);
    //         }
    //         return label;
    //       },
    //     },
    //   },
    // },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 90,
          minRotation: 45,
          font: {
            size: 10,
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  };

  // ===== COMPONENT RENDERING =====
  return (
    <div className='container mx-auto p-4 bg-gray-50'>
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h1 className='text-2xl font-bold text-gray-800 mb-6'>
          Sales vs Inventory Report
        </h1>

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

              <div className='flex-1'>
                <input
                  type='file'
                  ref={inventoryFileInputRef}
                  onChange={handleInventoryFileChange}
                  accept='.xlsx, .xls'
                  className='hidden'
                  id='inventoryFileInput'
                />
                <label
                  htmlFor='inventoryFileInput'
                  className='w-full inline-flex justify-center items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 truncate'
                >
                  {inventoryFile
                    ? `${inventoryFile.name.substring(0, 12)}...`
                    : 'Inventory File'}
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

        {/* Chart Display */}
        {!loading && reportData.length > 0 && (
          <div className='mb-8'>
            <div className='bg-white rounded-lg p-2 mb-4'>
              <p className='text-center text-gray-700 text-sm'>
                {selectedItems.length === 0
                  ? 'Showing average daily sales for all items. Select items in the table below to compare metrics.'
                  : 'Showing metrics for selected items.'}
              </p>
            </div>

            <div className='bg-white rounded-lg p-4 h-80'>
              {chartData &&
              chartData.datasets.length > 0 &&
              chartData.labels.length > 0 ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <p className='text-gray-600 text-center pt-32'>
                  No data to display in chart based on current selection.
                </p>
              )}
            </div>
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
                    Select
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    #
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Item Name (SKU)
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    City
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Warehouse
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Avg Daily Stock
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Avg Weekly Stock
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Avg Monthly Stock
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Total Sales
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    DOC
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Days with Inventory
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Closing Stock
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {reportData.map((item, index) => {
                  const itemIdentifier = `${item.item_id}-${item.city}`;
                  const isItemSelected = selectedItems.includes(itemIdentifier);

                  return (
                    <tr
                      key={itemIdentifier}
                      className={
                        isItemSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }
                    >
                      <td className='px-4 py-3 whitespace-nowrap'>
                        <input
                          type='checkbox'
                          checked={isItemSelected}
                          onChange={(e) =>
                            handleItemSelect(itemIdentifier, e.target.checked)
                          }
                          className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                        />
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900'>
                        {index + 1}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900'>
                        {item.item_name}{' '}
                        <span className='text-gray-500'>({item.sku_code})</span>
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.city}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.warehouse}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium'>
                        {item.metrics.avg_daily_on_stock_days.toFixed(2)}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.metrics.avg_weekly_on_stock_days.toFixed(2)}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.metrics.avg_monthly_on_stock_days.toFixed(2)}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium'>
                        {item.metrics.total_sales_in_period.toFixed(2)}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.metrics.days_of_coverage.toFixed(2)}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.metrics.days_with_inventory}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium'>
                        {item.metrics.closing_stock.toFixed(2)}
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
