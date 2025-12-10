// components/ItemsTabls.tsx
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

import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
import axios from 'axios';

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
  _id: string;
  sku_code: string;
  item_name: string;
  item_id: number;
}

const BlinkitItemsTable: React.FC = () => {
  // ===== STATE MANAGEMENT =====
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();

  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchItems();
  }, [selectedMonth, selectedYear]);

  const fetchItems = async () => {
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

      const response = await fetch(`${apiUrl}/blinkit/get_blinkit_sku_mapping`);

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
        console.warn('API returned a message instead of items:', data.message);
        setReportData([]);

        if (data.message.includes('No saved report found')) {
          toast.info(data.message);
        } else {
          toast.error(data.message);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch items:', err);
      toast.error(`Failed to fetch items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (item: any) => {
    try {
      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/blinkit/delete_item/${item._id}`
      );
      if (response.status == 200) {
        toast.success(`Item Deleted Successfully`);
        fetchItems();
      }
    } catch (error: any) {
      console.log(error);
      toast.error(`Error Deleting Item: `, error.message);
    }
  };
  // ===== COMPONENT RENDERING =====
  return (
    <div className='container mx-auto p-4 bg-gray-50'>
      {/* Loading State */}
      {loading && (
        <div className='flex justify-center items-center py-12'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
          <span className='ml-3 text-blue-600'>
            Loading Blinkit Products...
          </span>
        </div>
      )}

      {/* Report Table */}
      {!loading && reportData.length > 0 && (
        <div className='bg-white rounded-lg shadow-md overflow-hidden'>
          <div className='p-4 bg-gray-50 border-b border-gray-200'>
            <h2 className='text-lg font-semibold text-gray-800'>
              All Blinkit Product Details and Mappings
            </h2>
          </div>

          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    #
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Item Name
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Sku Code
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Item Id
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {reportData.map((item: any, index) => {
                  const itemIdentifier = `${item.item_id}-${item.city}`;
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
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900'>
                        {item.item_name}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900'>
                        {item.sku_code}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        {item.item_id}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                        <Trash2 onClick={() => deleteItem(item)} />
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

export default BlinkitItemsTable;
