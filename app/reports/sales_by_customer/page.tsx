"use client";
import React, { useEffect, useState } from "react";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader,
  BarChart3,
} from "lucide-react";
import axios from "axios";

const REPORT_TABS = [
  { id: "sales_by_customer", label: "Sales by Customer", icon: FileSpreadsheet },
  { id: "brand_sales", label: "Brand Sales Report", icon: BarChart3 },
] as const;

type TabId = (typeof REPORT_TABS)[number]["id"];

const InvoiceReportGenerator = () => {
  const [activeTab, setActiveTab] = useState<TabId>("sales_by_customer");

  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    brand: "",
    exclude_customers: false,
    min_quantity: "",
    report_type: "customer",
  });
  const [brandReportData, setBrandReportData] = useState({
    startDate: "",
    endDate: "",
  });
  const [brands, setBrands] = useState([]);
  const [excludedCustomers, setExcludedCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [brandReportLoading, setBrandReportLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [brandReportMessage, setBrandReportMessage] = useState({ type: "", text: "" });

  const getBrands = async () => {
    try {
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/brands`);
      setBrands(data.brands);
    } catch (error) {
      console.log(error);
    }
  };

  const getExcludedCustomers = async () => {
    try {
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/zoho/excluded-customers`);
      setExcludedCustomers(data.excluded_customers);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getBrands();
    getExcludedCustomers();
  }, []);

  const handleInputChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (message.text) setMessage({ type: "", text: "" });
  };

  const validateForm = () => {
    if (!formData.startDate) {
      setMessage({ type: "error", text: "Please select a start date" });
      return false;
    }
    if (!formData.endDate) {
      setMessage({ type: "error", text: "Please select an end date" });
      return false;
    }
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setMessage({ type: "error", text: "Start date cannot be after end date" });
      return false;
    }
    return true;
  };

  const generateReport = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/zoho/generate-invoice-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_date: formData.startDate,
            end_date: formData.endDate,
            brand: formData.brand,
            exclude_customers: formData.exclude_customers,
            report_type: formData.report_type,
            ...(formData.min_quantity ? { min_quantity: parseFloat(formData.min_quantity) } : {}),
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = "An error occurred while generating the report";
        if (response.status === 404) {
          errorMessage = "No data found for the selected criteria";
        } else if (response.status === 500) {
          errorMessage = "Server error occurred. Please try again later";
        } else {
          try {
            const errorData = await response.json();
            if (errorData.detail) errorMessage = errorData.detail;
          } catch (e) {}
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const brandLabel = formData.brand || "all_brands";
      const reportLabel = formData.report_type === "transfer_order" ? "transfer_order" : "invoice";
      link.setAttribute("download", `${reportLabel}_report_${brandLabel}_${formData.startDate}_to_${formData.endDate}_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "Report generated and downloaded successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Unable to connect to server. Please check your connection",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBrandReportChange = (e: any) => {
    const { name, value } = e.target;
    setBrandReportData((prev) => ({ ...prev, [name]: value }));
    if (brandReportMessage.text) setBrandReportMessage({ type: "", text: "" });
  };

  const generateBrandSalesReport = async () => {
    const { startDate, endDate } = brandReportData;
    if (!startDate || !endDate) {
      setBrandReportMessage({ type: "error", text: "Please select a date range" });
      return;
    }

    setBrandReportLoading(true);
    setBrandReportMessage({ type: "", text: "" });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/zoho/generate-brand-sales-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_date: startDate, end_date: endDate }),
        }
      );

      if (!response.ok) {
        let errorMessage = "An error occurred while generating the report";
        try {
          const errorData = await response.json();
          if (errorData.detail) errorMessage = errorData.detail;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const month = startDate.slice(0, 7);
      link.setAttribute("download", `brand_sales_report_${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setBrandReportMessage({ type: "success", text: "Brand sales report downloaded!" });
    } catch (error: any) {
      setBrandReportMessage({ type: "error", text: error.message || "Unable to connect to server" });
    } finally {
      setBrandReportLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const isTransferOrder = formData.report_type === "transfer_order";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg dark:shadow-none border border-transparent dark:border-zinc-800 overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-zinc-700">
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-8">
          {/* ── Sales by Customer ── */}
          {activeTab === "sales_by_customer" && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <p className="text-gray-600 dark:text-zinc-400 text-sm">
                  Generate detailed invoice reports by date range and brand
                </p>
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                  Report Type
                </label>
                <div className="flex gap-3">
                  {[
                    { value: "customer", label: "Customer Report" },
                    { value: "transfer_order", label: "Transfer Order Report" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, report_type: opt.value, exclude_customers: false }))
                      }
                      className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all duration-200 ${
                        formData.report_type === opt.value
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-blue-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {isTransferOrder && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Shows invoices for internal / non-trade customers only
                  </p>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    max={today}
                    className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    max={today}
                    min={formData.startDate}
                    className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>

              {/* Brand Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                  Brand
                </label>
                <select
                  id="brand"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-zinc-800"
                >
                  <option value="">All Brands</option>
                  {brands.map((brand: any) => (
                    <option key={brand.value} value={brand.value}>
                      {brand.label}
                    </option>
                  ))}
                </select>
                {!formData.brand && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                    A Brand column will be included in the report
                  </p>
                )}
              </div>

              {/* Exclude Customers */}
              {!isTransferOrder && (
                <div className="flex items-start gap-3 p-4 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    id="exclude_customers"
                    name="exclude_customers"
                    checked={formData.exclude_customers}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="exclude_customers"
                      className="block text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer"
                    >
                      Exclude Internal / Non-Trade Customers
                    </label>
                    <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                      Removes the following customers from the report:
                    </p>
                    <ul className="mt-1 text-xs text-gray-500 dark:text-zinc-500 list-disc list-inside space-y-0.5">
                      {excludedCustomers.map((customer, index) => (
                        <li key={index}>{customer}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Transfer Order info box */}
              {isTransferOrder && (
                <div className="p-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                    Internal / Non-Trade Customers
                  </p>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside space-y-0.5">
                    {excludedCustomers.map((customer, index) => (
                      <li key={index}>{customer}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Min Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                  Minimum Quantity (optional)
                </label>
                <input
                  type="number"
                  id="min_quantity"
                  name="min_quantity"
                  value={formData.min_quantity}
                  onChange={handleInputChange}
                  placeholder="Leave blank for all"
                  min="0"
                  className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-zinc-800"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                  Only include line items with quantity &ge; this value
                </p>
              </div>

              {message.text && (
                <div
                  className={`flex items-center p-4 rounded-lg ${
                    message.type === "error"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                  }`}
                >
                  {message.type === "error" ? (
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <button
                onClick={generateReport}
                disabled={loading}
                className={`w-full flex items-center justify-center px-6 py-4 rounded-lg font-medium transition-all duration-200 ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                } text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`}
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Generate & Download Report
                  </>
                )}
              </button>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Report Information</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Reports include invoices with status other than draft or void</li>
                  <li>• Data is filtered by the selected date range and brand</li>
                  <li>• The Excel file will download automatically when ready</li>
                  <li>
                    • Columns: SKU Code, Item, Customer, {!formData.brand && "Brand, "}Quantity,
                    Total Amount, Status, Purchase Status, Invoice ID, Created Date
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Brand Sales Report ── */}
          {activeTab === "brand_sales" && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <p className="text-gray-600 dark:text-zinc-400 text-sm">
                  Generate BWS / BWC / BWSC monthly breakdown (3 sheets)
                </p>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={brandReportData.startDate}
                    onChange={handleBrandReportChange}
                    max={today}
                    className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={brandReportData.endDate}
                    onChange={handleBrandReportChange}
                    max={today}
                    min={brandReportData.startDate}
                    className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>

              {brandReportMessage.text && (
                <div
                  className={`flex items-center p-4 rounded-lg ${
                    brandReportMessage.type === "error"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                  }`}
                >
                  {brandReportMessage.type === "error" ? (
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  )}
                  <span>{brandReportMessage.text}</span>
                </div>
              )}

              <button
                onClick={generateBrandSalesReport}
                disabled={brandReportLoading}
                className={`w-full flex items-center justify-center px-6 py-4 rounded-lg font-medium transition-all duration-200 ${
                  brandReportLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                } text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`}
              >
                {brandReportLoading ? (
                  <>
                    <Loader className="h-5 w-5 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Generate BWS / BWC / BWSC Report
                  </>
                )}
              </button>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Report Information</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• <strong>BWS:</strong> Brand-wise sales with transfer order and pure sales breakdown</li>
                  <li>• <strong>BWC:</strong> Brand-wise sales by product category</li>
                  <li>• <strong>BWSC:</strong> Brand-wise sales by product sub-category</li>
                  <li>• <strong>Summary:</strong> Month-over-month pure sales growth per brand (₹ &amp; %) with colour coding</li>
                  <li>• Each sheet includes the selected month <em>and</em> the previous calendar month side-by-side for easy comparison</li>
                  <li>• P&amp;L charges (Other Charges, Shipping, Post Supply Discount) are auto-fetched from Zoho Books for both months</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceReportGenerator;
