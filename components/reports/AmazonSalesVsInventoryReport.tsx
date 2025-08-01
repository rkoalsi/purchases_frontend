// components/AmazonSalesReport.tsx
"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import dateUtils from "../common/DateUtils";
import DatePicker from "../common/DatePicker";
import axios from "axios";
import { toast } from "react-toastify";
import { LucideRefreshCcw } from "lucide-react";

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
  const currentDate = new Date();
  const [startDate, setStartDate] = useState<Date>(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date>(currentDate); // Current date
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [warehouseType, setWarehouseType] = useState("all");

  const [downloading, setDownloading] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });

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

  const uniqueWarehouses = useMemo(() => {
    return [...new Set(reportData.map((item: any) => item.warehouses))].sort();
  }, [reportData]);

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

  // Sort icon component
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
          />
        </svg>
      );
    }

    return sortConfig.direction === "asc" ? (
      <svg
        className="w-4 h-4 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  // Handle date changes
  const handleStartDateChange = (date: Date | null) => {
    if (!date) return;
    // If selected start date is after current end date, set end date to start date
    if (dateUtils.isAfter(date, endDate)) {
      setEndDate(date);
    }
    setStartDate(date);
  };

  const handleEndDateChange = (date: Date | null) => {
    if (!date) return;
    // If selected end date is before current start date, set start date to end date
    if (dateUtils.isBefore(date, startDate)) {
      setStartDate(date);
    }
    setEndDate(date);
  };

  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, warehouseType]);

  const fetchReportData = async () => {
    setLoading(true);
    setReportData([]);
    setSelectedItems([]);
    try {
      const apiUrl = process.env.api_url;
      if (!apiUrl) {
        throw new Error("api_url environment variable is not set.");
      }

      // Format dates for API call (YYYY-MM-DD)
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Use the new date range API endpoint
      const r = await axios.get(
        `${apiUrl}/amazon/get_report_data_by_date_range?start_date=${startDateStr}&end_date=${endDateStr}&report_type=${warehouseType}`
      );
      setReportData(r.data);
    } catch (err: any) {
      console.error("Failed to fetch report data:", err);
      toast.error(`Failed to fetch report data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== DOWNLOAD LOGIC =====
  const handleDownload = async () => {
    setDownloading(true);

    const apiUrl = process.env.api_url;
    if (!apiUrl) {
      alert("API URL environment variable is not set.");
      setDownloading(false);
      return;
    }

    try {
      // Format dates for download API call
      const startDateStr = dateUtils.format(startDate, "yyyy-MM-dd");
      const endDateStr = dateUtils.format(endDate, "yyyy-MM-dd");

      const response = await fetch(
        `${apiUrl}/amazon/download_report_by_date_range?start_date=${startDateStr}&end_date=${endDateStr}`
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

      await processDownload(response);
    } catch (err: any) {
      console.error("Download failed:", err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const processDownload = async (response: Response) => {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `amazon_sales_inventory_report_${dateUtils.format(
      startDate,
      "yyyy-MM-dd"
    )}_to_${dateUtils.format(endDate, "yyyy-MM-dd")}.xlsx`;

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
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 lg:p-8 mb-6 lg:mb-8 hover:shadow-xl transition-shadow duration-300">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
            {/* Date Pickers Section - UPDATED */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <label className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Report Period
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative group">
                  <DatePicker
                    selected={startDate}
                    onChange={handleStartDateChange}
                    maxDate={endDate} // Prevent selecting start date after end date
                    label="From"
                    placeholder="Select start date"
                    className="group-hover:border-gray-300"
                  />
                </div>
                <div className="relative group">
                  <DatePicker
                    selected={endDate}
                    onChange={handleEndDateChange}
                    minDate={startDate} // Prevent selecting end date before start date
                    maxDate={new Date()} // Prevent selecting future dates
                    label="To"
                    placeholder="Select end date"
                    className="group-hover:border-gray-300"
                  />
                </div>
              </div>
            </div>
            {/* Action Buttons Section */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* <button
                className="flex-1 group relative overflow-hidden py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-center gap-2">
                  <LucideRefreshCcw />
                  Refresh Data
                </div>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              </button> */}

              <button
                onClick={handleDownload}
                disabled={downloading || reportData.length === 0}
                className={`flex-1 group relative overflow-hidden py-3 px-6 rounded-xl font-semibold transition-all duration-300 shadow-lg transform ${
                  downloading || reportData.length === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white hover:shadow-xl hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {downloading ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 transition-transform group-hover:scale-110"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download Report
                    </>
                  )}
                </div>
                {!downloading && reportData.length > 0 && (
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                )}
              </button>
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
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-blue-600">Loading report data...</span>
          </div>
        )}

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
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search items"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full text-black pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg
                      className="h-4 w-4 text-gray-400 hover:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="min-w-0 flex-1 min-w-[120px]">
                <select
                  value={warehouseType}
                  onChange={async (e) => {
                    console.log(e.target.value);
                    setWarehouseType(e.target.value);
                  }}
                  className="block w-full px-3 py-2 text-black text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {/* Change this value to 'all' to match the other 'All' option */}
                  <option value="all">FBA + Seller Flex</option>
                  {[
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

              {/* {warehouseType == "all" ? (
                <div className="min-w-0 flex-1 min-w-[120px]">
                  <select
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                    className="block w-full px-3 py-2 text-black text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">All Warehouses</option>
                    {uniqueWarehouses.map((warehouse, id) => (
                      <option key={id} value={warehouse}>
                        {warehouse}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null} */}

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
                      <SortIcon column="item_name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("sku_code")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      SKU Code
                      <SortIcon column="sku_code" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                    <button
                      onClick={() => handleSort("asin")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      ASIN
                      <SortIcon column="asin" />
                    </button>
                  </th>
                  {warehouseType !== "vendor_central" && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      <button
                        onClick={() => handleSort("warehouse")}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Warehouse
                        <SortIcon column="warehouse" />
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("units_sold")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Units Sold
                      <SortIcon column="units_sold" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("total_amount")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Total Amount
                      <SortIcon column="total_amount" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("closing_stock")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Closing Stock
                      <SortIcon column="closing_stock" />
                    </button>
                  </th>
                  {warehouseType !== "vendor_central" && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      <button
                        onClick={() => handleSort("sessions")}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Sessions
                        <SortIcon column="sessions" />
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("total_days_in_stock")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Total Days in Stock
                      <SortIcon column="total_days_in_stock" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <button
                      onClick={() => handleSort("drr")}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      DRR
                      <SortIcon column="drr" />
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
                        className={`${
                          isItemSelected ? "bg-blue-50" : "hover:bg-gray-50"
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
                        {warehouseType !== "vendor_central" && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {item?.warehouses?.map((w: string) => w).join(",")}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.units_sold}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.total_amount}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.closing_stock}
                        </td>
                        {warehouseType !== "vendor_central" && (
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
