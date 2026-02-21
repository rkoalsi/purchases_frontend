import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangeProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onApplyPreset?: (startDate: string, endDate: string) => void; // Modified to accept dates
    showGenerateButton?: boolean;
    onGenerate?: () => void;
    loading?: boolean;
    className?: string;
    downloadReport?: () => {};
    downloadDisabledCondition?: boolean;
    downloadLoading?: boolean;
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

        const formatDate = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const threeMonthsAgoStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        const threeMonthsAgoEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        // Last 90 days ending on the previous Sunday
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
        const prevSunday = new Date(today);
        prevSunday.setDate(today.getDate() - daysSinceSunday);
        const ninetyDaysBeforeSunday = new Date(prevSunday);
        ninetyDaysBeforeSunday.setDate(prevSunday.getDate() - 89); // inclusive 90-day window

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
            {
                label: 'Last 90 Days',
                startDate: formatDate(ninetyDaysBeforeSunday),
                endDate: formatDate(prevSunday),
            },
        ];
    };

    const handlePresetClick = (preset: DateRangePreset) => {
        // Update the state first
        onStartDateChange(preset.startDate);
        onEndDateChange(preset.endDate);

        // Pass the new dates directly to the preset handler
        if (onApplyPreset) {
            onApplyPreset(preset.startDate, preset.endDate);
        }
    };

    const presets = getDatePresets();

    return (
        <div className={className}>
            {/* Date inputs and quick presets aligned in one row */}
            <div className="flex flex-wrap items-end gap-4">
                <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-1">
                        Start Date
                    </label>
                    <input
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black dark:text-zinc-100 dark:bg-zinc-800"
                    />
                </div>
                <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-1">
                        End Date
                    </label>
                    <input
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black dark:text-zinc-100 dark:bg-zinc-800"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-400 mb-1">
                        Quick Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

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
