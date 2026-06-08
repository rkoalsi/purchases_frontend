// Brands that are constituent sub-brands and should be merged into a single
// display entry throughout the app. Add new groups here — nowhere else.
export const BRAND_GROUPS: Record<string, string[]> = {
  Petfest: ['Catfest', 'Dogfest'],
  'Barkbutler / FOFOS': ['Barkbutler', 'FOFOS'],
};

// Lowercase set of all constituent brand names (fast membership test).
export const BRAND_CONSTITUENTS = new Set(
  Object.values(BRAND_GROUPS).flat().map((s) => s.toLowerCase())
);

/**
 * Given a flat list of { value, label } brand options (as returned by
 * /zoho/brands), filters out constituent brands and inserts a merged entry
 * for each group that has at least one constituent present.
 * Returns a sorted list ready for a dropdown.
 */
export function mergeBrandOptions(
  raw: { value: string; label: string }[]
): { value: string; label: string }[] {
  const merged = raw.filter((b) => !BRAND_CONSTITUENTS.has(b.value.toLowerCase()));

  for (const [group, members] of Object.entries(BRAND_GROUPS)) {
    if (members.some((m) => raw.some((b) => b.value.toLowerCase() === m.toLowerCase()))) {
      merged.push({ value: group, label: group });
    }
  }

  return merged.sort((a, b) => a.label.localeCompare(b.label));
}
