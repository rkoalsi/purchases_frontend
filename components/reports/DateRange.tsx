import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangeProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onApplyPreset?: () => void; // Optional callback to trigger report generation
    showGenerateButton?: boolean; // Whether to show generate button
    onGenerate?: () => void; // Generate report callback
    loading?: boolean; // Loading state for generate button
    className?: string; // Additional CSS classes
    downloadReport?: () => {}; // Additional CSS classes
    downloadDisabledCondition?: boolean; // Additional CSS classes
    downloadLoading?: boolean; // Additional CSS classes
}

interface DateRangePreset {
    label: string;
    startDate: string;
    endDate: string;
}

const DateRange: React.FC<DateRangeProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onApplyPreset,
    showGenerateButton = false,
    downloadReport,
    downloadDisabledCondition,
    downloadLoading,
    onGenerate,
    loading = false,
    className = '',
}) => {
    const getDatePresets = (): DateRangePreset[] => {
        const today = new Date();

        // Helper function to format date as YYYY-MM-DD
        const formatDate = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // This Month (1st of current month to today)
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Last Month (1st to last day of previous month)
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month

        // Last 3 Completed Months (1st of 3 months ago to last day of last month)
        const threeMonthsAgoStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        const threeMonthsAgoEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month

        // Last 7 Days
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6); // -6 to include today as the 7th day

        // Last 30 Days  
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 29); // -29 to include today as the 30th day

        // Last 90 Days
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 89); // -89 to include today as the 90th day

        return [
            {
                label: 'This Month',
                startDate: formatDate(thisMonthStart),
                endDate: formatDate(today),
            },
            {
                label: 'Last Month',
                startDate: formatDate(lastMonthStart),
                endDate: formatDate(lastMonthEnd),
            },
            {
                label: 'Last 3 Months',
                startDate: formatDate(threeMonthsAgoStart),
                endDate: formatDate(threeMonthsAgoEnd),
            },
        ];
    };

    const handlePresetClick = (preset: DateRangePreset) => {
        onStartDateChange(preset.startDate);
        onEndDateChange(preset.endDate);

        // If onApplyPreset callback is provided, call it after setting dates
        if (onApplyPreset) {
            // Use setTimeout to ensure the state updates are processed first
            setTimeout(() => {
                onApplyPreset();
            }, 0);
        }
    };

    const presets = getDatePresets();

    return (
        <div className={className}>
            <div className="flex flex-col lg:flex-col gap-6">
                {/* Date Range Inputs */}
                <div className="flex flex-row sm:flex-row gap-4">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={(e) => onStartDateChange(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black"
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                            End Date
                        </label>
                        <input
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={(e) => onEndDateChange(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black"
                        />
                    </div>
                </div>

                {/* Date Range Presets */}
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quick Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Generate Button */}
            <div className="flex flex-row items-center gap-2 mt-4">
                <button
                    onClick={onGenerate}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? 'Loading...' : 'Generate Report'}
                </button>
                <button
                    onClick={downloadReport}
                    disabled={downloadDisabledCondition}
                    className='px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                    {downloadLoading ? (
                        <>
                            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                            Downloading...
                        </>
                    ) : (
                        <>
                            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                            </svg>
                            Download Excel
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default DateRange;