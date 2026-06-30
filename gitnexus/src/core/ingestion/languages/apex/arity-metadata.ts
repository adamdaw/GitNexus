/**
 * Apex param-type normalization for overload comparison (SDD-002 §3, WI-2).
 *
 * Apex identifiers and type names are case-insensitive, so two overloads whose
 * parameter types differ only in case denote the same type and a call must
 * compare them equal. This is the SAME language-local pattern C++ uses
 * (`languages/cpp/arity-metadata.ts:normalizeCppParamType`): each language
 * normalizes its OWN param-type comparison strings before the shared
 * overload-narrowing pass consumes them — no shared seam, names no language
 * (Constitution §2.1 preserved).
 *
 * Apex's transform is a case-fold (Apex case-insensitivity) with surrounding
 * whitespace trimmed (the comparison-symmetry invariant, SDD-002 §2 REQ-008:
 * the argument-side token and the declared `formal_parameter.type` segment must
 * render identically). Generic structure is PRESERVED — unlike C++'s
 * template-stripping — so `List<Account>` and `List<Contact>` stay distinct
 * (they are the two separate nodes WI-1 already emits). Node ids are untouched;
 * this folds only the overload-comparison string.
 */
export function normalizeApexParamType(raw: string): string {
  return raw.trim().toLowerCase();
}
