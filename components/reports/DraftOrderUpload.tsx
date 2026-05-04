'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, ShoppingCart, Loader2, Trash2, RefreshCw } from 'lucide-react';
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
  currency?: string;
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
  detected_vendors?: DetectedVendor[];
}

interface DraftOrder {
  _id: string;
  description: string;
  detected_vendor: DetectedVendor | null;
  date: string;
  item_count: number;
  po_created: boolean;
  po_number?: string;
  po_status?: string;
  notes?: string;
  reference_number?: string;
  purchaseorder_number?: string;
  created_at: string;
  items: OrderItem[];
}

export default function DraftOrderUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState<DetectedVendor | null>(null);
  const [availableVendors, setAvailableVendors] = useState<DetectedVendor[]>([]);

  const [description, setDescription] = useState('');
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [purchaseorderNumber, setPurchaseorderNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdPO, setCreatedPO] = useState<any>(null);

  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [poAlreadyCreated, setPoAlreadyCreated] = useState(false);

  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const { data } = await axios.get<DraftOrder[]>(`${API_URL}/vendors/draft_orders`);
      setDraftOrders(data);
    } catch {
      toast.error('Failed to load draft orders');
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const reset = () => {
    setFile(null);
    setValidation(null);
    setCreatedPO(null);
    setSelectedVendor(null);
    setAvailableVendors([]);
    setDescription('');
    setNotes('');
    setReferenceNumber('');
    setPurchaseorderNumber('');
    setPoDate(new Date().toISOString().slice(0, 10));
    setSavedDraftId(null);
    setPoAlreadyCreated(false);
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
    setSavedDraftId(null);
    setAvailableVendors([]);
    setSelectedVendor(null);
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
    setSavedDraftId(null);
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
      } else {
        const vendors = data.detected_vendors ?? [];
        if (vendors.length === 1) {
          setSelectedVendor(vendors[0]);
          setAvailableVendors([]);
        } else if (vendors.length > 1) {
          setAvailableVendors(vendors);
          setSelectedVendor(null);
        } else {
          setAvailableVendors([]);
          setSelectedVendor(null);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!validation?.items || !selectedVendor) return;
    setSaving(true);
    try {
      const { data } = await axios.post<DraftOrder>(
        `${API_URL}/vendors/draft_orders/save`,
        {
          description,
          items: validation.items,
          detected_vendor: selectedVendor,
          date: poDate,
          notes,
          reference_number: referenceNumber,
          purchaseorder_number: purchaseorderNumber,
        },
      );
      setSavedDraftId(data._id);
      toast.success('Draft order saved');
      await fetchDrafts();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/vendors/draft_orders/${id}`);
      setDraftOrders(prev => prev.filter(d => d._id !== id));
      if (savedDraftId === id) setSavedDraftId(null);
      toast.success('Draft deleted');
    } catch {
      toast.error('Failed to delete draft');
    }
  };

  const handleLoadDraft = (draft: DraftOrder) => {
    setValidation({
      valid: true,
      items: draft.items,
      total_items: draft.items.length,
    });
    setSelectedVendor(draft.detected_vendor);
    setAvailableVendors([]);
    setDescription(draft.description || '');
    setPoDate(draft.date || new Date().toISOString().slice(0, 10));
    setNotes(draft.notes || '');
    setReferenceNumber(draft.reference_number || '');
    setPurchaseorderNumber(draft.purchaseorder_number || '');
    setSavedDraftId(draft._id);
    setPoAlreadyCreated(draft.po_created);
    setCreatedPO(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleCreatePO = async () => {
    if (!validation?.items || !selectedVendor) return;
    setCreating(true);
    try {
      let draftId = savedDraftId;
      if (!draftId) {
        const { data: draft } = await axios.post<DraftOrder>(
          `${API_URL}/vendors/draft_orders/save`,
          {
            description,
            items: validation.items,
            detected_vendor: selectedVendor,
            date: poDate,
            notes,
            reference_number: referenceNumber,
            purchaseorder_number: purchaseorderNumber,
          },
        );
        draftId = draft._id;
        setSavedDraftId(draftId);
      }

      const { data } = await axios.post(
        `${API_URL}/vendors/draft_orders/create_po`,
        {
          contact_id: selectedVendor.contact_id,
          date: poDate,
          items: validation.items,
          notes,
          reference_number: referenceNumber,
          purchaseorder_number: purchaseorderNumber,
          description,
          draft_id: draftId,
        },
      );
      setCreatedPO(data);
      toast.success(`Purchase Order ${data.purchaseorder_number} created on Zoho`);
      await fetchDrafts();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create purchase order');
    } finally {
      setCreating(false);
    }
  };


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

      {/* Draft orders list */}
      <div className={TABLE_CLASSES.container}>
        <div className={TABLE_CLASSES.headerSection + ' flex items-center justify-between'}>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Saved Draft Orders</h2>
          <button onClick={fetchDrafts} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors">
            <RefreshCw size={15} className={draftsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {draftsLoading && (
          <div className="py-8 text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {!draftsLoading && draftOrders.length === 0 && (
          <div className="py-8 text-center text-zinc-400 text-sm">No saved draft orders yet.</div>
        )}
        {!draftsLoading && draftOrders.length > 0 && (
          <div className={TABLE_CLASSES.overflow}>
            <table className={TABLE_CLASSES.table}>
              <thead className={TABLE_CLASSES.thead}>
                <tr>
                  {['Description', 'Vendor', 'Date', 'Items', 'Status', 'PO Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className={TABLE_CLASSES.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {draftOrders.map(draft => (
                  <tr key={draft._id} className={`${TABLE_CLASSES.tr} ${savedDraftId === draft._id ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                    <td className={TABLE_CLASSES.td}>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {draft.description || <span className="text-zinc-400 italic">—</span>}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {draft.detected_vendor?.contact_name || <span className="text-zinc-400">—</span>}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">{draft.date}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{draft.item_count}</span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      {draft.po_created ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          PO Created{draft.po_number ? ` — ${draft.po_number}` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      {draft.po_status ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {draft.po_status}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <span className="text-xs text-zinc-500">
                        {new Date(draft.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td className={TABLE_CLASSES.td}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadDraft(draft)}
                          className="px-3 py-1 text-xs font-medium rounded border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft._id)}
                          className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                          title="Delete draft"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload area */}
      {!validation?.valid && (
        <>
          {/* Description field */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Q2 restock — Brand X…"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
        </>
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
                  {['Mfr Code', 'BB Code', 'Product Name', 'Qty', 'Unit Price', 'Total'].map(h => (
                    <th key={h} className={TABLE_CLASSES.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validation.items!.map((it, i) => {
                  const sym = it.currency === 'CNY' ? '¥' : '$';
                  const tag = it.currency && it.currency !== 'USD'
                    ? <span className="ml-1 px-1 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{it.currency}</span>
                    : null;
                  return (
                    <tr key={i} className={TABLE_CLASSES.tr}>
                      <td className={TABLE_CLASSES.td}>{it.manufacturer_code}</td>
                      <td className={TABLE_CLASSES.td}>{it.bb_code}</td>
                      <td className={TABLE_CLASSES.td}>{it.product_name || it.item_name}</td>
                      <td className={TABLE_CLASSES.td}>{it.qty.toLocaleString()}</td>
                      <td className={TABLE_CLASSES.td}>{sym}{it.unit_price.toFixed(2)}{tag}</td>
                      <td className={TABLE_CLASSES.td}>{sym}{(it.qty * it.unit_price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {Object.entries(
                  validation.items!.reduce((acc, it) => {
                    const c = it.currency || 'USD';
                    acc[c] = (acc[c] || 0) + it.qty * it.unit_price;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([curr, subtotal]) => (
                  <tr key={curr} className="border-t border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900">
                    <td colSpan={5} className={`${TABLE_CLASSES.td} font-semibold text-right`}>Total ({curr})</td>
                    <td className={`${TABLE_CLASSES.td} font-semibold`}>
                      {curr === 'CNY' ? '¥' : '$'}{subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>

          {/* PO creation form */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create Purchase Order on Zoho</h2>

            {poAlreadyCreated && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Purchase order has already been created for this draft. Load a new draft or reset to create another.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Q2 restock — Brand X…"
                  disabled={poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Vendor — auto-detected; picker shown when brand has multiple vendors */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Vendor
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(auto-detected from first product)</span>
                </label>
                {selectedVendor ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{selectedVendor.contact_name}</span>
                    {selectedVendor.currency_code && (
                      <span className="ml-auto text-xs text-zinc-400">{selectedVendor.currency_code}</span>
                    )}
                    {availableVendors.length > 1 && !poAlreadyCreated && (
                      <button
                        onClick={() => setSelectedVendor(null)}
                        className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : availableVendors.length > 1 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">This brand has multiple vendors — select the currency for this order:</p>
                    <div className="flex flex-wrap gap-2">
                      {availableVendors.map(v => (
                        <button
                          key={v.contact_id}
                          onClick={() => setSelectedVendor(v)}
                          className="flex items-center gap-2 px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{v.contact_name}</span>
                          {v.currency_code && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{v.currency_code}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                    No vendor detected — set up vendor brand mapping first
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
                  disabled={poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  placeholder="Required PO number…"
                  disabled={poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  disabled={poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  disabled={poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleSaveDraft}
                disabled={saving || !!savedDraftId || !selectedVendor || poAlreadyCreated}
                className="flex items-center gap-2 px-5 py-2.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {savedDraftId ? 'Draft Saved' : saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                onClick={handleCreatePO}
                disabled={creating || !selectedVendor || !poDate || poAlreadyCreated}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
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
