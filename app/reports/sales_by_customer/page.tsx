"use client";
import React, { useEffect, useState } from "react";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import axios from "axios";

const InvoiceReportGenerator = () => {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    brand: "",
    exclude_customers: false,
    min_quantity: "",
  });
  const [brands, setBrands] = useState([]);
  const [excludedCustomers, setExcludedCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

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
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear messages when user starts typing
    if (message.text) {
      setMessage({ type: "", text: "" });
    }
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
    if (!formData.brand) {
      setMessage({ type: "error", text: "Please select a brand" });
      return false;
    }
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setMessage({
        type: "error",
        text: "Start date cannot be after end date",
      });
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start_date: formData.startDate,
            end_date: formData.endDate,
            brand: formData.brand,
            exclude_customers: formData.exclude_customers,
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
            if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          } catch (e) {
            // If we can't parse error response, use default message
          }
        }

        throw new Error(errorMessage);
      }

      // Get the blob data
      const blob = await response.blob();

      // Create blob link to download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename with current timestamp
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      link.setAttribute(
        "download",
        `invoice_report_${formData.brand}_${timestamp}.xlsx`
      );

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Cleanup blob URL
      window.URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: "Report generated and downloaded successfully!",
      });
    } catch (error: any) {
      console.error("Error generating report:", error);
      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to connect to server. Please check your connection",
      });
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg dark:shadow-none border border-transparent dark:border-zinc-800 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center mb-4">
              <FileSpreadsheet className="h-12 w-12 text-blue-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                Sales By Customer Report
              </h1>
            </div>
            <p className="text-gray-600 dark:text-zinc-400">
              Generate detailed invoice reports by date range and brand
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2"
                >
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
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2"
                >
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
              <label
                htmlFor="brand"
                className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2"
              >
                Brand
              </label>
              <select
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-zinc-800"
              >
                <option value="">Select a brand...</option>
                {brands.map((brand: any) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Min Quantity Filter */}
            <div>
              <label
                htmlFor="min_quantity"
                className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-2"
              >
                Minimum Quantity (optional)
              </label>
              <input
                type="number"
                id="min_quantity"
                name="min_quantity"
                value={formData.min_quantity}
                onChange={handleInputChange}
                placeholder="Leave blank for all customers"
                min="0"
                className="w-full text-black dark:text-zinc-100 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-zinc-800"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                Only include customers with individual item quantity greater than or equal to this value
              </p>
            </div>

            <div
              className="flex items-center mb-4"
              data-tooltip-target="tooltip-default"
            >
              <input
                id="default-checkbox"
                type="checkbox"
                name="exclude_customers"
                checked={formData.exclude_customers}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              {/* <div
                id="tooltip-default"
                role="tooltip"
                className="absolute z-10 inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-xs opacity-0 tooltip dark:bg-gray-700"
              >
                Checking this box excludes the following customers: [ "(amzb2b)
                Pupscribe Enterprises Pvt Ltd", "Pupscribe Enterprises Private
                Limited", "(OSAMP) Office samples", "(PUPEV) PUPSCRIBE EVENTS",
                "(SSAM) Sales samples", ]
                <div className="tooltip-arrow" data-popper-arrow></div>
              </div> */}
              <label className="ms-2 text-sm font-medium text-gray-900 dark:text-zinc-100">
                Exclude Customers
              </label>
            </div>
            {/* Message Display */}
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

            {/* Generate Button */}
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
          </div>

          {/* Info Section */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              Report Information
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>
                • Reports include invoices with status other than 'draft' or
                'void'
              </li>
              <li>• Data is filtered by the selected date range and brand</li>
              <li>• The Excel file will download automatically when ready</li>
              <li>
                • File includes Invoice ID, Customer, Item, Quantity, and Date
                information
              </li>
              <li>
                • The Exclude Customers Checkbox above, once checked removes the following customers from the generated report:
                <ul className="ml-6 mt-2 space-y-1">
                  {excludedCustomers.map((customer, index) => (
                    <li key={index}>{index + 1}. {customer}</li>
                  ))}
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceReportGenerator;
