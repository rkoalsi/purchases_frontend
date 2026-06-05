'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from 'react-toastify';
import { Package, Loader2, Search, X, Pencil, Plus, Check, Tags, Trash2 } from "lucide-react";
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

  // New brand modal
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);

  // Rename state
  const [renamingBrandId, setRenamingBrandId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const newBrandInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (showNewBrandModal) {
      setTimeout(() => newBrandInputRef.current?.focus(), 50);
    }
  }, [showNewBrandModal]);

  useEffect(() => {
    if (renamingBrandId) {
      setTimeout(() => renameInputRef.current?.focus(), 50);
    }
  }, [renamingBrandId]);

  // Close vendor panel on outside click
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

  // Close vendor panel on scroll
  useEffect(() => {
    if (!panelOpen) return;
    const handler = () => setPanelOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [panelOpen]);

  const enterEdit = (brand: Brand) => {
    setEditingBrandId(brand._id);
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
    const cid = vendor.contact_id || vendor.vendor_id;
    const alreadyIn = pendingVendors.some(v => v.contact_id === cid);
    if (alreadyIn) {
      setPendingVendors(prev => prev.filter(v => v.contact_id !== cid));
    } else {
      if (pendingVendors.length >= MAX_VENDORS) {
        toast.warning(`Maximum ${MAX_VENDORS} vendors per brand`);
        return;
      }
      setPendingVendors(prev => [...prev, {
        contact_id: cid,
        contact_name: vendor.contact_name,
        currency_code: vendor.currency_code,
      }]);
    }
  };

  const handleSave = async (brand: Brand) => {
    setSavingBrandId(brand._id);
    try {
      await axios.put(`${API_URL}/vendors/brands/vendor`, {
        name: brand.name,
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

  const handleRename = async (brand: Brand) => {
    const name = renameValue.trim();
    if (!name || name === brand.name) { setRenamingBrandId(null); return; }
    setSavingRename(true);
    try {
      await axios.patch(`${API_URL}/vendors/brands/${brand._id}`, { name });
      toast.success(`Renamed to "${name}"`);
      setRenamingBrandId(null);
      await fetchBrands();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to rename brand");
    } finally {
      setSavingRename(false);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!confirm(`Delete brand "${brand.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/vendors/brands/${brand._id}`);
      toast.success(`Brand "${brand.name}" deleted`);
      await fetchBrands();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete brand");
    }
  };

  const handleCreateBrand = async () => {
    const name = newBrandName.trim();
    if (!name) return;
    setCreatingBrand(true);
    try {
      const res = await axios.post(`${API_URL}/vendors/brands`, { name });
      toast.success(`Brand "${name}" created`);
      setShowNewBrandModal(false);
      setNewBrandName("");
      await fetchBrands();
      // Enter edit mode for the new brand so user can add vendors right away
      const newBrand: Brand = { _id: res.data._id, name: res.data.name, vendors: [] };
      setEditingBrandId(res.data._id);
      setPendingVendors([]);
      // Scroll to the brand after a short delay for render
      setTimeout(() => {
        document.getElementById(`brand-row-${res.data._id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to create brand";
      toast.error(msg);
    } finally {
      setCreatingBrand(false);
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Tags className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Vendor Brand Mapping
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Assign up to {MAX_VENDORS} vendors per brand
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowNewBrandModal(true); setNewBrandName(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Brand
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 space-y-4">
        {/* Search + count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter brands..."
              value={brandSearch}
              onChange={e => setBrandSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {brandSearch && (
              <button onClick={() => setBrandSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
              </button>
            )}
          </div>
          {!loading && (
            <span className="text-xs text-zinc-400 dark:text-zinc-600 shrink-0">
              {filteredBrands.length}{brands.length !== filteredBrands.length ? ` of ${brands.length}` : ""} brand{brands.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className={TABLE_CLASSES.container}>
          {loading ? (
            <LoadingState message="Loading brands..." />
          ) : filteredBrands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-zinc-600">
              <Package className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {brandSearch ? "No brands match your filter" : "No brands yet"}
              </p>
              {!brandSearch && (
                <button
                  onClick={() => { setShowNewBrandModal(true); setNewBrandName(""); }}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Create your first brand
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className={TABLE_CLASSES.table}>
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                  <tr>
                    <th className={TABLE_CLASSES.th} style={{ width: "28%" }}>Brand</th>
                    <th className={TABLE_CLASSES.th} style={{ width: "55%" }}>Vendors</th>
                    <th className={TABLE_CLASSES.th} style={{ width: "17%" }}></th>
                  </tr>
                </thead>
                <tbody className={TABLE_CLASSES.tbody}>
                  {filteredBrands.map((brand) => {
                    const isEditing = editingBrandId === brand._id;
                    const isSaving = savingBrandId === brand._id;

                    return (
                      <tr key={brand._id} id={`brand-row-${brand._id}`} className={TABLE_CLASSES.tr}>
                        {/* Brand name */}
                        <td className={TABLE_CLASSES.td}>
                          {renamingBrandId === brand._id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                ref={renameInputRef}
                                type="text"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleRename(brand);
                                  if (e.key === "Escape") setRenamingBrandId(null);
                                }}
                                className="flex-1 min-w-0 px-2 py-1 text-sm border border-blue-400 dark:border-blue-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleRename(brand)}
                                disabled={savingRename}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
                                title="Save name"
                              >
                                {savingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setRenamingBrandId(null)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group/name">
                              <span className={TABLE_CLASSES.tdTextMedium}>{brand.name}</span>
                              <button
                                onClick={() => { setRenamingBrandId(brand._id); setRenameValue(brand.name); }}
                                className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
                                title="Rename brand"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Vendors cell */}
                        <td className={TABLE_CLASSES.td}>
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {pendingVendors.map(v => (
                                <span
                                  key={v.contact_id}
                                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                  {v.contact_name}
                                  {v.currency_code && (
                                    <span className="text-blue-500 opacity-60 text-[10px] font-normal ml-0.5">{v.currency_code}</span>
                                  )}
                                  <button
                                    onClick={() => setPendingVendors(prev => prev.filter(p => p.contact_id !== v.contact_id))}
                                    className="ml-0.5 p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                              {pendingVendors.length < MAX_VENDORS && (
                                <button
                                  ref={addBtnRef}
                                  onClick={openPanel}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-zinc-400 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Plus className="w-3 h-3" /> Add vendor
                                </button>
                              )}
                              {pendingVendors.length === 0 && (
                                <span className="text-xs text-zinc-400 italic">No vendors — click Add vendor</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {brand.vendors?.length > 0 ? (
                                brand.vendors.map(v => (
                                  <span
                                    key={v.contact_id}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                  >
                                    {v.contact_name}
                                    {v.currency_code && (
                                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">{v.currency_code}</span>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">Unassigned</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className={TABLE_CLASSES.td}>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleSave(brand)}
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
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => enterEdit(brand)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              {(!brand.vendors || brand.vendors.length === 0) && (
                                <button
                                  onClick={() => handleDeleteBrand(brand)}
                                  className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Delete brand"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
      </div>

      {/* Floating vendor search panel */}
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
          className="w-68 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl"
        >
          <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search vendors..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {vendorLoading ? (
              <div className="flex items-center justify-center py-5">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            ) : vendorResults.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-400 text-center">No vendors found</div>
            ) : (
              vendorResults.map((vendor) => {
                const cid = vendor.contact_id || vendor.vendor_id;
                const selected = pendingVendors.some(v => v.contact_id === cid);
                return (
                  <button
                    key={vendor.vendor_id || cid}
                    onClick={() => toggleVendor(vendor)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                      selected
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="truncate">{vendor.contact_name}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {vendor.currency_code && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{vendor.currency_code}</span>
                      )}
                      {selected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {pendingVendors.length >= MAX_VENDORS && (
            <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-amber-600 dark:text-amber-400 text-center">
              Max {MAX_VENDORS} vendors reached
            </div>
          )}
        </div>
      )}

      {/* New Brand Modal */}
      {showNewBrandModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewBrandModal(false); setNewBrandName(""); } }}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Tags className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">New Brand</h2>
              </div>
              <button
                onClick={() => { setShowNewBrandModal(false); setNewBrandName(""); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={newBrandInputRef}
                type="text"
                placeholder="e.g. Truelove"
                value={newBrandName}
                onChange={e => setNewBrandName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newBrandName.trim()) handleCreateBrand(); }}
                className="w-full px-3 py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
                After creating, you can immediately assign vendors to this brand.
              </p>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                onClick={() => { setShowNewBrandModal(false); setNewBrandName(""); }}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBrand}
                disabled={!newBrandName.trim() || creatingBrand}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {creatingBrand ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create Brand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
