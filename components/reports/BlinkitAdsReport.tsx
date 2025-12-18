'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import dateUtils from '../common/DateUtils';
import DatePicker from '../common/DatePicker';
import axios from 'axios';
import { toast } from 'react-toastify';
import { TrendingUp, Users, DollarSign, Eye, Package, Search, Filter, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import AdsUploadModal from '../common/AdsUploadModal';
import {
  SortIcon as StandardSortIcon,
  TABLE_CLASSES,
  LoadingState,
  SearchBar,
  formatCurrency,
  formatNumber,
} from './TableStyles';

// Type definitions - UPDATED
interface CampaignMetrics {
  total_impressions: number;
  total_direct_atc: number;
  total_indirect_atc: number;
  total_atc: number; // NEW
  total_direct_quantities_sold: number;
  total_indirect_quantities_sold: number;
  total_units: number; // NEW
  total_direct_sales: number;
  total_indirect_sales: number;
  total_sales: number; // NEW
  total_new_users_acquired: number;
  total_budget_consumed: number;
  calculated_cpm: number; // UPDATED from avg_cpm
  avg_direct_roas: number;
  avg_total_roas: number;
  record_count: number;
}

interface TargetingGroup {
  targeting_group: string;
  targeting_type: string;
  match_type?: string;
  sheet_type: 'product_listing' | 'product_recommendation';
  metrics: CampaignMetrics;
  date_range: {
    start_date: string;
    end_date: string;
  };
}

interface CampaignData {
  campaign_name: string;
  campaign_id: number;
  targeting_groups: TargetingGroup[];
  campaign_totals: CampaignMetrics;
  targeting_groups_count: number;
}

interface SummaryData {
  total_campaigns: number;
  total_records: number;
  total_impressions: number;
  total_direct_sales: number;
  total_indirect_sales: number;
  total_sales: number;
  total_budget_consumed: number;
  total_units: number; // NEW
  total_atc: number; // NEW
  calculated_cpm: number; // NEW
  sheet_types: string[];
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

interface CampaignsApiResponse {
  total_campaigns: number;
  campaigns: CampaignData[];
  filters_applied: {
    start_date?: string;
    end_date?: string;
    campaign_name?: string;
    sheet_type?: string;
  };
}

interface SummaryApiResponse {
  summary: SummaryData;
  campaigns: any[];
  filters_applied: {
    start_date?: string;
    end_date?: string;
    sheet_type?: string;
  };
}

const BlinkitAdsReport: React.FC = () => {
  // State management
  const currentDate = new Date();
  const [startDate, setStartDate] = useState<Date>(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date>(currentDate);
  const [campaignsData, setCampaignsData] = useState<CampaignData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sheetTypeFilter, setSheetTypeFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // File upload state
  const [adsFile, setAdsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const adsFileInputRef = useRef<HTMLInputElement>(null);

  // Utility functions
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount == null || isNaN(amount)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (num == null || isNaN(num)) return '0';
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  const formatPercentage = (num: number | null | undefined): string => {
    if (num == null || isNaN(num)) return '0.00%';
    return `${num.toFixed(2)}%`;
  };

  const calculateTotalSales = (directSales: number = 0, indirectSales: number = 0): number => {
    return (directSales || 0) + (indirectSales || 0);
  };

  const calculateTotalUnits = (directUnits: number = 0, indirectUnits: number = 0): number => {
    return (directUnits || 0) + (indirectUnits || 0);
  };

  const calculateTotalAtc = (directAtc: number = 0, indirectAtc: number = 0): number => {
    return (directAtc || 0) + (indirectAtc || 0);
  };

  // Date handlers
  const handleStartDateChange = (date: Date | null) => {
    if (!date) return;
    if (dateUtils.isAfter(date, endDate)) {
      setEndDate(date);
    }
    setStartDate(date);
  };

  const handleEndDateChange = (date: Date | null) => {
    if (!date) return;
    if (dateUtils.isBefore(date, startDate)) {
      setStartDate(date);
    }
    setEndDate(date);
  };

  // Filtering and sorting
  const filteredAndSortedData = useMemo(() => {
    if (!campaignsData?.length) return [];

    // Filter campaigns
    const filtered = campaignsData.filter((campaign) => {
      if (!campaign) return false;

      const searchMatch = !searchTerm || 
        campaign.campaign_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.campaign_id?.toString().includes(searchTerm) ||
        campaign.targeting_groups?.some(tg => 
          tg?.targeting_group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tg?.targeting_type?.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const typeMatch = !sheetTypeFilter ||
        campaign.targeting_groups?.some(tg => tg?.sheet_type === sheetTypeFilter);

      return searchMatch && typeMatch;
    });

    // Sort campaigns
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: any = null;
        let bValue: any = null;

        if (sortConfig.key?.startsWith('campaign_totals.')) {
          const metricKey = sortConfig.key.replace('campaign_totals.', '') as keyof CampaignMetrics;
          aValue = a?.campaign_totals?.[metricKey] ?? 0;
          bValue = b?.campaign_totals?.[metricKey] ?? 0;
        } else {
          aValue = a?.[sortConfig.key as keyof CampaignData] ?? '';
          bValue = b?.[sortConfig.key as keyof CampaignData] ?? '';
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = typeof bValue === 'string' ? bValue.toLowerCase() : '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [campaignsData, searchTerm, sheetTypeFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // API calls
  const fetchAdsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      const [campaignsResponse, summaryResponse] = await Promise.all([
        axios.get<CampaignsApiResponse>(
          `${apiUrl}/blinkit_ads/campaigns`,
          { params: { start_date: startDateStr, end_date: endDateStr } }
        ),
        axios.get<SummaryApiResponse>(
          `${apiUrl}/blinkit_ads/campaigns/summary`,
          { params: { start_date: startDateStr, end_date: endDateStr } }
        )
      ]);

      // Validate and set data
      const campaigns = campaignsResponse.data?.campaigns || [];
      const summary = summaryResponse.data?.summary || null;

      setCampaignsData(campaigns);
      setSummaryData(summary);

      if (campaigns.length === 0) {
        toast.info('No campaign data found for the selected date range.');
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch data';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // File upload handlers
  const handleAdsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls'];
      const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExt)) {
        toast.error('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }

      setAdsFile(file);
      event.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!adsFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const formData = new FormData();
      formData.append('file', adsFile);

      const response = await fetch(`${apiUrl}/blinkit_ads/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      toast.success(`Successfully uploaded ${result.total_records_inserted || 0} records!`);
      
      // Reset and refresh
      setAdsFile(null);
      if (adsFileInputRef.current) {
        adsFileInputRef.current.value = '';
      }
      setShowUploadModal(false);
      await fetchAdsData();

    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      const response = await fetch(
        `${apiUrl}/blinkit_ads/data/raw?start_date=${startDateStr}&end_date=${endDateStr}&limit=10000`
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const data = await response.json();
      
      if (!data.data?.length) {
        toast.warning('No data available for download');
        return;
      }

      // Convert to CSV and download
      const headers = Object.keys(data.data[0]);
      const csvContent = [
        headers.join(','),
        ...data.data.map((row: any) =>
          headers.map(header => {
            const value = row[header];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `blinkit_ads_${startDateStr}_to_${endDateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Report downloaded successfully!');

    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const toggleCampaignExpansion = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  // Effects
  useEffect(() => {
    fetchAdsData();
  }, [startDate, endDate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Blinkit Ads Campaign Report
            </h1>
            <p className="text-gray-600">
              Track and analyze your advertising campaign performance
            </p>
          </div>

          {/* Summary Cards - UPDATED */}
          {summaryData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium">Total Budget Consumed</p>
                    <p className="text-3xl font-bold mt-1">{formatCurrency(summaryData.total_budget_consumed)}</p>
                  </div>
                  <DollarSign className="h-12 w-12 text-red-200" />
                </div>
              </div>


              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Total Impressions</p>
                    <p className="text-3xl font-bold mt-1">{formatNumber(summaryData.total_impressions)}</p>
                  </div>
                  <Eye className="h-12 w-12 text-green-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Total Sales</p>
                    <p className="text-3xl font-bold mt-1">{formatCurrency(summaryData.total_sales)}</p>
                  </div>
                  <DollarSign className="h-12 w-12 text-purple-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Total Ad Units</p>
                    <p className="text-3xl font-bold mt-1">{formatNumber(summaryData.total_units)}</p>
                  </div>
                  <ShoppingCart className="h-12 w-12 text-orange-200" />
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="grid lg:grid-cols-2 gap-8 items-end">
            {/* Date Pickers */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Period</h3>
              <div className="grid grid-cols-2 gap-4">
                <DatePicker
                  selected={startDate}
                  onChange={handleStartDateChange}
                  maxDate={endDate}
                  label="From"
                  placeholder="Start date"
                />
                <DatePicker
                  selected={endDate}
                  onChange={handleEndDateChange}
                  minDate={startDate}
                  maxDate={new Date()}
                  label="To"
                  placeholder="End date"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Data
              </button>

              <button
                onClick={handleDownload}
                disabled={downloading || !campaignsData.length}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                  downloading || !campaignsData.length
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {downloading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        <AdsUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          adsFile={adsFile}
          onAdsFileChange={handleAdsFileChange}
          onUpload={handleUpload}
          uploading={uploading}
          title="Upload Ads Data"
          adsLabel="Excel File"
        />

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Loading campaign data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-red-800 font-medium">Error loading data</h3>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!loading && !error && campaignsData.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No campaign data found</h3>
              <p className="text-gray-600 mb-6">
                Upload your ads data to start analyzing campaign performance
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Upload Data
              </button>
            </div>
          </div>
        )}

        {/* Campaigns Table */}
        {!loading && !error && campaignsData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Table Controls */}
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Campaign Performance</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Showing {filteredAndSortedData.length} of {campaignsData.length} campaigns
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search campaigns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  <select
                    value={sheetTypeFilter}
                    onChange={(e) => setSheetTypeFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">All Types</option>
                    <option value="product_listing">Product Listing</option>
                    <option value="product_recommendation">Product Recommendation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Campaigns List */}
            <div className="divide-y divide-gray-200">
              {filteredAndSortedData.map((campaign) => (
                <div key={`${campaign.campaign_id}`} className="p-6">
                  {/* Campaign Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {campaign.campaign_name || 'Unnamed Campaign'}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>ID: {campaign.campaign_id}</span>
                        <span>•</span>
                        <span>{campaign.targeting_groups_count || 0} targeting groups</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleCampaignExpansion(campaign.campaign_id.toString())}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {expandedCampaigns.has(campaign.campaign_id.toString()) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Campaign Metrics - UPDATED */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-blue-600 text-sm font-medium">Impressions</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {formatNumber(campaign.campaign_totals?.total_impressions)}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-green-600 text-sm font-medium">Total Sales</p>
                      <p className="text-2xl font-bold text-green-900 mt-1">
                        {formatCurrency(campaign.campaign_totals?.total_sales)}
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-purple-600 text-sm font-medium">Budget Used</p>
                      <p className="text-2xl font-bold text-purple-900 mt-1">
                        {formatCurrency(campaign.campaign_totals?.total_budget_consumed)}
                      </p>
                    </div>
                    
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-orange-600 text-sm font-medium">CPM</p>
                      <p className="text-2xl font-bold text-orange-900 mt-1">
                        {formatCurrency(campaign.campaign_totals?.calculated_cpm)}
                      </p>
                    </div>
                    
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-indigo-600 text-sm font-medium">Total Units</p>
                      <p className="text-2xl font-bold text-indigo-900 mt-1">
                        {formatNumber(campaign.campaign_totals?.total_units)}
                      </p>
                    </div>
                    
                    <div className="bg-pink-50 rounded-lg p-4">
                      <p className="text-pink-600 text-sm font-medium">Total ROAS</p>
                      <p className="text-2xl font-bold text-pink-900 mt-1">
                        {(campaign.campaign_totals?.avg_total_roas || 0).toFixed(2)}x
                      </p>
                    </div>
                  </div>

                  {/* Expanded Targeting Groups */}
                  {expandedCampaigns.has(campaign.campaign_id.toString()) && campaign.targeting_groups?.length > 0 && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">
                        Targeting Groups ({campaign.targeting_groups.length})
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Targeting Group
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Match Type
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Sheet Type
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Impressions
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Sales
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Units
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total ATC
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Budget Used
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                CPM
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ROAS
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {campaign.targeting_groups.map((targetingGroup, index) => (
                              <tr 
                                key={`${campaign.campaign_id}-${index}`} 
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {targetingGroup?.targeting_group || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {targetingGroup?.targeting_type || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {targetingGroup?.match_type || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    targetingGroup?.sheet_type === 'product_listing'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {targetingGroup?.sheet_type === 'product_listing' ? 'Listing' : 'Recommendation'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(targetingGroup?.metrics?.total_impressions)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatCurrency(targetingGroup?.metrics?.total_sales)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(targetingGroup?.metrics?.total_units)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(targetingGroup?.metrics?.total_atc)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatCurrency(targetingGroup?.metrics?.total_budget_consumed)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatCurrency(targetingGroup?.metrics?.calculated_cpm)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  <div className="text-right">
                                    <div className="text-xs text-gray-500 mb-1">
                                      Direct: {(targetingGroup?.metrics?.avg_direct_roas || 0).toFixed(2)}x
                                    </div>
                                    <div className="font-medium">
                                      Total: {(targetingGroup?.metrics?.avg_total_roas || 0).toFixed(2)}x
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* No Results Message */}
            {filteredAndSortedData.length === 0 && (
              <div className="p-12 text-center">
                <Filter className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns match your filters</h3>
                <p className="text-gray-600 mb-6">
                  Try adjusting your search term or filter criteria
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSheetTypeFilter('');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Debug Information - Development Only */}
        {process.env.NODE_ENV === 'development' && (summaryData || campaignsData.length > 0) && (
          <div className="mt-8 bg-gray-100 rounded-xl p-6">
            <h3 className="text-lg font-medium text-gray-700 mb-4">Debug Information</h3>
            
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">API Status</h4>
                <div className="space-y-1 text-gray-600">
                  <p>Summary Data: {summaryData ? '✅ Loaded' : '❌ Missing'}</p>
                  <p>Campaigns Count: {campaignsData.length}</p>
                  <p>Filtered Count: {filteredAndSortedData.length}</p>
                  <p>Date Range: {format(startDate, 'yyyy-MM-dd')} to {format(endDate, 'yyyy-MM-dd')}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">State</h4>
                <div className="space-y-1 text-gray-600">
                  <p>Loading: {loading ? 'Yes' : 'No'}</p>
                  <p>Error: {error ? 'Yes' : 'No'}</p>
                  <p>Search Term: {searchTerm || 'None'}</p>
                  <p>Sheet Filter: {sheetTypeFilter || 'None'}</p>
                  <p>Expanded Campaigns: {expandedCampaigns.size}</p>
                </div>
              </div>
            </div>

            {summaryData && (
              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-gray-800 hover:text-gray-900">
                  Summary Data Structure
                </summary>
                <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-40">
                  {JSON.stringify(summaryData, null, 2)}
                </pre>
              </details>
            )}

            {campaignsData.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-gray-800 hover:text-gray-900">
                  First Campaign Structure
                </summary>
                <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-40">
                  {JSON.stringify(campaignsData[0], null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlinkitAdsReport;