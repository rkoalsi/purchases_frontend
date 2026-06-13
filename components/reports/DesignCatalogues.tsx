'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ChevronDown, ExternalLink, Pencil, Plus, ToggleLeft, ToggleRight, Upload, X } from 'lucide-react';
import { useAuth } from '@/components/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Catalogue {
  _id: string;
  name: string;
  brands?: string[];
  image_url: string;
  is_active: boolean;
  created_at?: string;
}

const EMPTY_FORM = { name: '', brands: [] as string[], image_url: '' };

function mergeBrands(raw: string[]): string[] {
  const hasPetfest = raw.some(
    (b) => b.toLowerCase() === 'dogfest' || b.toLowerCase() === 'catfest'
  );
  const filtered = raw.filter(
    (b) => b.toLowerCase() !== 'dogfest' && b.toLowerCase() !== 'catfest'
  );
  if (hasPetfest) filtered.push('Petfest');
  return filtered.sort((a, b) => a.localeCompare(b));
}

// Expanding "Petfest" back to Dogfest + Catfest when saving so existing order-form data keeps working
function expandPetfest(selected: string[], allRaw: string[]): string[] {
  if (!selected.includes('Petfest')) return selected;
  const expanded = selected.filter((b) => b !== 'Petfest');
  if (allRaw.some((b) => b.toLowerCase() === 'dogfest')) expanded.push('Dogfest');
  if (allRaw.some((b) => b.toLowerCase() === 'catfest')) expanded.push('Catfest');
  return expanded;
}

// When loading a catalogue that has Dogfest/Catfest, collapse them to Petfest for display
function collapsePetfest(brands: string[]): string[] {
  const hasPetfest = brands.some(
    (b) => b.toLowerCase() === 'dogfest' || b.toLowerCase() === 'catfest'
  );
  const filtered = brands.filter(
    (b) => b.toLowerCase() !== 'dogfest' && b.toLowerCase() !== 'catfest'
  );
  if (hasPetfest) filtered.push('Petfest');
  return filtered;
}

interface BrandMultiSelectProps {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}

function BrandMultiSelect({ options, value, onChange }: BrandMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (brand: string) => {
    onChange(value.includes(brand) ? value.filter((b) => b !== brand) : [...value, brand]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[38px] flex items-center justify-between gap-2 border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {value.length === 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">— Select brands —</span>
          ) : (
            value.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
              >
                {b}
                <span
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggle(b)}
                  onClick={(e) => { e.stopPropagation(); toggle(b); }}
                  className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-auto max-h-52">
          {options.map((b) => (
            <label
              key={b}
              className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="checkbox"
                checked={value.includes(b)}
                onChange={() => toggle(b)}
                className="accent-indigo-600 w-4 h-4"
              />
              {b}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DesignCatalogues() {
  const { accessToken } = useAuth();
  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [rawBrands, setRawBrands] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Catalogue | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCatalogues = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/design/brand-catalogues`, {
        headers: authHeaders(),
        params: { limit: 200 },
      });
      setCatalogues(data.catalogues);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load catalogues');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchBrands = useCallback(async () => {
    try {
      const { data } = await axios.get<Record<string, string[]>>(
        `${API_URL}/design/vendor-brands`,
        { headers: authHeaders() }
      );
      const flat = Array.from(new Set(Object.values(data).flat()));
      setRawBrands(flat);
      setBrandOptions(mergeBrands(flat));
    } catch {
      // non-critical
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchCatalogues();
    fetchBrands();
  }, [fetchCatalogues, fetchBrands]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (cat: Catalogue) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      brands: collapsePetfest(cat.brands ?? []),
      image_url: cat.image_url,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API_URL}/design/brand-catalogues/upload`, fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setForm((p) => ({ ...p, image_url: data.file_url }));
      toast.success('PDF uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.image_url) { toast.error('Please upload a PDF first'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        brands: expandPetfest(form.brands, rawBrands),
        image_url: form.image_url,
        is_active: true,
      };
      if (editing) {
        await axios.put(`${API_URL}/design/brand-catalogues/${editing._id}`, payload, { headers: authHeaders() });
        toast.success('Catalogue updated');
      } else {
        await axios.post(`${API_URL}/design/brand-catalogues`, payload, { headers: authHeaders() });
        toast.success('Catalogue created');
      }
      closeModal();
      fetchCatalogues();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cat: Catalogue) => {
    try {
      await axios.delete(`${API_URL}/design/brand-catalogues/${cat._id}`, { headers: authHeaders() });
      setCatalogues((prev) =>
        prev.map((c) => (c._id === cat._id ? { ...c, is_active: !c.is_active } : c))
      );
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Brand Catalogues</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {total} catalogue{total !== 1 ? 's' : ''} — shared with the order form
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Catalogue
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : catalogues.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 dark:text-zinc-600 text-sm">No catalogues yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800/60">
              <tr>
                {['Name', 'Brands', 'PDF', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              {catalogues.map((cat) => (
                <tr key={cat._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{cat.name}</td>
                  <td className="px-4 py-3">
                    {cat.brands && cat.brands.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {collapsePetfest(cat.brands).map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {cat.image_url ? (
                      <a
                        href={cat.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium transition-colors"
                      >
                        View PDF <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cat.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(cat)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          cat.is_active
                            ? 'text-green-500 hover:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            : 'text-zinc-400 hover:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        title={cat.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {cat.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {editing ? 'Edit Catalogue' : 'Add Catalogue'}
              </h2>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Truelove Summer 2025"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Brands multi-select */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Brands
                </label>
                <BrandMultiSelect
                  options={brandOptions}
                  value={form.brands}
                  onChange={(v) => setForm((p) => ({ ...p, brands: v }))}
                />
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  PDF File <span className="text-red-500">*</span>
                </label>
                {form.image_url ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <a
                      href={form.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-green-700 dark:text-green-400 font-medium truncate hover:underline"
                    >
                      PDF uploaded — view
                    </a>
                    <button
                      onClick={() => setForm((p) => ({ ...p, image_url: '' }))}
                      className="text-green-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg py-4 text-sm text-zinc-500 dark:text-zinc-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Click to upload PDF
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
