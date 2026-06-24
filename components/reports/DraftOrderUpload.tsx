'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, ShoppingCart, Loader2, Trash2, RefreshCw, Package, ExternalLink } from 'lucide-react';
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
  hsn_or_sac?: string;
  sku_code?: string;
  category?: string;
  sub_category?: string;
  series?: string;
  brand?: string;
  mrp?: number | null;
  tax_rate?: number;
  upc_code?: string;
  ean_code?: string;
}

type ItemEdits = Record<string, { tax_rate: number; upc_code: string; ean_code: string }>;

interface DetectedVendor {
  contact_id: string;
  contact_name: string;
  currency_code: string;
}

interface VendorBrand {
  name: string;
  vendors: Array<{ contact_id: string; contact_name: string; currency_code?: string }>;
}

interface InactiveItem {
  manufacturer_code: string;
  bb_code: string;
  item_name: string;
  status: string;
}

interface ValidationResult {
  valid: boolean;
  items?: OrderItem[];
  missing_items?: MissingItem[];
  inactive_items?: InactiveItem[];
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

// ── per-currency group form state ──────────────────────────────────────────
interface CurrencyGroupState {
  selectedVendor: DetectedVendor | null;
  poDate: string;
  notes: string;
  referenceNumber: string;
  purchaseorderNumber: string;
  saving: boolean;
  savedDraftId: string | null;
  creating: boolean;
  createdPO: any | null;
  poAlreadyCreated: boolean;
}

function defaultGroupState(): CurrencyGroupState {
  return {
    selectedVendor: null,
    poDate: new Date().toISOString().slice(0, 10),
    notes: '',
    referenceNumber: '',
    purchaseorderNumber: '',
    saving: false,
    savedDraftId: null,
    creating: false,
    createdPO: null,
    poAlreadyCreated: false,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────
function currencySym(code?: string) {
  if (code === 'CNY') return '¥';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return '$';
}

function poStatusChipClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'issued' || s === 'open') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  if (s === 'received' || s === 'closed' || s === 'billed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (s === 'cancelled' || s === 'void') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  if (s === 'draft' || s === 'pending approval') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function groupItemsByCurrency(items: OrderItem[]): Record<string, OrderItem[]> {
  const groups: Record<string, OrderItem[]> = {};
  for (const it of items) {
    const c = it.currency || 'USD';
    if (!groups[c]) groups[c] = [];
    groups[c].push(it);
  }
  return groups;
}

// ── component ──────────────────────────────────────────────────────────────
export default function DraftOrderUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<DetectedVendor[]>([]);
  const [creatingZohoItems, setCreatingZohoItems] = useState(false);
  const [zohoItemResults, setZohoItemResults] = useState<{ created: any[]; failed: any[]; skipped?: any[]; masters_sheet?: { inserted: number; error?: string | null } } | null>(null);
  const [itemEdits, setItemEdits] = useState<ItemEdits>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Per-currency group states keyed by currency code
  const [groups, setGroups] = useState<Record<string, CurrencyGroupState>>({});

  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const [vendorBrands, setVendorBrands] = useState<VendorBrand[]>([]);
  const [creatingBrandOrder, setCreatingBrandOrder] = useState<Record<string, boolean>>({});
  const [brandOrderCreated, setBrandOrderCreated] = useState<Record<string, boolean>>({});
  const [brandPickerFor, setBrandPickerFor] = useState<{
    key: string; vendorId: string; poNumber: string; poDate: string;
  } | null>(null);

  // re-upload mode — tracks which existing draft/PO is being overwritten
  const [reuploadMode, setReuploadMode] = useState<{
    draftId: string; poNumber: string; previousItems: OrderItem[];
  } | null>(null);
  const [showReuploadConfirm, setShowReuploadConfirm] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<ValidationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  // ── draft list ─────────────────────────────────────────────────────────
  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const [draftsRes, brandOrdersRes] = await Promise.all([
        axios.get<DraftOrder[]>(`${API_URL}/vendors/draft_orders`),
        axios.get<{ purchaseorder_number: string | null }[]>(`${API_URL}/brand_orders/`).catch(() => ({ data: [] })),
      ]);
      setDraftOrders(draftsRes.data);

      // Pre-populate brandOrderCreated for any draft whose PO already has a brand order
      const linkedPOs = new Set(
        brandOrdersRes.data
          .map((o) => o.purchaseorder_number)
          .filter(Boolean)
      );
      setBrandOrderCreated(prev => {
        const next = { ...prev };
        for (const draft of draftsRes.data) {
          const key = `draft_${draft._id}`;
          if (draft.po_number && linkedPOs.has(draft.po_number)) {
            next[key] = true;
          }
        }
        return next;
      });
    } catch {
      toast.error('Failed to load draft orders');
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
    axios.get<{ brands: VendorBrand[] }>(`${API_URL}/vendors/brands`)
      .then(r => setVendorBrands(r.data.brands || []))
      .catch(() => { });
  }, [fetchDrafts]);

  // ── reset ──────────────────────────────────────────────────────────────
  const reset = () => {
    setFile(null);
    setValidation(null);
    setAvailableVendors([]);
    setGroups({});
    setReuploadMode(null);
    setShowReuploadConfirm(false);
    setPendingValidation(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── start re-upload mode ───────────────────────────────────────────────
  const handleStartReupload = (draft: DraftOrder) => {
    reset();
    setReuploadMode({
      draftId: draft._id,
      poNumber: draft.po_number!,
      previousItems: draft.items ?? [],
    });
    setTimeout(() => uploadAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // ── confirm re-upload (after user approves the overwrite dialog) ────────
  const handleConfirmReupload = () => {
    if (!pendingValidation || !reuploadMode) return;
    setShowReuploadConfirm(false);

    const data = pendingValidation;
    setPendingValidation(null);

    const vendors = data.detected_vendors ?? [];
    setAvailableVendors(vendors);
    setValidation(data);

    const currencyGroups = groupItemsByCurrency(data.items ?? []);
    const initialGroups: Record<string, CurrencyGroupState> = {};
    for (const currency of Object.keys(currencyGroups)) {
      const gs = defaultGroupState();
      const matchedVendor = vendors.find(v => v.currency_code === currency) ?? null;
      gs.selectedVendor = matchedVendor ?? (vendors.length === 1 ? vendors[0] : null);
      // Pre-fill existing PO number and mark draft as already saved
      gs.purchaseorderNumber = reuploadMode.poNumber;
      gs.savedDraftId = reuploadMode.draftId;
      initialGroups[currency] = gs;
    }
    setGroups(initialGroups);
  };

  // ── file handling ──────────────────────────────────────────────────────
  const handleFileChange = (f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) { toast.error('Please upload a .xlsx file'); return; }
    setFile(f);
    setValidation(null);
    setGroups({});
    setAvailableVendors([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileChange(e.dataTransfer.files[0] ?? null);
  };

  // ── create missing items on Zoho ──────────────────────────────────────
  const handleCreateZohoItems = async (items: MissingItem[]) => {
    setCreatingZohoItems(true);
    setZohoItemResults(null);
    try {
      const { data } = await axios.post<{ created: any[]; failed: any[]; skipped?: any[] }>(
        `${API_URL}/vendors/draft_orders/create_zoho_items`,
        {
          items: items.map(m => {
            const key = m.bb_code || m.manufacturer_code;
            const edits = itemEdits[key] ?? {};
            return {
              item_name: m.item_name,
              manufacturer_code: m.manufacturer_code,
              bb_code: m.bb_code,
              sku_code: m.sku_code || '',
              hsn_or_sac: m.hsn_or_sac || '',
              category: m.category || '',
              sub_category: m.sub_category || '',
              series: m.series || '',
              brand: m.brand || '',
              mrp: m.mrp ?? null,
              tax_rate: edits.tax_rate ?? m.tax_rate ?? 18,
              upc_code: edits.upc_code ?? m.upc_code ?? m.sku_code ?? '',
              ean_code: edits.ean_code ?? m.ean_code ?? m.sku_code ?? '',
            };
          }),
        },
      );
      setZohoItemResults(data);
      const skippedCount = data.skipped?.length ?? 0;
      const skippedMsg = skippedCount > 0 ? `, ${skippedCount} already existed` : '';
      if (data.failed.length === 0) {
        toast.success(`${data.created.length} item${data.created.length !== 1 ? 's' : ''} created on Zoho${skippedMsg}`);
      } else {
        toast.warn(`${data.created.length} created, ${data.failed.length} failed${skippedMsg}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create items on Zoho');
    } finally {
      setCreatingZohoItems(false);
    }
  };

  // ── item field editing with debounced DB save ──────────────────────────
  const updateItemEdit = useCallback((
    item: MissingItem,
    field: 'tax_rate' | 'upc_code' | 'ean_code',
    value: number | string,
  ) => {
    const key = item.bb_code || item.manufacturer_code;
    setItemEdits(prev => {
      const existing = prev[key] ?? {
        tax_rate: item.tax_rate ?? 18,
        upc_code: item.upc_code ?? item.sku_code ?? '',
        ean_code: item.ean_code ?? item.sku_code ?? '',
      };
      const updated = { ...existing, [field]: value };
      // Debounce save to DB
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        axios.put(`${API_URL}/vendors/draft_orders/pending_item`, {
          bb_code: item.bb_code || '',
          manufacturer_code: item.manufacturer_code || '',
          tax_rate: updated.tax_rate,
          upc_code: updated.upc_code,
          ean_code: updated.ean_code,
        }).catch(() => { });
      }, 600);
      return { ...prev, [key]: updated };
    });
  }, []);

  // ── validate ───────────────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidation(null);
    setGroups({});
    setZohoItemResults(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post<ValidationResult>(`${API_URL}/vendors/draft_orders/validate`, form);
      if (!data.valid) {
        setValidation(data);
        // Seed itemEdits from server-merged saved values (tax_rate, upc_code, ean_code)
        const edits: ItemEdits = {};
        for (const m of data.missing_items ?? []) {
          const key = m.bb_code || m.manufacturer_code;
          edits[key] = {
            tax_rate: m.tax_rate ?? 18,
            upc_code: m.upc_code ?? m.sku_code ?? '',
            ean_code: m.ean_code ?? m.sku_code ?? '',
          };
        }
        setItemEdits(edits);
        setShowMissingModal(true);
      } else if (reuploadMode) {
        // In re-upload mode: store result and ask for confirmation before touching groups
        setPendingValidation(data);
        setShowReuploadConfirm(true);
      } else {
        setValidation(data);
        const vendors = data.detected_vendors ?? [];
        setAvailableVendors(vendors);

        // Initialise one group state per currency found in items
        const currencyGroups = groupItemsByCurrency(data.items as any ?? {});
        const initialGroups: Record<string, CurrencyGroupState> = {};
        const vendorFetches: Promise<void>[] = [];
        for (const currency of Object.keys(currencyGroups)) {
          const gs = defaultGroupState();
          // Auto-select vendor whose currency_code matches
          const matchedVendor = vendors.find(v => v.currency_code === currency) ?? null;
          if (!matchedVendor && vendors.length === 1) {
            gs.selectedVendor = vendors[0];
          } else {
            gs.selectedVendor = matchedVendor;
          }
          initialGroups[currency] = gs;
          if (gs.selectedVendor) {
            vendorFetches.push(
              axios.get<{ last_po_number: string | null; next_po_number: string | null }>(
                `${API_URL}/vendors/draft_orders/last_po_number`,
                { params: { vendor_id: gs.selectedVendor.contact_id } }
              ).then(({ data: poData }) => {
                if (poData.next_po_number) {
                  initialGroups[currency].purchaseorderNumber = poData.next_po_number;
                }
              }).catch(() => { })
            );
          }
        }
        await Promise.all(vendorFetches);
        setGroups(initialGroups);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  // ── group state helpers ────────────────────────────────────────────────
  const updateGroup = (currency: string, patch: Partial<CurrencyGroupState>) => {
    setGroups(prev => ({ ...prev, [currency]: { ...prev[currency], ...patch } }));
  };

  const fetchAndSetNextPoNumber = async (currency: string, vendorId: string) => {
    try {
      const { data } = await axios.get<{ last_po_number: string | null; next_po_number: string | null }>(
        `${API_URL}/vendors/draft_orders/last_po_number`,
        { params: { vendor_id: vendorId } }
      );
      if (data.next_po_number) {
        updateGroup(currency, { purchaseorderNumber: data.next_po_number });
      }
    } catch {
      // silently ignore — user can enter manually
    }
  };

  // ── save draft (per currency) ──────────────────────────────────────────
  const handleSaveDraft = async (currency: string, items: OrderItem[]) => {
    const gs = groups[currency];
    if (!gs?.selectedVendor) return;
    updateGroup(currency, { saving: true });
    try {
      const { data } = await axios.post<DraftOrder>(`${API_URL}/vendors/draft_orders/save`, {
        items,
        detected_vendor: gs.selectedVendor,
        date: gs.poDate,
        notes: gs.notes,
        reference_number: gs.referenceNumber,
        purchaseorder_number: gs.purchaseorderNumber,
      });
      updateGroup(currency, { savedDraftId: data._id });
      toast.success(`Draft saved (${currency})`);
      await fetchDrafts();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save draft');
    } finally {
      updateGroup(currency, { saving: false });
    }
  };

  // ── create / update PO (per currency) ─────────────────────────────────
  const handleCreatePO = async (currency: string, items: OrderItem[]) => {
    const gs = groups[currency];
    if (!gs?.selectedVendor) return;
    updateGroup(currency, { creating: true });
    try {
      if (reuploadMode) {
        const { data } = await axios.post(
          `${API_URL}/vendors/draft_orders/${reuploadMode.draftId}/update_po`,
          {
            contact_id: gs.selectedVendor.contact_id,
            date: gs.poDate,
            items,
            notes: gs.notes,
            reference_number: gs.referenceNumber,
            purchaseorder_number: gs.purchaseorderNumber,
          },
        );
        updateGroup(currency, { createdPO: data });
        toast.success(`PO ${data.purchaseorder_number} updated`);
        setReuploadMode(null);
        await fetchDrafts();
        return;
      }

      let draftId = gs.savedDraftId;
      if (!draftId) {
        const { data: draft } = await axios.post<DraftOrder>(`${API_URL}/vendors/draft_orders/save`, {
          items,
          detected_vendor: gs.selectedVendor,
          date: gs.poDate,
          notes: gs.notes,
          reference_number: gs.referenceNumber,
          purchaseorder_number: gs.purchaseorderNumber,
        });
        draftId = draft._id;
        updateGroup(currency, { savedDraftId: draftId });
      }

      const { data } = await axios.post(`${API_URL}/vendors/draft_orders/create_po`, {
        contact_id: gs.selectedVendor.contact_id,
        date: gs.poDate,
        items,
        notes: gs.notes,
        reference_number: gs.referenceNumber,
        purchaseorder_number: gs.purchaseorderNumber,
        draft_id: draftId,
      });
      updateGroup(currency, { createdPO: data });
      toast.success(`PO ${data.purchaseorder_number} created (${currency})`);
      await fetchDrafts();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || (reuploadMode ? 'Failed to update purchase order' : 'Failed to create purchase order'));
    } finally {
      updateGroup(currency, { creating: false });
    }
  };

  // ── load draft ─────────────────────────────────────────────────────────
  const handleLoadDraft = (draft: DraftOrder) => {
    const items = draft.items ?? [];
    const currencyGroups = groupItemsByCurrency(items);
    const currencies = Object.keys(currencyGroups);
    const vendors = draft.detected_vendor ? [draft.detected_vendor] : [];
    setAvailableVendors(vendors);

    const initialGroups: Record<string, CurrencyGroupState> = {};
    for (const currency of currencies) {
      initialGroups[currency] = {
        selectedVendor: draft.detected_vendor,
        poDate: draft.date || new Date().toISOString().slice(0, 10),
        notes: draft.notes || '',
        referenceNumber: draft.reference_number || '',
        purchaseorderNumber: draft.purchaseorder_number || '',
        saving: false,
        savedDraftId: currencies.length === 1 ? draft._id : null,
        creating: false,
        createdPO: null,
        poAlreadyCreated: currencies.length === 1 ? draft.po_created : false,
      };
    }

    setValidation({ valid: true, items, total_items: items.length });
    setGroups(initialGroups);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/vendors/draft_orders/${id}`);
      setDraftOrders(prev => prev.filter(d => d._id !== id));
      toast.success('Draft deleted');
    } catch {
      toast.error('Failed to delete draft');
    }
  };

  // ── brand order creation ───────────────────────────────────────────────
  const getBrandsForVendor = (vendorId: string) =>
    vendorBrands.filter(b => b.vendors.some(v => v.contact_id === vendorId));

  const handleCreateBrandOrder = async (key: string, vendorId: string, poNumber: string, poDate: string, brandName?: string) => {
    if (!brandName) {
      const matches = getBrandsForVendor(vendorId);
      if (matches.length === 0) { toast.error('No brand mapping found for this vendor'); return; }
      if (matches.length > 1) { setBrandPickerFor({ key, vendorId, poNumber, poDate }); return; }
      brandName = matches[0].name;
    }
    setCreatingBrandOrder(p => ({ ...p, [key]: true }));
    try {
      const form = new FormData();
      form.append('brand', brandName!);
      form.append('vendor_id', vendorId);
      form.append('purchaseorder_number', poNumber);
      if (poDate) form.append('order_date', poDate);
      await axios.post(`${API_URL}/brand_orders/`, form);
      toast.success(`Brand order created for PO ${poNumber}`);
      setBrandOrderCreated(p => ({ ...p, [key]: true }));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create brand order');
    } finally {
      setCreatingBrandOrder(p => ({ ...p, [key]: false }));
    }
  };

  // ── currency group section ─────────────────────────────────────────────
  const renderCurrencyGroup = (currency: string, items: OrderItem[], isMultiCurrency: boolean) => {
    const gs = groups[currency] ?? defaultGroupState();
    const sym = currencySym(currency);
    const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const vendorsForGroup = availableVendors.length > 0
      ? availableVendors
      : gs.selectedVendor ? [gs.selectedVendor] : [];

    return (
      <div key={currency} className="space-y-4">
        {isMultiCurrency && (
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              {currency} Order — {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Subtotal: {sym}{subtotal.toFixed(2)}
            </span>
          </div>
        )}

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
              {items.map((it, i) => (
                <tr key={i} className={TABLE_CLASSES.tr}>
                  <td className={TABLE_CLASSES.td}>{it.manufacturer_code}</td>
                  <td className={TABLE_CLASSES.td}>{it.bb_code}</td>
                  <td className={TABLE_CLASSES.td}>{it.product_name || it.item_name}</td>
                  <td className={TABLE_CLASSES.td}>{it.qty.toLocaleString()}</td>
                  <td className={TABLE_CLASSES.td}>{sym}{it.unit_price.toFixed(2)}</td>
                  <td className={TABLE_CLASSES.td}>{sym}{(it.qty * it.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900">
                <td colSpan={5} className={`${TABLE_CLASSES.td} font-semibold text-right`}>Total ({currency})</td>
                <td className={`${TABLE_CLASSES.td} font-semibold`}>{sym}{subtotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* PO creation form */}
        {!gs.createdPO && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Create Purchase Order{isMultiCurrency ? ` — ${currency}` : ''} on Zoho
            </h2>

            {gs.poAlreadyCreated && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Purchase order already created for this draft.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Vendor
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(auto-detected from first product)</span>
                </label>
                {gs.selectedVendor ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{gs.selectedVendor.contact_name}</span>
                    {gs.selectedVendor.currency_code && (
                      <span className="ml-auto text-xs text-zinc-400">{gs.selectedVendor.currency_code}</span>
                    )}
                    {vendorsForGroup.length > 1 && !gs.poAlreadyCreated && (
                      <button
                        onClick={() => updateGroup(currency, { selectedVendor: null })}
                        className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : vendorsForGroup.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Select vendor for this {currency} order:</p>
                    <div className="flex flex-wrap gap-2">
                      {vendorsForGroup.map(v => (
                        <button
                          key={v.contact_id}
                          onClick={() => {
                            updateGroup(currency, { selectedVendor: v });
                            fetchAndSetNextPoNumber(currency, v.contact_id);
                          }}
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
                  value={gs.poDate}
                  onChange={(e) => updateGroup(currency, { poDate: e.target.value })}
                  disabled={gs.poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  PO Number
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(auto-incremented from last PO)</span>
                </label>
                <input
                  type="text"
                  value={gs.purchaseorderNumber}
                  onChange={(e) => updateGroup(currency, { purchaseorderNumber: e.target.value })}
                  placeholder="e.g. PO-00123"
                  disabled={gs.poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={gs.referenceNumber}
                  onChange={(e) => updateGroup(currency, { referenceNumber: e.target.value })}
                  placeholder="Optional reference…"
                  disabled={gs.poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={gs.notes}
                  onChange={(e) => updateGroup(currency, { notes: e.target.value })}
                  placeholder="Optional notes…"
                  disabled={gs.poAlreadyCreated}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => handleSaveDraft(currency, items)}
                disabled={gs.saving || !!gs.savedDraftId || !gs.selectedVendor || gs.poAlreadyCreated}
                className="flex items-center gap-2 px-5 py-2.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
              >
                {gs.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {gs.savedDraftId ? 'Draft Saved' : gs.saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleCreatePO(currency, items)}
                disabled={gs.creating || !gs.selectedVendor || !gs.poDate || gs.poAlreadyCreated}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {gs.creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {gs.creating
                  ? (reuploadMode ? 'Updating…' : 'Creating…')
                  : (reuploadMode ? 'Update Purchase Order' : 'Create Purchase Order')}
              </button>
            </div>
          </div>
        )}

        {/* Success state */}
        {gs.createdPO && (() => {
          const vendorId = gs.selectedVendor?.contact_id ?? '';
          const matchedBrands = getBrandsForVendor(vendorId);
          const singleBrand = matchedBrands.length === 1 ? matchedBrands[0].name : null;
          const key = currency;
          return (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Purchase Order Created{isMultiCurrency ? ` (${currency})` : ''}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400">PO Number</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{gs.createdPO.purchaseorder_number}</p>
                </div>
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400">Vendor</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{gs.createdPO.vendor_name}</p>
                </div>
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400">Brand</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {matchedBrands.length === 0 ? <span className="text-zinc-400">—</span> : matchedBrands.map(b => b.name).join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400">Total</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {gs.createdPO.currency_code} {Number(gs.createdPO.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end pt-2 border-t border-green-200 dark:border-green-800">
                {brandOrderCreated[key] ? (
                  <button
                    onClick={() => router.push(`/brand_orders?po=${encodeURIComponent(gs.createdPO.purchaseorder_number)}`)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Visit Brand Order
                  </button>
                ) : (
                  <button
                    onClick={() => handleCreateBrandOrder(key, vendorId, gs.createdPO.purchaseorder_number, gs.poDate, singleBrand ?? undefined)}
                    disabled={creatingBrandOrder[key] || matchedBrands.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {creatingBrandOrder[key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                    {creatingBrandOrder[key] ? 'Creating…' : 'Create Brand Order'}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── main render ────────────────────────────────────────────────────────
  const currencyGroups = validation?.valid ? groupItemsByCurrency(validation.items ?? []) : {};
  const currencies = Object.keys(currencyGroups);
  const isMultiCurrency = currencies.length > 1;
  const allPOsCreated = currencies.length > 0 && currencies.every(c => groups[c]?.createdPO);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
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
                  {['Brand', 'Date', 'Items', 'Status', 'PO Status', 'PO Number', 'Actions'].map(h => (
                    <th key={h} className={TABLE_CLASSES.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_CLASSES.tbody}>
                {draftOrders.map(draft => {
                  const draftBrands = getBrandsForVendor(draft.detected_vendor?.contact_id ?? '');
                  const draftBrandLabel = draftBrands.length === 0 ? '—' : draftBrands.map(b => b.name).join(', ');
                  const draftKey = `draft_${draft._id}`;
                  const canCreateBrandOrder = draft.po_created && !!draft.po_number && draftBrands.length > 0;
                  return (
                    <tr key={draft._id} className={TABLE_CLASSES.tr}>
                      <td className={TABLE_CLASSES.td}>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{draftBrandLabel}</span>
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
                            PO Created
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        {draft.po_status ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${poStatusChipClass(draft.po_status)}`}>
                            {draft.po_status}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>
                      <td className={TABLE_CLASSES.td}>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {draft.po_number || <span className="text-zinc-400 text-xs">—</span>}
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
                          {draft.po_created && draft.po_number && (
                            <button
                              onClick={() => handleStartReupload(draft)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              title="Re-upload a new file to overwrite this PO"
                            >
                              <RefreshCw size={11} />
                              Re-upload
                            </button>
                          )}
                          {canCreateBrandOrder && (
                            brandOrderCreated[draftKey] ? (
                              <button
                                onClick={() => router.push(`/brand_orders?po=${encodeURIComponent(draft.po_number!)}`)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <ExternalLink size={11} /> Visit Brand Order
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCreateBrandOrder(
                                  draftKey,
                                  draft.detected_vendor!.contact_id,
                                  draft.po_number!,
                                  draft.date,
                                  draftBrands.length === 1 ? draftBrands[0].name : undefined,
                                )}
                                disabled={creatingBrandOrder[draftKey]}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
                                title="Create Brand Order"
                              >
                                {creatingBrandOrder[draftKey] ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />}
                                {creatingBrandOrder[draftKey] ? 'Creating…' : 'Brand Order'}
                              </button>
                            )
                          )}
                          <button
                            onClick={() => handleDeleteDraft(draft._id)}
                            disabled={brandOrderCreated[draftKey]}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-zinc-400"
                            title={brandOrderCreated[draftKey] ? 'Cannot delete — brand order exists' : 'Delete draft'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload area */}
      {!validation?.valid && (
        <div ref={uploadAreaRef} className="space-y-4">
          {reuploadMode && (
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                <RefreshCw className="w-4 h-4 flex-shrink-0" />
                <span>
                  Re-uploading for <strong>{reuploadMode.poNumber}</strong> — the uploaded file will overwrite this PO on Zoho
                </span>
              </div>
              <button
                onClick={reset}
                className="text-xs font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 ml-4 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
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

      {/* Valid: show per-currency groups */}
      {validation?.valid && (
        <>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              {validation.total_items} item{validation.total_items !== 1 ? 's' : ''} found in database
              {(validation.inactive_items?.length ?? 0) > 0 && ` — ${validation.inactive_items!.length} inactive/deleted excluded`}
              {isMultiCurrency && ` — split into ${currencies.length} currency orders`}
            </span>
          </div>

          {(validation.inactive_items?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {validation.inactive_items!.length} item{validation.inactive_items!.length !== 1 ? 's' : ''} excluded — inactive or deleted in Zoho
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100/60 dark:bg-amber-900/30">
                    <tr>
                      {['Mfr Code', 'BB Code', 'Item Name', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validation.inactive_items!.map((m, i) => (
                      <tr key={i} className="border-t border-amber-100 dark:border-amber-800">
                        <td className="px-3 py-2 text-amber-900 dark:text-amber-200">{m.manufacturer_code || '—'}</td>
                        <td className="px-3 py-2 text-amber-900 dark:text-amber-200">{m.bb_code || '—'}</td>
                        <td className="px-3 py-2 text-amber-900 dark:text-amber-200">{m.item_name}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 capitalize">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isMultiCurrency && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
              This order contains items in multiple currencies ({currencies.join(', ')}). Each currency group will be created as a separate purchase order.
            </div>
          )}

          <div className={isMultiCurrency ? 'space-y-10 divide-y divide-zinc-200 dark:divide-zinc-800' : 'space-y-4'}>
            {currencies.map(currency => (
              <div key={currency} className={isMultiCurrency ? 'pt-6 first:pt-0' : ''}>
                {renderCurrencyGroup(currency, currencyGroups[currency], isMultiCurrency)}
              </div>
            ))}
          </div>

          {allPOsCreated && (
            <div className="flex justify-center pt-4">
              <button
                onClick={reset}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Upload another order
              </button>
            </div>
          )}
        </>
      )}

      {/* Re-upload confirmation modal */}
      {showReuploadConfirm && pendingValidation && reuploadMode && (() => {
        const newItems = pendingValidation.items ?? [];
        const oldCodes = new Set(reuploadMode.previousItems.map(i => i.bb_code || i.manufacturer_code));
        const newCodes = new Set(newItems.map(i => i.bb_code || i.manufacturer_code));
        const addedCount = newItems.filter(i => !oldCodes.has(i.bb_code || i.manufacturer_code)).length;
        const removedCount = reuploadMode.previousItems.filter(i => !newCodes.has(i.bb_code || i.manufacturer_code)).length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <h2 className="text-base font-semibold">Overwrite {reuploadMode.poNumber}?</h2>
                </div>
                <button
                  onClick={() => { setShowReuploadConfirm(false); setPendingValidation(null); }}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                The existing Zoho PO will be replaced with the items from the new file. This cannot be undone.
              </p>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2">
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{newItems.length}</p>
                  <p className="text-xs text-zinc-500">Total items</p>
                </div>
                <div className={`rounded-lg px-3 py-2 ${addedCount > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                  <p className={`text-lg font-bold ${addedCount > 0 ? 'text-green-700 dark:text-green-400' : 'text-zinc-400'}`}>+{addedCount}</p>
                  <p className="text-xs text-zinc-500">New</p>
                </div>
                <div className={`rounded-lg px-3 py-2 ${removedCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                  <p className={`text-lg font-bold ${removedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>−{removedCount}</p>
                  <p className="text-xs text-zinc-500">Removed</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => { setShowReuploadConfirm(false); setPendingValidation(null); }}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReupload}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                >
                  Yes, overwrite PO
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Brand picker modal */}
      {brandPickerFor && (() => {
        const matchedBrands = getBrandsForVendor(brandPickerFor.vendorId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Select Brand</h2>
                <button onClick={() => setBrandPickerFor(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Multiple brands are mapped to this vendor. Choose which brand to create the order under.
              </p>
              <div className="space-y-2">
                {matchedBrands.map(b => (
                  <button
                    key={b.name}
                    onClick={() => {
                      const { key, vendorId, poNumber, poDate } = brandPickerFor;
                      setBrandPickerFor(null);
                      handleCreateBrandOrder(key, vendorId, poNumber, poDate, b.name);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-colors text-left"
                  >
                    <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Missing items modal */}
      {showMissingModal && validation && !validation.valid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-[90vw] sm:max-w-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <h2 className="text-lg font-semibold">Missing Items</h2>
              </div>
              <button onClick={() => setShowMissingModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 flex-shrink-0">
              {validation.missing_count} item{validation.missing_count !== 1 ? 's' : ''} were not found in the database.
              You can create {validation.missing_count !== 1 ? 'them' : 'it'} directly on Zoho Books, then re-validate.
            </p>

            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                  <tr>
                    {['Mfr Code', 'BB Code', 'Item Name', 'HSN', 'Category', 'Series', 'MRP', 'SKU / UPC / EAN', 'Tax Rate'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validation.missing_items!.map((m, i) => {
                    const key = m.bb_code || m.manufacturer_code;
                    const edits = itemEdits[key] ?? { tax_rate: m.tax_rate ?? 18, upc_code: m.upc_code ?? m.sku_code ?? '', ean_code: m.ean_code ?? m.sku_code ?? '' };
                    const isCreated = zohoItemResults?.created.some(c => c.bb_code === m.bb_code && c.manufacturer_code === m.manufacturer_code);
                    const isFailed = zohoItemResults?.failed.find(f => f.bb_code === m.bb_code && f.manufacturer_code === m.manufacturer_code);
                    const isSkipped = zohoItemResults?.skipped?.some(s => s.bb_code === m.bb_code && s.manufacturer_code === m.manufacturer_code);
                    const isDone = isCreated || isSkipped;
                    return (
                      <tr key={i} className={`border-t border-zinc-100 dark:border-zinc-800 ${isCreated ? 'bg-green-50 dark:bg-green-900/20' : isSkipped ? 'bg-zinc-100 dark:bg-zinc-800/40' : isFailed ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                        <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200 font-mono text-xs">{m.manufacturer_code || '—'}</td>
                        <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200 font-mono text-xs">{m.bb_code || '—'}</td>
                        <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                          <div className="flex items-center gap-2">
                            {m.item_name}
                            {isCreated && <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Created</span>}
                            {isSkipped && !isCreated && <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium" title="Already exists in Zoho — skipped to avoid a duplicate">↺ Already exists</span>}
                            {isFailed && <span className="text-xs text-red-600 dark:text-red-400 font-medium" title={isFailed.error}>✗ Failed</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 text-xs">{m.hsn_or_sac || '—'}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 text-xs">{[m.category, m.sub_category].filter(Boolean).join(' › ') || '—'}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 text-xs">{m.series || '—'}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 text-xs">{m.mrp != null ? `₹${m.mrp}` : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{m.sku_code || '—'}</span>
                            <input
                              type="text"
                              value={edits.upc_code}
                              onChange={e => updateItemEdit(m, 'upc_code', e.target.value)}
                              disabled={!!isDone}
                              placeholder="UPC"
                              className="w-full px-1.5 py-0.5 text-xs border border-zinc-200 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                            />
                            <input
                              type="text"
                              value={edits.ean_code}
                              onChange={e => updateItemEdit(m, 'ean_code', e.target.value)}
                              disabled={!!isDone}
                              placeholder="EAN"
                              className="w-full px-1.5 py-0.5 text-xs border border-zinc-200 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={edits.tax_rate}
                            onChange={e => updateItemEdit(m, 'tax_rate', parseInt(e.target.value))}
                            disabled={!!isDone}
                            className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-1.5 py-1 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                          >
                            <option value={5}>GST 5%</option>
                            <option value={12}>GST 12%</option>
                            <option value={18}>GST 18%</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between gap-3 pt-1 flex-shrink-0">
              <button
                onClick={() => setShowMissingModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
              <div className="flex gap-3">
                {zohoItemResults && (zohoItemResults.created.length > 0 || (zohoItemResults.skipped?.length ?? 0) > 0) && (
                  <button
                    onClick={() => { setShowMissingModal(false); handleValidate(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Re-validate
                  </button>
                )}
                {!zohoItemResults && (
                  <button
                    onClick={() => handleCreateZohoItems(validation.missing_items!)}
                    disabled={creatingZohoItems}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {creatingZohoItems ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                    {creatingZohoItems ? 'Creating…' : `Create ${validation.missing_count} Item${validation.missing_count !== 1 ? 's' : ''} on Zoho`}
                  </button>
                )}
                {zohoItemResults?.failed.length === 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 font-medium px-4 py-2">
                    <CheckCircle className="w-4 h-4" />
                    {(zohoItemResults.skipped?.length ?? 0) > 0
                      ? `Done — ${zohoItemResults.created.length} created, ${zohoItemResults.skipped!.length} already existed`
                      : 'All items created'}
                  </span>
                )}
                {zohoItemResults && zohoItemResults.failed.length > 0 && (
                  <button
                    onClick={() => handleCreateZohoItems(
                      validation.missing_items!.filter(m =>
                        zohoItemResults.failed.some(f => f.bb_code === m.bb_code && f.manufacturer_code === m.manufacturer_code)
                      )
                    )}
                    disabled={creatingZohoItems}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {creatingZohoItems ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Retry {zohoItemResults.failed.length} Failed
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
