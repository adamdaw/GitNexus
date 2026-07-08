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

import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { apexMethodConfig } from './method-config.js';

export function normalizeApexParamType(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Extract Apex arity metadata from a method-like tree-sitter node —
 * `method_declaration` or `constructor_declaration`.
 *
 * Mirrors `languages/java/arity-metadata.ts:computeJavaArityMetadata`, reusing
 * `apexMethodConfig.extractParameters` so scope-extracted defs carry the same
 * arity semantics as the WI-1 parse path. Apex user methods take no
 * optional/default-valued parameters and no user varargs (SDD-002 A-WI2-1), so
 * `parameterCount === requiredParameterCount` in practice; the varargs branch is
 * preserved for structural fidelity (it stays inert because the Apex parameter
 * extractor always reports `isVariadic === false`).
 */
export interface ApexArityMetadata {
  readonly parameterCount: number | undefined;
  readonly requiredParameterCount: number | undefined;
  readonly parameterTypes: readonly string[] | undefined;
}

export function computeApexArityMetadata(fnNode: SyntaxNode): ApexArityMetadata {
  const params = apexMethodConfig.extractParameters?.(fnNode) ?? [];

  let hasVariadic = false;
  const types: string[] = [];
  for (const p of params) {
    if (p.isVariadic) hasVariadic = true;
    // Fold the declared param type (Apex case-insensitivity) so overload
    // narrowing compares argument and parameter types case-insensitively
    // (the argument side is folded symmetrically in captures.ts).
    if (p.type !== null) types.push(normalizeApexParamType(p.type));
  }
  if (hasVariadic) types.push('varargs');

  const total = params.length;
  const fixedCount = params.filter((p) => !p.isVariadic).length;
  const parameterCount = hasVariadic ? undefined : total;
  const requiredParameterCount = hasVariadic ? fixedCount : total;

  return {
    parameterCount,
    requiredParameterCount,
    parameterTypes: types.length > 0 ? types : undefined,
  };
}
