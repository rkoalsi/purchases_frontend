'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from 'react-toastify';
import { Package, ChevronDown, Loader2, Search, X, Pencil, Plus, Check } from "lucide-react";
import axios from "axios";
import { TABLE_CLASSES, LoadingState } from "./TableStyles";

interface VendorInfo {
  contact_id: string;
  contact_name: string;
  currency_code?: string;
}

interface Brand {
  _id: string;
  name: string;
  vendors: VendorInfo[];
}

interface Vendor {
  vendor_id: string;
  contact_id: string;
  contact_name: string;
  currency_code?: string;
}

const MAX_VENDORS = 5;
const API_URL = process.env.NEXT_PUBLIC_API_URL;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function VendorBrandMapping() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [pendingVendors, setPendingVendors] = useState<VendorInfo[]>([]);
  const [savingBrandId, setSavingBrandId] = useState<string | null>(null);

  // Floating "add vendor" panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelAnchor, setPanelAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorResults, setVendorResults] = useState<Vendor[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);

  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const debouncedVendorSearch = useDebounce(vendorSearch, 300);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/vendors/brands`);
      setBrands(res.data.brands || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to fetch brands.');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = useCallback(async (search: string) => {
    setVendorLoading(true);
    try {
      const params: Record<string, any> = { page: 1, page_size: 50 };
      if (search) params.search = search;
      const res = await axios.get(`${API_URL}/vendors`, { params });
      setVendorResults(res.data.vendors || []);
    } catch {
      setVendorResults([]);
    } finally {
      setVendorLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrands(); }, []);

  useEffect(() => {
    if (panelOpen) fetchVendors(debouncedVendorSearch);
  }, [debouncedVendorSearch, panelOpen, fetchVendors]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !addBtnRef.current?.contains(target) &&
        !floatingRef.current?.contains(target)
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close panel on scroll
  useEffect(() => {
    if (!panelOpen) return;
    const handler = () => setPanelOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [panelOpen]);

  const enterEdit = (brand: Brand) => {
    setEditingBrandId(brand.name);
    setPendingVendors([...brand.vendors]);
    setPanelOpen(false);
  };

  const cancelEdit = () => {
    setEditingBrandId(null);
    setPendingVendors([]);
    setPanelOpen(false);
    setVendorSearch("");
  };

  const openPanel = () => {
    if (!addBtnRef.current) return;
    const rect = addBtnRef.current.getBoundingClientRect();
    const PANEL_HEIGHT = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow >= PANEL_HEIGHT) {
      setPanelAnchor({ top: rect.bottom + 4, left: rect.left });
    } else {
      setPanelAnchor({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
    }
    setPanelOpen(true);
    setVendorSearch("");
    fetchVendors("");
  };

  const toggleVendor = (vendor: Vendor) => {
    const alreadyIn = pendingVendors.some(v => v.contact_id === (vendor.contact_id || vendor.vendor_id));
    if (alreadyIn) {
      setPendingVendors(prev => prev.filter(v => v.contact_id !== (vendor.contact_id || vendor.vendor_id)));
    } else {
      if (pendingVendors.length >= MAX_VENDORS) {
        toast.warning(`Maximum ${MAX_VENDORS} vendors per brand`);
        return;
      }
      setPendingVendors(prev => [...prev, {
        contact_id: vendor.contact_id || vendor.vendor_id,
        contact_name: vendor.contact_name,
        currency_code: vendor.currency_code,
      }]);
    }
  };

  const handleSave = async (brandName: string) => {
    setSavingBrandId(brandName);
    try {
      await axios.put(`${API_URL}/vendors/brands/vendor`, {
        name: brandName,
        vendor_ids: pendingVendors.map(v => v.contact_id),
      });
      toast.success("Vendors updated");
      setEditingBrandId(null);
      setPendingVendors([]);
      setPanelOpen(false);
      await fetchBrands();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update vendors");
    } finally {
      setSavingBrandId(null);
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Vendor Brand Mapping
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Assign up to {MAX_VENDORS} vendors per brand
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Filter brands..."
            value={brandSearch}
            onChange={e => setBrandSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {brandSearch && (
            <button onClick={() => setBrandSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
            </button>
          )}
        </div>

        <div className={TABLE_CLASSES.container}>
          {loading ? (
            <LoadingState message="Loading brands..." />
          ) : filteredBrands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-600">
              <Package className="w-10 h-10 mb-3" />
              <p className="text-sm">{brandSearch ? "No brands match your filter" : "No brands found"}</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className={TABLE_CLASSES.table}>
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                  <tr>
                    <th className={TABLE_CLASSES.th} style={{ width: "30%" }}>Brand Name</th>
                    <th className={TABLE_CLASSES.th} style={{ width: "50%" }}>Vendors</th>
                    <th className={TABLE_CLASSES.th} style={{ width: "20%" }}></th>
                  </tr>
                </thead>
                <tbody className={TABLE_CLASSES.tbody}>
                  {filteredBrands.map((brand) => {
                    const isEditing = editingBrandId === brand.name;
                    const isSaving = savingBrandId === brand.name;

                    return (
                      <tr key={brand._id} className={TABLE_CLASSES.tr}>
                        <td className={TABLE_CLASSES.td}>
                          <span className={TABLE_CLASSES.tdTextMedium}>{brand.name}</span>
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {pendingVendors.map(v => (
                                <span
                                  key={v.contact_id}
                                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                  {v.contact_name}
                                  {v.currency_code && (
                                    <span className="text-blue-500 dark:text-blue-500 opacity-70">{v.currency_code}</span>
                                  )}
                                  <button
                                    onClick={() => setPendingVendors(prev => prev.filter(p => p.contact_id !== v.contact_id))}
                                    className="ml-0.5 hover:text-red-500 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              {pendingVendors.length < MAX_VENDORS && (
                                <button
                                  ref={addBtnRef}
                                  onClick={openPanel}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-zinc-400 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Plus className="w-3 h-3" /> Add
                                </button>
                              )}
                              {pendingVendors.length === 0 && (
                                <span className="text-xs text-zinc-400 italic">No vendors assigned</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {brand.vendors?.length > 0 ? (
                                brand.vendors.map(v => (
                                  <span
                                    key={v.contact_id}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                  >
                                    {v.contact_name}
                                    {v.currency_code && (
                                      <span className="opacity-60">{v.currency_code}</span>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-400 dark:text-zinc-600">Unassigned</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleSave(brand.name)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
                              >
                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => enterEdit(brand)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          {filteredBrands.length} of {brands.length} brand{brands.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Floating vendor search panel — opens above or below depending on viewport space */}
      {panelOpen && panelAnchor && (
        <div
          ref={floatingRef}
          style={{
            position: "fixed",
            top: panelAnchor.top,
            bottom: panelAnchor.bottom,
            left: panelAnchor.left,
            zIndex: 50,
          }}
          className="w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg"
        >
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search vendor..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {vendorLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            ) : vendorResults.length === 0 ? (
              <div className="px-3 py-3 text-sm text-zinc-400 text-center">No vendors found</div>
            ) : (
              vendorResults.map((vendor) => {
                const selected = pendingVendors.some(v => v.contact_id === (vendor.contact_id || vendor.vendor_id));
                return (
                  <button
                    key={vendor.vendor_id || vendor.contact_id}
                    onClick={() => toggleVendor(vendor)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                      selected
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>{vendor.contact_name}</span>
                    {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
