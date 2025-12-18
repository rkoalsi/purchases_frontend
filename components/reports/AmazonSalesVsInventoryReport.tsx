// components/AmazonSalesReport.tsx
"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import dateUtils from "../common/DateUtils";
import DatePicker from "../common/DatePicker";
import axios from "axios";
import { toast } from "react-toastify";
import { Package, TrendingUp } from "lucide-react";
import {
  SortIcon as StandardSortIcon,
  TABLE_CLASSES,
  CONTROLS_CLASSES,
  LoadingState,
  SearchBar,
  formatNumber as standardFormatNumber,
} from './TableStyles';
import DateRangeComponent from '@/components/reports/DateRange';

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
    sales_last_7_days: number;
    two_weeks_ago_sales: number;
    sales_last_30_days: number;
    performance_vs_last_30_days_pct: number;
    performance_vs_last_7_days_pct: number;
  };
}

const AmazonSalesVSInventoryReport: React.FC = () => {
  // ===== STATE MANAGEMENT =====
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [reportMetadata, setReportMetadata]: any = useState({});
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reportType, setReportType] = useState("all");

  const [downloading, setDownloading] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const formatDate = (dateString: string) => {
    if (!dateString) return 'No data';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredAndSortedData = useMemo(() => {
    const filteredData = reportData.filter((item) => {
      const matchesSearch = item.item_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesCity = !cityFilter || item.city === cityFilter;
      const matchesWarehouse =
        !warehouseFilter || item.warehouse === warehouseFilter;

      return matchesSearch && matchesCity && matchesWarehouse;
    });

    // Apply sorting
    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key?.startsWith("metrics.")) {
          const metricKey = sortConfig.key.replace("metrics.", "");
          aValue = a.metrics[metricKey as keyof typeof a.metrics];
          bValue = b.metrics[metricKey as keyof typeof b.metrics];
        } else {
          aValue = a[sortConfig.key as keyof typeof a];
          bValue = b[sortConfig.key as keyof typeof b];
        }

        if (typeof aValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredData;
  }, [reportData, searchTerm, cityFilter, warehouseFilter, sortConfig]);


  // Sort handler
  const handleSort = (key: string) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const renderStatusBadges = () => {
  if (reportType === "all") {
    // Render both vendor_central and fba_seller_flex data
    return (
      <div className="space-y-4 mt-4 text-black text-sm">
        {/* Vendor Central Section */}
        {reportMetadata.vendor_central && (
          <div className="space-y-2 mt-2">
            <h4 className="text-sm font-medium text-gray-700">Vendor Central (Last Updated)</h4>
            <div className="flex flex-wrap flex-row gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-full border border-purple-100">
                <Package className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-800">
                  <span className="font-medium">Inventory (Range):</span> {
                    reportMetadata.vendor_central.inventory_data.first_inventory_date && reportMetadata.vendor_central.inventory_data.last_inventory_date
                      ? `${formatDate(reportMetadata.vendor_central.inventory_data.first_inventory_date)} - ${formatDate(reportMetadata.vendor_central.inventory_data.last_inventory_date)}`
                      : 'No data'
                  }
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-full border border-indigo-100">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                <span className="text-sm text-indigo-800">
                  <span className="font-medium">Sales (Range):</span> {
                    reportMetadata.vendor_central.sales_data.first_sales_date && reportMetadata.vendor_central.sales_data.last_sales_date
                      ? `${formatDate(reportMetadata.vendor_central.sales_data.first_sales_date)} - ${formatDate(reportMetadata.vendor_central.sales_data.last_sales_date)}`
                      : 'No data'
                  }
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full border border-gray-100">
                <span className="text-sm text-gray-800">
                  <span className="font-medium">Records:</span> {reportMetadata.vendor_central.sales_data.records_count} sales, {reportMetadata.vendor_central.inventory_data.records_count} inventory
                </span>
              </div>
            </div>
          </div>
        )}

        {/* FBA/Seller Flex Section */}
        {reportMetadata.fba_seller_flex && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">FBA/Seller Flex (Last Updated)</h4>
            <div className="flex flex-wrap flex-row gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-full border border-blue-100">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  <span className="font-medium">Inventory (Range):</span> {
                    reportMetadata.fba_seller_flex.inventory_data.first_inventory_date && reportMetadata.fba_seller_flex.inventory_data.last_inventory_date
                      ? `${formatDate(reportMetadata.fba_seller_flex.inventory_data.first_inventory_date)} - ${formatDate(reportMetadata.fba_seller_flex.inventory_data.last_inventory_date)}`
                      : 'No data'
                  }
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 rounded-full border border-green-100">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  <span className="font-medium">Sales (Range):</span> {
                    reportMetadata.fba_seller_flex.sales_data.first_sales_date && reportMetadata.fba_seller_flex.sales_data.last_sales_date
                      ? `${formatDate(reportMetadata.fba_seller_flex.sales_data.first_sales_date)} - ${formatDate(reportMetadata.fba_seller_flex.sales_data.last_sales_date)}`
                      : 'No data'
                  }
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full border border-gray-100">
                <span className="text-sm text-gray-800">
                  <span className="font-medium">Records:</span> {reportMetadata.fba_seller_flex.sales_data.records_count} sales, {reportMetadata.fba_seller_flex.inventory_data.records_count} inventory
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } else {
    // Original single report type rendering
    return (
      <div className="flex flex-wrap flex-row gap-3 mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-full border border-blue-100">
          <Package className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            <span className="font-medium">Inventory (Range):</span> {
              reportMetadata.inventory_data?.first_inventory_date && reportMetadata.inventory_data?.last_inventory_date
                ? `${formatDate(reportMetadata.inventory_data.first_inventory_date)} - ${formatDate(reportMetadata.inventory_data.last_inventory_date)}`
                : 'No data'
            }
          </span>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 rounded-full border border-green-100">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800">
            <span className="font-medium">Sales (Range):</span> {
              reportMetadata.sales_data?.first_sales_date && reportMetadata.sales_data?.last_sales_date
                ? `${formatDate(reportMetadata.sales_data.first_sales_date)} - ${formatDate(reportMetadata.sales_data.last_sales_date)}`
                : 'No data'
            }
          </span>
        </div>

        {reportMetadata.sales_data?.records_count !== undefined && reportMetadata.inventory_data?.records_count !== undefined && (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full border border-gray-100">
            <span className="text-sm text-gray-800">
              <span className="font-medium">Records:</span> {reportMetadata.sales_data.records_count} sales, {reportMetadata.inventory_data.records_count} inventory
            </span>
          </div>
        )}
      </div>
    );
  }
};
  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, reportType]);

  const fetchReportData = async () => {
    setLoading(true);
    setReportData([]);
    setSelectedItems([]);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error("api_url environment variable is not set.");
      }

      // Use the new date range API endpoint
      const r = await axios.get(
        `${apiUrl}/amazon/get_report_data_by_date_range`, { params: { start_date: startDate, end_date: endDate, report_type: reportType } }
      );
      const resp = await axios.get(
        `${apiUrl}/amazon/status`, { params: { start_date: startDate, end_date: endDate, report_type: reportType } }
      );
      setReportData(r.data);
      setReportMetadata(resp.data)
    } catch (err: any) {
      console.error("Failed to fetch report data:", err);
      toast.error(`Failed to fetch report data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fixed download function with proper axios blob handling
const handleDownload = async () => {
  setDownloading(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    alert("API URL environment variable is not set.");
    setDownloading(false);
    return;
  }

  try {
    const response = await axios.get(
      `${apiUrl}/amazon/download_report_by_date_range`,
      {
        params: {
          'start_date': startDate,
          'end_date': endDate,
          'report_type': reportType
        },
        responseType: 'blob' // ← Critical: Tell axios to handle binary data
      }
    );

    if (response.status !== 200) {
      throw new Error(`Download failed with status: ${response.status}`);
    }

    await processDownload(response);
  } catch (err: any) {
    console.error("Download failed:", err);
    alert(`Download failed: ${err.message}`);
  } finally {
    setDownloading(false);
  }
};

// Fixed processDownload function for axios response
const processDownload = async (response: any) => {
  // response.data is already a Blob when responseType is 'blob'
  const blob = response.data;
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers['content-disposition'];
  let filename = `amazon_sales_inventory_report_${startDate}_to_${endDate}_${reportType}.xlsx`;

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

  setTimeout(() => window.URL.revokeObjectURL(url), 100);
  console.log("Report downloaded successfully!");
};
  // ===== COMPONENT RENDERING =====
  return (
    <div className="container mx-auto p-4 bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Amazon Sales vs Inventory Report
        </h1>
        <div className={CONTROLS_CLASSES.container}>
          <div className={CONTROLS_CLASSES.inner}>
            <div className={CONTROLS_CLASSES.grid}>
              {/* Date Range Controls */}
              <div className={CONTROLS_CLASSES.section}>
                <h3 className={CONTROLS_CLASSES.sectionTitle}>Date Range & Actions</h3>
                <DateRangeComponent
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onGenerate={fetchReportData}
                  loading={loading}
                  downloadReport={handleDownload}
                  downloadDisabledCondition={downloading || reportData.length === 0}
                  downloadLoading={downloading}
                />
              </div>

              {/* Search Bar */}
              <div className={CONTROLS_CLASSES.section}>
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search items"
                />
              </div>
            </div>
          </div>
        </div>
        {/* Status Indicator */}
        {reportData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Report data loaded ({reportData.length} records)
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && <LoadingState message="Loading report data..." />}

        {/* No Data State */}
        {!loading && reportData.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-gray-600">
              No report data found for given date range. Please upload files to
              generate a report.
            </p>
          </div>
        )}
      </div>

      {/* Report Table */}
      {!loading && reportData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Table Header with Search and Filters */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Report Details
                </h2>
                <p className="text-sm text-gray-600">
                  Showing {filteredAndSortedData.length} of {reportData.length}{" "}
                  items
                </p>
              </div>

              {/* Search Bar */}
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search items"
                className="flex-1 max-w-md"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <select
                  value={reportType}
                  onChange={async (e) => {
                    console.log(e.target.value);
                    setReportType(e.target.value);
                  }}
                  className="block w-full px-3 py-2 text-black text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">FBA + Seller Flex + Vendor Central</option>
                  {[
                    { label: "FBA + Seller Flex", value: "fba+seller_flex" },
                    { label: "FBA", value: "fba" },
                    { label: "Seller Flex", value: "seller_flex" },
                    { label: "Vendor Central", value: "vendor_central" },
                  ].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>


              {/* Clear Filters Button */}
              {(searchTerm || cityFilter || warehouseFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCityFilter("");
                    setWarehouseFilter("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
           {renderStatusBadges()}
          </div>

          {/* Table Container with Fixed Height and Sticky Header */}
          <div className="relative max-h-[70vh] overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Sticky Header */}
              <thead className="bg-gray-50 sticky top-0 z-30 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[250px]">
                    <button
                      onClick={() => handleSort("item_name")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Item Name
                      <StandardSortIcon column="item_name" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("sku_code")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      SKU Code
                      <StandardSortIcon column="sku_code" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                    <button
                      onClick={() => handleSort("asin")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      ASIN
                      <StandardSortIcon column="asin" sortConfig={sortConfig} />
                    </button>
                  </th>
                  {reportType !== "vendor_central" && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      <button
                        onClick={() => handleSort("warehouse")}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Warehouse
                        <StandardSortIcon column="warehouse" sortConfig={sortConfig} />
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("units_sold")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Units Sold
                      <StandardSortIcon column="units_sold" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("total_returns")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Total Returns
                      <StandardSortIcon column="total_returns" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("total_amount")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Total Amount
                      <StandardSortIcon column="total_amount" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("closing_stock")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Closing Stock
                      <StandardSortIcon column="closing_stock" sortConfig={sortConfig} />
                    </button>
                  </th>
                  {reportType !== "vendor_central" && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      <button
                        onClick={() => handleSort("sessions")}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Sessions
                        <StandardSortIcon column="sessions" sortConfig={sortConfig} />
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("total_days_in_stock")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Total Days in Stock
                      <StandardSortIcon column="total_days_in_stock" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("drr")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      DRR
                      <StandardSortIcon column="drr" sortConfig={sortConfig} />
                    </button>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={21}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No items match your search criteria
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((item: any, index) => {
                    const itemIdentifier = `${item.units_sold}-${index}-${item.asin}-${item.warehouses}`;
                    const isItemSelected =
                      selectedItems.includes(itemIdentifier);

                    return (
                      <tr
                        key={itemIdentifier}
                        className={`${isItemSelected ? "bg-blue-50" : "hover:bg-gray-50"
                          } transition-colors`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 min-w-[250px] max-w-[350px]">
                          <div className="break-words leading-tight">
                            {item.item_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {item.sku_code}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {item.asin}
                        </td>
                        {reportType !== "vendor_central" && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {item?.warehouses?.map((w: string) => w).join(",")}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.units_sold}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.total_returns}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.total_amount}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.closing_stock}
                        </td>
                        {reportType !== "vendor_central" && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {item.sessions}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.total_days_in_stock}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.drr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmazonSalesVSInventoryReport;
