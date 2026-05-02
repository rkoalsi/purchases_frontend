'use client';

import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, ShoppingCart, Loader2 } from 'lucide-react';
import { TABLE_CLASSES } from './TableStyles';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface OrderItem {
  manufacturer_code: string;
  bb_code: string;
  item_name: string;
  product_name: string;
  qty: number;
  unit_price: number;
  item_id: string;
}

interface MissingItem {
  manufacturer_code: string;
  bb_code: string;
  item_name: string;
}

interface DetectedVendor {
  contact_id: string;
  contact_name: string;
  currency_code: string;
}

interface ValidationResult {
  valid: boolean;
  items?: OrderItem[];
  missing_items?: MissingItem[];
  found_count?: number;
  missing_count?: number;
  total_items?: number;
  detected_vendor?: DetectedVendor | null;
}

interface Vendor {
  contact_id: string;
  contact_name: string;
  currency_code?: string;
}

export default function DraftOrderUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [purchaseorderNumber, setPurchaseorderNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdPO, setCreatedPO] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const vendorSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setFile(null);
    setValidation(null);
    setCreatedPO(null);
    setSelectedVendor(null);
    setVendorSearch('');
    setNotes('');
    setReferenceNumber('');
    setPurchaseorderNumber('');
    setPoDate(new Date().toISOString().slice(0, 10));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) {
      toast.error('Please upload a .xlsx file');
      return;
    }
    setFile(f);
    setValidation(null);
    setCreatedPO(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileChange(e.dataTransfer.files[0] ?? null);
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidation(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post<ValidationResult>(
        `${API_URL}/vendors/draft_orders/validate`,
        form,
      );
      setValidation(data);
      if (!data.valid) {
        setShowMissingModal(true);
      } else if (data.detected_vendor) {
        setSelectedVendor(data.detected_vendor);
        setVendorSearch(data.detected_vendor.contact_name);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const fetchVendors = useCallback(async (search: string) => {
    setVendorsLoading(true);
    try {
      const params: Record<string, any> = { page: 1, page_size: 50 };
      if (search) params.search = search;
      const { data } = await axios.get(`${API_URL}/vendors`, { params });
      setVendors(data.vendors || []);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setVendorsLoading(false);
    }
  }, []);

  const handleVendorSearchChange = (val: string) => {
    setVendorSearch(val);
    setShowVendorDropdown(true);
    if (vendorSearchTimeout.current) clearTimeout(vendorSearchTimeout.current);
    vendorSearchTimeout.current = setTimeout(() => fetchVendors(val), 300);
  };

  const handleVendorFocus = () => {
    setShowVendorDropdown(true);
    if (vendors.length === 0) fetchVendors(vendorSearch);
  };

  const selectVendor = (v: Vendor) => {
    setSelectedVendor(v);
    setVendorSearch(v.contact_name);
    setShowVendorDropdown(false);
  };

  const handleCreatePO = async () => {
    if (!validation?.items || !selectedVendor) return;
    setCreating(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/vendors/draft_orders/create_po`,
        {
          contact_id: selectedVendor.contact_id,
          date: poDate,
          items: validation.items,
          notes,
          reference_number: referenceNumber,
          purchaseorder_number: purchaseorderNumber,
        },
      );
      setCreatedPO(data);
      toast.success(`Purchase Order ${data.purchaseorder_number} created on Zoho`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create purchase order');
    } finally {
      setCreating(false);
    }
  };

  const totalAmount =
    validation?.items?.reduce((sum, it) => sum + it.qty * it.unit_price, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Draft Order Upload</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Upload a completed draft order to validate items and create a Zoho purchase order
          </p>
        </div>
        {(file || validation) && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" /> Reset
          </button>
        )}
      </div>

      {/* Upload area */}
      {!validation?.valid && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
            ${dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 bg-zinc-50 dark:bg-zinc-900'
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-10 h-10 text-green-500" />
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{file.name}</p>
              <p className="text-sm text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-zinc-400" />
              <div>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  Drop your order .xlsx here or click to browse
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Format: Manufacturer Code, BBCode, Item Name, Qty, Unit Price, …
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {file && !validation?.valid && (
        <div className="flex justify-end">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {validating ? 'Validating…' : 'Validate Items'}
          </button>
        </div>
      )}

      {/* Valid: show order preview + PO form */}
      {validation?.valid && !createdPO && (
        <>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              All {validation.total_items} items found in database
            </span>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  {['Mfr Code', 'BB Code', 'Product Name', 'Qty', 'Unit Price (USD)', 'Total (USD)'].map(h => (
                    <th key={h} className={TABLE_CLASSES.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validation.items!.map((it, i) => (
                  <tr key={i} className={TABLE_CLASSES.tr}>
                    <td className={TABLE_CLASSES.td}>{it.manufacturer_code}</td>
                    <td className={TABLE_CLASSES.td}>{it.bb_code}</td>
                    <td className={TABLE_CLASSES.td}>{it.product_name || it.item_name}</td>
                    <td className={TABLE_CLASSES.td}>{it.qty.toLocaleString()}</td>
                    <td className={TABLE_CLASSES.td}>${it.unit_price.toFixed(2)}</td>
                    <td className={TABLE_CLASSES.td}>${(it.qty * it.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900">
                  <td colSpan={5} className={`${TABLE_CLASSES.td} font-semibold text-right`}>Total</td>
                  <td className={`${TABLE_CLASSES.td} font-semibold`}>${totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* PO creation form */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create Purchase Order on Zoho</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendor */}
              <div className="relative">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Vendor <span className="text-red-500">*</span>
                  {validation?.detected_vendor && selectedVendor?.contact_id === validation.detected_vendor.contact_id && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(auto-detected)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => handleVendorSearchChange(e.target.value)}
                  onFocus={handleVendorFocus}
                  placeholder="Search vendor…"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showVendorDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {vendorsLoading ? (
                      <div className="p-3 text-sm text-zinc-500 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                      </div>
                    ) : vendors.length === 0 ? (
                      <div className="p-3 text-sm text-zinc-500">No vendors found</div>
                    ) : (
                      vendors.map((v) => (
                        <button
                          key={v.contact_id}
                          onClick={() => selectVendor(v)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex justify-between"
                        >
                          <span>{v.contact_name}</span>
                          {v.currency_code && (
                            <span className="text-zinc-400 text-xs">{v.currency_code}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* PO Date */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  PO Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  PO Number
                </label>
                <input
                  type="text"
                  value={purchaseorderNumber}
                  onChange={(e) => setPurchaseorderNumber(e.target.value)}
                  placeholder="Optional PO number…"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional reference…"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes…"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleCreatePO}
                disabled={creating || !selectedVendor || !poDate}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {creating ? 'Creating…' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Success state */}
      {createdPO && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="w-6 h-6" />
            <h2 className="text-lg font-semibold">Purchase Order Created</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">PO Number</p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{createdPO.purchaseorder_number}</p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Vendor</p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{createdPO.vendor_name}</p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Date</p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{createdPO.date}</p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Total</p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {createdPO.currency_code} {Number(createdPO.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Upload another order
          </button>
        </div>
      )}

      {/* Missing items modal */}
      {showMissingModal && validation && !validation.valid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <h2 className="text-lg font-semibold">Missing Items</h2>
              </div>
              <button onClick={() => setShowMissingModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {validation.missing_count} item{validation.missing_count !== 1 ? 's' : ''} were not found in the database.
              Please add {validation.missing_count !== 1 ? 'them' : 'it'} via the Items page and re-upload.
            </p>

            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Mfr Code</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">BB Code</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Item Name</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.missing_items!.map((m, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{m.manufacturer_code || '—'}</td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{m.bb_code || '—'}</td>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{m.item_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowMissingModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => { setShowMissingModal(false); handleValidate(); }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Re-validate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
