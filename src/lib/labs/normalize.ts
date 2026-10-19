/**
 * Dedup/match key for a lab test name: lowercase and strip everything that
 * isn't a letter or digit (unicode-aware), so trivial formatting variants of
 * the SAME test collapse — "Acid/U" == "Acid/U.", "x – y" (en-dash) == "x - y",
 * stray spaces, etc. Genuinely different names stay distinct because their extra
 * words/numbers survive (e.g. "…VGKC" ≠ "…VGKC, CSF", "Anti-Hu" ≠ "Anti-Hu CSF").
 * Falls back to the lowercased name if stripping leaves nothing.
 *
 * Shared by the scrape dedup ({@link file://./run-scrape.ts}) and the lab-test
 * lookup/export tools so "the same test" means the same thing everywhere.
 */
export function normalizeTestKey(name: string): string {
  const stripped = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  return stripped.length > 0 ? stripped : name.trim().toLowerCase()
}
