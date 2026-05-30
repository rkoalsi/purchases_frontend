'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';

interface SyncStatus {
  missing: boolean;
  latest_date: string | null;
  days_behind: number | null;
}

/**
 * Polls GET /zoho/invoice-sync-status and renders an amber banner when invoices
 * are missing for the last 15 days. Intended for any report page that reads from
 * the invoices collection (master report, sales by customer, zoho sales, seasonal).
 */
export default function InvoiceSyncWarning() {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    axios
      .get<SyncStatus>(`${process.env.NEXT_PUBLIC_API_URL}/zoho/invoice-sync-status`)
      .then((res) => setStatus(res.data))
      .catch(() => {/* silently ignore — don't block the report */});
  }, []);

  if (!status?.missing) return null;

  const latestLabel = status.latest_date
    ? `Latest invoice date on record: ${status.latest_date}${status.days_behind != null ? ` (${status.days_behind} days ago)` : ''}.`
    : 'No recent invoices found in the database.';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300 mb-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Invoices are being re-synced.</strong>{' '}
        {latestLabel}{' '}
        Data for the last 15 days may be incomplete — please try again in a few minutes.
      </span>
    </div>
  );
}
