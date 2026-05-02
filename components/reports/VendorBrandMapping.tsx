'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from 'react-toastify';
import { Package, ChevronDown, Loader2, Search, X, Pencil } from "lucide-react";
import axios from "axios";
import { TABLE_CLASSES, LoadingState } from "./TableStyles";

interface Brand {
  _id: string;
  name: string;
  vendor_id: string | null;
  vendor_name: string | null;
}

interface Vendor {
  vendor_id: string;
  contact_name: string;
}

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

  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number } | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownVendors, setDropdownVendors] = useState<Vendor[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [updatingBrandId, setUpdatingBrandId] = useState<string | null>(null);

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const floatingRef = useRef<HTMLDivElement>(null);
  const debouncedDropdownSearch = useDebounce(dropdownSearch, 300);

  const closeDropdown = useCallback(() => {
    setExpandedDropdown(null);
    setDropdownSearch("");
    setDropdownAnchor(null);
  }, []);

  const cancelEdit = useCallback(() => {
    closeDropdown();
    setEditingBrandId(null);
  }, [closeDropdown]);

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
    setDropdownLoading(true);
    try {
      const params: Record<string, any> = { page: 1, page_size: 50 };
      if (search) params.search = search;
      const res = await axios.get(`${API_URL}/vendors`, { params });
      setDropdownVendors(res.data.vendors || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to fetch vendors.');
      setDropdownVendors([]);
    } finally {
      setDropdownLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrands(); }, []);

  useEffect(() => {
    if (expandedDropdown !== null) fetchVendors(debouncedDropdownSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDropdownSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = expandedDropdown && buttonRefs.current[expandedDropdown]?.contains(target);
      const inFloating = floatingRef.current?.contains(target);
      if (!inButton && !inFloating) closeDropdown();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedDropdown, closeDropdown]);

  // Close on scroll so the fixed dropdown doesn't drift
  useEffect(() => {
    if (!expandedDropdown) return;
    const handler = () => closeDropdown();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [expandedDropdown, closeDropdown]);

  const openDropdown = (brandId: string) => {
    if (expandedDropdown === brandId) {
      closeDropdown();
      return;
    }
    const btn = buttonRefs.current[brandId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownAnchor({ top: rect.bottom + 4, left: rect.left });
    }
    setExpandedDropdown(brandId);
    setDropdownSearch("");
    fetchVendors("");
  };

  const handleVendorChange = async (brandId: string, vendorId: string | null) => {
    setUpdatingBrandId(brandId);
    try {
      await axios.put(`${API_URL}/vendors/brands/vendor`, {
        name: brandId,
        vendor_id: vendorId || null,
      });
      toast.success("Vendor updated successfully");
      closeDropdown();
      setEditingBrandId(null);
      await fetchBrands();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update vendor assignment");
    } finally {
      setUpdatingBrandId(null);
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const activeBrand = brands.find(b => b.name === expandedDropdown) ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Vendor Brand Mapping
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Assign vendors to your brands
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Brand filter */}
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

        {/* Table */}
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
                    <th className={TABLE_CLASSES.th} style={{ width: "35%" }}>Brand Name</th>
                    <th className={TABLE_CLASSES.th} style={{ width: "40%" }}>Vendor</th>
                    <th className={TABLE_CLASSES.th} style={{ width: "25%" }}></th>
                  </tr>
                </thead>
                <tbody className={TABLE_CLASSES.tbody}>
                  {filteredBrands.map((brand) => {
                    const brandId = brand.name;
                    const isEditing = editingBrandId === brandId;
                    const isOpen = expandedDropdown === brandId;
                    const isUpdating = updatingBrandId === brandId;

                    return (
                      <tr key={brandId} className={TABLE_CLASSES.tr}>
                        <td className={TABLE_CLASSES.td}>
                          <span className={TABLE_CLASSES.tdTextMedium}>{brand.name}</span>
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {isEditing ? (
                            <button
                              ref={el => { buttonRefs.current[brandId] = el; }}
                              onClick={() => openDropdown(brandId)}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors min-w-[160px] justify-between"
                            >
                              <span className="truncate">{brand.vendor_name || "Select vendor"}</span>
                              {isUpdating
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                : <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              }
                            </button>
                          ) : (
                            brand.vendor_name ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                {brand.vendor_name}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400 dark:text-zinc-600">Unassigned</span>
                            )
                          )}
                        </td>
                        <td className={TABLE_CLASSES.td}>
                          {isEditing ? (
                            <button
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingBrandId(brandId)}
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

      {/* Floating dropdown — rendered outside scroll container to avoid clipping */}
      {expandedDropdown && dropdownAnchor && activeBrand && (
        <div
          ref={floatingRef}
          style={{ position: "fixed", top: dropdownAnchor.top, left: dropdownAnchor.left, zIndex: 50 }}
          className="w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg"
        >
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search vendor..."
                value={dropdownSearch}
                onChange={e => setDropdownSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {dropdownLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleVendorChange(expandedDropdown, null)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800"
                >
                  Remove vendor
                </button>
                {dropdownVendors.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-zinc-400 text-center">No vendors found</div>
                ) : (
                  dropdownVendors.map((vendor) => (
                    <button
                      key={vendor.vendor_id}
                      onClick={() => handleVendorChange(expandedDropdown, vendor.vendor_id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        activeBrand.vendor_id === vendor.vendor_id
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {vendor.contact_name}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
